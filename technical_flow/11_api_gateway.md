# API Gateway

This document describes the API Gateway configuration for both WebSocket and REST APIs.

## Overview

Amazon API Gateway manages all API traffic for the application:
- **WebSocket API**: Real-time bidirectional messaging
- **REST API**: User data and message history

## API Gateway Summary

| API | Name | ID | Protocol | Stage |
|-----|------|-----|----------|-------|
| WebSocket | `family-messenger-websocket` | `7477wqg01f` | WEBSOCKET | $default |
| REST | `family-messenger-rest` | `wka1crhece` | HTTP | $default |

---

## WebSocket API

**API Name**: `family-messenger-websocket`
**API ID**: `7477wqg01f`
**Protocol**: WEBSOCKET
**Stage**: `$default`
**Endpoint**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`

### Routes

| Route Key | Integration | Authorization | Lambda Handler |
|-----------|-----------|--------------|---------------|
| `$connect` | AWS_PROXY | CUSTOM | `family-messenger-connect-handler` |
| `$disconnect` | AWS_PROXY | NONE | `family-messenger-disconnect-handler` |
| `sendMessage` | AWS_PROXY | NONE | `family-messenger-message-handler` |

### Route Selection Expression
```
$request.body.action
```

The route is selected based on the `action` field in the message body.

### Authorizer Configuration

**Authorizer Name**: `websocket-authorizer`
**Authorizer ID**: `825ml8`
**Authorizer Type**: REQUEST
**Identity Source**: `route.request.querystring.Authorization`

**Important**: Only query string authorization is used. Using both header and query string causes WebSocket authentication to fail because WebSocket upgrade requests cannot set custom headers.

### Throttling

| Setting | Value |
|---------|-------|
| Burst Limit | 1000 requests/second |
| Rate Limit | 500 requests/second |

### Access Logging

**Log Group**: `/aws/apigateway/family-messenger/websocket`

**Log Format**:
```json
{
  "requestId": "$context.requestId",
  "ip": "$context.identity.sourceIp",
  "caller": "$context.identity.caller",
  "user": "$context.identity.user",
  "requestTime": "$context.requestTime",
  "httpMethod": "$context.httpMethod",
  "resourcePath": "$context.resourcePath",
  "status": "$context.status",
  "protocol": "$context.protocol",
  "responseLength": "$context.responseLength",
  "routeKey": "$context.routeKey",
  "connectedAt": "$context.connectedAt",
  "connectionId": "$context.connectionId"
}
```

---

## REST API

**API Name**: `family-messenger-rest`
**API ID**: `wka1crhece`
**Protocol**: HTTP (API Gateway v2)
**Stage**: `$default`
**Endpoint**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com`

### Routes

| Route Key | Method | Integration | Lambda Handler |
|-----------|--------|-----------|---------------|
| `/users` | GET | AWS_PROXY | `family-messenger-users-handler` |
| `/users` | OPTIONS | AWS_PROXY | `family-messenger-users-handler` |
| `/conversations/{conversationId}/messages` | GET | AWS_PROXY | `family-messenger-history-handler` |
| `/conversations/{conversationId}/messages` | OPTIONS | AWS_PROXY | `family-messenger-history-handler` |
| `/{proxy}` | OPTIONS | AWS_PROXY | `family-messenger-users-handler` |

### CORS Configuration

```json
{
  "allow_origins": ["*"],
  "allow_methods": ["GET", "POST", "OPTIONS"],
  "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
  "expose_headers": [],
  "max_age": 3600
}
```

### Throttling

| Setting | Value |
|---------|-------|
| Burst Limit | 1000 requests/second |
| Rate Limit | 500 requests/second |

### Access Logging

**Log Group**: `/aws/apigateway/family-messenger/rest`

**Log Format**:
```json
{
  "requestId": "$context.requestId",
  "ip": "$context.identity.sourceIp",
  "caller": "$context.identity.caller",
  "user": "$context.identity.user",
  "requestTime": "$context.requestTime",
  "httpMethod": "$context.httpMethod",
  "resourcePath": "$context.resourcePath",
  "status": "$context.status",
  "protocol": "$context.protocol",
  "responseLength": "$context.responseLength",
  "integrationErrorMessage": "$context.integrationErrorMessage"
}
```

---

## Integration Configuration

### Integration Type
AWS_PROXY (Lambda proxy integration)

### Response Format
The Lambda function returns:
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
  "body": "{\"key\": \"value\"}"
}
```

### Multi-Value Headers
API Gateway v2 requires `multiValueHeaders` for CORS. The Lambda function must return both `headers` and `multiValueHeaders`.

---

## Lambda Permissions

### WebSocket API
```hcl
resource "aws_lambda_permission" "allow_apigateway_connect" {
  statement_id  = "AllowAPIGatewayConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}
```

### REST API
```hcl
resource "aws_lambda_permission" "allow_rest_apigateway_users" {
  statement_id  = "AllowRESTAPIGatewayUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}
```

---

## API Gateway Account Settings

### CloudWatch Logs Role
```hcl
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logging.arn
}
```

This allows API Gateway to write access logs to CloudWatch.

---

## Stage Configuration

### $default Stage
All APIs use the `$default` stage which is automatically deployed.

### Stage Variables
Available for Lambda function environment variable overrides:
- `${stageVariables.functionName}`
- `${stageVariables.tableName}`

---

## Request Flow

### WebSocket Message Flow
```
Browser
    │
    ▼
WebSocket Upgrade Request
    │
    ▼
API Gateway (7477wqg01f)
    │
    ├──► Authorizer (validates JWT)
    │
    ▼
$connect Route
    │
    ▼
Lambda: connect_handler
    │
    ▼
DynamoDB: store connection
```

### REST Request Flow
```
Browser
    │
    ▼
HTTPS Request
    │
    ▼
API Gateway (wka1crhece)
    │
    ▼
Route: GET /users
    │
    ▼
Lambda: users_handler
    │
    ▼
Cognito: list users
```

---

## Error Responses

### Lambda Errors
If the Lambda function returns an error, API Gateway returns:
```
HTTP/1.1 502 Bad Gateway
{"message": "Internal server error"}
```

### Authorizer Errors
If authorization fails:
```
HTTP/1.1 401 Unauthorized
```

### Route Not Found
```
HTTP/1.1 403 Forbidden
```

---

## Terraform Configuration

### WebSocket API
```hcl
resource "aws_apigatewayv2_api" "websocket_api" {
  name          = "family-messenger-websocket"
  protocol_type = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}
```

### REST API
```hcl
resource "aws_apigatewayv2_api" "rest_api" {
  name          = "family-messenger-rest"
  protocol_type = "HTTP"
}
```

---

## Monitoring

### CloudWatch Metrics
- Count
- Latency
- 4XXError
- 5XXError
- IntegrationLatency

### CloudWatch Alarms
- `family-messenger-websocket-api-5xx`
- `family-messenger-rest-api-5xx`

---

## Next Steps

- [IAM Permissions](12_iam_permissions.md) - IAM role and policy configuration
- [Cognito Configuration](13_cognito_config.md) - Cognito User Pool settings
