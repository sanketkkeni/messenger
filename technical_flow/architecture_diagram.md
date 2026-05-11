# High-Level Architecture Diagram

This document contains comprehensive Mermaid diagrams of the Family Messenger system.

## System Architecture

```mermaid
flowchart TB
    subgraph CLIENT["CLIENT LAYER"]
        Browser["Browser<br/>(Next.js App)"]
    end

    subgraph FRONTEND["FRONTEND - Vercel"]
        VercelCDN["Vercel CDN<br/>(Static Assets)"]
    end

    subgraph AUTH["AUTHENTICATION - Cognito"]
        CognitoUserPool["Cognito User Pool<br/>us-east-1_tQ9N9Y8LF"]
        CognitoClient["App Client<br/>6pbdutoj0p9bhrp2hia7qcflj6"]
    end

    subgraph BACKEND["BACKEND - AWS Lambda + API Gateway<br/>(Managed by Terraform)"]
        subgraph APIGW["API Gateway"]
            WebSocketAPI["WebSocket API<br/>ID: 7477wqg01f"]
            RESTAPI["REST API<br/>ID: wka1crhece"]
        end

        subgraph LAMBDA["Lambda Functions (Python 3.13)"]
            Authorizer["authorizer<br/>(JWT Validation)"]
            ConnectHandler["connect_handler<br/>(Store connection)"]
            DisconnectHandler["disconnect_handler<br/>(Remove connection)"]
            MessageHandler["message_handler<br/>(Route messages)"]
            UsersHandler["users_handler<br/>(List users)"]
            HistoryHandler["history_handler<br/>(Load history)"]
        end

        subgraph IAM["IAM Roles"]
            LambdaExecutionRole["Lambda Execution Role<br/>(Least privilege)"]
        end
    end

    subgraph STORAGE["DATA STORAGE - DynamoDB"]
        ConnectionsTable["connections<br/>(connectionId to userId)"]
        MessagesTable["messages<br/>(conversationId, timestamp)"]
    end

    subgraph MONITORING["MONITORING - CloudWatch"]
        CloudWatchLogs["CloudWatch Logs<br/>(Lambda, API GW, Cognito)"]
        CloudWatchDashboards["Dashboards<br/>(Lambda metrics, API usage)"]
    end

    subgraph INFRA["INFRASTRUCTURE - Terraform"]
        TerraformState["Terraform State<br/>(S3 Backend)"]
        TerraformConfig["Terraform Config<br/>(infrastructure/)"]
    end

    Browser <-.->|HTTPS/WSS| VercelCDN
    VercelCDN <-.->|Fetch assets| Browser

    Browser -->|1. Sign up/Sign in| CognitoUserPool
    CognitoUserPool -->|2. Auth tokens| Browser
    CognitoClient -.->|Validate| CognitoUserPool

    Browser -->|3. WSS Connect| WebSocketAPI
    WebSocketAPI -->|4. Invoke| Authorizer
    Authorizer -->|5. Validate JWT| CognitoUserPool
    Authorizer -->|6. Allow/Deny| WebSocketAPI
    WebSocketAPI -->|7. Store connection| ConnectHandler
    ConnectHandler -->|8. PutItem| ConnectionsTable

    Browser -->|9. Send message| WebSocketAPI
    WebSocketAPI -->|10. Route| MessageHandler
    MessageHandler -->|11. Query| ConnectionsTable
    MessageHandler -->|12. Store message| MessagesTable
    MessageHandler -->|13. PostToConnection| WebSocketAPI
    WebSocketAPI -->|14. Deliver message| Browser

    Browser -->|15. GET history| RESTAPI
    RESTAPI -->|16. Route| HistoryHandler
    HistoryHandler -->|17. Query| MessagesTable
    HistoryHandler -->|18. Return messages| RESTAPI
    RESTAPI -->|19. JSON response| Browser

    Browser -->|20. List users| RESTAPI
    RESTAPI -->|21. Route| UsersHandler
    UsersHandler -->|22. List users| CognitoUserPool

    ConnectHandler -.->|Logs| CloudWatchLogs
    DisconnectHandler -.->|Logs| CloudWatchLogs
    MessageHandler -.->|Logs| CloudWatchLogs
    UsersHandler -.->|Logs| CloudWatchLogs
    HistoryHandler -.->|Logs| CloudWatchLogs
    WebSocketAPI -.->|Logs| CloudWatchLogs
    RESTAPI -.->|Logs| CloudWatchLogs

    TerraformConfig -.->|Apply| APIGW
    TerraformConfig -.->|Apply| LAMBDA
    TerraformConfig -.->|Apply| ConnectionsTable
    TerraformConfig -.->|Apply| MessagesTable
    TerraformConfig -.->|Apply| CognitoUserPool
    TerraformConfig -.->|Apply| CloudWatchLogs
    TerraformConfig -.->|State| TerraformState
```

## User Authentication Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Frontend as Next.js
    participant Cognito as Cognito (User Pool)
    participant DynamoDB as DynamoDB (connections)

    User->>Frontend: 1. Click Sign Up
    Frontend->>Cognito: 2. SignUp(email, password)
    Cognito-->>User: 3. Confirmation email sent

    User->>Frontend: 4. Enter verification code
    Frontend->>Cognito: 5. ConfirmSignUp(email, code)
    Cognito-->>Frontend: 6. User confirmed

    User->>Frontend: 7. Sign In (email, password)
    Frontend->>Cognito: 8. InitiateAuth(email, password)
    Cognito-->>Frontend: 9. Tokens (IdToken, AccessToken, RefreshToken)

    Frontend->>Frontend: 10. Store tokens in HttpOnly cookies
    Frontend-->>User: 11. Redirect to Chat
```

## WebSocket Connection Flow

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant APIGW as API Gateway WebSocket
    participant Authorizer as Lambda authorizer
    participant Cognito as Cognito
    participant DynamoDB as DynamoDB (connections)

    Browser->>APIGW: 1. WSS Connect with JWT token
    APIGW->>Authorizer: 2. Invoke with JWT token
    Authorizer->>Authorizer: 3. Decode JWT
    Authorizer->>Cognito: 4. Validate token signature
    Cognito-->>Authorizer: 5. Token valid
    Authorizer->>Authorizer: 6. Extract userId (cognito:username)
    Authorizer-->>APIGW: 7. IAM policy (Allow)
    APIGW->>DynamoDB: 8. PutItem(connectionId, userId, timestamp)
    DynamoDB-->>APIGW: 9. Success
    APIGW-->>Browser: 10. Connected (200)
```

## Real-Time Messaging Flow

```mermaid
sequenceDiagram
    participant Sender as Sender (User A)
    participant APIGW as API Gateway WebSocket
    participant Lambda as Lambda message_handler
    participant DynamoDB as DynamoDB
    participant Receiver as Receiver (User B)

    Sender->>APIGW: 1. WSS Send message
    APIGW->>Lambda: 2. Invoke message_handler
    Lambda->>Lambda: 3. Parse request
    Lambda->>Lambda: 4. Generate messageId (UUID)
    Lambda->>DynamoDB: 5. Query connections where userId = user-b
    DynamoDB-->>Lambda: 6. Return connectionId(s)
    Lambda->>DynamoDB: 7. PutItem(message record)
    DynamoDB-->>Lambda: 8. Message stored
    Lambda->>APIGW: 9. PostToConnection(connectionId, payload)
    APIGW-->>Sender: 10. SendResult success
    APIGW->>Receiver: 11. Push message via WebSocket
    Receiver-->>APIGW: 12. Acknowledge
```

## Message History Flow

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant REST as API Gateway REST
    participant Lambda as Lambda history_handler
    participant DynamoDB as DynamoDB (messages)

    Browser->>REST: 1. GET /conversations/{id}/messages
    REST->>Lambda: 2. Invoke history_handler
    Lambda->>Lambda: 3. Get userId from JWT
    Lambda->>Lambda: 4. Validate access to conversation
    Lambda->>DynamoDB: 5. Query messages for conversation
    Note over Lambda,DynamoDB: Sorted by timestamp ascending
    DynamoDB-->>Lambda: 6. Return messages
    Lambda->>Lambda: 7. Convert Decimal types to int
    Lambda-->>REST: 8. Return messages JSON
    REST-->>Browser: 9. JSON response with chat history
    Note over Browser: Chat UI displays message list
```

## Data Model (DynamoDB)

```mermaid
erDiagram
    connections {
        string connectionId
        string userId
        number connectedAt
        string endpoint
    }
    messages {
        string conversationId
        number timestamp
        string messageId
        string senderId
        string receiverId
        string message
    }
    connections ||--o{ messages : stores
```

### Table Definitions

**connections table**
| Attribute | Type | Key |
|-----------|------|-----|
| connectionId | String | Partition Key (PK) |
| userId | String | Attribute |
| connectedAt | Number | Attribute |
| endpoint | String | Attribute |

**messages table**
| Attribute | Type | Key |
|-----------|------|-----|
| conversationId | String | Partition Key (PK) |
| timestamp | Number | Sort Key (SK) |
| messageId | String | Attribute |
| senderId | String | Attribute |
| receiverId | String | Attribute |
| message | String | Attribute |

## Infrastructure (Terraform-managed Resources)

```mermaid
flowchart TB
    subgraph TERRAFORM["Terraform Configuration (infrastructure/)"]
        main_tf["main.tf (Provider, backend)"]
        variables_tf["variables.tf"]
        outputs_tf["outputs.tf"]
        dynamodb_tf["dynamodb.tf (Tables, GSI)"]
        cognito_tf["cognito.tf (User pool, client)"]
        lambda_tf["lambda.tf (Functions, IAM)"]
        api_gateway_tf["api_gateway.tf (WebSocket, REST, routes)"]
        cloudwatch_tf["cloudwatch.tf (Log groups, dashboards)"]
    end

    subgraph APPLIED["AWS Resources (Deployed via Terraform)"]
        direction LR
        DDB["DynamoDB<br/>- connections<br/>- messages"]
        COG["Cognito<br/>- User Pool<br/>- App Client"]
        LAMBDA["Lambda<br/>- authorizer<br/>- connect_handler<br/>- disconnect_handler<br/>- message_handler<br/>- users_handler<br/>- history_handler"]
        APIGW["API Gateway<br/>- WebSocket API<br/>- REST API"]
        CW["CloudWatch<br/>- Log Groups<br/>- Dashboards"]
        IAM["IAM<br/>- Lambda execution role<br/>- API GW logs role"]
    end

    subgraph DEPLOY["Deployment Workflow"]
        Local["Local Machine<br/>(Terraform apply)"]
        AWS["AWS Cloud<br/>(Resources created)"]
    end

    main_tf -->|Defines| variables_tf
    main_tf -->|References| dynamodb_tf
    main_tf -->|References| cognito_tf
    main_tf -->|References| lambda_tf
    main_tf -->|References| api_gateway_tf
    main_tf -->|References| cloudwatch_tf

    Local -->|terraform apply| AWS
    outputs_tf -->|Provides| AWS
    outputs_tf -->|Provides| Local

    dynamodb_tf -->|Creates| DDB
    cognito_tf -->|Creates| COG
    lambda_tf -->|Creates| LAMBDA
    lambda_tf -->|Creates| IAM
    api_gateway_tf -->|Creates| APIGW
    cloudwatch_tf -->|Creates| CW
```

## Deployment Flow

```mermaid
flowchart LR
    subgraph GIT["Git Repository (GitHub)"]
        main_branch["main branch"]
    end

    subgraph FRONTEND_DEPLOY["Frontend (Vercel)"]
        VercelBuild["Vercel Build<br/>(npm install, build)"]
        VercelDeploy["Vercel Deploy<br/>(Automatic on push)"]
        VercelCDN["Vercel CDN<br/>(Global edge network)"]
    end

    subgraph BACKEND_DEPLOY["Backend (AWS - Terraform)"]
        TerraformInit["terraform init"]
        TerraformPlan["terraform plan"]
        TerraformApply["terraform apply"]
        LambdaUpdate["Lambda Code Update<br/>(zip + aws cli)"]
    end

    subgraph RESOURCES["AWS Resources"]
        LambdaFunc["Lambda Functions"]
        APIGateway["API Gateway"]
        DynamoDB["DynamoDB"]
        Cognito["Cognito"]
        CloudWatch["CloudWatch"]
    end

    main_branch -->|git push| VercelBuild
    VercelBuild -->|On push to main| VercelDeploy
    VercelDeploy -->|CDN| VercelCDN

    main_branch -->|git push| TerraformPlan
    TerraformPlan -->|terraform apply| TerraformApply
    TerraformApply -->|Creates/Updates| RESOURCES
    TerraformApply -->|Updates| LambdaFunc

    LambdaFunc -->|Python code| LambdaUpdate
    LambdaUpdate -->|Deploy| LambdaFunc
```

## Environment Configuration

```mermaid
flowchart TB
    subgraph FRONTEND_ENV["Frontend (Vercel)"]
        API_URL["NEXT_PUBLIC_API_URL<br/>https://wka1crhece.execute-api.us-east-1.amazonaws.com"]
        WS_URL["NEXT_PUBLIC_WEBSOCKET_URL<br/>wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default"]
        COGNITO_CLIENT["NEXT_PUBLIC_COGNITO_CLIENT_ID<br/>6pbdutoj0p9bhrp2hia7qcflj6"]
        COGNITO_POOL["NEXT_PUBLIC_COGNITO_USER_POOL_ID<br/>us-east-1_tQ9N9Y8LF"]
        REGION["NEXT_PUBLIC_COGNITO_REGION<br/>us-east-1"]
    end

    subgraph BACKEND_ENV["Backend (Lambda)"]
        DDB_MESSAGES["DYNAMODB_TABLE_MESSAGES<br/>family-messenger-messages"]
        DDB_CONNECTIONS["DYNAMODB_TABLE_CONNECTIONS<br/>family-messenger-connections"]
        AWS_REGION["AWS_REGION<br/>us-east-1"]
    end

    subgraph SECRETS["Security"]
        JWT_SECRET["JWT Secret (Cognito public keys)"]
        HTTPS["HTTPS/WSS (Always encrypted)"]
        HttpOnly["HttpOnly Cookies (Token storage)"]
    end
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js, React, TypeScript | User interface |
| **Hosting** | Vercel | Frontend deployment |
| **Auth** | AWS Cognito | User authentication |
| **API** | AWS API Gateway | WebSocket + REST endpoints |
| **Compute** | AWS Lambda | Backend logic (Python) |
| **Database** | AWS DynamoDB | Messages + connections storage |
| **Infrastructure** | Terraform | Backend resource management |
| **Monitoring** | AWS CloudWatch | Logs, metrics, dashboards |

## Resource Reference

| Resource | Identifier/Value |
|----------|------------------|
| **Frontend URL** | https://sanketmessenger.vercel.app |
| **WebSocket API** | 7477wqg01f |
| **REST API** | wka1crhece |
| **Cognito User Pool** | us-east-1_tQ9N9Y8LF |
| **Cognito App Client** | 6pbdutoj0p9bhrp2hia7qcflj6 |
| **DynamoDB Tables** | family-messenger-messages, family-messenger-connections |
| **Lambda Functions** | authorizer, connect_handler, disconnect_handler, message_handler, users_handler, history_handler |
| **Region** | us-east-1 |