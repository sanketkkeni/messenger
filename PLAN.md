# Serverless Real-Time Family Messenger - Implementation Plan

## Overview
This document outlines the implementation plan for building a production-ready, serverless messaging application with real-time capabilities and secure authentication using AWS services, Terraform for infrastructure, Python for backend logic, and Next.js for the frontend.

## Project Structure
```
messenger/
├── infrastructure/          # Terraform IaC files
├── backend/                 # Python Lambda functions
├── frontend/                # Next.js application
└── README.md                # Documentation
```

## Phase 1: Infrastructure-as-Code (Terraform)

### 1.1 Core Infrastructure Files
- `main.tf` - Terraform configuration, provider, and required versions
- `variables.tf` - Input variables for environment, region, naming conventions
- `outputs.tf` - Output values for frontend configuration (User Pool ID, Client ID, API endpoints)

### 1.2 Cognito Authentication (`cognito.tf`)
- User Pool with username/password authentication
- User Pool Client configured for USER_PASSWORD_AUTH and ADMIN_NO_SRP_AUTH flows
- Password policy requirements (8 chars, uppercase, lowercase, numbers)
- Email verification and required attributes
- Outputs for frontend integration

### 1.3 Data Storage (`dynamodb.tf`)
- Connections Table: UserId (PK), connectionId (SK) - PAY_PER_REQUEST billing
- Messages Table: conversationId (PK), timestamp (SK) - PAY_PER_REQUEST billing
- Both tables tagged with environment and project information

### 1.4 Security & Permissions (`iam.tf`)
- Lambda execution role with basic CloudWatch Logs policy
- Custom IAM policies for:
  - DynamoDB access (GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan)
  - API Gateway connection management
  - Cognito read access (ListUsers, AdminGetUser)
- Role policy attachments for all permissions

### 1.5 API Gateway (`api_gateway.tf`)
- WebSocket API for real-time messaging:
  - Routes: $connect, $disconnect, sendMessage
  - Integration with corresponding Lambda functions
  - Deployment stage configuration
- REST API for user discovery:
  - GET /users endpoint
  - Integration with users Lambda function
  - Deployment stage configuration
- API Gateway stage variables and logging configuration

### 1.6 Lambda Functions (`lambda.tf`)
- Five Lambda functions defined:
  1. Authorizer - Validates Cognito JWT tokens
  2. ConnectHandler - Manages WebSocket connection establishment
  3. DisconnectHandler - Cleans up connection data
  4. MessageHandler - Processes sendMessage actions and routes messages
  5. UsersHandler - REST endpoint for listing registered users
- Each function configured with:
  - Python 3.13 runtime
  - Appropriate timeout and memory settings
  - Environment variables for table names, etc.
  - Packaging from local directories
  - Dependencies on IAM role

## Phase 2: Backend Logic (Python 3.13)

### 2.1 Shared Utilities (`utils.py`)
- JWT validation helper using PyJWT and Cognito public keys
- DynamoDB helper functions for common operations
- Error handling and response formatting utilities
- Environment variable loading and validation
- Logging configuration

### 2.2 Authorizer (`authorizer.py`)
- Extracts JWT from WebSocket connection headers
- Validates token signature, expiration, audience
- Retrieves user information from Cognito claims
- Generates IAM policy allowing WebSocket connection
- Returns appropriate error responses for invalid tokens

### 2.3 Connection Handler (`connect_handler.py`)
- Extracts UserId from validated JWT claims (two methods):
  1. From authorizer context (if custom authorizer used)
  2. Direct from query parameters (fallback for AuthorizationType: NONE)
- Stores UserId and connectionId in Connections table
- Returns appropriate status codes (200, 401, 500)

Note: Unlike the original plan, the connect handler performs direct token
validation instead of relying solely on the authorizer. This provides
reliability when the custom authorizer is bypassed or not invoked.

### 2.4 Disconnect Handler (`disconnect_handler.py`)
- Extracts connectionId from WebSocket event
- Removes corresponding record from Connections table
- Handles cases where connection may not exist
- Returns appropriate status codes

### 2.5 Message Handler (`message_handler.py`)
- Parses incoming WebSocket message body
- Validates required fields: action, recipientId, text
- Only processes "sendMessage" action
- Looks up recipientId in Connections table to get connectionId
- If recipient is online:
  - Uses boto3 to call apigatewaymanagementapi@postToConnection
  - Sends formatted message to recipient's connectionId
- Always saves message to Messages table regardless of recipient online status:
  - conversationId: sorted combination of senderId and recipientId
  - timestamp: epoch milliseconds
  - senderId, text, and optional metadata
- Handles errors gracefully (connection not found, API Gateway errors)
- Returns appropriate responses to sender

### 2.6 Users Handler (`users_handler.py`)
- REST API endpoint handler for GET /users
- Uses boto3 to call cognito-idp@listUsers
- Filters and formats user data (username, email, etc.)
- Excludes sensitive information
- Returns JSON array of user objects
- Handles pagination if needed
- Implements error handling and proper HTTP status codes

## Phase 3: Frontend Application (Next.js with Tailwind CSS)

### 3.1 Project Initialization
- Create Next.js app with TypeScript
- Install dependencies: tailwindcss, postcss, autoprefixer, lucide-react
- Configure Tailwind for dark mode and custom colors
- Set up PostCSS configuration

### 3.2 Authentication System (`lib/auth.js`)
- AWS Amplify or AWS SDK for JavaScript v3 integration
- User registration (signUp) with email verification
- User authentication (signIn) with password
- Token management (store JWT in localStorage)
- Session handling and refresh
- Sign out functionality
- Error handling and user feedback

### 3.3 WebSocket Connection (`lib/websocket.js`)
- Establish connection to API Gateway WebSocket endpoint
- Include JWT in connection headers for authorization
- Handle connection events: open, close, error, message
- Reconnection logic with exponential backoff
- Message queue for sending when connection is ready
- Subscription to message events for UI updates

### 3.4 Core Components

#### Layout Component (`components/layout.js`)
- Consistent header/footer navigation
- Dark mode toggle switch
- Responsive container styling
- Global context providers (auth, websocket)

#### Authentication Pages
- `pages/login.js` - Email/password login form
- `pages/signup.js` - Registration form with verification
- `pages/index.js` - Landing page redirecting based on auth status

#### Chat Interface (`pages/chat.js`)
- Protected route requiring authentication
- Contact list sidebar
- Main chat window
- Message input area
- Real-time updates from WebSocket

#### Reusable Components
- `components/chat-window.js` - Main messaging interface
- `components/message-list.js` - Virtualized list of messages
- `components/message-input.js` - Text input with send button
- `components/user-list.js` - List of available users for chat
- `components/message-bubble.js` - Individual message styling
- `components/user-status-indicator.js` - Online/offline presence

### 3.5 Styling & Theming
- Tailwind CSS configuration with custom color palette (fintech-inspired)
- Dark mode support using class strategy
- Responsive design breakpoints
- Custom animations for message transitions
- Focus states and accessibility considerations
- Global CSS for base styles and resets

### 3.6 State Management
- React Context API for global state (auth, user data, contacts)
- Local storage persistence for JWT and connection settings
- SWR or React Query for REST API data fetching (users list)
- Optimistic UI updates for messaging
- Error boundaries and loading states

### 3.7 Key Features Implementation
- **Contact List**: Fetches users via GET /users REST endpoint on login
- **Real-time Messaging**: Bidirectional WebSocket communication
- **Message Persistence**: Local storage of recent messages for continuity
- **Presence Indicators**: Online/offline status based on WebSocket connections
- **Message Status**: Sent, delivered, read indicators (basic implementation)
- **Conversation History**: Load previous messages on chat initiation
- **Search & Filter**: Basic contact search functionality

## Phase 4: Testing & Deployment

### 4.1 Local Development
- Terraform workflow: init → plan → apply
- Backend local testing with sam local invoke or pytest
- Frontend development: npm run dev
- Environment variable configuration for local testing

### 4.2 Deployment Process
1. Infrastructure deployment:
   ```
   cd infrastructure
   terraform init
   terraform plan -var-file="dev.tfvars"
   terraform apply -var-file="dev.tfvars"
   ```

2. Backend deployment:
   - Terraform handles Lambda deployment via zip files
   - Optional: Separate CI/CD pipeline for code updates

3. Frontend deployment:
   ```
   cd frontend
   npm run build
   # Deploy to Vercel, Netlify, or AWS Amplify
   ```

### 4.3 Post-Deployment Verification
- Test user registration and login flows
- Verify WebSocket connection establishment
- Test message sending and receiving
- Confirm data persistence in DynamoDB tables
- Monitor CloudWatch logs for Lambda functions
- Validate API Gateway metrics and throttling

## Phase 5: Documentation

### 5.1 README.md Contents
- Project overview and architecture diagram
- Prerequisites and installation instructions
- Terraform usage:
  - Variables file examples
  - Apply/destroy commands
  - Output explanations
- Backend development:
  - Local testing instructions
  - Deployment process
  - Logging and monitoring
- Frontend usage:
  - Environment setup
  - Development server commands
  - Production build instructions
- WebSocket Message Contract:
  - Client → Server: `{ "action": "sendMessage", "recipientId": "string", "text": "string" }`
  - Server → Client: `{ "senderId": "string", "text": "string", "timestamp": "number" }`
  - System messages and error formats
- Security considerations and best practices
- Troubleshooting common issues
- Cleanup instructions for resource removal

## Technical Dependencies

### Infrastructure
- Terraform ~> 1.15.2
- AWS Provider ~> 5.0
- Python 3.13 (Lambda runtime)

### Backend
- Python 3.13
- boto3 (AWS SDK)
- PyJWT (for token validation in authorizer)
- Python-dotenv (environment variable management)

### Frontend
- Next.js (latest)
- React 18
- TypeScript
- Tailwind CSS
- Lucide React Icons
- AWS SDK for JavaScript v3 or Amplify

## Milestones

### Completed Milestones

1. **Milestone 1**: Infrastructure provisioning (Cognito, DynamoDB, IAM) ✅
   - All Terraform files created and applied
   - Cognito User Pool configured with email verification
   - DynamoDB tables for connections and messages

2. **Milestone 2**: API Gateway and Lambda functions ✅
   - WebSocket API with $connect, $disconnect, sendMessage routes
   - REST API with /users endpoint
   - All 5 Lambda functions deployed

3. **Milestone 3**: Basic frontend authentication ✅
   - Login/signup/confirm pages implemented
   - Cognito SDK integration working
   - Token storage in localStorage

4. **Milestone 4**: Real-time messaging functionality ✅
   - WebSocket connection established (resolved token validation issue)
   - Connection stored in DynamoDB
   - Contact list loading from /users endpoint

5. **Milestone 5**: Testing & Documentation
   - Playwright tests for WebSocket debugging
   - WIKI.md with issue resolution history
   - Code comments throughout codebase
   - AGENTS.md for AI assistant workflow

### Remaining Work

6. **Milestone 6**: Message delivery verification
   - `message_handler` Lambda exists but end-to-end messaging not tested
   - DynamoDB message persistence not verified

7. **Milestone 7**: UI polish and features
   - Basic chat interface working
   - Message history display needs enhancement
   - Responsive design improvements

This plan provides a comprehensive roadmap for building the serverless real-time family messenger application following all specified requirements and best practices.