import jwt
import requests

def get_jwks(issuer, jwks_url):
    """Fetch the JSON Web Key Set (JWKS) from the issuer."""
    response = requests.get(jwks_url)
    response.raise_for_status()  # Raise an error for bad responses
    return response.json()

def validate_lti_jwt(id_token, expected_nonce=None):
    """Validate an LTI JWT token."""
    try:
        # Decode the token without verification to get the header and payload
        decoded = jwt.decode(id_token, options={"verify_signature": False})

        issuer = decoded['iss']
        kid = jwt.get_unverified_header(id_token)['kid']

        # Fetch the JWKS from the issuer
        jwks_url = f"{issuer}/mod/lti/certs.php"  # Adjust this URL as needed
        jwks = get_jwks(issuer, jwks_url)

        # Find the key that matches the 'kid' from the JWT header
        key = next((k for k in jwks['keys'] if k['kid'] == kid), None)

        if not key:
            return {'isValid': False, 'error': 'Key not found in JWKS'}

        # Get the public key
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)

        # Validate the token
        payload = jwt.decode(
            id_token,
            key=public_key,
            algorithms=['RS256'],
            audience='your_client_id',  # Replace with your client ID
            issuer=issuer
        )

        # Check nonce if provided
        if expected_nonce and payload.get('nonce') != expected_nonce:
            return {'isValid': False, 'error': 'Invalid nonce'}

        return {'isValid': True, 'payload': payload}

    except jwt.ExpiredSignatureError:
        return {'isValid': False, 'error': 'Token has expired'}
    except jwt.InvalidTokenError as e:
        return {'isValid': False, 'error': str(e)}
    except Exception as e:
        return {'isValid': False, 'error': str(e)}
