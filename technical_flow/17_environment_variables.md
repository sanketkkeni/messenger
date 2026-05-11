# 17 - Environment Configuration

## Environment Variables Overview

The application uses environment variables in two places:
1. **Vercel (Frontend)**: Client-side accessible variables with `NEXT_PUBLIC_` prefix
2. **AWS Lambda**: Server-side variables for backend functions

## Frontend Environment Variables (Vercel)

### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://wka1crhece.execute-api.us-east-1.amazonaws.com` | REST API endpoint |
| `NEXT_PUBLIC_WEBSOCKET_URL` | `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default` | WebSocket endpoint |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `6pbdutoj0p9bhrp2hia7qcflj6` | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `us-east-1_tQ9N9Y8LF` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_REGION` | `us-east-1` | AWS Region |

### Setting Variables in Vercel

1. Go to Vercel Dashboard
2. Select project: `sanketmessenger`
3. Navigate to: Settings > Environment Variables
4. Add each variable with appropriate values
5. Select All Environments (Production, Preview, Development)
6. Save changes (triggers redeployment)

## Backend Environment Variables (Lambda)

### Lambda Function Variables

These are set in Terraform or directly in Lambda configuration:

| Function | Variables |
|----------|-----------|
| All Lambdas | `AWS_REGION`, `DYNAMODB_TABLE_CONNECTIONS`, `DYNAMODB_TABLE_MESSAGES` |
| authorizer | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` |
| users_handler | `COGNITO_CLIENT_ID`, `COGNITO_USER_POOL_ID` |

### Setting in Terraform

```hcl
resource "aws_lambda_function" "message_handler" {
  # ... other config ...
  
  environment {
    variables = {
      DYNAMODB_TABLE_MESSAGES = "family-messenger-messages"
      DYNAMODB_TABLE_CONNECTIONS = "family-messenger-connections"
    }
  }
}
```

## Local Development

### Frontend (.env.local)

Create `frontend/.env.local` for local development:

```bash
NEXT_PUBLIC_API_URL=https://wka1crhece.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default
NEXT_PUBLIC_COGNITO_CLIENT_ID=6pbdutoj0p9bhrp2hia7qcflj6
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_tQ9N9Y8LF
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

### Backend (.env for testing)

If testing Lambda locally:

```bash
AWS_REGION=us-east-1
DYNAMODB_TABLE_MESSAGES=family-messenger-messages
DYNAMODB_TABLE_CONNECTIONS=family-messenger-connections
COGNITO_USER_POOL_ID=us-east-1_tQ9N9Y8LF
COGNITO_CLIENT_ID=6pbdutoj0p9bhrp2hia7qcflj6
```

## Variable Validation

Frontend code should validate on load:

```typescript
// In a startup check
const required = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_WEBSOCKET_URL',
  'NEXT_PUBLIC_COGNITO_CLIENT_ID',
  'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
  'NEXT_PUBLIC_COGNITO_REGION'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

## Security Notes

- Never commit `.env` files to Git
- `NEXT_PUBLIC_` variables are exposed to browser (safe for non-secrets)
- Cognito client ID is not a secret (it's public)
- Sensitive values (if any) go in Lambda environment or AWS Secrets Manager