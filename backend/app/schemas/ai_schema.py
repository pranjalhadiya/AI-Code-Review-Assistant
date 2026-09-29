from typing import Literal  

from pydantic import BaseModel, Field,  ConfigDict 


class AIFinding(BaseModel):
  
    model_config = ConfigDict(extra="forbid")
    
    category: Literal[
        "bug", "security", "code_smell", "performance",
        "best_practice", "refactoring", "naming",
    ] = Field(description="The kind of issue this is.")
   
    severity: Literal["High", "Medium", "Low"] = Field(
        description="How serious the issue is. Use exactly High, Medium, or Low."
    )

    title: str = Field(description="A short title for the issue, under 80 characters.")
    explanation: str = Field(
        description="What the problem is and why it matters, in 1-3 sentences (under 300 characters)."
    )
    suggestion: str = Field(
        description="A concrete fix or improvement, under 500 characters. A very short code example is fine."
    )


    line_number: int = Field(
        description="The line number the issue is on, using the numbered lines provided. Use 0 if it applies to the whole file."
    )
    

class AIReview(BaseModel):
    
    model_config = ConfigDict(extra="forbid")

    quality_score: int = Field(description="Overall code quality from 0 (very poor) to 100 (excellent).")
   
    summary: str = Field(description="A 2-4 sentence overall assessment of the code.")
    findings: list[AIFinding] = Field(description="The most important issues, most serious first. At most 15.")