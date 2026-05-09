import json
from utils import delete_connection, create_response

def lambda_handler(event, context):
    """
    Handle WebSocket $disconnect route
    Remove connection information
    """
    try:
        # Extract connection ID
        request_context = event.get('requestContext', {})
        connection_id = request_context.get('connectionId')
        
        if not connection_id:
            print("No connection ID in request context")
            return create_response(400, {'message': 'Bad request'})
        
        # Delete the connection
        success = delete_connection(connection_id)
        if not success:
            print("Failed to delete connection")
            # We still return 200 because the connection is already gone from API Gateway's perspective
            # But we log the error for investigation
        
        print(f"Connection {connection_id} disconnected")
        return create_response(200, {'message': 'Disconnected'})
        
    except Exception as e:
        print(f"Disconnect handler error: {str(e)}")
        return create_response(500, {'message': 'Internal server error'})