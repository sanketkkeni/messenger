# 21 - Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │   Browser   │  │   Browser   │  │   Mobile    │                       │
│  │  (User A)   │  │  (User B)   │  │   (Future)  │                       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                       │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          │ HTTPS/WSS      │ HTTPS/WSS      │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           AWS CLOUD                                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     VERCEL CDN                                  │   │
│  │                   (Static Assets)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API GATEWAY                                  │   │
│  │  ┌─────────────────────┐    ┌─────────────────────────────┐   │   │
│  │  │   WebSocket API     │    │       REST API              │   │   │
│  │  │   wss://.../$default│    │   https://.../prod/...       │   │   │
│  │  │                     │    │                             │   │   │
│  │  │  $connect ─────────┼────┼──► authorizer (Lambda)      │   │   │
│  │  │  $send    ─────────┘    │                             │   │   │
│  │  │  $disconnect───────────│────────────────────────────┤   │   │
│  │  └─────────────────────────┘                             │   │   │
│  └─────────────────────────────────────────────────────────┼───────┘   │
│                                                              │          │
│                              ┌──────────────────────────────┘          │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     LAMBDA FUNCTIONS                            │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │ authorizer  │  │   connect    │  │  disconnect  │            │   │
│  │  │   (JWT)     │  │   handler    │  │   handler    │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   message   │  │    users    │  │   history   │            │   │
│  │  │   handler   │  │   handler   │  │   handler   │            │   │
│  │  └──────┬──────┘  └─────────────┘  └──────┬──────┘            │   │
│  │         │                                │                     │   │
│  └─────────┼────────────────────────────────┼─────────────────────┘   │
│            │                                │                         │
│            ▼                                ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       DYNAMODB                                   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐  │   │
│  │  │  family-messenger-      │  │   family-messenger-         │  │   │
│  │  │    connections          │  │     messages                │  │
│  │  │                         │  │                             │  │   │
│  │  │  PK: connectionId       │  │   PK: conversationId         │  │   │
│  │  │  Attributes:            │  │   SK: timestamp             │  │   │
│  │  │    - userId             │  │   Attributes:               │  │   │
│  │  │    - connectedAt        │  │     - senderId              │  │   │
│  │  │    - endpoint           │  │     - receiverId            │  │   │
│  │  │                         │  │     - message               │  │   │
│  │  └─────────────────────────┘  │     - messageId             │  │   │
│  │                               └─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      COGNITO                                    │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │              us-east-1_tQ9N9Y8LF                          │  │   │
│  │  │                                                         │  │   │
│  │  │   Users Table:                                          │  │   │
│  │  │   - Email (username)                                    │  │   │
│  │  │   - Password (hashed)                                   │  │   │
│  │  │   - Email verified status                                │  │   │
│  │  │                                                         │  │   │
│  │  │   App Client: 6pbdutoj0p9bhrp2hia7qcflj6                │  │   │
│  │  │   - OAuth 2.0                                           │  │   │
│  │  │   - JWT tokens                                          │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     CLOUDWATCH                                  │   │
│  │                                                                 │   │
│  │   Log Groups:                                                   │   │
│  │   - /aws/lambda/family-messenger-*                             │   │
│  │   - /aws/apigateway/family-messenger/*                         │   │
│  │   - /aws/cognito/family-messenger-users                        │   │
│  │                                                                 │   │
│  │   Dashboards:                                                   │   │
│  │   - Lambda metrics (invocations, errors, duration)             │   │
│  │   - API Gateway metrics (connections, messages)                │   │
│  │   - DynamoDB metrics (capacity, latency)                       │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  User    │         │ Frontend │         │ Cognito  │         │ DynamoDB │
│          │         │          │         │          │         │          │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │ 1. POST /signup    │                    │                    │
     │───────────────────►│                    │                    │
     │                    │ 2. SignUp          │                    │
     │                    │───────────────────►                    │
     │                    │                    │                    │
     │                    │ 3. Confirm Email  │                    │
     │                    │───────────────────►                    │
     │                    │                    │                    │
     │ 4. POST /signin    │                    │                    │
     │───────────────────►│                    │                    │
     │                    │ 5. InitiateAuth    │                    │
     │                    │───────────────────►                    │
     │                    │                    │                    │
     │                    │ 6. Tokens (ID, Access, Refresh)        │
     │◄───────────────────│                    │                    │
     │                    │                    │                    │
     │ 7. WSS Connect     │                    │                    │
     │ (with token)       │                    │                    │
     │───────────────────►│                    │                    │
     │                    │ 8. Invoke authorizer│                   │
     │                    │────────────────────────────────────────►│
     │                    │                    │                    │
     │                    │ 9. Save connection │                    │
     │                    │────────────────────────────────────────►│
     │                    │                    │                    │
     │◄───────────────────│ 10. Connected     │                    │
     │                    │                    │                    │
     │ 11. Send message   │                    │                    │
     │───────────────────►│ 12. POST /messages │                   │
     │                    │────────────────────────────────────────►│
     │                    │                    │                    │
     │                    │ 13. Store message  │                    │
     │                    │────────────────────────────────────────►│
     │                    │                    │                    │
     │ 14. Receive via WS │                    │                    │
     │◄───────────────────│                    │                    │
     │                    │                    │                    │
```

## Message Flow (Real-time)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ User A  │     │Frontend │     │ Lambda  │     │DynamoDB │     │Frontend │
│         │     │         │     │  API    │     │         │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │                │                │                │                │
     │ 1. Type message│                │                │                │
     │                │                │                │                │
     │ 2. WSS send    │                │                │                │
     │───────────────►│                │                │                │
     │                │                │                │                │
     │                │ 3. API Gateway route $send                     │
     │                │────────────────►                │                │
     │                │                │                │                │
     │                │                │ 4. Lambda message_handler     │
     │                │                │────────────────►                │
     │                │                │                │                │
     │                │                │ 5. Store message              │
     │                │                │────────────────►                │
     │                │                │                │                │
     │                │                │ 6. PutItem result              │
     │                │◄────────────────│                │                │
     │                │                │                │                │
     │ 7. Confirm sent│                │                │                │
     │◄───────────────│                │                │                │
     │                │                │                │                │
     │                │ 8. PostToConnection (to User B)               │
     │                │────────────────────────────────────────────────►│
     │                │                │                │                │
     │                │                │                │ 9. Receive via │
     │                │                │                │    WebSocket   │
     │                │                │                │◄───────────────│
     │                │                │                │                │
```

## WebSocket Connection Lifecycle

```
Timeline

User A                          Lambda                          DynamoDB
 │                                │                                │
 │  WSS Connect                   │                                │
 │────────────────────────────────►                                │
 │                                │                                │
 │                                │ Validate JWT                   │
 │                                │────────────────────────────────►
 │                                │                                │
 │                                │ Store connection               │
 │                                │────────────────────────────────►
 │                                │                                │
 │  Connected                     │                                │
 │◄────────────────────────────────│                                │
 │                                │                                │
 │                                │                                │
 │  Send Message                  │                                │
 │────────────────────────────────►                                │
 │                                │                                │
 │                                │ Look up user connections       │
 │                                │────────────────────────────────►
 │                                │                                │
 │                                │ Send message to User B         │
 │                                │────────────────────────────────►
 │                                │                                │
 │  Message OK                    │                                │
 │◄────────────────────────────────│                                │
 │                                │                                │
 │                                │                                │
 │  Disconnect                    │                                │
 │────────────────────────────────►                                │
 │                                │                                │
 │                                │ Delete connection              │
 │                                │────────────────────────────────►
 │                                │                                │
 │  Disconnected                  │                                │
 │◄────────────────────────────────│                                │
 │                                │                                │
```

## Data Model (DynamoDB)

### connections Table

```
┌─────────────────────────────────────────────────────────────────────┐
│                     family-messenger-connections                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PK: connectionId (String)                                           │
│  SK: (none - single table design)                                   │
│                                                                      │
│  ┌───────────────────┬─────────────────────────────────────────┐   │
│  │ connectionId       │ Attributes                              │   │
│  ├───────────────────┼─────────────────────────────────────────┤   │
│  │ abc123...         │ userId: "user-a"                        │   │
│  │                   │ connectedAt: 1699123456789              │   │
│  │                   │ endpoint: "wss://..."                   │   │
│  └───────────────────┴─────────────────────────────────────────┘   │
│                                                                      │
│  ┌───────────────────┬─────────────────────────────────────────┐   │
│  │ connectionId       │ Attributes                              │   │
│  ├───────────────────┼─────────────────────────────────────────┤   │
│  │ def456...         │ userId: "user-b"                        │   │
│  │                   │ connectedAt: 1699123456790              │   │
│  │                   │ endpoint: "wss://..."                   │   │
│  └───────────────────┴─────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### messages Table

```
┌─────────────────────────────────────────────────────────────────────┐
│                       family-messenger-messages                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PK: conversationId (String)                                         │
│  SK: timestamp (Number)                                              │
│                                                                      │
│  ┌───────────────────┬─────────────────────────────────────────┐   │
│  │ conversationId    │ timestamp   │ Attributes                │   │
│  ├───────────────────┼──────────────┼───────────────────────────┤   │
│  │ user-a|user-b     │ 1699123456789│ senderId: "user-a"        │   │
│  │                   │              │ receiverId: "user-b"     │   │
│  │                   │              │ message: "Hello!"         │   │
│  │                   │              │ messageId: "msg-001"      │   │
│  ├───────────────────┼──────────────┼───────────────────────────┤   │
│  │ user-a|user-b     │ 1699123456791│ senderId: "user-b"       │   │
│  │                   │              │ receiverId: "user-a"      │   │
│  │                   │              │ message: "Hi there!"      │   │
│  │                   │              │ messageId: "msg-002"      │   │
│  ├───────────────────┼──────────────┼───────────────────────────┤   │
│  │ user-a|user-b     │ 1699123456793│ senderId: "user-a"        │   │
│  │                   │              │ receiverId: "user-b"      │   │
│  │                   │              │ message: "How are you?"   │   │
│  │                   │              │ messageId: "msg-003"      │   │
│  └───────────────────┴──────────────┴───────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Frontend Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                              App                                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  (AuthContext)                                               │ │
│  │                                                              │ │
│  │    ┌─────────────────────────────────────────────────────┐  │ │
│  │    │  Router                                              │  │ │
│  │    │                                                      │  │ │
│  │    │  ┌────────────┐ ┌────────────┐ ┌────────────┐      │  │ │
│  │    │  │ /signin    │ │ /signup    │ │ /chat      │      │  │ │
│  │    │  │            │ │            │ │            │      │  │ │
│  │    │  │ SignInForm │ │ SignUpForm │ │ ChatPage   │      │  │ │
│  │    │  │            │ │            │ │            │      │  │ │
│  │    │  └────────────┘ └────────────┘ │  ┌────────┐│      │  │ │
│  │    │                                 │  │ Sidebar││      │  │ │
│  │    │                                 │  │        ││      │  │ │
│  │    │                                 │  │ UserList││     │  │ │
│  │    │                                 │  └────────┘│      │  │ │
│  │    │                                 │            │      │  │ │
│  │    │                                 │  ┌────────┐│      │  │ │
│  │    │                                 │  │MessageList│     │  │ │
│  │    │                                 │  │        ││      │  │ │
│  │    │                                 │  │Message│ │      │  │ │
│  │    │                                 │  │Message│ │      │  │ │
│  │    │                                 │  └────────┘│      │  │ │
│  │    │                                 │            │      │  │ │
│  │    │                                 │  ┌────────┐│      │  │ │
│  │    │                                 │  │MessageInput│    │  │ │
│  │    │                                 │  └────────┘│      │  │ │
│  │    │                                 └────────────┘      │  │ │
│  │    └─────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Infrastructure (Terraform)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      infrastructure/                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  main.tf            - AWS provider, backend config                  │
│  ├── variables.tf   - Input variables                              │
│  ├── outputs.tf     - Output values                                │
│  ├── dynamodb.tf    - DynamoDB tables                              │
│  ├── cognito.tf     - User pool, app client                        │
│  ├── lambda.tf      - Lambda functions, IAM roles                  │
│  ├── api_gateway.tf - REST + WebSocket APIs                        │
│  ├── route53.tf     - (future) DNS records                         │
│  └── cloudwatch.tf  - Log groups, dashboards                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
messenger/
├── frontend/                    # Next.js application
│   ├── pages/
│   │   ├── _app.tsx           # App wrapper with AuthProvider
│   │   ├── index.tsx          # Landing/redirect
│   │   ├── signin.tsx         # Login page
│   │   ├── signup.tsx         # Registration page
│   │   └── chat.tsx           # Main chat interface
│   ├── components/
│   │   ├── SignInForm.tsx
│   │   ├── SignUpForm.tsx
│   │   ├── Sidebar.tsx
│   │   ├── UserList.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   └── MessageInput.tsx
│   ├── context/
│   │   └── AuthContext.tsx    # Auth state management
│   ├── lib/
│   │   ├── auth.ts            # Cognito authentication
│   │   └── websocket.ts       # WebSocket connection
│   ├── tests/                 # Playwright E2E tests
│   └── package.json
│
├── backend/                    # Lambda functions
│   ├── utils.py               # Shared utilities
│   ├── authorizer.py          # JWT validation
│   ├── connect_handler.py     # WebSocket connect
│   ├── disconnect_handler.py  # WebSocket disconnect
│   ├── message_handler.py     # Message processing
│   ├── users_handler.py       # User management
│   ├── history_handler.py     # Message history
│   └── *.zip                  # Deployment packages
│
├── infrastructure/            # Terraform
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── dynamodb.tf
│   ├── cognito.tf
│   ├── lambda.tf
│   ├── api_gateway.tf
│   └── cloudwatch.tf
│
├── technical_flow/           # Technical documentation
│   ├── README.md              # Documentation index
│   ├── 01_*.md               # Architecture overview
│   ├── 02_*.md               # AWS services
│   ├── ...                   # 21 documentation files
│
├── README.md                  # User documentation
├── PLAN.md                    # Project plan
├── WIKI.md                    # Knowledge base
└── AGENTS.md                  # Agent instructions
```

This concludes the technical documentation for the family messenger application.