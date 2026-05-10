import json
import os
import time
import boto3
from botocore.config import Config

USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

cognito_client = boto3.client('cognito-idp', config=Config(
    retries={'max_attempts': 3, 'mode': 'standard'}
))

cache = {'users': [], 'timestamp': 0}
CACHE_TTL = 30

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
}

CORS_MULTI_HEADERS = {
    'Content-Type': ['application/json'],
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Headers': ['Content-Type,Authorization,X-Requested-With'],
    'Access-Control-Allow-Methods': ['GET', 'POST', 'OPTIONS']
}

def lambda_handler(event, context):
    print(f"DEBUG: Received event: {json.dumps(event)}")
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))
    print(f"DEBUG: Method detected: {method}")

    if method == 'OPTIONS' or event.get('type') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
        print("DEBUG: Handling OPTIONS request")
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'multiValueHeaders': CORS_MULTI_HEADERS,
            'body': ''
        }

    try:
        current_time = time.time()
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

        headers = event.get('headers', {})
        authorization = headers.get('Authorization') or headers.get('authorization')

        response = cognito_client.list_users(
            UserPoolId=USER_POOL_ID,
            Limit=60
        )

        users = response.get('Users', [])

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

            attributes = {attr.get('Name'): attr.get('Value') for attr in user.get('Attributes', [])}
            user_data['email'] = attributes.get('email')
            user_data['email_verified'] = attributes.get('email_verified', 'false') == 'true'

            if user_data['email']:
                formatted_users.append(user_data)

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

    except cognito_client.exceptions.UserPoolTemporarilyUnavailableException as e:
        print(f"Cognito temporarily unavailable: {str(e)}")
        return {'statusCode': 503, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 'body': json.dumps({'message': 'Service temporarily unavailable'})}

    except cognito_client.exceptions.TooManyRequestsException as e:
        print(f"Too many requests to Cognito: {str(e)}")
        return {'statusCode': 429, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 'body': json.dumps({'message': 'Too many requests'})}

    except Exception as e:
        print(f"Users handler error: {str(e)}")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'multiValueHeaders': CORS_MULTI_HEADERS, 'body': json.dumps({'message': 'Internal server error'})}
