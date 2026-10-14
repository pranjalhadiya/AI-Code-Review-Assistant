import os
from typing import Literal 
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func 
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.review import Review
from app.models.review_finding import ReviewFinding
from app.schemas.review_schema import ReviewResponse, SourceCodeResponse, ReanalyzeRequest, ReviewListItem
from app.utils.file_validation import validate_upload        
from app.utils.file_storage import overwrite_stored_file, delete_stored_file   
from app.services.auth_service import get_current_user
from app.services.pylint_service import (
    run_pylint,
    parse_pylint_findings,
    convert_score_to_100,
    compute_combined_score,
    compute_static_score_from_findings,
)
from app.services.bandit_service import run_bandit, parse_bandit_findings
from app.services.radon_service import run_radon, parse_radon_findings
from app.services.c_service import run_cppcheck, parse_cppcheck_findings
from app.services.java_service import run_pmd, parse_pmd_findings
from app.services.ai_service import (
    AIServiceError,
    run_ai_review,
    parse_ai_findings,
    get_ai_score,
    blend_scores,
    truncate_text,
    AI_SUMMARY_MAX_LENGTH,
)
from app.services.finding_merge_service import merge_static_and_ai_findings  
from app.utils.language_detection import detect_language, EXTENSION_TO_LANGUAGE


router = APIRouter(
    prefix="/review",
    tags=["Review"]
)

LANGUAGE_FILE_SUFFIX = {language: ext for ext, language in EXTENSION_TO_LANGUAGE.items()}

SORT_ORDERINGS = {
    "newest": (Review.created_at.desc(), Review.id.desc()),
    "oldest": (Review.created_at.asc(), Review.id.asc()),
    "score_desc": (Review.review_score.desc().nulls_last(), Review.created_at.desc(), Review.id.desc()),
    "score_asc": (Review.review_score.asc().nulls_last(), Review.created_at.desc(), Review.id.desc()),
    "name": (func.lower(Project.project_name).asc(), Review.created_at.desc(), Review.id.desc()),
}



@router.get("/", response_model=list[ReviewListItem])
def list_reviews(
    search: str | None = Query(None, max_length=100),
    language: Literal["python", "c", "java"] | None = None,
    score: Literal["good", "needs_improvement", "poor"] | None = None,
    sort: Literal["newest", "oldest", "score_desc", "score_asc", "name"] = "newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """The logged-in user's reviews, newest first by default, with optional search, filters, and sort."""
    query = (
        db.query(Review, Project)
        .join(Project, Review.project_id == Project.id)
        .filter(Project.user_id == current_user.id)   # Only this user's reviews, enforced in SQL.
    )

    if search and search.strip():
        query = query.filter(Project.project_name.icontains(search.strip(), autoescape=True))

    if language:
        query = query.filter(func.lower(Project.file_path).endswith(LANGUAGE_FILE_SUFFIX[language]))

    if score == "good":
        query = query.filter(Review.review_score >= 80)
    elif score == "needs_improvement":
        query = query.filter(Review.review_score >= 50, Review.review_score < 80)
    elif score == "poor":
        query = query.filter(Review.review_score < 50)


    rows = query.order_by(*SORT_ORDERINGS[sort]).all()

    review_ids = [review.id for review, _ in rows]
    counts_by_review: dict[int, dict[str, int]] = {}
    if review_ids:
        grouped = (
            db.query(ReviewFinding.review_id, ReviewFinding.severity, func.count(ReviewFinding.id))
            .filter(ReviewFinding.review_id.in_(review_ids))
            .group_by(ReviewFinding.review_id, ReviewFinding.severity)
            .all()
        )
        for review_id, severity, count in grouped:
            counts_by_review.setdefault(review_id, {})[severity] = count

    return [
        ReviewListItem(
            id=review.id,
            project_id=project.id,
            project_name=project.project_name,
            language=detect_language(project.file_path),
            review_score=review.review_score,
            high_count=counts_by_review.get(review.id, {}).get("High", 0),
            medium_count=counts_by_review.get(review.id, {}).get("Medium", 0),
            low_count=counts_by_review.get(review.id, {}).get("Low", 0),
            created_at=review.created_at,
        )
        for review, project in rows
    ]

@router.post(
    "/{project_id}/analyze",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED
)
def analyze_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this project."
        )

    language = detect_language(project.file_path)

    if language is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine the programming language of this file."
        )

    is_python = language == "python"
    is_c = language == "c"
    is_java = language == "java"

    pylint_findings = []
    raw_pylint_score = 0.0
    pylint_failed = False

    if is_python:
        try:
            raw_pylint_findings, raw_pylint_score = run_pylint(project.file_path)
            pylint_findings = parse_pylint_findings(raw_pylint_findings)
        except Exception as e:
            print(f"Pylint analysis failed for project {project.id}: {e}")
            pylint_failed = True

    bandit_findings = []
    bandit_failed = False

    if is_python:
        try:
            raw_bandit_findings = run_bandit(project.file_path)
            bandit_findings = parse_bandit_findings(raw_bandit_findings)
        except Exception as e:
            print(f"Bandit analysis failed for project {project.id}: {e}")
            bandit_failed = True

    radon_findings = []
    radon_failed = False
    maintainability_index = None
    lines_of_code = None
    function_count = None
    class_count = None

    if is_python:
        try:
            radon_output = run_radon(project.file_path)
            radon_findings = parse_radon_findings(radon_output, project.file_path)
            maintainability_index = radon_output["maintainability_index"]
            lines_of_code = radon_output["raw_metrics"].loc
            function_count = len([
                item for item in radon_output["complexity_results"]
                if type(item).__name__ == "Function" and item.classname is None
            ])
            class_count = len([
                item for item in radon_output["complexity_results"]
                if type(item).__name__ == "Class"
            ])
        except Exception as e:
            print(f"Radon analysis failed for project {project.id}: {e}")
            radon_failed = True

    c_findings = []
    c_failed = False

    if is_c:
        try:
            raw_c_findings = run_cppcheck(project.file_path)
            c_findings = parse_cppcheck_findings(raw_c_findings)
        except Exception as e:
            print(f"Cppcheck analysis failed for project {project.id}: {e}")
            c_failed = True

    java_findings = []
    java_failed = False

    if is_java:
        try:
            raw_java_findings = run_pmd(project.file_path)
            java_findings = parse_pmd_findings(raw_java_findings)
        except Exception as e:
            print(f"PMD analysis failed for project {project.id}: {e}")
            java_failed = True

    ai_findings = []
    ai_score = None
    ai_summary = None
    ai_error = None
    try:
        ai_review = run_ai_review(project.file_path, language)
        ai_findings = parse_ai_findings(ai_review, project.file_path)
        ai_score = get_ai_score(ai_review)
        ai_summary = truncate_text(ai_review.summary.strip(), AI_SUMMARY_MAX_LENGTH)
    except AIServiceError as e:
        print(f"AI review unavailable for project {project.id}: {e}")
        ai_error = str(e)
    except Exception as e:
        print(f"AI review failed unexpectedly for project {project.id}: {e}")
        ai_error = "The AI review failed unexpectedly."

    ai_failed = ai_error is not None

    if is_python:
        nothing_worked = pylint_failed and bandit_failed and radon_failed and ai_failed
    elif is_c:
        nothing_worked = c_failed and ai_failed
    elif is_java:
        nothing_worked = java_failed and ai_failed
    else:
        nothing_worked = ai_failed

    if nothing_worked:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="All analysis tools failed to process this file. It may be corrupted or contain invalid syntax."
        )

    tagged_static_findings = (
        [("Pylint", f) for f in pylint_findings]
        + [("Bandit", f) for f in bandit_findings]
        + [("Radon", f) for f in radon_findings]
        + [("Cppcheck", f) for f in c_findings]
        + [("PMD", f) for f in java_findings]
    )

    all_findings = merge_static_and_ai_findings(tagged_static_findings, ai_findings)

    if is_python:
        if pylint_failed:
            static_score = None
        else:
            pylint_base_score = convert_score_to_100(raw_pylint_score)
            static_score = compute_combined_score(pylint_base_score, bandit_findings, radon_findings)
    elif is_c:
        static_score = None if c_failed else compute_static_score_from_findings(100.0, c_findings)
    elif is_java:
        static_score = None if java_failed else compute_static_score_from_findings(100.0, java_findings)
    else:
        static_score = None

    final_score = blend_scores(static_score, ai_score)
    print(f"Scores for project {project.id} ({language}): static={static_score}, ai={ai_score}, final={final_score}")


    if is_python:
        summary_parts = [
            f"{len(pylint_findings)} code quality issue(s)" if not pylint_failed else "code quality scan failed",
            f"{len(bandit_findings)} security issue(s)" if not bandit_failed else "security scan failed",
            f"{len(radon_findings)} complexity issue(s)" if not radon_failed else "complexity scan failed",
            f"{len(ai_findings)} AI finding(s)" if not ai_failed else f"AI review unavailable ({ai_error.rstrip('.')})",
        ]
    elif is_c:
        summary_parts = [
            f"{len(c_findings)} static analysis issue(s)" if not c_failed else "static analysis scan failed",
            f"{len(ai_findings)} AI finding(s)" if not ai_failed else f"AI review unavailable ({ai_error.rstrip('.')})",
        ]
    elif is_java:
        summary_parts = [
            f"{len(java_findings)} static analysis issue(s)" if not java_failed else "static analysis scan failed",
            f"{len(ai_findings)} AI finding(s)" if not ai_failed else f"AI review unavailable ({ai_error.rstrip('.')})",
        ]
    else:
        summary_parts = [f"{len(ai_findings)} AI finding(s)" if not ai_failed else f"AI review unavailable ({ai_error.rstrip('.')})"]

    summary = "Analysis results: " + ", ".join(summary_parts) + "."

    new_review = Review(
        project_id=project.id,
        review_score=final_score,
        summary=summary,
        maintainability_index=maintainability_index,
        lines_of_code=lines_of_code,
        function_count=function_count,
        class_count=class_count,
        ai_score=ai_score,
        ai_summary=ai_summary,
    )

    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    for finding_data in all_findings:
        finding = ReviewFinding(
            review_id=new_review.id,
            severity=finding_data["severity"],
            issue=finding_data["issue"],
            explanation=finding_data["explanation"],
            suggestion=finding_data["suggestion"],
            file_name=finding_data["file_name"],
            line_number=finding_data["line_number"],
            category=finding_data.get("category"),              
            source=finding_data.get("source"),                  
            technical_details=finding_data.get("technical_details"),  
        )
        db.add(finding)

    db.commit()
    db.refresh(new_review)

    return new_review


@router.get(
    "/{review_id}",
    response_model=ReviewResponse
)
def get_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    review = db.query(Review).filter(Review.id == review_id).first()

    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    if review.project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this review."
        )

    return review

@router.get(
    "/{review_id}/source",
    response_model=SourceCodeResponse
)
def get_review_source(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    review = db.query(Review).filter(Review.id == review_id).first()

    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    if review.project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this review."
        )

    language = detect_language(review.project.file_path)


    try:
        with open(review.project.file_path, "r", encoding="utf-8", errors="ignore") as f:
            source_code = f.read()

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The source file for this review could no longer be found on the server."
        )

    return SourceCodeResponse(
        file_name=review.project.project_name,
        language=language or "python",  
        source_code=source_code,
    )

def _delete_project_reviews_except(db: Session, project_id: int, keep_ids: set[int]) -> None:
    """
    Deletes every Review of this project whose id is NOT in keep_ids. Uses the ORM (db.delete),
    not a bulk delete, so each review's findings cascade-delete too (Review.findings has
    cascade="all, delete-orphan"). A bulk delete would skip the cascade and hit the foreign key.
    """
    stale_reviews = db.query(Review).filter(
        Review.project_id == project_id,
        Review.id.notin_(list(keep_ids)),
    ).all()
    for stale in stale_reviews:
        db.delete(stale)
    db.commit()


def _rollback_reanalysis(db: Session, project_id: int, file_path: str,
                         original_bytes: bytes, ids_before: set[int]) -> None:
    """
    Puts everything back the way it was before a failed re-analysis. Each step is wrapped
    separately, so a failure while cleaning up can't hide the original error.
    """
    db.rollback()  # Discard anything pending in this session first.

    try:
        overwrite_stored_file(file_path, original_bytes)  # Restore the user's original code.
    except Exception as e:
        print(f"Could not restore original file {file_path}: {e}")

    try:
        _delete_project_reviews_except(db, project_id, ids_before)  # Remove any review this attempt created.
    except Exception as e:
        db.rollback()
        print(f"Could not clean up reviews after failed re-analysis of project {project_id}: {e}")


@router.post(
    "/{review_id}/reanalyze",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED
)
def reanalyze_review(
    review_id: int,
    payload: ReanalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Replace-in-place re-analysis: overwrites the project's stored file with the edited code,
    runs the normal analysis pipeline, and keeps ONLY the new review. On any failure the
    original file and review are restored. No version history is kept.
    """
    old_review = db.query(Review).filter(Review.id == review_id).first()

    if not old_review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    if old_review.project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this review."
        )

    project_id = old_review.project.id
    file_path = old_review.project.file_path

    if not payload.source_code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No code was provided.")

    new_bytes = payload.source_code.encode("utf-8")

    is_valid, message = validate_upload(os.path.basename(file_path), len(new_bytes))
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    try:
        with open(file_path, "rb") as f:
            original_bytes = f.read() 
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The source file for this review could no longer be found on the server."
        )

    ids_before = {row.id for row in db.query(Review.id).filter(Review.project_id == project_id).all()}
  

    overwrite_stored_file(file_path, new_bytes)
   

    try:
        new_review = analyze_project(project_id=project_id, current_user=current_user, db=db)
        
        _delete_project_reviews_except(db, project_id, {new_review.id})
        db.refresh(new_review) 
    except Exception:
        _rollback_reanalysis(db, project_id, file_path, original_bytes, ids_before)
        raise  

    return new_review

@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    review = db.query(Review).filter(Review.id == review_id).first()

    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    if review.project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this review."
        )

    project_id = review.project_id
    file_path = review.project.file_path

    db.delete(review)   
    db.commit()

    file_to_remove = None
    try:
        remaining = db.query(Review.id).filter(Review.project_id == project_id).count()
        if remaining == 0:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project is not None:
                db.delete(project)
                db.commit()
                path_still_used = db.query(Project.id).filter(Project.file_path == file_path).count() > 0
                if not path_still_used:
                    file_to_remove = file_path
    except Exception as e:
        db.rollback()
        print(f"Review {review_id} was deleted, but project cleanup failed: {e}")

    if file_to_remove:
        try:
            delete_stored_file(file_to_remove)
        except Exception as e:
            print(f"Review {review_id} was deleted, but the stored file could not be removed: {e}")

    return None