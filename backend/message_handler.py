import json
from utils import (
    get_connection_user, 
    get_user_connections, 
    get_conversation_id, 
    save_message, 
    send_websocket_message, 
    create_response
)

def lambda_handler(event, context):
    """
    Handle WebSocket sendMessage route
    Process incoming messages and route to recipients
    """
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        sender_id = authorizer.get('userId')
        
        if not sender_id:
            return create_response(401, {'message': 'Unauthorized'})
        
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