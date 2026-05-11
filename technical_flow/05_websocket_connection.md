# WebSocket Connection

This document describes the WebSocket connection establishment, authentication, and disconnection flow.

## Overview

WebSocket connections enable real-time bidirectional communication between the frontend and backend. The application uses API Gateway WebSocket API to maintain persistent connections for instant message delivery.

## Key Resources
- **WebSocket API ID**: `7477wqg01f`
- **WebSocket API Name**: `family-messenger-websocket`
- **Stage**: `$default`
- **Endpoint**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`
- **Authorizer**: `family-messenger-websocket` (Request authorizer)

## WebSocket Routes

| Route | Lambda Handler | Authentication | Purpose |
|-------|--------------|----------------|---------|
| `$connect` | `family-messenger-connect-handler` | CUSTOM (authorizer) | Establish connection |
| `$disconnect` | `family-messenger-disconnect-handler` | NONE | Close connection |
| `sendMessage` | `family-messenger-message-handler` | NONE | Send message |

## Connection Flow

### Step 1: Frontend Initiates Connection

```typescript
// frontend/lib/websocket.ts - connect function
const wsUrl = `${WEBSOCKET_ENDPOINT}/$default?Authorization=${encodeURIComponent(idToken)}`;
socket = new WebSocket(wsUrl);
```

### Step 2: API Gateway Intercepts Request

API Gateway receives the WebSocket upgrade request with token in query parameter:

```
wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default?Authorization=<idToken>
```

### Step 3: Authorizer Validates Token

The `family-messenger-authorizer` Lambda is invoked:
1. Extracts token from `route.request.querystring.Authorization`
2. Decodes JWT payload
3. Extracts `cognito:username` or `sub` as userId
4. Returns IAM policy with `isAuthorized: true`

**Important**: The authorizer uses only query string authorization. Using both header and query string causes WebSocket authentication to fail because WebSocket upgrade requests cannot set custom headers.

### Step 4: $connect Lambda Executes

The `family-messenger-connect-handler` Lambda:
1. Receives connectionId from requestContext
2. Optionally extracts userId from authorizer context (if set)
3. Falls back to extracting userId from JWT in query params
4. Stores mapping in DynamoDB table `family-messenger-connections`

### Step 5: DynamoDB Stores Connection

```python
# backend/connect_handler.py - lambda_handler
connections_table.put_item(
    Item={
        'UserId': userId,           # Partition key
        'connectionId': connectionId, # Sort key
        'timestamp': int(time.time() * 1000)
    }
)
```

### Step 6: Connection Established

API Gateway returns 101 Switching Protocols, establishing the WebSocket connection.

## Connection State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBSOCKET CONNECTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

Browser                  API Gateway                Lambda                  DynamoDB
   │                          │                       │                        │
   │  1. new WebSocket()      │                       │                        │
   │     with idToken         │                       │                        │
   │ ─────────────────────────►                       │                        │
   │                          │  2. WebSocket upgrade │                        │
   │                          │     request           │                        │
   │                          │ ─────────────────────►│                        │
   │                          │                       │                        │
   │                          │  3. Invoke authorizer │                        │
   │                          │     (custom authorizer)│                        │
   │                          │ ─────────────────────►│                        │
   │                          │                       │  4. Validate JWT       │
   │                          │                       │     Extract userId     │
   │                          │                       │ ◄────────────────────── │
   │                          │  5. IAM policy         │                        │
   │                          │ ◄───────────────────── │                        │
   │                          │     { isAuthorized: true }                     │
   │                          │                       │                        │
   │                          │  6. Invoke $connect   │                        │
   │                          │     Lambda            │                        │
   │                          │ ─────────────────────►│                        │
   │                          │                       │  7. Store connection   │
   │                          │                       │ ─────────────────────► │
   │                          │                       │ ◄───────────────────── │
   │                          │  8. Return 200        │                        │
   │                          │ ◄───────────────────── │                        │
   │  9. Connection established│                       │                        │
   │ ◄─────────────────────────│                       │                        │
   │     (onopen event)       │                       │                        │
```

## Authorizer Configuration

### Identity Source
```
route.request.querystring.Authorization
```

Only query string is used because WebSocket upgrade requests cannot set custom headers.

### Authorizer Logic

```python
# backend/authorizer.py - lambda_handler
def lambda_handler(event, context):
    token = event.get('queryStringParameters', {}).get('Authorization', '')
    
    # Validate token and extract claims
    payload = decode_jwt(token)
    user_id = payload.get('cognito:username') or payload.get('sub')
    
    # Return IAM policy
    return {
        'principalId': user_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': 'Allow',
                'Resource': '*'
            }]
        },
        'context': {
            'userId': user_id
        }
    }
```

## Disconnect Flow

### Step 1: Connection Closes

Browser disconnects (page close, network loss, or explicit close):

```typescript
socket.close();
```

### Step 2: API Gateway Detects Disconnect

API Gateway automatically detects connection closure.

### Step 3: $disconnect Lambda Executes

The `family-messenger-disconnect-handler` Lambda:
1. Receives connectionId from requestContext
2. Scans DynamoDB for matching connectionId
3. Deletes the connection record

### Step 4: DynamoDB Removes Connection

```python
# backend/disconnect_handler.py - lambda_handler
connections_table.delete_item(
    Key={
        'UserId': userId,
        'connectionId': connectionId
    }
)
```

## Disconnect State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WEBSOCKET DISCONNECT FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

Browser                  API Gateway                Lambda                  DynamoDB
   │                          │                       │                        │
   │  1. socket.close()       │                       │                        │
   │     or page unload       │                       │                        │
   │ ─────────────────────────►                       │                        │
   │                          │  2. Connection closed │                        │
   │                          │ ─────────────────────►│                        │
   │                          │                       │                        │
   │                          │  3. Invoke $disconnect│                        │
   │                          │     Lambda            │                        │
   │                          │ ─────────────────────►│                        │
   │                          │                       │  4. Scan for connection│
   │                          │                       │ ─────────────────────► │
   │                          │                       │  5. Delete connection │
   │                          │                       │ ─────────────────────► │
   │                          │                       │ ◄───────────────────── │
   │                          │                       │                        │
   │                          │  6. Return 200        │                        │
   │                          │ ◄───────────────────── │                        │
```

## Connection Storage Schema

### DynamoDB Table: family-messenger-connections

| Attribute | Type | Description |
|-----------|------|-------------|
| UserId | String (PK) | Cognito username (sub) |
| connectionId | String (SK) | API Gateway connection ID |
| timestamp | Number | Connection establishment time (epoch ms) |

### Example Item
```
{
  "UserId": "9478a478-9081-7018-199b-d5ac8003f775",
  "connectionId": "abc123xyz",
  "timestamp": 1778517000000
}
```

## Multi-Device Support

Each device maintains its own WebSocket connection:

```
User A (Device 1) ──► Connection: abc123 ──► DynamoDB: UserId A → abc123
User A (Device 2) ──► Connection: def456 ──► DynamoDB: UserId A → def456
```

When sending a message, the message_handler sends to all active connections for the recipient.

## Connection Management Functions

### Store Connection
```python
# backend/utils.py - store_connection
connections_table.put_item(
    Item={
        'UserId': userId,
        'connectionId': connectionId,
        'timestamp': int(time.time() * 1000)
    }
)
```

### Get User Connections
```python
# backend/utils.py - get_user_connections
response = connections_table.query(
    KeyConditionExpression=Key('UserId').eq(userId)
)
return response.get('Items', [])
```

### Delete Connection
```python
# backend/utils.py - delete_connection
response = connections_table.scan(
    FilterExpression=Key('connectionId').eq(connectionId)
)
# Delete each matching item
```

## WebSocket Client Functions

### Connect
```typescript
// frontend/lib/websocket.ts - connect function
export function connect(token: string): Promise<boolean> {
  const wsUrl = `${endpoint}/$default?Authorization=${encodeURIComponent(token)}`;
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    notifyConnectionChange('connected');
  };
  
  socket.onclose = () => {
    notifyConnectionChange('disconnected');
    // Auto-reconnect logic
  };
}
```

### Send Message
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

### Disconnect
```typescript
// frontend/lib/websocket.ts - disconnect function
export function disconnect(): void {
  socket.close(1000, 'User disconnected');
  socket = null;
}
```

## Reconnection Logic

The WebSocket client implements exponential backoff reconnection:

```typescript
socket.onclose = (event) => {
  if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
    setTimeout(() => {
      connect(token);  // Retry with exponential backoff
    }, delay);
  }
};
```

## CloudWatch Logs

### Log Groups
- `/aws/lambda/family-messenger-authorizer`
- `/aws/lambda/family-messenger-connect-handler`
- `/aws/lambda/family-messenger-disconnect-handler`
- `/aws/apigateway/family-messenger/websocket`

### Viewing Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-connect-handler \
  --start-time 1778517000000
```

## Troubleshooting

### "WebSocket connection failed"
1. Check token validity (not expired)
2. Verify authorizer identity source configuration
3. Check CloudWatch logs for `family-messenger-authorizer`

### "Connection not established"
1. Verify `connect_handler` Lambda execution
2. Check DynamoDB table `family-messenger-connections` has entry
3. Verify IAM permissions for Lambda

### "Messages not delivered"
1. Check recipient has active connection in DynamoDB
2. Verify `message_handler` Lambda execution
3. Check API Gateway Management API permissions

## Next Steps

- [Messaging Flow](06_messaging_flow.md) - Message routing between users
- [CloudWatch Logs](14_cloudwatch_logs.md) - Viewing Lambda logs
