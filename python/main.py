from flask import Flask, request, jsonify
from services.ags import submit_score
from services.lti import validate_lti_jwt

app = Flask(__name__)

@app.route('/api/assessment', methods=['POST'])
def create_assessment():
    data = request.json
    result = submit_score(data)
    return jsonify(result)

@app.route('/api/lti/launch', methods=['POST'])
def lti_launch():
    id_token = request.json.get('id_token')
    validation = validate_lti_jwt(id_token)
    if not validation['isValid']:
        return jsonify(validation), 401
    return jsonify(validation)

if __name__ == '__main__':
    app.run(port=5001)
