from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ProjectResponse(BaseModel):
   
    id: int
    project_name: str
    upload_type: str
    created_at: datetime
   

    model_config = ConfigDict(from_attributes=True)  