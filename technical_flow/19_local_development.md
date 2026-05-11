# 19 - Local Development Setup

## Overview

This guide explains how to set up a local development environment for the family messenger application.

## Prerequisites

### Software Requirements
- Node.js >= 18
- Python >= 3.9 (for Lambda development)
- AWS CLI configured
- Git

### AWS Requirements
- AWS credentials with appropriate permissions
- DynamoDB tables accessible (or local DynamoDB)
- Cognito user pool accessible

## Frontend Development

### 1. Clone Repository
```bash
git clone https://github.com/sanketkkeni/messenger.git
cd messenger
```

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Configure Environment
```bash
# Create .env.local
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://wka1crhece.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default
NEXT_PUBLIC_COGNITO_CLIENT_ID=6pbdutoj0p9bhrp2hia7qcflj6
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_tQ9N9Y8LF
NEXT_PUBLIC_COGNITO_REGION=us-east-1
EOF
```

### 4. Run Development Server
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 5. Run Tests
```bash
# Unit tests
npm test

# E2E tests
npx playwright test
```

## Backend Development

### Local Lambda Development

### 1. Install SAM CLI
```bash
# Windows (with Chocolatey)
choco install aws-sam-cli

# Or use pip
pip install aws-sam-cli
```

### 2. Create Local Testing Template

Create `template.yaml` in backend folder:
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  MessageHandler:
    Type: AWS::Serverless::Function
    Properties:
      Handler: message_handler.lambda_handler
      Runtime: python3.13
      Events:
        Api:
          Type: Api
          Properties:
            Path: /messages
            Method: post
```

### 3. Test Lambda Locally
```bash
cd backend
sam local invoke MessageHandler -e test_event.json
```

### DynamoDB Local

For testing without AWS:
```bash
# Run DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create tables
aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name family-messenger-messages \
  --attribute-definitions \
    AttributeName=conversationId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=conversationId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name family-messenger-connections \
  --attribute-definitions \
    AttributeName=connectionId,AttributeType=S \
  --key-schema \
    AttributeName=connectionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Terraform Development

### 1. Initialize
```bash
cd infrastructure
terraform init
```

### 2. Format and Validate
```bash
terraform fmt
terraform validate
```

### 3. Plan
```bash
terraform plan -no-color > plan_output.txt
```

### 4. Apply (when ready)
```bash
terraform apply
```

## Code Quality

### Frontend
```bash
cd frontend
npm run lint
npm run typecheck
npm test
```

### Backend
```bash
cd backend
# Python linting (if configured)
flake8 .
# Or
ruff check .
```

## Hot Reload

### Frontend
- Next.js has built-in hot reload
- Changes to React components reload automatically

### Backend
- SAM CLI supports hot reload with `--warm-containers`
- Or use serverless-offline plugin alternative

## Working with Production Data

**Warning**: Use production data carefully

1. Never run local code against production without testing first
2. Use CloudWatch to monitor for issues
3. Consider creating a staging environment
4. Always have a rollback plan

## Debugging

### Frontend Debug
- Chrome DevTools Network tab
- React Developer Tools
- Console logging

### Backend Debug
```python
import logging
logging.info("Debug message")
```

### Lambda Debug
```bash
# Stream logs in real-time
aws logs tail /aws/lambda/family-messenger-message-handler --follow
```