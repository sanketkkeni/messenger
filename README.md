# Serverless Real-Time Family Messenger

A production-ready, serverless messaging application with real-time WebSocket capabilities and secure authentication using AWS services.

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

## Quick Start

### 1. Deploy Infrastructure
```bash
cd infrastructure
terraform init
terraform apply
```

### 2. Configure Frontend
Create `frontend/.env.local` with outputs from terraform:
```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_WEBSOCKET_ENDPOINT=wss://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/$default
NEXT_PUBLIC_REST_API_ENDPOINT=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/$default
```

### 3. Start Development
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
messenger/
├── infrastructure/          # Terraform IaC
│   ├── main.tf             # Provider & remote config
│   ├── variables.tf        # Input variables
│   ├── outputs.tf          # Output values
│   ├── cognito.tf          # Cognito User Pool
│   ├── dynamodb.tf         # DynamoDB Tables
│   ├── iam.tf              # IAM Roles
│   ├── api_gateway.tf      # WebSocket & REST APIs
│   └── lambda.tf           # Lambda Functions
├── backend/                 # Python Lambda handlers
│   ├── utils.py            # Shared utilities
│   ├── authorizer.py       # JWT authorizer
│   ├── connect_handler.py  # WebSocket $connect
│   ├── disconnect_handler.py # WebSocket $disconnect
│   ├── message_handler.py   # Message routing
│   └── users_handler.py     # REST /users endpoint
├── frontend/               # Next.js application
│   ├── pages/              # Page components
│   ├── context/            # Auth & WebSocket providers
│   ├── lib/                # Auth & WebSocket modules
│   ├── __tests__/         # Jest tests
│   └── tests/              # Playwright tests
├── WIKI.md                 # Debugging guide & issues
├── AGENTS.md               # Agent rules for AI assistants
└── README.md               # This file
```

## Key Components

### WebSocket Connection Flow
1. Client connects with JWT token: `wss://...?Authorization=<token>`
2. `connect_handler` validates token and stores `connectionId` in DynamoDB
3. Client sends messages via WebSocket to `message_handler`
4. `message_handler` routes messages between users via API Gateway Management API

### REST API
- **GET /users** - List registered users from Cognito
- Returns cached results for 30 seconds

## Updating Lambda Functions

When you modify Python handlers in `backend/`:

```bash
# 1. Create zip file
cd backend
python -c "import zipfile, os; z = zipfile.ZipFile('handler.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f)) for r,d,files in os.walk('.') for f in files if f.endswith('.py')]; z.close()"

# 2. Deploy to AWS
aws lambda update-function-code --function-name family-messenger-connect-handler --zip-file fileb://connect_handler.zip --no-cli-pager
```

## Testing

### Playwright Tests (WebSocket)
```bash
cd frontend
cmd /c "npx playwright test"
```

### Jest Tests (Unit)
```bash
cd frontend
cmd /c "npm test"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_AWS_REGION` | AWS region (e.g., us-east-1) |
| `NEXT_PUBLIC_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | Cognito Client ID |
| `NEXT_PUBLIC_WEBSOCKET_ENDPOINT` | WebSocket API URL |
| `NEXT_PUBLIC_REST_API_ENDPOINT` | REST API URL |

## WebSocket Message Contract

### Send Message (Client → Server)
```json
{
  "action": "sendMessage",
  "recipientId": "user-uuid",
  "text": "Hello!"
}
```

### Receive Message (Server → Client)
```json
{
  "senderId": "sender-uuid",
  "text": "Hello!",
  "timestamp": 1778371812000,
  "conversationId": "uuid1#uuid2"
}
```

## Documentation

- [WIKI.md](WIKI.md) - Debugging guide, issues resolved, architecture decisions
- [AGENTS.md](AGENTS.md) - AI agent rules and workflow guidelines
- [PLAN.md](PLAN.md) - Original implementation plan

## Troubleshooting

### WebSocket Shows "Disconnected"
1. Check browser console for detailed error
2. Verify `.env.local` has correct endpoints
3. Check CloudWatch logs: `/aws/lambda/family-messenger-connect-handler`
4. Ensure JWT token is valid (log out and back in)

### Messages Not Delivering
1. Verify both users show "Connected" status
2. Check DynamoDB `family-messenger-connections` table
3. Review CloudWatch logs for `message_handler` errors

### Lambda Errors
1. View logs: `aws logs filter-log-events --log-group-name /aws/lambda/family-messenger-<handler>`
2. Check Lambda configuration matches expected environment variables
3. Verify Lambda zip contains all required dependencies

## Cleanup

```bash
cd infrastructure
terraform destroy
```

## License

This project is for educational and personal use.
