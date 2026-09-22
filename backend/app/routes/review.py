from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.review import Review
from app.models.review_finding import ReviewFinding
from app.schemas.review_schema import ReviewResponse
from app.services.auth_service import get_current_user
from app.services.pylint_service import run_pylint, parse_pylint_findings, convert_score_to_100


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

    raw_findings, raw_score = run_pylint(project.file_path)
 
    parsed_findings = parse_pylint_findings(raw_findings)
    final_score = convert_score_to_100(raw_score)

    new_review = Review(
        project_id=project.id,
        review_score=final_score,
        summary=f"Pylint analysis found {len(parsed_findings)} issue(s)."

    )

    db.add(new_review)
    db.commit()
    db.refresh(new_review)
 
    for finding_data in parsed_findings:
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