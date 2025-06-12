import os
import requests
import jwt
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configuration from environment variables
LTI_PRIVATE_KEY = os.getenv('LTI_PRIVATE_KEY')
LTI_CLIENT_ID = os.getenv('LTI_CLIENT_ID')
LTI_ISSUER = os.getenv('LTI_ISSUER')
LTI_DEPLOYMENT_ID = os.getenv('LTI_DEPLOYMENT_ID')
LTI_TOKEN_ENDPOINT = os.getenv('LTI_TOKEN_ENDPOINT')

@app.route('/submit-grade', methods=['POST'])
def submit_grade():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['lineItemUrl', 'scoreGiven', 'scoreMaximum', 'userId']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Get access token
        access_token = get_lti_access_token(
            data.get('issuer', LTI_ISSUER),
            data.get('clientId', LTI_CLIENT_ID),
            data.get('deploymentId', LTI_DEPLOYMENT_ID)
        )
        
        # Submit score to LMS
        score_url = build_score_url(data['lineItemUrl'])
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/vnd.ims.lis.v1.score+json'
        }
        
        score_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'scoreGiven': data['scoreGiven'],
            'scoreMaximum': data['scoreMaximum'],
            'comment': data.get('feedback', ''),
            'activityProgress': 'Completed',
            'gradingProgress': 'FullyGraded',
            'userId': data['userId']
        }
        
        response = requests.post(score_url, headers=headers, json=score_data)
        response.raise_for_status()
        
        return jsonify({
            'success': True,
            'message': 'Grade submitted successfully',
            'status_code': response.status_code,
            'response': response.json()
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Failed to submit grade',
            'details': str(e),
            'response': e.response.text if hasattr(e, 'response') else None
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_lti_access_token(issuer, client_id, deployment_id):
    """Get LTI access token using JWT client credentials grant"""
    now = datetime.utcnow()
    exp = now + timedelta(minutes=5)
    
    # Create JWT assertion
    jwt_payload = {
        'iss': client_id,
        'sub': client_id,
        'aud': [LTI_TOKEN_ENDPOINT, issuer],
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
        'jti': f'lti-service-{now.timestamp()}'
    }
    
    headers = {
        'kid': 'lti-service-key',
        'alg': 'RS256'
    }
    
    # Sign the JWT with the private key
    client_assertion = jwt.encode(
        jwt_payload,
        LTI_PRIVATE_KEY,
        algorithm='RS256',
        headers=headers
    )
    
    # Request access token
    token_data = {
        'grant_type': 'client_credentials',
        'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        'client_assertion': client_assertion,
        'scope': 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
    }
    
    response = requests.post(LTI_TOKEN_ENDPOINT, data=token_data)
    response.raise_for_status()
    
    token_response = response.json()
    return token_response['access_token']

def build_score_url(line_item_url):
    """Construct the proper score submission URL from a line item URL"""
    if '/scores' in line_item_url:
        return line_item_url
    
    if '/lineitem' in line_item_url:
        if '?' in line_item_url:
            base, query = line_item_url.split('?', 1)
            return f"{base}/scores?{query}"
        return f"{line_item_url}/scores"
    
    if '/lineitems/' in line_item_url:
        parts = line_item_url.split('/')
        line_item_index = parts.index('lineitems') + 1
        line_item_id = parts[line_item_index]
        return f"{'/'.join(parts[:line_item_index])}/{line_item_id}/scores"
    
    return line_item_url

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)