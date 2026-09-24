from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.review import Review
from app.models.review_finding import ReviewFinding
from app.schemas.review_schema import ReviewResponse
from app.services.auth_service import get_current_user
from app.services.pylint_service import run_pylint, parse_pylint_findings, convert_score_to_100, compute_combined_score
from app.services.bandit_service import run_bandit, parse_bandit_findings  
from app.services.radon_service import run_radon, parse_radon_findings     


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found."
        )

    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this project."
        )

    pylint_findings = []
    raw_pylint_score = 0.0
    pylint_failed = False

    try:
        raw_pylint_findings, raw_pylint_score = run_pylint(project.file_path)
        pylint_findings = parse_pylint_findings(raw_pylint_findings)
    except Exception as e:
        print(f"Pylint analysis failed for project {project.id}: {e}")
        pylint_failed = True

    bandit_findings = []
    bandit_failed = False

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

    try:
        radon_output = run_radon(project.file_path)
        radon_findings = parse_radon_findings(radon_output, project.file_path)

        maintainability_index = radon_output["maintainability_index"]
       
        lines_of_code = radon_output["raw_metrics"].loc
       
        function_count = len([
            item for item in radon_output["complexity_results"]
            if type(item).__name__ == "Function" and item.classname is None
        ])
       
        class_count = len(set(
            item for item in radon_output["complexity_results"]
            if type(item).__name__ == "Class"
        ))
        
    except Exception as e:
        print(f"Radon analysis failed for project {project.id}: {e}")
        radon_failed = True

    
    if pylint_failed and bandit_failed and radon_failed:
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="All analysis tools failed to process this file. It may be corrupted or contain invalid Python syntax."
        )


    all_findings = pylint_findings + bandit_findings + radon_findings


    if pylint_failed:
        final_score = None
    else:
        pylint_base_score = convert_score_to_100(raw_pylint_score)
        final_score = compute_combined_score(pylint_base_score, bandit_findings, radon_findings)  


    summary_parts = []
    summary_parts.append(
        f"{len(pylint_findings)} code quality issue(s)" if not pylint_failed
        else "code quality scan failed"
    )
    summary_parts.append(
        f"{len(bandit_findings)} security issue(s)" if not bandit_failed
        else "security scan failed"
    )
    summary_parts.append(
        f"{len(radon_findings)} complexity issue(s)" if not radon_failed
        else "complexity scan failed"
    )
    summary = "Analysis results: " + ", ".join(summary_parts) + "."


    new_review = Review(
        project_id=project.id,
        review_score=final_score,
        summary=summary,
         maintainability_index=maintainability_index,   
        lines_of_code=lines_of_code,                     
        function_count=function_count,                    
        class_count=class_count, 
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
        )
        db.add(finding)

    db.commit()
    db.refresh(new_review)

    return new_review