import json
from utils import validate_jwt_token, create_response

def lambda_handler(event, context):
    """
    Lambda authorizer for WebSocket connections
    Validates the Cognito JWT token and returns an IAM policy
    """
    try:
        # Extract token from headers
        headers = event.get('headers', {})
        token = headers.get('Authorization') or headers.get('authorization')
        
        if not token:
            print("No token provided in headers")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        # Validate the JWT token
        claims = validate_jwt_token(token)
        if not claims:
            print("Failed to validate JWT token")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Extract user ID from token claims
        user_id = claims.get('username') or claims.get('cognito:username') or claims.get('email')
        if not user_id:
            # Try sub claim as fallback
            user_id = claims.get('sub')
        
        if not user_id:
            print("Unable to extract user ID from token")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Create IAM policy allowing WebSocket connection
        principal_id = user_id
        
        # Allow connection to WebSocket API
        policy = {
            'principalId': principal_id,
            'policyDocument': {
                'Version': '2012-10-17',
                'Statement': [
                    {
                        'Action': 'execute-api:Invoke',
                        'Effect': 'Allow',
                        'Resource': event['methodArn']
                    }
                ]
            },
            'context': {
                'userId': user_id,
                'token': token  # Pass token to Lambda for further validation if needed
            }
        }
        
        return policy
        
    except Exception as e:
        print(f"Authorizer error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})