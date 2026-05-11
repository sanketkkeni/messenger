# IAM Permissions

This document describes the IAM roles and policies used by the application.

## Overview

AWS Identity and Access Management (IAM) manages permissions for Lambda functions to access other AWS services.

## Lambda Execution Role

**Role Name**: `family-messenger-lambda-role`
**Role ARN**: `arn:aws:iam::910972977862:role/family-messenger-lambda-role`
**Region**: us-east-1

### Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "lambda.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

---

## IAM Policies

### 1. Lambda Basic Execution Policy

**Policy Name**: `family-messenger-lambda-basic`

**Purpose**: Basic permissions for Lambda execution

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": "*"
  }]
}
```

This allows Lambda to write logs to CloudWatch.

---

### 2. DynamoDB Access Policy

**Policy Name**: `family-messenger-lambda-dynamodb-access`

**Purpose**: Read and write access to DynamoDB tables

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:910972977862:table/family-messenger-connections"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:910972977862:table/family-messenger-messages"
    }
  ]
}
```

**Usage by Lambda Functions**:
| Lambda Function | Permissions Used |
|----------------|-----------------|
| connect_handler | PutItem |
| disconnect_handler | Scan, DeleteItem |
| message_handler | GetItem, Query, PutItem |
| history_handler | Query |

---

### 3. API Gateway Management Policy

**Policy Name**: `family-messenger-lambda-apigateway-management`

**Purpose**: Allow Lambda to send WebSocket messages via API Gateway Management API

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "execute-api:ManageConnections"
    ],
    "Resource": "arn:aws:execute-api:us-east-1:910972977862:7477wqg01f/*/*"
  }]
}
```

**Usage**: The `message_handler` Lambda uses this to push messages to connected clients via `PostToConnection`.

---

### 4. Cognito Read Policy

**Policy Name**: `family-messenger-lambda-cognito-read`

**Purpose**: Read access to Cognito User Pool for listing users

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "cognito-idp:ListUsers",
      "cognito-idp:AdminGetUser"
    ],
    "Resource": "arn:aws:cognito-idp:us-east-1:910972977862:userpool/us-east-1_tQ9N9Y8LF"
  }]
}
```

**Usage by Lambda Functions**:
| Lambda Function | Permissions Used |
|----------------|-----------------|
| users_handler | ListUsers |
| authorizer | (uses Cognito SDK directly) |

---

### 5. Cognito Logging Policy

**Policy Name**: `family-messenger-cognito-logging-policy`

**Purpose**: Allow Cognito to write logs to CloudWatch

**Attached To**: `family-messenger-cognito-logging` role

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:DescribeLogStreams",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": "arn:aws:logs:us-east-1:910972977862:log-group:/aws/cognito/family-messenger-users:*"
  }]
}
```

---

## API Gateway Logging Role

**Role Name**: `family-messenger-apigateway-logging`

**Purpose**: Allow API Gateway to write access logs to CloudWatch

**Trust Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "apigateway.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

**Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:FilterLogEvents",
      "logs:PutLogEvents"
    ],
    "Resource": "arn:aws:logs:us-east-1:910972977862:log-group/*"
  }]
}
```

---

## Lambda Permission Statements

### For API Gateway Invocation

```hcl
# Lambda permissions for WebSocket API
resource "aws_lambda_permission" "allow_apigateway_connect" {
  statement_id  = "AllowAPIGatewayConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_apigateway_message" {
  statement_id  = "AllowAPIGatewayMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.message_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# Lambda permissions for REST API
resource "aws_lambda_permission" "allow_rest_apigateway_users" {
  statement_id  = "AllowRESTAPIGatewayUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_rest_apigateway_history" {
  statement_id  = "AllowRESTAPIGatewayHistory"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.history_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}
```

---

## Permission Summary Table

| Lambda Function | DynamoDB | API Gateway | Cognito | CloudWatch |
|----------------|----------|-------------|---------|------------|
| authorizer | - | - | - | ✓ |
| connect_handler | ✓ (PutItem) | - | - | ✓ |
| disconnect_handler | ✓ (Scan, Delete) | - | - | ✓ |
| message_handler | ✓ (Get, Query, Put) | ✓ (ManageConnections) | - | ✓ |
| users_handler | - | - | ✓ (ListUsers) | ✓ |
| history_handler | ✓ (Query) | - | - | ✓ |

---

## Security Best Practices

### 1. Least Privilege
Each Lambda has only the permissions it needs:
- connect_handler: PutItem only
- message_handler: GetItem, Query, PutItem

### 2. Resource-Level Permissions
Permissions are scoped to specific resources:
```json
"Resource": "arn:aws:dynamodb:us-east-1:910972977862:table/family-messenger-connections"
```

### 3. No Hardcoded Credentials
Lambda functions use IAM roles, not access keys.

### 4. CloudWatch Logging
All Lambda functions write logs for debugging and auditing.

---

## Terraform Configuration

### IAM Role
```hcl
resource "aws_iam_role" "lambda_role" {
  name = "family-messenger-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}
```

### Policy Attachments
```hcl
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_basic.arn
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_apigateway" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_apigateway_management.arn
}

resource "aws_iam_role_policy_attachment" "lambda_cognito" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_cognito_read.arn
}
```

---

## Next Steps

- [Cognito Configuration](13_cognito_config.md) - Cognito User Pool settings
- [CloudWatch Logs](14_cloudwatch_logs.md) - Log groups and monitoring