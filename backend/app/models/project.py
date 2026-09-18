from sqlalchemy import Column, Integer, String, DateTime, ForeignKey  
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship 

from app.database import Base


class Project(Base):
    """
    Represents one code submission (a set of uploaded files) belonging to a user.
    Maps to the 'projects' table in PostgreSQL.
    """

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"), 
        nullable=False,
        index=True  
    )

    project_name = Column(
        String(255),
        nullable=False  
    )

    upload_type = Column(
        String(50),
        nullable=False,
        default="file_upload" 
    )

    file_path = Column(
        String(500),  
        nullable=False 
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    owner = relationship("User")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.project_name})>"