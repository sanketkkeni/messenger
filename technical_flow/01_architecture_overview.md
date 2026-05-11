# Architecture Overview

## System Overview

Family Messenger is a serverless real-time messaging application built on AWS services with a Next.js frontend deployed on Vercel. The application enables family members to communicate instantly through WebSocket-based real-time messaging with message history persistence.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│  ┌─────────────────────────┐        ┌─────────────────────────┐              │
│  │   Browser (User A)      │        │   Browser (User B)      │              │
│  │   skkeni06@gmail.com    │        │   skkeni04@gmail.com    │              │
│  └───────────┬─────────────┘        └───────────┬─────────────┘              │
└──────────────┼──────────────────────────────┼──────────────────────┬──────────┘
               │                              │                      │
               │ HTTPS / WSS                  │ HTTPS / WSS          │
               ▼                              ▼                      ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                           │
│                                                                              │
│  Frontend Hosting: https://sanketmessenger.vercel.app                       │
│  - Next.js Application                                                       │
│  - React Components                                                         │
│  - WebSocket Client                                                         │
│  - Cognito SDK for Authentication                                           │
│                                                                              │
└───────────────────────────────────────────────────────────────────────────────┘
               │
               │ HTTPS
               ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        AUTHENTICATION                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    COGNITO USER POOL                             │ │ │
│  │  │  User Pool ID: us-east-1_tQ9N9Y8LF                               │ │ │
│  │  │  - User signup/login                                             │ │ │
│  │  │  - Email verification                                            │ │ │
│  │  │  - JWT token issuance                                            │ │ │
│  │  │  - Password policies                                            │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      API GATEWAY                                       │ │
│  │  ┌──────────────────────┐    ┌──────────────────────────────────────┐ │ │
│  │  │  WEBSOCKET API       │    │  REST API                              │ │ │
│  │  │  family-messenger-   │    │  family-messenger-rest                 │ │ │
│  │  │  websocket           │    │  (HTTP API v2)                         │ │ │
│  │  │  ID: 7477wqg01f      │    │  ID: wka1crhece                        │ │ │
│  │  │                      │    │                                       │ │ │
│  │  │  Routes:             │    │  Routes:                              │ │ │
│  │  │  - $connect         │    │  - GET /users                         │ │ │
│  │  │  - $disconnect      │    │  - GET /conversations/{id}/messages   │ │ │
│  │  │  - sendMessage      │    │                                       │ │ │
│  │  └──────────┬───────────┘    └──────────────────┬───────────────────┘ │ │
│  │             │                                      │                       │ │
│  │             │ Lambda Invoke                       │ Lambda Invoke       │ │
│  │             ▼                                      ▼                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                      LAMBDA FUNCTIONS                             │ │ │
│  │  │                                                                 │ │ │
│  │  │  authorizer          - Validates JWT for WebSocket $connect     │ │ │
│  │  │  connect_handler     - Stores WebSocket connection              │ │ │
│  │  │  disconnect_handler - Removes WebSocket connection             │ │ │
│  │  │  message_handler    - Routes messages between users            │ │ │
│  │  │  users_handler      - Lists registered users                   │ │ │
│  │  │  history_handler    - Retrieves message history               │ │ │
│  │  │                                                                 │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      DATA STORAGE                                      │ │
│  │  ┌──────────────────────┐    ┌──────────────────────────────────────┐ │ │
│  │  │  DYNAMODB             │    │  CLOUDWATCH                           │ │ │
│  │  │                       │    │                                       │ │ │
│  │  │  family-messenger-    │    │  Log Groups:                          │ │ │
│  │  │  connections          │    │  - /aws/lambda/* (all Lambdas)        │ │ │
│  │  │  - Stores active      │    │  - /aws/apigateway/*                 │ │ │
│  │  │    WebSocket conn.    │    │  - /aws/cognito/*                    │ │ │
│  │  │                       │    │                                       │ │ │
│  │  │  family-messenger-    │    │  Dashboard:                           │ │ │
│  │  │  messages             │    │  family-messenger-dashboard          │ │ │
│  │  │  - Stores all chat    │    │                                       │ │ │
│  │  │    messages           │    │                                       │ │ │
│  │  └──────────────────────┘    └──────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Vercel (Frontend Hosting)
- **Service**: Vercel
- **URL**: https://sanketmessenger.vercel.app
- **Responsibilities**:
  - Hosts the Next.js application
  - Serves static assets and SSR pages
  - Manages frontend build and deployment
  - Triggers deployments on Git push

### AWS Cognito (Authentication)
- **Service**: Amazon Cognito User Pools
- **User Pool ID**: `us-east-1_tQ9N9Y8LF`
- **App Client ID**: `6pbdutoj0p9bhrp2hia7qcflj6`
- **Responsibilities**:
  - User registration with email verification
  - User authentication (USER_PASSWORD_AUTH flow)
  - JWT token issuance (idToken, accessToken, refreshToken)
  - Password policy enforcement

### AWS API Gateway (API Routing)
#### WebSocket API
- **Name**: `family-messenger-websocket`
- **API ID**: `7477wqg01f`
- **Stage**: `$default`
- **Endpoint**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`
- **Responsibilities**:
  - Manages WebSocket connections ($connect, $disconnect)
  - Routes sendMessage action to message_handler Lambda
  - Maintains persistent connections for real-time messaging

#### REST API
- **Name**: `family-messenger-rest`
- **API ID**: `wka1crhece`
- **Stage**: `$default`
- **Endpoint**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com`
- **Responsibilities**:
  - Serves user list via GET /users
  - Serves message history via GET /conversations/{id}/messages

### AWS Lambda (Backend Logic)
- **Runtime**: Python 3.13
- **Timeout**: 30 seconds
- **Memory**: 256 MB
- **Functions**:
  - `family-messenger-authorizer` - JWT validation for WebSocket
  - `family-messenger-connect-handler` - Connection establishment
  - `family-messenger-disconnect-handler` - Connection cleanup
  - `family-messenger-message-handler` - Message routing
  - `family-messenger-users-handler` - User listing
  - `family-messenger-history-handler` - Message history

### AWS DynamoDB (Data Storage)
#### Connections Table
- **Name**: `family-messenger-connections`
- **Billing**: Pay-per-request
- **Schema**:
  - Partition Key: `UserId` (String)
  - Sort Key: `connectionId` (String)
- **Purpose**: Maps users to their active WebSocket connection IDs

#### Messages Table
- **Name**: `family-messenger-messages`
- **Billing**: Pay-per-request
- **Schema**:
  - Partition Key: `conversationId` (String)
  - Sort Key: `timestamp` (Number)
- **Purpose**: Stores all chat messages for history retrieval

### AWS CloudWatch (Monitoring)
- **Dashboard**: `family-messenger-dashboard`
- **Log Groups**:
  - `/aws/lambda/family-messenger-*` (all Lambda functions)
  - `/aws/apigateway/family-messenger/*` (API Gateway access logs)
  - `/aws/cognito/family-messenger-users` (Cognito logs)
- **Alarms**:
  - `family-messenger-websocket-api-5xx`
  - `family-messenger-rest-api-5xx`
  - `family-messenger-*-errors` (per Lambda)

## Data Flow Summary

### 1. User Signup
```
Browser → Cognito (SignUp) → Email Verification → User Record Created
```

### 2. User Login
```
Browser → Cognito (InitiateAuth) → JWT Tokens → Browser localStorage
```

### 3. WebSocket Connection
```
Browser → API Gateway WebSocket ($connect) → authorizer Lambda → connect_handler Lambda → DynamoDB (store connection)
```

### 4. Send Message
```
Browser → API Gateway WebSocket (sendMessage) → message_handler Lambda → DynamoDB (store message) → API Gateway Management API → Recipient Browser
```

### 5. Load History
```
Browser → REST API (/conversations/{id}/messages) → history_handler Lambda → DynamoDB (query messages) → Browser
```

## Infrastructure as Code

All AWS resources are defined in Terraform configuration files:

| File | Resources |
|------|-----------|
| `infrastructure/main.tf` | Provider, Terraform Cloud config |
| `infrastructure/variables.tf` | Input variables |
| `infrastructure/outputs.tf` | Output values |
| `infrastructure/cognito.tf` | User Pool, Client |
| `infrastructure/dynamodb.tf` | Connections, Messages tables |
| `infrastructure/iam.tf` | IAM roles and policies |
| `infrastructure/api_gateway.tf` | WebSocket API, REST API |
| `infrastructure/lambda.tf` | Lambda functions |
| `infrastructure/cloudwatch.tf` | Log groups, dashboards, alarms |

## Next Steps

- [AWS Services](02_aws_services.md) - Detailed breakdown of each AWS service
- [User Authentication](03_user_authentication.md) - Signup, login, Cognito flows
- [WebSocket Connection](05_websocket_connection.md) - Connection establishment
