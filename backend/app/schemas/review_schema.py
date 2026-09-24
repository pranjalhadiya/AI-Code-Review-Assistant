from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ReviewFindingResponse(BaseModel):
   
    id: int
    severity: str
    issue: str
    explanation: str | None  
    suggestion: str | None
    file_name: str
    line_number: int | None

    model_config = ConfigDict(from_attributes=True)


class ReviewResponse(BaseModel):
   
    id: int
    project_id: int
    review_score: float | None
    summary: str | None
    maintainability_index: float | None   
    lines_of_code: int | None              
    function_count: int | None              
    class_count: int | None  
    created_at: datetime
    findings: list[ReviewFindingResponse] = []


    model_config = ConfigDict(from_attributes=True)