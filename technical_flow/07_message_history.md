# Message History

This document describes how chat history is retrieved and displayed to users.

## Overview

When a user opens a conversation, the application retrieves the message history from DynamoDB through the REST API. This provides context for ongoing conversations.

## Key Resources
- **History Handler Lambda**: `family-messenger-history-handler`
- **Messages DynamoDB Table**: `family-messenger-messages`
- **REST API Endpoint**: `GET /conversations/{conversationId}/messages`
- **REST API ID**: `wka1crhece`

## History Retrieval Flow

### Step 1: User Selects Conversation

```typescript
// frontend/pages/chat.tsx - useEffect for loading history
useEffect(() => {
  if (!selectedUser || !user) return;

  const loadHistory = async () => {
    const conversationId = getConversationId(user.username, selectedUser.username);
    const history = await fetchHistory(tokens.accessToken, conversationId);

    // Add history to messages state
    setMessages(prev => [...prev, ...historyMessages]);
  };

  loadHistory();
}, [selectedUser]);
```

### Step 2: Frontend Calls REST API

```typescript
// frontend/lib/websocket.ts - fetchHistory function
export async function fetchHistory(
  accessToken: string,
  conversationId: string,
  limit: number = 50
): Promise<any[]> {
  const response = await fetch(
    `${REST_API_ENDPOINT}/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();
  return data.messages || [];
}
```

### Step 3: API Gateway Routes Request

```
Browser → REST API (wka1crhece) → history_handler Lambda
```

The REST API route `GET /conversations/{conversationId}/messages` routes to `family-messenger-history-handler`.

### Step 4: history_handler Validates Request

```python
# backend/history_handler.py - lambda_handler

# 1. Validate authorization
user_id = validate_jwt_token(auth_header)
if not user_id:
    return { 'statusCode': 401 }

# 2. Extract conversation ID from path
conversation_id = path_params.get('conversationId')

# 3. Verify user is part of conversation
parts = conversation_id.split('#')
if user_id not in parts:
    return { 'statusCode': 403 }  # Not authorized
```

### Step 5: Query DynamoDB

```python
# backend/utils.py - get_messages
def get_messages(conversation_id, limit=50):
    response = messages_table.query(
        KeyConditionExpression=Key('conversationId').eq(conversation_id),
        ScanIndexForward=False,  # Descending order (newest first)
        Limit=limit
    )
    return response.get('Items', [])
```

### Step 6: Return Messages

```python
# backend/history_handler.py
messages = get_messages(conversation_id, limit)

return {
    'statusCode': 200,
    'headers': CORS_HEADERS,
    'multiValueHeaders': CORS_MULTI_HEADERS,
    'body': json.dumps({
        'messages': serializable_messages,
        'conversationId': conversation_id,
        'count': len(messages)
    })
}
```

## History Flow State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE HISTORY FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User                    Frontend                     REST API                history_handler
Browser                    │                           Gateway                   Lambda
   │                       │                             │                        │
   │  1. Select contact   │                             │                        │
   │ ────────────────────►                             │                        │
   │                       │                             │                        │
   │                       │  2. fetchHistory()          │                        │
   │                       │ ────────────────────────────►                        │
   │                       │                             │                        │
   │                       │  3. GET /conversations/     │                        │
   │                       │     {id}/messages          │                        │
   │                       │ ───────────────────────────►│                        │
   │                       │                             │                        │
   │                       │                             │  4. Invoke Lambda     │
   │                       │                             │ ──────────────────────►│
   │                       │                             │                        │
   │                       │                             │  5. Validate JWT      │
   │                       │                             │ ──────────────────────►│
   │                       │                             │                        │
   │                       │                             │  6. Verify auth       │
   │                       │                             │ ──────────────────────►│
   │                       │                             │                        │
   │                       │                             │  7. Query DynamoDB     │
   │                       │                             │ ──────────────────────►│
   │                       │                             │                        │
   │                       │                             │  8. Return messages   │
   │                       │                             │ ◄─────────────────────│
   │                       │                             │     (JSON response)    │
   │                       │  9. Return messages         │                        │
   │                       │ ◄───────────────────────────│                        │
   │                       │     { messages: [...] }    │                        │
   │                       │                             │                        │
   │  10. Display history │                             │                        │
   │ ◄───────────────────│                             │                        │
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Maximum messages to return (max: 100) |

### Example Request
```
GET /conversations/user-123%23user-456/messages?limit=50
Authorization: Bearer <accessToken>
```

## Response Format

### Success Response (200)
```json
{
  "messages": [
    {
      "conversationId": "user-123#user-456",
      "timestamp": 1778517000000,
      "senderId": "user-123",
      "message": "Hello!"
    },
    {
      "conversationId": "user-123#user-456",
      "timestamp": 1778517100000,
      "senderId": "user-456",
      "message": "Hi there!"
    }
  ],
  "conversationId": "user-123#user-456",
  "count": 2
}
```

### Error Responses
| Status | Body | Description |
|--------|------|-------------|
| 400 | `{"message": "Missing conversationId"}` | Path param missing |
| 401 | `{"message": "Missing authorization header"}` | No token |
| 401 | `{"message": "Invalid token"}` | Token validation failed |
| 403 | `{"message": "Not authorized to view this conversation"}` | User not part of conversation |
| 500 | `{"message": "Internal server error"}` | Server error |

## DynamoDB Query

### Query Configuration
- **Table**: `family-messenger-messages`
- **Key Condition**: `conversationId = :cid`
- **Sort Direction**: `ScanIndexForward: false` (newest first)
- **Limit**: 50 messages (configurable up to 100)

### Query Result (before reverse)
```
[
  { timestamp: 1778517200000, ... },  // Newest
  { timestamp: 1778517100000, ... },
  { timestamp: 1778517000000, ... }   // Oldest
]
```

### Post-Processing (reversed for display)
```
[
  { timestamp: 1778517000000, ... },  // Oldest first (chat order)
  { timestamp: 1778517100000, ... },
  { timestamp: 1778517200000, ... } // Newest
]
```

## Message Deduplication

The frontend avoids duplicate messages by checking existing IDs:

```typescript
// frontend/pages/chat.tsx - loadHistory
const historyMessages = history.map((msg: any) => ({
  senderId: msg.senderId,
  text: msg.message,
  timestamp: msg.timestamp,
  conversationId
}));

setMessages(prev => {
  const existingIds = new Set(
    prev.map(m => `${m.senderId}-${m.text}-${m.timestamp}`)
  );
  const newMessages = historyMessages.filter(
    m => !existingIds.has(`${m.senderId}-${m.text}-${m.timestamp}`)
  );
  return [...prev, ...newMessages];
});
```

## Integration with Real-Time Messaging

Messages from history are merged with real-time WebSocket messages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE LIST MERGING                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│  History (REST) │           │  Real-Time     │           │  Combined List │
│                 │           │  (WebSocket)   │           │                 │
│  - Message A    │           │                 │           │  - Message A    │
│  - Message B    │           │  - Message C    │           │  - Message B    │
│                 │           │                 │           │  - Message C    │
└─────────────────┘           └─────────────────┘           └─────────────────┘
         │                              │                              │
         │                              │                              │
         └──────────────────────────────┴──────────────────────────────┘
                                              │
                                              ▼
                                    setMessages([A, B, C])
```

## CORS Configuration

The history endpoint requires CORS for browser requests:

### Preflight Request
```
OPTIONS /conversations/{conversationId}/messages
```

### Preflight Response
```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
}
```

## Decimal Serialization

DynamoDB returns numbers as `Decimal` type, which is not JSON serializable:

### Problem
```python
messages = messages_table.query(...)  # Returns Decimal types
return json.dumps({'messages': messages})  # ERROR: Decimal not JSON serializable
```

### Solution
```python
serializable_messages = []
for msg in messages:
    serializable_messages.append({
        'conversationId': msg.get('conversationId'),
        'timestamp': int(msg.get('timestamp', 0)),  # Convert Decimal to int
        'senderId': msg.get('senderId'),
        'message': msg.get('message')
    })
```

## Loading State

The frontend shows a loading indicator while fetching history:

```typescript
// frontend/pages/chat.tsx
const [loadingHistory, setLoadingHistory] = useState(false);

useEffect(() => {
  setLoadingHistory(true);
  const history = await fetchHistory(...);
  setMessages(prev => [...prev, ...historyMessages]);
  setLoadingHistory(false);
}, [selectedUser]);
```

### UI Display
```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-4">
  {loadingHistory ? (
    <div className="text-center text-gray-400 py-8">
      Loading message history...
    </div>
  ) : filteredMessages.length === 0 ? (
    <div className="text-center text-gray-400 py-8">
      No messages yet. Start the conversation!
    </div>
  ) : (
    filteredMessages.map(...)
  )}
</div>
```

## CloudWatch Logs

### Log Groups
- `/aws/lambda/family-messenger-history-handler`
- `/aws/apigateway/family-messenger/rest`

### Key Log Messages
```
DEBUG: history_handler event: {...}
History handler error: Object of type Decimal is not JSON serializable
```

## Troubleshooting

### "CORS error on history fetch"
1. Verify history_handler returns CORS headers
2. Check OPTIONS route exists in API Gateway
3. Verify `multiValueHeaders` is included

### "Empty history"
1. Check messages exist in DynamoDB table
2. Verify conversationId format is correct
3. Check user is part of the conversation

### "Duplicate messages"
1. The deduplication logic may not be working
2. Check existingIds set construction
3. Verify timestamp comparison

## Next Steps

- [API Endpoints](08_api_endpoints.md) - Complete REST API documentation
- [Lambda Functions](09_lambda_functions.md) - Detailed Lambda configuration
