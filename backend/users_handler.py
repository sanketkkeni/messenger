"""
Users API Handler Lambda

This Lambda function handles REST API requests to list all registered users.
It queries AWS Cognito User Pool to retrieve user information and returns
a formatted list of users with their email and verification status.

Caching:
- Results are cached for CACHE_TTL seconds to reduce Cognito API calls
- Cache is invalidated after TTL expires

CORS:
- Handles OPTIONS preflight requests for cross-origin requests from frontend
"""

import json
import os
import time
import boto3
from botocore.config import Config

# Environment configuration
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

# Cognito client with retry configuration for transient errors
cognito_client = boto3.client('cognito-idp', config=Config(
    retries={'max_attempts': 3, 'mode': 'standard'}
))

# In-memory cache to reduce Cognito API calls
# Cache is per-Lambda-instance, so may not persist across invocations in Lambda
cache = {'users': [], 'timestamp': 0}
CACHE_TTL = 30  # Cache TTL in seconds

# CORS headers for all responses (required for browser requests)
CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
}

# Multi-value CORS headers (required by API Gateway AWS_PROXY integration)
CORS_MULTI_HEADERS = {
    'Content-Type': ['application/json'],
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Headers': ['Content-Type,Authorization,X-Requested-With'],
    'Access-Control-Allow-Methods': ['GET', 'POST', 'OPTIONS']
}


def lambda_handler(event, context):
    """
    Main entry point for REST API /users endpoint.
    
    Args:
        event: API Gateway event containing HTTP method, headers, query params
        context: Lambda context (unused but required by Lambda signature)
    
    Returns:
        dict: HTTP response with status code, headers, and body
    """
    # Detect HTTP method from various API Gateway event formats
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))

    # Handle CORS preflight OPTIONS requests
    if method == 'OPTIONS' or event.get('type') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'multiValueHeaders': CORS_MULTI_HEADERS,
            'body': ''
        }

    try:
        current_time = time.time()
        
        # Return cached response if available and not expired
        if cache['users'] and (current_time - cache['timestamp']) < CACHE_TTL:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': json.dumps({
                    'users': cache['users'],
                    'count': len(cache['users']),
                    'cached': True
                })
            }

        # Query Cognito for all users in the User Pool
        # Note: This only returns users in the paginated result set
        response = cognito_client.list_users(
            UserPoolId=USER_POOL_ID,
            Limit=60  # Limit results per API call
        )

        users = response.get('Users', [])

        # Format user data from Cognito response structure
        formatted_users = []
        for user in users:
            user_data = {
                'username': user.get('Username'),
                'email': None,
                'email_verified': False,
                'created_at': str(user.get('UserCreateDate')),
                'status': user.get('UserStatus'),
                'enabled': user.get('Enabled', True)
            }

            # Extract attributes from the Attributes list
            attributes = {attr.get('Name'): attr.get('Value') for attr in user.get('Attributes', [])}
            user_data['email'] = attributes.get('email')
            user_data['email_verified'] = attributes.get('email_verified', 'false') == 'true'

            # Only include users with valid email
            if user_data['email']:
                formatted_users.append(user_data)

        # Update cache
        cache['users'] = formatted_users
        cache['timestamp'] = current_time

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'multiValueHeaders': CORS_MULTI_HEADERS,
            'body': json.dumps({
                'users': formatted_users,
                'count': len(formatted_users),
                'cached': False
            })
        }

    # Handle specific Cognito rate limiting errors
    except cognito_client.exceptions.UserPoolTemporarilyUnavailableException:
        return {'statusCode': 503, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 
                'body': json.dumps({'message': 'Service temporarily unavailable'})}

    except cognito_client.exceptions.TooManyRequestsException:
        return {'statusCode': 429, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 
                'body': json.dumps({'message': 'Too many requests'})}

    # Generic error handler
    except Exception:
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 
                'body': json.dumps({'message': 'Internal server error'})}
