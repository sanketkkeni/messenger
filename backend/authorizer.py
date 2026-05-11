"""
WebSocket API Authorizer Lambda Handler

This Lambda function serves as a custom authorizer for the WebSocket API Gateway.
It validates JWT tokens passed via the Authorization header or query parameter
and extracts user identity to pass to downstream handlers.

Token Validation Flow:
1. Extract token from headers (Authorization) or query parameters
2. Decode JWT payload (base64url decode the middle segment)
3. Extract userId from priority fields: cognito:username, username, sub, email
4. Return isAuthorized=true with principalId and context for route handlers

Note: This authorizer is defined in infrastructure/api_gateway.tf but the
$connect route currently uses AuthorizationType: NONE with token validation
done directly in connect_handler.py for reliability.
"""

import json
import os
import base64

USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')


def lambda_handler(event, context):
    """
    Main entry point for API Gateway authorizer invocations.
    Handles both REST API and WebSocket API Gateway v2 event formats.
    """
    import sys
    print(f"AUTHORIZER_DEBUG: Received event type: {type(event)}", flush=True)
    print(f"AUTHORIZER_DEBUG: Event: {json.dumps(event, default=str)[:500]}", flush=True)

    try:
        # Determine if this is a WebSocket or REST API event
        event_type = event.get('type', '')
        route_key = event.get('routeKey', '')
        
        # Handle WebSocket API Gateway v2 format
        if route_key:
            print(f"AUTHORIZER_DEBUG: WebSocket event, routeKey={route_key}", flush=True)
            headers = event.get('headers', {}) or {}
            query_params = event.get('queryStringParameters', {}) or {}
        else:
            # REST API or other format
            headers = event.get('headers', {}) or {}
            query_params = event.get('queryStringParameters', {}) or {}

        print(f"AUTHORIZER_DEBUG: headers keys: {list(headers.keys())}")
        print(f"AUTHORIZER_DEBUG: query params keys: {list(query_params.keys())}")
        if 'Authorization' in query_params:
            auth_val = query_params['Authorization']
            print(f"AUTHORIZER_DEBUG: query Authorization length: {len(auth_val)}")
            print(f"AUTHORIZER_DEBUG: query Authorization (first 50): {auth_val[:50]}")
        
        multi_value_headers = event.get('multiValueHeaders', {}) or {}
        
        # Collect all potential Authorization values from headers and query params
        auth_values = []
        
        # Fix: Get each header separately, not nested
        auth_from_headers = headers.get('Authorization', '') or headers.get('authorization', '') or ''
        auth_values.extend(auth_from_headers.split(','))
        
        multi_value_headers = event.get('multiValueHeaders', {}) or {}
        auth_values.extend(multi_value_headers.get('Authorization', []))
        auth_values.extend(multi_value_headers.get('authorization', []))
        
        auth_from_query = query_params.get('Authorization', '') or query_params.get('authorization', '') or ''
        auth_values.extend(auth_from_query.split(','))

        # Find first non-empty Authorization value
        token = None
        for val in auth_values:
            val = val.strip()
            if val and val != '':
                token = val
                break

        if not token:
            print("AUTHORIZER_DEBUG: No token found. auth_values collected:", auth_values, flush=True)
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))
        
        print(f"AUTHORIZER_DEBUG: Token found, length={len(token)}, prefix={token[:20]}...")

        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]

        # Decode JWT payload (JWT format: header.payload.signature)
        try:
            parts = token.split('.')
            if len(parts) != 3:
                return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

            # Decode payload (middle segment) from base64url encoding
            payload_b64 = parts[1]
            padding = 4 - (len(payload_b64) % 4)
            if padding != 4:
                payload_b64 += '=' * padding

            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            print(f"AUTHORIZER_DEBUG: Payload decoded successfully. Keys: {list(payload.keys())}")

        except Exception as e:
            print(f"AUTHORIZER_DEBUG: Exception decoding token: {type(e).__name__}: {str(e)}", flush=True)
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

        # Extract userId from JWT claims (priority order: cognito:username, username, sub, email)
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email', 'unknown')

        # Extract routeArn for IAM policy
        route_arn = event.get('routeArn', event.get('methodArn', '*'))
        print(f"AUTHORIZER_DEBUG: routeArn: {route_arn}")
        
        if route_arn == '*':
            print("AUTHORIZER_DEBUG: WARNING - No routeArn found, using wildcard")
        
        print(f"AUTHORIZER_DEBUG: Extracted user_id: {user_id}")
        if not user_id or user_id == 'unknown':
            print(f"AUTHORIZER_DEBUG: WARNING - user_id not found in payload. Payload keys: {list(payload.keys())}", flush=True)
        
        return generate_allow_response(route_arn, user_id, payload)

    except Exception as e:
        print(f"AUTHORIZER_DEBUG: Exception in authorizer: {str(e)}", flush=True)
        return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))


def generate_allow_response(route_arn, principal_id, context=None):
    """
    Generate a successful authorizer response.
    
    For WebSocket APIs, this must return an IAM policy (not isAuthorized).
    
    Args:
        route_arn: The ARN of the route being accessed
        principal_id: The user ID extracted from the token
        context: Optional additional context to pass to the route handler
    
    Returns:
        dict: IAM policy format expected by API Gateway WebSocket
    """
    return {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': 'Allow',
                'Resource': route_arn
            }]
        },
        'context': {
            'userId': principal_id,
        }
    }


def generate_deny_response(resource):
    """
    Generate a denied authorizer response.
    
    For WebSocket APIs, this must return an IAM policy (not isAuthorized: false).
    
    Args:
        resource: The ARN of the route being accessed (or '*' for wildcard)
    
    Returns:
        dict: IAM policy denying access
    """
    return {
        'principalId': 'anonymous',
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': 'Deny',
                'Resource': resource
            }]
        }
    }
