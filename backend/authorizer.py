import json
import os
import base64

USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

def lambda_handler(event, context):
    try:
        print(f"DEBUG: Authorizer event keys: {event.keys()}")
        print(f"DEBUG: routeArn: {event.get('routeArn', 'N/A')}")
        print(f"DEBUG: type: {event.get('type', 'N/A')}")
        print(f"DEBUG: methodArn: {event.get('methodArn', 'N/A')}")
        print(f"DEBUG: queryStringParameters: {json.dumps(event.get('queryStringParameters', {}))}")
        print(f"DEBUG: identitySource: {json.dumps(event.get('identitySource', []))}")

        headers = event.get('headers', {}) or {}
        query_params = event.get('queryStringParameters', {}) or {}
        multi_value_headers = event.get('multiValueHeaders', {}) or {}

        auth_values = []
        auth_values.extend(headers.get('Authorization', headers.get('authorization', '')).split(','))
        auth_values.extend(headers.get('authorization', '').split(','))
        auth_values.extend(multi_value_headers.get('Authorization', []))
        auth_values.extend(multi_value_headers.get('authorization', []))
        auth_values.extend(query_params.get('Authorization', query_params.get('authorization', '')).split(','))

        token = None
        for val in auth_values:
            val = val.strip()
            if val:
                token = val
                break

        print(f"DEBUG: auth_values count: {len(auth_values)}")

        if not token:
            print("No Authorization token provided")
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

        if token.startswith('Bearer '):
            token = token[7:]

        print(f"DEBUG: token prefix: {token[:80]}...")
        print(f"DEBUG: token length: {len(token)}")

        try:
            parts = token.split('.')
            if len(parts) != 3:
                print(f"Invalid JWT format: token has {len(parts)} parts")
                return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

            payload_b64 = parts[1]
            padding = 4 - (len(payload_b64) % 4)
            if padding != 4:
                payload_b64 += '=' * padding

            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            print(f"Decoded token payload: {json.dumps(payload)}")

        except Exception as e:
            print(f"Failed to decode token: {e}")
            return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))

        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email', 'unknown')

        print(f"Authorized user: {user_id}")

        route_arn = event.get('routeArn', event.get('methodArn', '*'))
        return generate_allow_response(route_arn, user_id, payload)

    except Exception as e:
        print(f"Authorizer error: {str(e)}")
        return generate_deny_response(event.get('routeArn', event.get('methodArn', '*')))


def generate_allow_response(route_arn, principal_id, context=None):
    return {
        'isAuthorized': True,
        'principalId': principal_id,
        'context': {
            'userId': principal_id,
        }
    }


def generate_deny_response(resource):
    return {
        'isAuthorized': False,
        'principalId': 'anonymous',
    }