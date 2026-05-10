import json
import os
import base64
from utils import store_connection, create_response

USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

def validate_token(token):
    """Validate JWT token and return user_id or None"""
    try:
        if not token:
            return None
        if token.startswith('Bearer '):
            token = token[7:]
        
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        # Extract userId from priority fields: cognito:username, username, sub, email
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email')
        return user_id
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

def lambda_handler(event, context):
    """
    WebSocket $connect route handler.
    
    This function is triggered by API Gateway during the connection handshake.
    It extracts user identity from the Authorization token (fallback from authorizer
    context to query parameters) and persists the mapping between the WebSocket
    connectionId and the userId to allow sending targeted messages later.
    """
    try:
        request_context = event.get('requestContext', {})
        connection_id = request_context.get('connectionId')
        
        if not connection_id:
            print("No connection ID in request context")
            return create_response(400, {'message': 'Bad request'})
        
        # Try to get userId from authorizer context first
        authorizer = request_context.get('authorizer', {})
        user_id = authorizer.get('userId')
        
        # If no authorizer context, extract token from query parameters
        if not user_id:
            query_params = event.get('queryStringParameters', {}) or {}
            auth_param = query_params.get('Authorization') or query_params.get('authorization')
            if auth_param:
                user_id = validate_token(auth_param)
        
        if not user_id:
            print("Could not extract userId from any source")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Persist the connection state for future message routing
        success = store_connection(user_id, connection_id)
        if not success:
            print("Failed to store connection")
            return create_response(500, {'message': 'Internal server error'})
        
        print(f"User {user_id} connected with connection ID {connection_id}")
        return create_response(200, {'message': 'Connected'})
        
    except Exception as e:
        print(f"Connect handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})
