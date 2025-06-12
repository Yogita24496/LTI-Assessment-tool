from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any

class Question(BaseModel):
    id: int
    text: str
    options: List[str]
    correct_answer: str = Field(alias="correctAnswer")  # Accept both snake_case and camelCase
    
    class Config:
        # Allow both field names to be accepted
        allow_population_by_field_name = True
        # This allows the model to be populated by either the field name or the alias

class AssessmentRequest(BaseModel):
    questions: List[Question]
    answers: Dict[str, str]  # question_id -> selected_answer
    userId: Optional[str] = Field(None, alias="user_id")
    courseId: Optional[str] = Field(None, alias="course_id")
    
    class Config:
        allow_population_by_field_name = True

class GradeResult(BaseModel):
    score: float
    total_questions: int
    correct_answers: int
    incorrect_answers: int
    percentage: float
    detailed_results: List[Dict[str, Any]]
    
    class Config:
        allow_population_by_field_name = True