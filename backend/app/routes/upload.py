import re 

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File  # UploadFile: FastAPI's special type for handling uploaded files efficiently. File: tells FastAPI this parameter comes from multipart form data, not JSON.
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project_schema import ProjectResponse, CodeSubmission
from app.services.auth_service import get_current_user
from app.utils.file_validation import validate_upload
from app.utils.file_storage import save_uploaded_file


router = APIRouter(
    prefix="/upload",
    tags=["Upload"]
)


@router.post(
    "/",                          
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_file(
    file: UploadFile = File(...),  
    current_user: User = Depends(get_current_user),  
    db: Session = Depends(get_db)
):
    
    if not file.filename:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was provided."
        )

    file_bytes = await file.read()
    

    is_valid, message = validate_upload(file.filename, len(file_bytes))
    

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message  
        )

    saved_path = save_uploaded_file(
        user_id=current_user.id,  
        file_bytes=file_bytes,
        original_filename=file.filename
    )

    new_project = Project(
        user_id=current_user.id,
        project_name=file.filename,  
        upload_type="file_upload",
        file_path=saved_path
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)  

    return new_project

LANGUAGE_EXTENSIONS = {"python": ".py", "c": ".c", "java": ".java"}

JAVA_TYPE_PATTERN = re.compile(
    r"\bpublic\s+(?:(?:final|abstract|static|sealed)\s+)*(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)"
)


def _filename_for_code(code: str, language: str) -> str:
    """untitled.py / untitled.c, or <ClassName>.java when a public Java type is found."""
    extension = LANGUAGE_EXTENSIONS[language]
    if language == "java":
        match = JAVA_TYPE_PATTERN.search(code)
        if match:
            return f"{match.group(1)}{extension}"
    return f"untitled{extension}"


@router.post(
    "/code",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED
)
def upload_code(
    payload: CodeSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
   
    if not payload.code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No code was provided.")
        

    file_name = _filename_for_code(payload.code, payload.language)
    file_bytes = payload.code.encode("utf-8")

    is_valid, message = validate_upload(file_name, len(file_bytes))
    
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    saved_path = save_uploaded_file(
        user_id=current_user.id,
        file_bytes=file_bytes,
        original_filename=file_name
    )

    new_project = Project(
        user_id=current_user.id,
        project_name=file_name,
        upload_type="code_editor",
        file_path=saved_path
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project
