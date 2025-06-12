import requests

def submit_score(assessment_data):
    response = requests.post(
        assessment_data['lineItemUrl'],
        json={
            'scoreGiven': assessment_data['scoreGiven'],
            'scoreMaximum': assessment_data['scoreMaximum'],
            'comment': assessment_data['feedback'],
            'activityProgress': assessment_data['activityProgress'],
            'gradingProgress': assessment_data['gradingProgress'],
            'userId': assessment_data['userId']
        },
        headers={
            'Authorization': f"Bearer {assessment_data['accessToken']}",
            'Content-Type': 'application/vnd.ims.lis.v1.score+json'
        }
    )
    return response.json()
