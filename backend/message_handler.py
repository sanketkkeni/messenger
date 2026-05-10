import json
import base64
from utils import (
    get_connection_user,
    get_user_connections,
    get_conversation_id,
    save_message,
    send_websocket_message,
    create_response
)


def validate_token(token: str):
    """Extract userId from JWT token payload."""
    try:
        if not token:
            return None
        if token.startswith('Bearer '):
            token = token[7:]
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email')
        return user_id
    except Exception:
        return None


def lambda_handler(event, context):
    """
    Handle WebSocket sendMessage route
    Process incoming messages and route to recipients
    """
    try:
        print(f"DEBUG: message_handler event: {json.dumps(event)}")
        
        request_context = event.get('requestContext', {})
        connection_id = request_context.get('connectionId')
        
        # Get sender_id from connection mapping in DynamoDB
        # This works because we stored UserId -> connectionId during $connect
        sender_id = get_connection_user(connection_id)
        print(f"DEBUG: sender_id from DynamoDB: {sender_id}")

        # Fallback: check query params (for testing via direct Lambda invocation)
        if not sender_id:
            query_params = event.get('queryStringParameters', {}) or {}
            auth_param = query_params.get('Authorization') or query_params.get('authorization')
            if auth_param:
                sender_id = validate_token(auth_param)
                print(f"DEBUG: sender_id from token fallback: {sender_id}")

        print(f"DEBUG: final sender_id: {sender_id}")
        
        connection_id = request_context.get('connectionId')
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        action = body.get('action')
        recipient_id = body.get('recipientId')
        text = body.get('text')
        
        if action != 'sendMessage':
            return create_response(400, {'message': 'Invalid action'})
        
        if not recipient_id:
            return create_response(400, {'message': 'Missing recipientId'})
        
        if not text:
            return create_response(400, {'message': 'Missing text'})
        
        if recipient_id == sender_id:
            return create_response(400, {'message': 'Cannot send message to yourself'})
        
        conversation_id = get_conversation_id(sender_id, recipient_id)
        save_message(conversation_id, sender_id, text)
        
        recipient_connections = get_user_connections(recipient_id)
        
        if recipient_connections:
            domain_name = request_context.get('domainName')
            stage = request_context.get('stage')
            endpoint_url = f"https://{domain_name}/{stage}"
            
            message_data = {
                'senderId': sender_id,
                'text': text,
                'timestamp': int(event.get('requestTimeEpoch', 0)),
                'conversationId': conversation_id
            }
            
            sent_count = 0
            for conn in recipient_connections:
                recipient_conn_id = conn.get('connectionId')
                if recipient_conn_id:
                    success = send_websocket_message(recipient_conn_id, message_data, endpoint_url)
                    if success:
                        sent_count += 1
            
            print(f"Message sent to {sent_count} connection(s) for recipient {recipient_id}")
        else:
            print(f"Recipient {recipient_id} is offline, message saved but not delivered")
        
        return create_response(200, {
            'message': 'Message sent',
            'conversationId': conversation_id,
            'recipientOnline': len(recipient_connections) > 0
        })
        
    except Exception as e:
        print(f"Message handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})