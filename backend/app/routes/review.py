from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.review import Review
from app.models.review_finding import ReviewFinding
from app.schemas.review_schema import ReviewResponse
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
from app.services.finding_merge_service import merge_static_and_ai_findings  # NEW
from app.utils.language_detection import detect_language


router = APIRouter(
    prefix="/review",
    tags=["Review"]
)


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