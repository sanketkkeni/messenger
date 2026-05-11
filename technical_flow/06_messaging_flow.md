# Messaging Flow

This document describes how messages are sent, routed, and delivered between users in real-time.

## Overview

The messaging system uses a publish-subscribe pattern where messages are sent through the WebSocket connection, processed by Lambda, and delivered to the recipient via API Gateway Management API.

## Key Resources
- **Message Handler Lambda**: `family-messenger-message-handler`
- **Messages DynamoDB Table**: `family-messenger-messages`
- **Connections DynamoDB Table**: `family-messenger-connections`
- **API Gateway Management API**: Used to push messages to connected clients

## Message Send Flow

### Step 1: User Types and Sends Message

```typescript
// frontend/pages/chat.tsx - handleSend function
const handleSend = () => {
  const conversationId = getConversationId(user.username, recipient.username);

  // Add to local state immediately (optimistic update)
  const newMessage = {
    senderId: currentUserId,
    text: messageText,
    timestamp: Date.now(),
    conversationId
  };
  setMessages(prev => [...prev, newMessage]);

  // Send via WebSocket
  sendMessage(recipient.username, messageText);
};
```

### Step 2: Frontend Sends WebSocket Message

```typescript
// frontend/lib/websocket.ts - sendMessage function
export function sendMessage(recipientId: string, text: string): boolean {
  const message = {
    action: 'sendMessage',
    recipientId,
    text
  };
  socket.send(JSON.stringify(message));
  return true;
}
```

### Step 3: API Gateway Routes to message_handler

The WebSocket API routes the message to `family-messenger-message-handler`:

```
Browser → WebSocket API ($default route) → message_handler Lambda
```

### Step 4: message_handler Processes Message

```python
# backend/message_handler.py - lambda_handler
def lambda_handler(event, context):
    # Get connection ID from request context
    connection_id = event['requestContext']['connectionId']

    # Get sender ID from DynamoDB (stored during $connect)
    sender_id = get_connection_user(connection_id)

    # Parse message body
    body = json.loads(event['body'])
    recipient_id = body['recipientId']
    text = body['text']

    # Generate conversation ID (sorted IDs to ensure consistency)
    conversation_id = get_conversation_id(sender_id, recipient_id)

    # Save message to DynamoDB
    save_message(conversation_id, sender_id, text)

    # Get recipient's connections
    recipient_connections = get_user_connections(recipient_id)

    # Send to all recipient connections
    for conn in recipient_connections:
        send_websocket_message(conn['connectionId'], message_data, endpoint_url)
```

### Step 5: Message Saved to DynamoDB

```python
# backend/utils.py - save_message
messages_table.put_item(
    Item={
        'conversationId': conversation_id,
        'timestamp': int(time.time() * 1000),
        'senderId': sender_id,
        'message': text
    }
)
```

### Step 6: Recipient Connections Retrieved

```python
# backend/utils.py - get_user_connections
response = connections_table.query(
    KeyConditionExpression=Key('UserId').eq(recipient_id)
)
return response.get('Items', [])
```

### Step 7: Message Delivered to Recipient

```python
# backend/utils.py - send_websocket_message
apigatewaymanagementapi_client.post_to_connection(
    ConnectionId=connection_id,
    Data=json.dumps(message_data)
)
```

## Message Flow State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Sender                  WebSocket                  message_handler              Recipient
Browser                   API                       Lambda                       DynamoDB
   │                       │                            │                            │
   │  1. sendMessage()    │                            │                            │
   │     with recipientId │                            │                            │
   │ ────────────────────►                            │                            │
   │                       │  2. Route to handler       │                            │
   │                       │ ─────────────────────────►│                            │
   │                       │                            │                            │
   │                       │  3. Invoke Lambda         │                            │
   │                       │ ──────────────────────────►│                            │
   │                       │                            │                            │
   │                       │                            │  4. Get sender from DynamoDB │
   │                       │                            │ ──────────────────────────► │
   │                       │                            │ ◄────────────────────────── │
   │                       │                            │     (UserId lookup)        │
   │                       │                            │                            │
   │                       │                            │  5. Parse message           │
   │                       │                            │     Extract recipientId     │
   │                       │                            │     Extract text            │
   │                       │                            │                            │
   │                       │                            │  6. Save to DynamoDB        │
   │                       │                            │ ──────────────────────────► │
   │                       │                            │ ◄────────────────────────── │
   │                       │                            │     (messages table)       │
   │                       │                            │                            │
   │                       │                            │  7. Get recipient conn.    │
   │                       │                            │ ──────────────────────────► │
   │                       │                            │ ◄────────────────────────── │
   │                       │                            │     (connections table)     │
   │                       │                            │                            │
   │                       │                            │  8. PostToConnection()      │
   │                       │                            │ ──────────────────────────► │
   │                       │                            │                            │
   │  9. No response to     │                            │                            │
   │     sender (async)    │                            │                            │
   │ ◄─────────────────────│                            │                            │
   │                       │                            │                            │
   │                       │                            │                      ┌─────┴─────┐
   │                       │                            │                      │  API GW   │
   │                       │                            │                      │  Mgmt API │
   │                       │                            │                      └─────┬─────┘
   │                       │                            │                            │
   │                       │                            │                   10. Push to
   │                       │                            │                   recipient
   │                       │                            │ ◄──────────────────────────────────
   │                       │                            │                            │
   │                       │                      ┌──────┴──────┐                       │
   │                       │                      │  Recipient  │                       │
   │                       │                      │  Browser    │                       │
   │                       │                      └─────────────┘                       │
   │                       │                            │                            │
   │                       │                            │  11. onmessage event       │
   │                       │                            │ ◄───────────────────────── │
```

## Conversation ID Generation

Conversation IDs are generated by sorting the two user IDs:

```python
# backend/utils.py - get_conversation_id
def get_conversation_id(user1_id, user2_id):
    sorted_ids = sorted([user1_id, user2_id])
    return f"{sorted_ids[0]}#{sorted_ids[1]}"
```

### Example
```
User A: "user-123"
User B: "user-456"

Conversation ID: "user-123#user-456"
```

This ensures the same conversation ID regardless of which user initiates the conversation.

## Message Data Structure

### WebSocket Message (Client → Server)
```json
{
  "action": "sendMessage",
  "recipientId": "user-456",
  "text": "Hello!"
}
```

### Push Message (Server → Client)
```json
{
  "senderId": "user-123",
  "text": "Hello!",
  "timestamp": 1778517000000,
  "conversationId": "user-123#user-456"
}
```

## Message Storage Schema

### DynamoDB Table: family-messenger-messages

| Attribute | Type | Description |
|-----------|------|-------------|
| conversationId | String (PK) | Sorted user ID pair |
| timestamp | Number (SK) | Message time (epoch milliseconds) |
| senderId | String | Username of sender |
| message | String | Message text content |

### Example Item
```
{
  "conversationId": "user-123#user-456",
  "timestamp": 1778517000000,
  "senderId": "user-123",
  "message": "Hello!"
}
```

## Optimistic Updates

The frontend adds messages to local state immediately for instant UI feedback:

```typescript
// frontend/pages/chat.tsx - handleSend
const handleSend = () => {
  // 1. Add to local state (optimistic)
  setMessages(prev => [...prev, newMessage]);

  // 2. Send via WebSocket (server handles routing)
  sendMessage(recipientId, text);
};
```

This ensures the sender sees their message instantly without waiting for server confirmation.

## Duplicate Prevention

The WebSocketContext deduplicates incoming messages:

```typescript
// frontend/context/WebSocketContext.tsx - handleNewMessage
const handleNewMessage = (data: Message) => {
  setMessages((prev) => {
    const isDuplicate = prev.some(
      m => m.senderId === data.senderId &&
           m.text === data.text &&
           m.timestamp === data.timestamp
    );
    if (isDuplicate) return prev;
    return [...prev, data];
  });
};
```

## Multi-Device Messaging

If the recipient has multiple devices connected, messages are sent to all connections:

```python
# backend/message_handler.py
recipient_connections = get_user_connections(recipient_id)

for conn in recipient_connections:
    recipient_conn_id = conn.get('connectionId')
    if recipient_conn_id:
        send_websocket_message(recipient_conn_id, message_data, endpoint_url)
```

Example:
```
User A sends to User B
User B has 2 devices connected:
  - Device 1: connectionId "abc123"
  - Device 2: connectionId "def456"

Both devices receive the message
```

## Offline Message Handling

Messages are always saved to DynamoDB regardless of recipient online status:

```python
# backend/message_handler.py
# Always save first
save_message(conversation_id, sender_id, text)

# Then try to deliver
recipient_connections = get_user_connections(recipient_id)

if recipient_connections:
    # Deliver via WebSocket
    for conn in recipient_connections:
        send_websocket_message(conn['connectionId'], message_data)
else:
    # Recipient offline - message saved but not delivered
    print(f"Recipient {recipient_id} is offline, message saved but not delivered")
```

When the recipient comes online, they can load message history via the REST API.

## Error Handling

### Invalid Recipient
```python
if recipient_id == sender_id:
    return create_response(400, {'message': 'Cannot send message to yourself'})
```

### Missing Fields
```python
if not recipient_id:
    return create_response(400, {'message': 'Missing recipientId'})
if not text:
    return create_response(400, {'message': 'Missing text'})
```

### Delivery Failure
If a message fails to send (e.g., connection no longer exists), it's logged but doesn't fail the request:

```python
for conn in recipient_connections:
    recipient_conn_id = conn.get('connectionId')
    if recipient_conn_id:
        success = send_websocket_message(recipient_conn_id, message_data, endpoint_url)
        if success:
            sent_count += 1
```

## CloudWatch Logs

### Log Groups
- `/aws/lambda/family-messenger-message-handler`
- `/aws/apigateway/family-messenger/websocket`

### Key Log Messages
```
DEBUG: message_handler event: {...}
DEBUG: sender_id from DynamoDB: user-123
DEBUG: final sender_id: user-123
Message sent to 1 connection(s) for recipient user-456
```

## Troubleshooting

### "Message not delivered to recipient"
1. Check recipient has active connection in `family-messenger-connections`
2. Verify `message_handler` Lambda executed successfully
3. Check CloudWatch logs for `send_websocket_message` results

### "Message not saved to DynamoDB"
1. Verify `MESSAGES_TABLE_NAME` environment variable is set
2. Check Lambda IAM permissions for DynamoDB PutItem

### "Message appears twice for sender"
1. The sender already has the message in local state from optimistic update
2. The message from WebSocket push creates a duplicate
3. Duplicate prevention in WebSocketContext should handle this

## Next Steps

- [Message History](07_message_history.md) - Retrieving past messages
- [API Endpoints](08_api_endpoints.md) - REST API for history retrieval
