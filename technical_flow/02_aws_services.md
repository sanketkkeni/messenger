# AWS Services

This document provides a detailed breakdown of each AWS service used in the Family Messenger application.

## Service Overview

| Service | Purpose | Resource Name |
|---------|---------|--------------|
| Amazon Cognito | User authentication | `us-east-1_tQ9N9Y8LF` |
| Amazon API Gateway | API routing | WebSocket: `7477wqg01f`, REST: `wka1crhece` |
| AWS Lambda | Backend logic | 6 Lambda functions |
| Amazon DynamoDB | Data storage | 2 tables |
| Amazon CloudWatch | Monitoring | Logs, dashboards, alarms |
| AWS IAM | Permissions | Roles and policies |

---

## Amazon Cognito User Pools

### Overview
Amazon Cognito provides user sign-up, sign-in, and access control for the application. It handles authentication and issues JWT tokens for authorization.

### Resource Details
- **User Pool ID**: `us-east-1_tQ9N9Y8LF`
- **User Pool Name**: `family-messenger-users`
- **Region**: `us-east-1`
- **App Client ID**: `6pbdutoj0p9bhrp2hia7qcflj6`

### Configuration

#### Password Policy
- Minimum length: 8 characters
- Require uppercase letters: Yes
- Require lowercase letters: Yes
- Require numbers: Yes
- Require symbols: No

#### Username Attributes
- Email-based usernames (users sign in with email)

#### Verification
- Email verification required
- Verification method: Code sent via email

### Auth Flows
- **USER_PASSWORD_AUTH**: Primary authentication flow (email + password)
- **REFRESH_TOKEN_AUTH**: Token refresh flow (for session persistence)

### Token Configuration
| Token Type | Purpose | Expiry |
|-----------|---------|--------|
| idToken | WebSocket authentication | 1 hour |
| accessToken | REST API calls | 1 hour |
| refreshToken | Session restoration | 30 days |

### CloudWatch Integration
- Log Group: `/aws/cognito/family-messenger-users`
- Retention: 30 days

---

## Amazon API Gateway

### Overview
API Gateway handles all API traffic - both WebSocket for real-time messaging and REST for user data.

### WebSocket API

**Resource Name**: `family-messenger-websocket`
**API ID**: `7477wqg01f`
**Protocol**: WEBSOCKET
**Stage**: `$default`
**Endpoint**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`

#### Routes
| Route | Lambda Integration | Auth |
|-------|------------------|------|
| `$connect` | `family-messenger-connect-handler` | CUSTOM (authorizer) |
| `$disconnect` | `family-messenger-disconnect-handler` | NONE |
| `sendMessage` | `family-messenger-message-handler` | NONE |

#### Throttling
- Burst limit: 1000 requests/second
- Rate limit: 500 requests/second

#### Access Logging
- Log Group: `/aws/apigateway/family-messenger/websocket`

### REST API

**Resource Name**: `family-messenger-rest`
**API ID**: `wka1crhece`
**Protocol**: HTTP (API Gateway v2)
**Stage**: `$default`
**Endpoint**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com`

#### Routes
| Route | Method | Lambda Integration |
|-------|--------|------------------|
| `/users` | GET | `family-messenger-users-handler` |
| `/users` | OPTIONS | `family-messenger-users-handler` (CORS) |
| `/conversations/{conversationId}/messages` | GET | `family-messenger-history-handler` |
| `/conversations/{conversationId}/messages` | OPTIONS | `family-messenger-history-handler` (CORS) |
| `/{proxy}` | OPTIONS | `family-messenger-users-handler` (CORS) |

#### CORS Configuration
- Allow origins: `*`
- Allow methods: GET, POST, OPTIONS
- Allow headers: Content-Type, Authorization, X-Requested-With
- Max age: 3600 seconds

#### Throttling
- Burst limit: 1000 requests/second
- Rate limit: 500 requests/second

#### Access Logging
- Log Group: `/aws/apigateway/family-messenger/rest`

---

## AWS Lambda

### Overview
Lambda functions provide serverless compute for all backend logic. Each function is triggered by API Gateway and executes specific business logic.

### Common Configuration
- **Runtime**: Python 3.13
- **Timeout**: 30 seconds
- **Memory**: 256 MB
- **Billing**: Pay-per-invocation

### Lambda Functions

#### 1. Authorizer Lambda
- **Function Name**: `family-messenger-authorizer`
- **Handler**: `authorizer.lambda_handler`
- **Purpose**: Validates JWT tokens for WebSocket $connect route
- **Trigger**: API Gateway authorizer invocation
- **Environment Variables**:
  - `USER_POOL_ID`: `us-east-1_tQ9N9Y8LF`
  - `USER_POOL_APP_CLIENT_ID`: `6pbdutoj0p9bhrp2hia7qcflj6`
- **Log Group**: `/aws/lambda/family-messenger-authorizer`

#### 2. Connect Handler Lambda
- **Function Name**: `family-messenger-connect-handler`
- **Handler**: `connect_handler.lambda_handler`
- **Purpose**: Stores WebSocket connection in DynamoDB
- **Trigger**: API Gateway WebSocket $connect route
- **Environment Variables**:
  - `CONNECTIONS_TABLE_NAME`: `family-messenger-connections`
- **Log Group**: `/aws/lambda/family-messenger-connect-handler`

#### 3. Disconnect Handler Lambda
- **Function Name**: `family-messenger-disconnect-handler`
- **Handler**: `disconnect_handler.lambda_handler`
- **Purpose**: Removes WebSocket connection from DynamoDB
- **Trigger**: API Gateway WebSocket $disconnect route
- **Environment Variables**:
  - `CONNECTIONS_TABLE_NAME`: `family-messenger-connections`
- **Log Group**: `/aws/lambda/family-messenger-disconnect-handler`

#### 4. Message Handler Lambda
- **Function Name**: `family-messenger-message-handler`
- **Handler**: `message_handler.lambda_handler`
- **Purpose**: Routes messages between users, stores in DynamoDB
- **Trigger**: API Gateway WebSocket sendMessage route
- **Environment Variables**:
  - `CONNECTIONS_TABLE_NAME`: `family-messenger-connections`
  - `MESSAGES_TABLE_NAME`: `family-messenger-messages`
- **Log Group**: `/aws/lambda/family-messenger-message-handler`

#### 5. Users Handler Lambda
- **Function Name**: `family-messenger-users-handler`
- **Handler**: `users_handler.lambda_handler`
- **Purpose**: Returns list of registered users from Cognito
- **Trigger**: API Gateway REST GET /users route
- **Environment Variables**:
  - `USER_POOL_ID`: `us-east-1_tQ9N9Y8LF`
- **Log Group**: `/aws/lambda/family-messenger-users-handler`

#### 6. History Handler Lambda
- **Function Name**: `family-messenger-history-handler`
- **Handler**: `history_handler.lambda_handler`
- **Purpose**: Retrieves message history from DynamoDB
- **Trigger**: API Gateway REST GET /conversations/{id}/messages route
- **Environment Variables**:
  - `MESSAGES_TABLE_NAME`: `family-messenger-messages`
- **Log Group**: `/aws/lambda/family-messenger-history-handler`

---

## Amazon DynamoDB

### Overview
DynamoDB provides NoSQL data storage for connection mappings and chat messages.

### Common Configuration
- **Billing Mode**: Pay-per-request (on-demand)
- **Region**: `us-east-1`

### Tables

#### Connections Table
- **Table Name**: `family-messenger-connections`
- **Purpose**: Maps users to their WebSocket connection IDs
- **Schema**:
  - Partition Key: `UserId` (String)
  - Sort Key: `connectionId` (String)
- **Attributes**:
  - `timestamp`: When connection was established

#### Messages Table
- **Table Name**: `family-messenger-messages`
- **Purpose**: Stores all chat messages for history retrieval
- **Schema**:
  - Partition Key: `conversationId` (String)
  - Sort Key: `timestamp` (Number)
- **Attributes**:
  - `senderId`: Username of message sender
  - `message`: Message text content

---

## Amazon CloudWatch

### Overview
CloudWatch provides monitoring, logging, and alerting for all application components.

### Log Groups

| Log Group | Source | Retention |
|-----------|--------|----------|
| `/aws/lambda/family-messenger-authorizer` | authorizer Lambda | 30 days |
| `/aws/lambda/family-messenger-connect-handler` | connect_handler Lambda | 30 days |
| `/aws/lambda/family-messenger-disconnect-handler` | disconnect_handler Lambda | 30 days |
| `/aws/lambda/family-messenger-message-handler` | message_handler Lambda | 30 days |
| `/aws/lambda/family-messenger-users-handler` | users_handler Lambda | 30 days |
| `/aws/lambda/family-messenger-history-handler` | history_handler Lambda | 30 days |
| `/aws/apigateway/family-messenger/websocket` | WebSocket API access logs | 30 days |
| `/aws/apigateway/family-messenger/rest` | REST API access logs | 30 days |
| `/aws/cognito/family-messenger-users` | Cognito User Pool logs | 30 days |

### Dashboard
- **Dashboard Name**: `family-messenger-dashboard`
- **Region**: `us-east-1`
- **URL**: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=family-messenger-dashboard

### CloudWatch Alarms

| Alarm Name | Metric | Threshold | Action |
|-----------|--------|-----------|--------|
| `family-messenger-websocket-api-5xx` | WebSocket API 5xx errors | > 0 | SNS (if configured) |
| `family-messenger-rest-api-5xx` | REST API 5xx errors | > 0 | SNS (if configured) |
| `family-messenger-*-errors` | Lambda function errors | > 0 | SNS (if configured) |

---

## AWS IAM

### Overview
IAM manages permissions for Lambda functions to access other AWS services.

### Lambda Execution Role
- **Role Name**: `family-messenger-lambda-role`
- **Role ARN**: `arn:aws:iam::910972977862:role/family-messenger-lambda-role`

### Policies Attached

| Policy Name | Purpose |
|------------|---------|
| `family-messenger-lambda-basic` | Basic Lambda execution permissions |
| `family-messenger-lambda-dynamodb-access` | DynamoDB read/write permissions |
| `family-messenger-lambda-apigateway` | API Gateway Management API permissions |
| `family-messenger-lambda-cognito-read` | Cognito ListUsers permission |

---

## Service Connections Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ Next.js     │  │ WebSocket   │  │ Cognito SDK │                          │
│  │ (Frontend)  │  │ Client      │  │ (Auth)      │                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  REST API        │ │  WebSocket API  │ │  Cognito        │
│  wka1crhece      │ │  7477wqg01f     │ │  us-east-1_     │
│  (HTTPS)        │ │  (WSS)         │ │  tQ9N9Y8LF      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AWS LAMBDA                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Lambda Execution Role: family-messenger-lambda-role              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   ▼
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  │ history_   │    │ message_   │    │ connect_   │    │ Cognito   │
│  │ handler    │    │ handler    │    │ handler    │    │ (boto3)   │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └────────────┘
│        │                 │                 │
│        ▼                 ▼                 ▼
│  ┌────────────────────────────────────────────────────────────┐
│  │ DYNAMODB                                             │
│  │  family-messenger-messages    │  family-messenger-connections  │
│  └────────────────────────────────────────────────────────────┘
│                               │
└───────────────────────────────┼───────────────────────────────────────┘
                                ▼
                         ┌────────────┐
                         │ CloudWatch │
                         │ (Logs,     │
                         │  Alarms)   │
                         └────────────┘
```

## Next Steps

- [User Authentication](03_user_authentication.md) - Signup, login, Cognito flows
- [WebSocket Connection](05_websocket_connection.md) - Connection establishment
- [Messaging Flow](06_messaging_flow.md) - Message routing
