from ..schemas import GradeResult

class AssessmentService:
    @staticmethod
    def calculate_score(questions: list, answers: dict) -> GradeResult:
        correct_count = 0
        
        for question in questions:
            if str(question['id']) in answers and answers[str(question['id'])] == question['correct_answer']:
                correct_count += 1
        
        score = (correct_count / len(questions)) * 100
        feedback = f"You got {correct_count} out of {len(questions)} questions correct."
        
        return GradeResult(
            score=score,
            correct_answers=correct_count,
            total_questions=len(questions),
            feedback=feedback
        )