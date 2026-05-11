# API Endpoints

This document provides complete documentation for all REST API endpoints used in the application.

## Overview

The application uses two API Gateway APIs:
- **WebSocket API** (`7477wqg01f`) - For real-time messaging
- **REST API** (`wka1crhece`) - For user data and message history

## REST API

**Base URL**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com`

### Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/users` | GET | List all registered users | Yes |
| `/conversations/{conversationId}/messages` | GET | Get message history | Yes |

---

## GET /users

Returns a list of all registered users in the Cognito User Pool.

### Request

```http
GET /users HTTP/1.1
Host: wka1crhece.execute-api.us-east-1.amazonaws.com
Authorization: Bearer <accessToken>
```

### Response

#### Success (200)
```json
{
  "users": [
    {
      "username": "9478a478-9081-7018-199b-d5ac8003f775",
      "email": "skkeni06@gmail.com",
      "email_verified": true,
      "created_at": "2026-05-10T15:30:00Z",
      "status": "CONFIRMED",
      "enabled": true
    },
    {
      "username": "2498c418-d031-7049-64d6-89b418a51ae6",
      "email": "skkeni04@gmail.com",
      "email_verified": true,
      "created_at": "2026-05-10T14:00:00Z",
      "status": "CONFIRMED",
      "enabled": true
    }
  ],
  "count": 2,
  "cached": false
}
```

#### Error (401 Unauthorized)
```json
{
  "message": "Missing authorization header"
}
```

#### Error (500 Internal Server Error)
```json
{
  "message": "Internal server error"
}
```

### Caching

The users_handler implements in-memory caching:
- **Cache TTL**: 30 seconds
- **Cache Key**: All users in the User Pool
- **Cache Invalidation**: After TTL expires

### Lambda Handler
- **Function Name**: `family-messenger-users-handler`
- **Handler**: `users_handler.lambda_handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### CloudWatch Log Group
`/aws/lambda/family-messenger-users-handler`

---

## GET /conversations/{conversationId}/messages

Retrieves message history for a specific conversation.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| conversationId | string | Yes | Conversation ID (format: `userId1#userId2`) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Maximum messages to return (max: 100) |

### Request

```http
GET /conversations/9478a478-9081-7018-199b-d5ac8003f775%232498c418-d031-7049-64d6-89b418a51ae6/messages?limit=50 HTTP/1.1
Host: wka1crhece.execute-api.us-east-1.amazonaws.com
Authorization: Bearer <accessToken>
```

### Response

#### Success (200)
```json
{
  "messages": [
    {
      "conversationId": "9478a478-9081-7018-199b-d5ac8003f775#2498c418-d031-7049-64d6-89b418a51ae6",
      "timestamp": 1778517000000,
      "senderId": "9478a478-9081-7018-199b-d5ac8003f775",
      "message": "Hello!"
    },
    {
      "conversationId": "9478a478-9081-7018-199b-d5ac8003f775#2498c418-d031-7049-64d6-89b418a51ae6",
      "timestamp": 1778517100000,
      "senderId": "2498c418-d031-7049-64d6-89b418a51ae6",
      "message": "Hi there!"
    }
  ],
  "conversationId": "9478a478-9081-7018-199b-d5ac8003f775#2498c418-d031-7049-64d6-89b418a51ae6",
  "count": 2
}
```

#### Error (400 Bad Request)
```json
{
  "message": "Missing conversationId"
}
```

#### Error (401 Unauthorized)
```json
{
  "message": "Missing authorization header"
}
```

#### Error (403 Forbidden)
```json
{
  "message": "Not authorized to view this conversation"
}
```

### Lambda Handler
- **Function Name**: `family-messenger-history-handler`
- **Handler**: `history_handler.lambda_handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### CloudWatch Log Group
`/aws/lambda/family-messenger-history-handler`

---

## WebSocket API

**Endpoint**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`

### Connection Authentication

WebSocket connections require authentication via query parameter:

```javascript
const wsUrl = `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default?Authorization=${encodeURIComponent(idToken)}`;
const socket = new WebSocket(wsUrl);
```

### Routes

| Route | Direction | Description | Auth |
|-------|-----------|-------------|------|
| `$connect` | Inbound | Establish connection | CUSTOM (authorizer) |
| `$disconnect` | Inbound | Close connection | NONE |
| `sendMessage` | Outbound | Client sends message | NONE |

---

## sendMessage Action

The primary WebSocket message action for sending chat messages.

### Request (Client → Server)

```json
{
  "action": "sendMessage",
  "recipientId": "2498c418-d031-7049-64d6-89b418a51ae6",
  "text": "Hello, how are you?"
}
```

### Response (Success)

The server does not send a direct response to the sender. Messages are pushed to the recipient's WebSocket connection.

### Push to Recipient

When a message is sent, it's pushed to the recipient's connection:

```json
{
  "senderId": "9478a478-9081-7018-199b-d5ac8003f775",
  "text": "Hello, how are you?",
  "timestamp": 1778517500000,
  "conversationId": "9478a478-9081-7018-199b-d5ac8003f775#2498c418-d031-7049-64d6-89b418a51ae6"
}
```

### Lambda Handler
- **Function Name**: `family-messenger-message-handler`
- **Handler**: `message_handler.lambda_handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### CloudWatch Log Group
`/aws/lambda/family-messenger-message-handler`

---

## CORS Configuration

The REST API includes CORS headers to allow browser requests from any origin.

### Allowed Origins
`*` (all origins for development; restrict in production)

### Allowed Methods
- GET
- POST
- OPTIONS

### Allowed Headers
- Content-Type
- Authorization
- X-Requested-With

### Preflight Handling

OPTIONS requests are routed to the appropriate Lambda handler which returns:

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
  }
}
```

---

## Throttling Configuration

Both APIs have throttling limits configured:

| API | Burst Limit | Rate Limit |
|-----|-------------|------------|
| WebSocket | 1000 req/s | 500 req/s |
| REST | 1000 req/s | 500 req/s |

---

## API Gateway Stage

Both APIs use the `$default` stage:

- **WebSocket**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`
- **REST**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com/$default`

---

## Testing Commands

### Test Users Endpoint
```bash
# Get access token first, then:
curl -X GET "https://wka1crhece.execute-api.us-east-1.amazonaws.com/users" \
  -H "Authorization: Bearer <accessToken>"
```

### Test History Endpoint
```bash
curl -X GET "https://wka1crhece.execute-api.us-east-1.amazonaws.com/conversations/user1%23user2/messages" \
  -H "Authorization: Bearer <accessToken>"
```

### Test WebSocket Connection
```javascript
const WebSocket = require('ws');

const token = '<idToken>';
const wsUrl = `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default?Authorization=${encodeURIComponent(token)}`;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    action: 'sendMessage',
    recipientId: 'user-id',
    text: 'Test message'
  }));
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data));
});
```

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | OK | Successful request |
| 400 | Bad Request | Missing required parameters |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | User not authorized for resource |
| 429 | Too Many Requests | Throttling limit exceeded |
| 500 | Internal Server Error | Lambda or DynamoDB error |

### Lambda Error Responses

All Lambda functions return standardized error responses:

```json
{
  "statusCode": 400,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"message\": \"Error description\"}"
}
```

---

## Next Steps

- [Lambda Functions](09_lambda_functions.md) - Detailed Lambda configuration
- [DynamoDB Tables](10_dynamodb_tables.md) - Data storage schema
