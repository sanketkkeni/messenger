import json
from utils import get_messages, get_conversation_id, validate_jwt_token, create_response

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

CORS_MULTI_HEADERS = {
    'Content-Type': ['application/json'],
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Methods': ['GET', 'OPTIONS'],
    'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'],
}


def lambda_handler(event, context):
    """
    Handle GET /conversations/{conversationId}/messages
    Returns message history for a conversation
    """
    try:
        print(f"DEBUG: history_handler event: {json.dumps(event)}")

        # Handle CORS preflight
        method = event.get('requestContext', {}).get('http', {}).get('method', '')
        if method == 'OPTIONS' or event.get('type') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': ''
            }

        # Get authorization header
        headers = event.get('headers', {}) or {}
        auth_header = headers.get('Authorization') or headers.get('authorization')

        if not auth_header:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': json.dumps({'message': 'Missing authorization header'})
            }

        user_id = validate_jwt_token(auth_header)
        if not user_id:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': json.dumps({'message': 'Invalid token'})
            }

        # Get conversationId from path parameters
        path_params = event.get('pathParameters', {}) or {}
        conversation_id = path_params.get('conversationId')

        if not conversation_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': json.dumps({'message': 'Missing conversationId'})
            }

        # Verify user is part of this conversation
        parts = conversation_id.split('#')
        if len(parts) != 2 or user_id not in parts:
            return {
                'statusCode': 403,
                'headers': CORS_HEADERS,
                'multiValueHeaders': CORS_MULTI_HEADERS,
                'body': json.dumps({'message': 'Not authorized to view this conversation'})
            }

        # Get limit from query params (default 50)
        query_params = event.get('queryStringParameters', {}) or {}
        limit = int(query_params.get('limit', 50))
        limit = min(limit, 100)  # Cap at 100

        messages = get_messages(conversation_id, limit)

        # Convert DynamoDB Decimal types to regular Python types for JSON serialization
        serializable_messages = []
        for msg in messages:
            serializable_messages.append({
                'conversationId': msg.get('conversationId'),
                'timestamp': int(msg.get('timestamp', 0)),
                'senderId': msg.get('senderId'),
                'message': msg.get('message')
            })

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'multiValueHeaders': CORS_MULTI_HEADERS,
            'body': json.dumps({
                'messages': serializable_messages,
                'conversationId': conversation_id,
                'count': len(serializable_messages)
            })
        }

    except Exception as e:
        print(f"History handler error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'multiValueHeaders': CORS_MULTI_HEADERS,
            'body': json.dumps({'message': 'Internal server error'})
        }
