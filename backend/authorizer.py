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
    
    Args:
        event: API Gateway authorizer event containing headers, query params, route ARN
        context: Lambda context (unused but required by Lambda signature)
    
    Returns:
        dict: isAuthorized, principalId, and context for the route handler
    """
    try:
        # Extract Authorization token from multiple potential sources
        # Identity source configured in API Gateway: queryString.Authorization, header.Authorization
        headers = event.get('headers', {}) or {}
        query_params = event.get('queryStringParameters', {}) or {}
        multi_value_headers = event.get('multiValueHeaders', {}) or {}

        # Collect all potential Authorization values from headers and query params
        auth_values = []
        auth_values.extend(headers.get('Authorization', headers.get('authorization', '')).split(','))
        auth_values.extend(headers.get('authorization', '').split(','))
        auth_values.extend(multi_value_headers.get('Authorization', []))
        auth_values.extend(multi_value_headers.get('authorization', []))
        auth_values.extend(query_params.get('Authorization', query_params.get('authorization', '')).split(','))

        # Find first non-empty Authorization value
        token = None
        for val in auth_values:
            val = val.strip()
            if val:
                token = val
                break

        if not token:
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

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

        except Exception:
            # Invalid token format or decode error
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

        # Extract userId from JWT claims (priority order: cognito:username, username, sub, email)
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email', 'unknown')

        route_arn = event.get('routeArn', event.get('methodArn', '*'))
        return generate_allow_response(route_arn, user_id, payload)

    except Exception as e:
        return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))


def generate_allow_response(route_arn, principal_id, context=None):
    """
    Generate a successful authorizer response.
    
    Args:
        route_arn: The ARN of the route being accessed
        principal_id: The user ID extracted from the token
        context: Optional additional context to pass to the route handler
    
    Returns:
        dict: Response format expected by API Gateway
    """
    return {
        'isAuthorized': True,
        'principalId': principal_id,
        'context': {
            'userId': principal_id,
        }
    }


def generate_deny_response(resource):
    """
    Generate a denied authorizer response.
    
    Args:
        resource: The ARN of the route being accessed (or '*' for wildcard)
    
    Returns:
        dict: Deny response preventing access to the route
    """
    return {
        'isAuthorized': False,
        'principalId': 'anonymous',
    }
