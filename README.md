# Serverless Real-Time Family Messenger

A production-ready, serverless messaging application with real-time capabilities and secure authentication using AWS services.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   API Gateway   │     │   Lambda        │
│   (Next.js)     │◄───►│   (WebSocket)   │────►│   Functions     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   DynamoDB      │◄─────────────┤
                        │   - Connections │              │
                        │   - Messages    │              │
                        └─────────────────┘              │
                                                         │
                        ┌─────────────────┐              │
                        │   Cognito       │◄─────────────┘
                        │   (Auth)        │
                        └─────────────────┘
```

## Prerequisites

- **AWS Account** with appropriate permissions
- **Terraform** >= 1.15.2
- **Node.js** >= 18.x
- **Python** >= 3.13 (for local development/testing)

## Project Structure

```
messenger/
├── infrastructure/          # Terraform IaC files
│   ├── main.tf              # Terraform configuration
│   ├── variables.tf         # Input variables
│   ├── outputs.tf           # Output values
│   ├── cognito.tf           # Cognito User Pool & Client
│   ├── dynamodb.tf          # DynamoDB Tables
│   ├── iam.tf              # IAM Roles & Policies
│   ├── api_gateway.tf      # API Gateway (WebSocket & REST)
│   └── lambda.tf           # Lambda Functions
├── backend/                 # Python Lambda functions
│   ├── utils.py            # Shared utilities
│   ├── authorizer.py       # JWT validation
│   ├── connect_handler.py  # WebSocket connect
│   ├── disconnect_handler.py # WebSocket disconnect
│   ├── message_handler.py  # Message routing
│   └── users_handler.py    # REST API endpoint
├── frontend/               # Next.js application
│   ├── pages/             # Page components
│   ├── components/       # Reusable components
│   ├── lib/              # Utilities (auth, websocket)
│   ├── context/          # React contexts
│   └── styles/           # CSS files
└── README.md             # This file
```

## Deployment

### Step 1: Infrastructure Setup (Terraform)

1. **Initialize Terraform:**
   ```bash
   cd infrastructure
   terraform init
   ```

2. **Create a variables file (optional):**
   Create `dev.tfvars` with your configuration:
   ```hcl
   aws_region        = "us-east-1"
   environment       = "dev"
   project_name      = "family-messenger"
   ```

3. **Plan the infrastructure:**
   ```bash
   terraform plan -var-file="dev.tfvars"
   # Or without vars file:
   terraform plan
   ```

4. **Apply the infrastructure:**
   ```bash
   terraform apply -var-file="dev.tfvars"
   # Or without vars file:
   terraform apply
   ```

   Type `yes` when prompted to confirm.

5. **Get the outputs:**
   ```bash
   terraform output
   ```

   Note down these important values:
   - `user_pool_id`
   - `user_pool_client_id`
   - `websocket_api_endpoint`
   - `rest_api_endpoint`

### Step 2: Lambda Functions

The Lambda functions are deployed as part of the Terraform apply. However, if you need to update them separately:

1. **Package the Python functions:**
   ```bash
   cd backend

   # Create zip for each function
   zip authorizer.zip authorizer.py utils.py
   zip connect_handler.zip connect_handler.py utils.py
   zip disconnect_handler.zip disconnect_handler.py utils.py
   zip message_handler.zip message_handler.py utils.py
   zip users_handler.zip users_handler.py utils.py
   ```

2. **Update Lambda functions:**
   ```bash
   aws lambda update-function-code \
     --function-name family-messenger-authorizer \
     --zip-file fileb://authorizer.zip
   ```

### Step 3: Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment variables:**
   Create `.env.local` in the frontend directory:
   ```env
   NEXT_PUBLIC_AWS_REGION=us-east-1
   NEXT_PUBLIC_USER_POOL_ID=<your-user-pool-id>
   NEXT_PUBLIC_USER_POOL_CLIENT_ID=<your-client-id>
   NEXT_PUBLIC_WEBSOCKET_ENDPOINT=wss://<your-websocket-api-id>.execute-api.us-east-1.amazonaws.com/$default
   NEXT_PUBLIC_REST_API_ENDPOINT=https://<your-rest-api-id>.execute-api.us-east-1.amazonaws.com/$default
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

## WebSocket Message Contract

### Client to Server

#### Connect
Connect to the WebSocket endpoint with the JWT token in the query parameter:
```
wss://<api-id>.execute-api.<region>.amazonaws.com/$default?Authorization=<jwt-token>
```

#### Send Message
```json
{
  "action": "sendMessage",
  "recipientId": "user@example.com",
  "text": "Hello, how are you?"
}
```

**Required Fields:**
- `action` (string): Must be "sendMessage"
- `recipientId` (string): The username/email of the recipient
- `text` (string): The message content

### Server to Client

#### Incoming Message
```json
{
  "senderId": "sender@example.com",
  "text": "Hello, how are you?",
  "timestamp": 1704067200000,
  "conversationId": "user1@example.com#user2@example.com"
}
```

**Fields:**
- `senderId` (string): Username of the sender
- `text` (string): The message content
- `timestamp` (number): Unix timestamp in milliseconds
- `conversationId` (string): Unique conversation identifier

#### System Messages
```json
{
  "type": "system",
  "message": "Connection established"
}
```

#### Error Response
```json
{
  "error": true,
  "message": "Error description"
}
```

## REST API

### GET /users

Retrieve all registered users from Cognito.

**Request:**
```http
GET https://<api-id>.execute-api.<region>.amazonaws.com/$default/users
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "users": [
    {
      "username": "user1",
      "email": "user1@example.com",
      "email_verified": true,
      "created_at": "2024-01-01T00:00:00Z",
      "status": "CONFIRMED",
      "enabled": true
    }
  ],
  "count": 1
}
```

## CloudWatch Logging

All Lambda functions are configured with CloudWatch Logs:

- **Log Group:** `/aws/lambda/family-messenger-<function-name>`
- **Retention:** 30 days (configurable)
- **Log Level:** INFO (can be changed via environment variable LOG_LEVEL)

### Viewing Logs

```bash
# View recent logs for a specific function
aws logs tail /aws/lambda/family-messenger-message-handler --follow

# Search logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-message-handler \
  --filter-pattern "ERROR"
```

### Metrics Dashboard

The following CloudWatch metrics are automatically available:
- Lambda invocations and errors
- API Gateway request counts
- WebSocket connection counts
- DynamoDB read/write capacity

## Security Considerations

1. **JWT Token Validation:** All WebSocket connections and REST API calls require valid Cognito JWT tokens
2. **CORS:** API Gateway is configured with appropriate CORS settings
3. **IAM Roles:** Lambda functions have least-privilege permissions
4. **DynamoDB:** Tables are created with PAY_PER_REQUEST billing for automatic scaling
5. **Data Encryption:** All data at rest is encrypted using AWS managed keys

## Cleanup

To destroy all resources created by Terraform:

```bash
cd infrastructure
terraform destroy
```

Type `yes` when prompted to confirm deletion of all resources.

## Troubleshooting

### WebSocket Connection Issues
- Verify the JWT token is valid and not expired
- Check CloudWatch logs for Lambda authorizer errors
- Ensure the WebSocket endpoint URL is correct

### Message Delivery Issues
- Check that the recipient is connected (look in Connections table)
- Verify the recipient's user ID is correct
- Review CloudWatch logs for message handler errors

### DynamoDB Errors
- Ensure IAM permissions are correct
- Check table names match environment variables
- Verify DynamoDB is available in the selected region

## Performance Considerations

- **DynamoDB:** PAY_PER_REQUEST billing handles variable load automatically
- **Lambda:** Cold starts are minimized with provisioned concurrency (optional)
- **API Gateway:** WebSocket connections are managed automatically
- **Frontend:** Messages are queued when connection is lost and retried on reconnect

## Development Workflow

1. **Update Infrastructure:** Modify `.tf` files and run `terraform apply`
2. **Update Backend:** Modify Python files, zip, and update Lambda functions
3. **Update Frontend:** Modify React components and run `npm run dev`
4. **Testing:** Use the frontend UI or Postman/curl for REST API testing

## License

This project is for educational and personal use.