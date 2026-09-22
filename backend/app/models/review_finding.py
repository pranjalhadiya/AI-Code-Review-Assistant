from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class ReviewFinding(Base):
    

    __tablename__ = "review_findings"

    id = Column(Integer, primary_key=True, index=True)

    review_id = Column(
        Integer,
        ForeignKey("reviews.id"),
        nullable=False,
        index=True
    )

    severity = Column(
        String(20),
        nullable=False 
    )

    issue = Column(
        String(255),
        nullable=False  
    )

    explanation = Column(
        String(1000),
        nullable=True  
    )

    suggestion = Column(
        String(1000),
        nullable=True  
    )

    file_name = Column(
        String(255),
        nullable=False 
    )

    line_number = Column(
        Integer,
        nullable=True  
    )

    review = relationship("Review", back_populates="findings")
   

    def __repr__(self):
        return f"<ReviewFinding(id={self.id}, severity={self.severity}, issue={self.issue})>"