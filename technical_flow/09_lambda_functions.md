# Lambda Functions

This document provides detailed documentation for all Lambda functions used in the application.

## Overview

AWS Lambda provides serverless compute for all backend logic. Each function is triggered by API Gateway and executes specific business logic.

## Common Configuration

| Setting | Value |
|---------|-------|
| Runtime | Python 3.13 |
| Timeout | 30 seconds |
| Memory | 256 MB |
| Billing | Pay-per-invocation |
| Region | us-east-1 |

## Lambda Functions Summary

| Function | Handler | Trigger | Purpose |
|---------|---------|---------|---------|
| `family-messenger-authorizer` | authorizer.lambda_handler | API Gateway Authorizer | JWT validation |
| `family-messenger-connect-handler` | connect_handler.lambda_handler | WebSocket $connect | Store connection |
| `family-messenger-disconnect-handler` | disconnect_handler.lambda_handler | WebSocket $disconnect | Remove connection |
| `family-messenger-message-handler` | message_handler.lambda_handler | WebSocket sendMessage | Route messages |
| `family-messenger-users-handler` | users_handler.lambda_handler | REST GET /users | List users |
| `family-messenger-history-handler` | history_handler.lambda_handler | REST GET /conversations/{id}/messages | Get history |

---

## 1. Authorizer Lambda

**Function Name**: `family-messenger-authorizer`
**Handler**: `authorizer.lambda_handler`
**Source File**: `backend/authorizer.py`

### Purpose
Validates JWT tokens for WebSocket $connect route authentication.

### Trigger
API Gateway Request Authorizer (REQUEST type)

### Environment Variables
| Variable | Value |
|----------|-------|
| USER_POOL_ID | `us-east-1_tQ9N9Y8LF` |
| USER_POOL_APP_CLIENT_ID | `6pbdutoj0p9bhrp2hia7qcflj6` |
| LOG_LEVEL | INFO |

### IAM Permissions
- None required (validates JWT directly)

### Input Event
```json
{
  "type": "REQUEST",
  "methodArn": "arn:aws:execute-api:us-east-1:...:7477wqg01f/$default/$CONNECT",
  "queryStringParameters": {
    "Authorization": "<jwt_token>"
  }
}
```

### Output
```json
{
  "principalId": "user-123",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{
      "Action": "execute-api:Invoke",
      "Effect": "Allow",
      "Resource": "*"
    }]
  },
  "context": {
    "userId": "user-123"
  }
}
```

### CloudWatch Log Group
`/aws/lambda/family-messenger-authorizer`

---

## 2. Connect Handler Lambda

**Function Name**: `family-messenger-connect-handler`
**Handler**: `connect_handler.lambda_handler`
**Source File**: `backend/connect_handler.py`

### Purpose
Stores WebSocket connection information in DynamoDB when a user connects.

### Trigger
API Gateway WebSocket $connect route

### Environment Variables
| Variable | Value |
|----------|-------|
| CONNECTIONS_TABLE_NAME | `family-messenger-connections` |
| LOG_LEVEL | INFO |

### IAM Permissions
- `dynamodb:PutItem` on `family-messenger-connections`

### Input Event
```json
{
  "requestContext": {
    "connectionId": "abc123xyz",
    "authorizer": {
      "userId": "user-123"
    }
  },
  "queryStringParameters": {
    "Authorization": "<jwt_token>"
  }
}
```

### Output
```json
{
  "statusCode": 200,
  "body": "{\"message\": \"Connected\"}"
}
```

### DynamoDB Operation
```python
connections_table.put_item(
    Item={
        'UserId': userId,
        'connectionId': connectionId,
        'timestamp': int(time.time() * 1000)
    }
)
```

### CloudWatch Log Group
`/aws/lambda/family-messenger-connect-handler`

---

## 3. Disconnect Handler Lambda

**Function Name**: `family-messenger-disconnect-handler`
**Handler**: `disconnect_handler.lambda_handler`
**Source File**: `backend/disconnect_handler.py`

### Purpose
Removes WebSocket connection information from DynamoDB when a user disconnects.

### Trigger
API Gateway WebSocket $disconnect route

### Environment Variables
| Variable | Value |
|----------|-------|
| CONNECTIONS_TABLE_NAME | `family-messenger-connections` |
| LOG_LEVEL | INFO |

### IAM Permissions
- `dynamodb:Scan` on `family-messenger-connections`
- `dynamodb:DeleteItem` on `family-messenger-connections`

### Input Event
```json
{
  "requestContext": {
    "connectionId": "abc123xyz"
  }
}
```

### Output
```json
{
  "statusCode": 200,
  "body": "{\"message\": \"Disconnected\"}"
}
```

### DynamoDB Operation
```python
response = connections_table.scan(
    FilterExpression=Key('connectionId').eq(connectionId)
)
# Delete each matching item
```

### CloudWatch Log Group
`/aws/lambda/family-messenger-disconnect-handler`

---

## 4. Message Handler Lambda

**Function Name**: `family-messenger-message-handler`
**Handler**: `message_handler.lambda_handler`
**Source File**: `backend/message_handler.py`

### Purpose
Routes messages between users, stores messages in DynamoDB, and pushes to recipient connections.

### Trigger
API Gateway WebSocket sendMessage route

### Environment Variables
| Variable | Value |
|----------|-------|
| CONNECTIONS_TABLE_NAME | `family-messenger-connections` |
| MESSAGES_TABLE_NAME | `family-messenger-messages` |
| LOG_LEVEL | INFO |

### IAM Permissions
- `dynamodb:GetItem` on `family-messenger-connections`
- `dynamodb:Query` on `family-messenger-connections`
- `dynamodb:PutItem` on `family-messenger-messages`

### Input Event
```json
{
  "requestContext": {
    "connectionId": "abc123xyz",
    "domainName": "7477wqg01f.execute-api.us-east-1.amazonaws.com",
    "stage": "$default"
  },
  "body": "{\"action\": \"sendMessage\", \"recipientId\": \"user-456\", \"text\": \"Hello!\"}"
}
```

### Output
```json
{
  "statusCode": 200,
  "body": "{\"message\": \"Message sent\", \"conversationId\": \"user-123#user-456\", \"recipientOnline\": true}"
}
```

### DynamoDB Operations
1. Get sender from connections table
2. Save message to messages table
3. Query recipient connections
4. Push to all recipient connections via API Gateway Management API

### CloudWatch Log Group
`/aws/lambda/family-messenger-message-handler`

---

## 5. Users Handler Lambda

**Function Name**: `family-messenger-users-handler`
**Handler**: `users_handler.lambda_handler`
**Source File**: `backend/users_handler.py`

### Purpose
Returns a list of all registered users from Cognito User Pool.

### Trigger
API Gateway REST GET /users route

### Environment Variables
| Variable | Value |
|----------|-------|
| USER_POOL_ID | `us-east-1_tQ9N9Y8LF` |
| LOG_LEVEL | INFO |

### IAM Permissions
- `cognito-idp:ListUsers` on `us-east-1_tQ9N9Y8LF`

### Input Event
```json
{
  "requestContext": {
    "http": {
      "method": "GET"
    }
  }
}
```

### Output
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "multiValueHeaders": {
    "Content-Type": ["application/json"],
    "Access-Control-Allow-Origin": ["*"]
  },
  "body": "{\"users\": [...], \"count\": 2, \"cached\": false}"
}
```

### Caching
- In-memory cache with 30-second TTL
- Reduces Cognito API calls

### CloudWatch Log Group
`/aws/lambda/family-messenger-users-handler`

---

## 6. History Handler Lambda

**Function Name**: `family-messenger-history-handler`
**Handler**: `history_handler.lambda_handler`
**Source File**: `backend/history_handler.py`

### Purpose
Retrieves message history for a conversation from DynamoDB.

### Trigger
API Gateway REST GET /conversations/{conversationId}/messages route

### Environment Variables
| Variable | Value |
|----------|-------|
| MESSAGES_TABLE_NAME | `family-messenger-messages` |
| LOG_LEVEL | INFO |

### IAM Permissions
- `dynamodb:Query` on `family-messenger-messages`

### Input Event
```json
{
  "requestContext": {
    "http": {
      "method": "GET"
    }
  },
  "pathParameters": {
    "conversationId": "user-123#user-456"
  },
  "queryStringParameters": {
    "limit": "50"
  },
  "headers": {
    "Authorization": "Bearer <accessToken>"
  }
}
```

### Output
```json
{
  "statusCode": 200,
  "headers": {...},
  "multiValueHeaders": {...},
  "body": "{\"messages\": [...], \"conversationId\": \"...\", \"count\": 2}"
}
```

### DynamoDB Operation
```python
response = messages_table.query(
    KeyConditionExpression=Key('conversationId').eq(conversation_id),
    ScanIndexForward=False,  # Descending (newest first)
    Limit=limit
)
```

### Note on Decimal Types
DynamoDB returns numbers as `Decimal` type. The handler converts to `int` for JSON serialization.

### CloudWatch Log Group
`/aws/lambda/family-messenger-history-handler`

---

## Lambda Function Dependencies

### Python Packages (Built-in)
- `json` - JSON parsing
- `time` - Timestamp generation
- `base64` - JWT decoding
- `boto3` - AWS SDK

### Shared Code
All Lambda functions share utilities from `utils.py`:
- `create_response()` - Standardized HTTP responses
- `validate_jwt_token()` - JWT token validation
- `get_connection_user()` - DynamoDB lookup
- `get_user_connections()` - DynamoDB query
- `store_connection()` - DynamoDB put
- `delete_connection()` - DynamoDB delete
- `save_message()` - DynamoDB put
- `get_messages()` - DynamoDB query

---

## Deployment

### Zip File Creation
```bash
cd backend
python -c "import zipfile; z = zipfile.ZipFile('handler.zip', 'w'); [z.write(f) for f in ['handler.py', 'utils.py']]; z.close()"
```

### Lambda Update Command
```bash
aws lambda update-function-code \
  --function-name family-messenger-<handler> \
  --zip-file fileb://<handler>.zip \
  --no-cli-pager
```

### Terraform Deployment
Lambda functions are deployed via Terraform:
```bash
cd infrastructure
terraform apply
```

---

## Monitoring

### CloudWatch Metrics
- Invocations
- Duration
- Errors
- Throttles

### CloudWatch Alarms
- `family-messenger-*-errors` - Triggers on any Lambda error

---

## Next Steps

- [DynamoDB Tables](10_dynamodb_tables.md) - Data storage schema and access patterns
- [API Gateway](11_api_gateway.md) - API configuration details
