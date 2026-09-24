from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float  
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Review(Base):
   

    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"), 
        nullable=False,
        index=True
    )

    review_score = Column(
        Float, 
        nullable=True  
    )

    summary = Column(
        String(1000),  
        nullable=True  
    )

    maintainability_index = Column(
        Float,
        nullable=True  
    )

    lines_of_code = Column(
        Integer,
        nullable=True  
    )

    function_count = Column(
        Integer,
        nullable=True
    )

    class_count = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    project = relationship("Project")
  

    findings = relationship("ReviewFinding", back_populates="review", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Review(id={self.id}, project_id={self.project_id}, score={self.review_score})>"