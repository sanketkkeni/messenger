import os
import json
import boto3
import jwt
import time
from botocore.exceptions import ClientError
from jose import jwk, jwt
from jose.utils import base64url_decode

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp')
apigatewaymanagementapi_client = None  # Will be initialized per request with endpoint

# Environment variables
USER_POOL_ID = os.environ.get('USER_POOL_ID')
CLIENT_ID = os.environ.get('CLIENT_ID')
CONNECTIONS_TABLE_NAME = os.environ.get('CONNECTIONS_TABLE_NAME')
MESSAGES_TABLE_NAME = os.environ.get('MESSAGES_TABLE_NAME')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# DynamoDB tables
connections_table = dynamodb.Table(CONNECTIONS_TABLE_NAME) if CONNECTIONS_TABLE_NAME else None
messages_table = dynamodb.Table(MESSAGES_TABLE_NAME) if MESSAGES_TABLE_NAME else None

def get_cognito_keys():
    """Get the public keys from Cognito for JWT validation"""
    try:
        response = cognito_client.get_user_pool_client(
            UserPoolId=USER_POOL_ID,
            ClientId=CLIENT_ID
        )
        # Get the user pool's issuer and jwks_url
        pool_response = cognito_client.describe_user_pool(UserPoolId=USER_POOL_ID)
        issuer = f"https://cognito-idp.{os.environ.get('AWS_REGION', 'us-east-1')}.amazonaws.com/{USER_POOL_ID}"
        jwks_url = f"{issuer}/.well-known/jwks.json"
        
        # Fetch JWKS
        import urllib.request
        with urllib.request.urlopen(jwks_url) as f:
            jwks = json.loads(f.read().decode())
        return jwks['keys']
    except Exception as e:
        print(f"Error getting Cognito keys: {str(e)}")
        return []

def validate_jwt_token(token):
    """Validate a JWT token issued by Cognito"""
    try:
        # Get the token header to find the key ID
        headers = jwt.get_unverified_header(token)
        kid = headers['kid']
        
        # Get Cognito public keys
        keys = get_cognito_keys()
        key = None
        for k in keys:
            if k['kid'] == kid:
                key = k
                break
        
        if not key:
            raise Exception("Unable to find appropriate key")
        
        # Construct the public key
        public_key = jwk.construct(key)
        
        # Verify the token
        message, encoded_signature = token.rsplit('.', 1)
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
        
        if not public_key.verify(message.encode("utf8"), decoded_signature):
            raise Exception("Signature verification failed")
        
        # Get claims
        claims = jwt.get_unverified_claims(token)
        
        # Check expiration
        if time.time() > claims['exp']:
            raise Exception("Token is expired")
        
        # Check audience
        if CLIENT_ID and claims.get('aud') != CLIENT_ID and claims.get('client_id') != CLIENT_ID:
            raise Exception("Token was not issued for this audience")
        
        return claims
    except Exception as e:
        print(f"JWT validation error: {str(e)}")
        return None

def get_user_connections(user_id):
    """Get all connections for a user"""
    try:
        if not connections_table:
            return []
        
        response = connections_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('UserId').eq(user_id)
        )
        return response.get('Items', [])
    except Exception as e:
        print(f"Error getting user connections: {str(e)}")
        return []

def store_connection(user_id, connection_id):
    """Store a connection for a user"""
    try:
        if not connections_table:
            return False
        
        connections_table.put_item(
            Item={
                'UserId': user_id,
                'connectionId': connection_id,
                'timestamp': int(time.time() * 1000)  # Store timestamp in milliseconds
            }
        )
        return True
    except Exception as e:
        print(f"Error storing connection: {str(e)}")
        return False

def delete_connection(connection_id):
    """Delete a specific connection"""
    try:
        if not connections_table:
            return False
        
        # First find the item to get the UserId (since we need both PK and SK)
        response = connections_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Key('connectionId').eq(connection_id)
        )
        
        items = response.get('Items', [])
        if not items:
            return True  # Nothing to delete
        
        # Delete each matching item (should be only one)
        for item in items:
            connections_table.delete_item(
                Key={
                    'UserId': item['UserId'],
                    'connectionId': item['connectionId']
                }
            )
        return True
    except Exception as e:
        print(f"Error deleting connection: {str(e)}")
        return False

def get_connection_user(connection_id):
    """Get the user ID for a connection"""
    try:
        if not connections_table:
            return None
        
        response = connections_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Key('connectionId').eq(connection_id)
        )
        
        items = response.get('Items', [])
        if items:
            return items[0].get('UserId')
        return None
    except Exception as e:
        print(f"Error getting connection user: {str(e)}")
        return None

def save_message(conversation_id, sender_id, message_text):
    """Save a message to the Messages table"""
    try:
        if not messages_table:
            return False
        
        messages_table.put_item(
            Item={
                'conversationId': conversation_id,
                'timestamp': int(time.time() * 1000),  # Store timestamp in milliseconds
                'senderId': sender_id,
                'message': message_text
            }
        )
        return True
    except Exception as e:
        print(f"Error saving message: {str(e)}")
        return False

def get_conversation_id(user1_id, user2_id):
    """Generate a consistent conversation ID from two user IDs"""
    # Sort the IDs to ensure consistency regardless of order
    sorted_ids = sorted([user1_id, user2_id])
    return f"{sorted_ids[0]}#{sorted_ids[1]}"

def send_websocket_message(connection_id, message_data, endpoint_url):
    """Send a message via WebSocket using the API Gateway Management API"""
    global apigatewaymanagementapi_client
    
    try:
        # Initialize client with the endpoint URL if not already set or if endpoint changed
        if not apigatewaymanagementapi_client or apigatewaymanagementapi_client._endpoint.host != endpoint_url:
            apigatewaymanagementapi_client = boto3.client(
                'apigatewaymanagementapi',
                endpoint_url=endpoint_url
            )
        
        apigatewaymanagementapi_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message_data)
        )
        return True
    except Exception as e:
        print(f"Error sending WebSocket message: {str(e)}")
        return False

def create_response(status_code, body=None):
    """Create a standardized response"""
    response = {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    }
    
    if body is not None:
        if isinstance(body, dict):
            response['body'] = json.dumps(body)
        else:
            response['body'] = body
    else:
        response['body'] = ''
    
    return response