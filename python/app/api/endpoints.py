from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import logging
from ..services.assessment_service import AssessmentService
from ..schemas import AssessmentRequest, GradeResult

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

def convert_camel_to_snake(data):
    """Convert camelCase fields to snake_case for questions"""
    if isinstance(data, dict):
        converted = {}
        for key, value in data.items():
            if key == "questions" and isinstance(value, list):
                # Convert questions array
                converted[key] = []
                for question in value:
                    if isinstance(question, dict):
                        q_converted = {}
                        for q_key, q_value in question.items():
                            if q_key == "correctAnswer":
                                q_converted["correct_answer"] = q_value
                            else:
                                q_converted[q_key] = q_value
                        converted[key].append(q_converted)
                    else:
                        converted[key].append(question)
            else:
                converted[key] = value
        return converted
    return data


@router.post("/assessments/grade", response_model=GradeResult)
async def grade_assessment(request: Request):
    try:
        # Get raw request body
        raw_data = await request.json()
        
        # Log the incoming request
        logger.info(f"Raw grading request received: {raw_data}")
        
        # Convert camelCase to snake_case
        converted_data = convert_camel_to_snake(raw_data)
        logger.info(f"Converted data: {converted_data}")
        
        # Parse with Pydantic
        assessment = AssessmentRequest(**converted_data)
        
        # Validate the assessment data
        if not assessment.questions:
            raise HTTPException(
                status_code=400, 
                detail="Questions are required for assessment grading"
            )
        
        if not assessment.answers:
            raise HTTPException(
                status_code=400, 
                detail="Answers are required for assessment grading"
            )
        
        if len(assessment.questions) != len(assessment.answers):
            raise HTTPException(
                status_code=400, 
                detail=f"Mismatch between questions ({len(assessment.questions)}) and answers ({len(assessment.answers)})"
            )
        
        # Call the assessment service
        result = AssessmentService.calculate_score(
            questions=assessment.questions,
            answers=assessment.answers
        )
        
        logger.info(f"Grading completed successfully. Score: {result.score}")
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during grading: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during grading: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "assessment-grading"}