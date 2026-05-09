import json
import os

USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
USER_POOL_APP_CLIENT_ID = os.environ.get('USER_POOL_APP_CLIENT_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

def lambda_handler(event, context):
    """
    Lambda authorizer for WebSocket connections
    Validates the Cognito JWT token and returns an IAM policy
    """
    try:
        headers = event.get('headers', {})
        query_params = event.get('queryStringParameters', {})
        token = headers.get('Authorization') or headers.get('authorization') or query_params.get('Authorization')
        
        if not token:
            print("No token provided")
            return generate_policy(False, 'Deny', event.get('routeArn', event.get('methodArn', '*')))
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        import boto3
        from jose import jwt, jwk
        from jose.exceptions import JWTError
        
        cognito_client = boto3.client('cognito-idp', REGION)
        
        try:
            keys_response = cognito_client.describe_user_pool(UserPoolId=USER_POOL_ID)
            user_pool = keys_response['UserPool']
            jwks_uri = user_pool.get('Domain', '') + '/.well-known/jwks.json'
            
            keys = {}
            try:
                import urllib.request
                jwks_json = json.loads(urllib.request.urlopen(jwks_uri).read())
                for key in jwks_json.get('keys', []):
                    keys[key['kid']] = key
            except Exception as e:
                print(f"Failed to fetch JWKS: {e}")
                keys = {}
        except Exception as e:
            print(f"Failed to get JWKS URI: {e}")
            keys = {}
        
        try:
            claims = jwt.decode(
                token, 
                keys, 
                audience=USER_POOL_APP_CLIENT_ID,
                issuer=f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
            )
        except JWTError as e:
            print(f"JWT validation failed: {e}")
            return generate_policy(False, 'Deny', event.get('routeArn', event.get('methodArn', '*')))
        
        user_id = claims.get('username') or claims.get('cognito:username') or claims.get('sub')
        
        if not user_id:
            print("Unable to extract user ID from token")
            return generate_policy(False, 'Deny', event.get('routeArn', event.get('methodArn', '*')))
        
        principal_id = user_id
        route_arn = event.get('routeArn', event.get('methodArn', '*'))
        
        return generate_policy(True, 'Allow', route_arn, principal_id, claims)
        
    except Exception as e:
        print(f"Authorizer error: {str(e)}")
        return generate_policy(False, 'Deny', event.get('routeArn', event.get('methodArn', '*')))


def generate_policy(effect, action, resource, principal_id='anonymous', context=None):
    policy = {
        'isAuthorized': effect,
        'principalId': principal_id,
    }
    if context:
        policy['context'] = {
            'userId': context.get('username') or context.get('cognito:username') or context.get('sub'),
            'email': context.get('email', ''),
        }
    return policy