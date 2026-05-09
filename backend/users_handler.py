import json
import os
import boto3
from utils import create_response, USER_POOL_ID

cognito_client = boto3.client('cognito-idp')

def lambda_handler(event, context):
    """
    Handle REST API GET /users route
    List all registered users from Cognito User Pool
    """
    try:
        # Check if request has authorization header
        headers = event.get('headers', {})
        authorization = headers.get('Authorization') or headers.get('authorization')
        
        # For now, we'll make this endpoint publicly accessible for demo purposes
        # In production, you would validate the token here
        
        # List users from Cognito
        try:
            response = cognito_client.list_users(
                UserPoolId=USER_POOL_ID,
                Limit=60  # Cognito default max is 60
            )
            
            users = response.get('Users', [])
            
            # Format user data (exclude sensitive information)
            formatted_users = []
            for user in users:
                user_data = {
                    'username': user.get('Username'),
                    'email': None,
                    'email_verified': False,
                    'created_at': user.get('UserCreateDate'),
                    'status': user.get('UserStatus'),
                    'enabled': user.get('Enabled', True)
                }
                
                # Extract email and email_verified from attributes
                attributes = {attr.get('Name'): attr.get('Value') for attr in user.get('Attributes', [])}
                user_data['email'] = attributes.get('email')
                user_data['email_verified'] = attributes.get('email_verified', 'false') == 'true'
                
                # Only include users with email
                if user_data['email']:
                    formatted_users.append(user_data)
            
            return create_response(200, {
                'users': formatted_users,
                'count': len(formatted_users)
            })
            
        except cognito_client.exceptions.UserPoolTemporarilyUnavailableException as e:
            print(f"Cognito temporarily unavailable: {str(e)}")
            return create_response(503, {'message': 'Service temporarily unavailable'})
            
        except cognito_client.exceptions.TooManyRequestsException as e:
            print(f"Too many requests to Cognito: {str(e)}")
            return create_response(429, {'message': 'Too many requests'})
            
    except Exception as e:
        print(f"Users handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})
