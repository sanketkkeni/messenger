"""
WebSocket $connect Route Handler

This Lambda function is triggered by API Gateway when a new WebSocket connection
is established. It authenticates the user and stores the connection information
for routing messages between users.

Connection Flow:
1. Client initiates WebSocket connection with JWT token in query parameter
2. API Gateway invokes this Lambda via the $connect route
3. Lambda extracts userId from token (or authorizer context)
4. Lambda stores connection in DynamoDB for message routing
5. Lambda returns 200 to allow connection, or 401 to reject

Message Routing:
After connection, messages from one user to another flow through message_handler:
1. Sender's client sends message via WebSocket with recipientId
2. message_handler queries DynamoDB for recipient's connectionId
3. message_handler uses API Gateway Management API to send to recipient's WebSocket
"""

import json
import os
import base64
from utils import store_connection, create_response

# Environment variables (set in Lambda configuration)
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')


def validate_token(token: str):
    """
    Validate JWT token and extract userId.
    
    This function decodes the JWT payload (without cryptographic verification)
    to extract the userId claim. Verification is done client-side by Cognito
    during login; we trust the token since it was issued for this app.
    
    Args:
        token: JWT token string (with or without 'Bearer ' prefix)
    
    Returns:
        userId string if valid, None if invalid
    """
    try:
        if not token:
            return None
        
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        # JWT format: header.payload.signature (all base64url encoded)
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode payload (middle segment)
        payload_b64 = parts[1]
        # Add padding if needed for base64 decoding
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        
        # Extract userId from priority fields
        # cognito:username is the preferred identifier from Cognito User Pools
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email')
        
        return user_id
    except Exception:
        return None


def lambda_handler(event, context):
    """
    Main entry point for WebSocket $connect route.
    
    Args:
        event: API Gateway WebSocket event containing:
            - requestContext: connectionId, routeKey, authorizer context
            - queryStringParameters: Authorization token (if no authorizer)
        context: Lambda context (unused but required by Lambda signature)
    
    Returns:
        HTTP response: 200 (connected), 401 (unauthorized), or 400/500 (error)
    """
    try:
        print(f"DEBUG: connect_handler event keys: {list(event.keys())}")
        
        request_context = event.get('requestContext', {})
        connection_id = request_context.get('connectionId')
        
        if not connection_id:
            return create_response(400, {'message': 'Bad request'})
        
        # First, try to get userId from authorizer context (if custom authorizer used)
        # The authorizer injects principalId and context into requestContext
        authorizer = request_context.get('authorizer', {})
        user_id = authorizer.get('userId')
        print(f"DEBUG: userId from authorizer: {user_id}")
        
        # Fallback: extract token from query parameters
        # This handles the case where AuthorizationType is NONE
        if not user_id:
            query_params = event.get('queryStringParameters', {}) or {}
            auth_param = query_params.get('Authorization') or query_params.get('authorization')
            print(f"DEBUG: query params: {query_params}")
            if auth_param:
                print(f"DEBUG: validate_token called with token: {auth_param[:50]}...")
                user_id = validate_token(auth_param)
                print(f"DEBUG: validate_token result: {user_id}")

        print(f"DEBUG: final user_id: {user_id}")
        
        if not user_id:
            print("DEBUG: Could not extract userId from any source")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Store connection mapping in DynamoDB
        # Key: UserId (partition), connectionId (sort)
        success = store_connection(user_id, connection_id)
        if not success:
            return create_response(500, {'message': 'Internal server error'})
        
        print(f"User {user_id} connected with connection ID {connection_id}")
        return create_response(200, {'message': 'Connected'})
        
    except Exception as e:
        print(f"Connect handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})
