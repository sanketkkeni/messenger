import json
from utils import store_connection, create_response

def lambda_handler(event, context):
    """
    Handle WebSocket $connect route
    Authenticate user and store connection information
    """
    try:
        # Extract user ID from authorizer context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        user_id = authorizer.get('userId')
        
        if not user_id:
            print("No user ID in authorizer context")
            return create_response(401, {'message': 'Unauthorized'})
        
        # Extract connection ID
        connection_id = request_context.get('connectionId')
        if not connection_id:
            print("No connection ID in request context")
            return create_response(400, {'message': 'Bad request'})
        
        # Store the connection
        success = store_connection(user_id, connection_id)
        if not success:
            print("Failed to store connection")
            return create_response(500, {'message': 'Internal server error'})
        
        print(f"User {user_id} connected with connection ID {connection_id}")
        return create_response(200, {'message': 'Connected'})
        
    except Exception as e:
        print(f"Connect handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})