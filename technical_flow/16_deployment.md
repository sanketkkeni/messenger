# 16 - Deployment Guide

## Overview

The family messenger application consists of two deployment targets:
1. **Frontend**: Vercel (automated from GitHub)
2. **Backend**: AWS Lambda + API Gateway + DynamoDB + Cognito (via Terraform)

## Prerequisites

### Required Tools
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Git
- Node.js >= 18 (for local frontend development)

### Required Access
- AWS account with permissions for:
  - Lambda, API Gateway, DynamoDB, Cognito, IAM, CloudWatch
- Vercel account connected to GitHub repository

## Backend Deployment (Terraform)

### 1. Initialize Terraform
```bash
cd infrastructure
terraform init
```

### 2. Review Plan
```bash
terraform plan -no-color > plan_output.txt
# Review plan_output.txt before applying
```

### 3. Apply Infrastructure
```bash
terraform apply
```

### 4. Update Lambda Functions

After infrastructure is deployed, update Lambda code:
```bash
# Create Lambda zip files
cd backend
python -c "import zipfile, os; z = zipfile.ZipFile('connect_handler.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f)) for r,d,files in os.walk('.') for f in files if f.endswith('.py')]; z.close()"
# Repeat for other handlers...

# Deploy to AWS
aws lambda update-function-code --function-name family-messenger-connect-handler --zip-file fileb://backend/connect_handler.zip --no-cli-pager
# ... update other handlers
```

## Frontend Deployment (Vercel)

### Automatic Deployment
1. Push to GitHub `main` branch
2. Vercel automatically builds and deploys
3. Environment variables configured in Vercel dashboard

### Manual Deploy
```bash
cd frontend
vercel --prod
```

### Required Environment Variables (Vercel)
```
NEXT_PUBLIC_API_URL=https://wka1crhece.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default
NEXT_PUBLIC_COGNITO_CLIENT_ID=6pbdutoj0p9bhrp2hia7qcflj6
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_tQ9N9Y8LF
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

## Post-Deployment Verification

1. **Test Sign Up**: Create a new user at /signup
2. **Test Sign In**: Login at /signin
3. **Test WebSocket**: Open chat, verify connection
4. **Test Messaging**: Send messages between two users
5. **Test History**: Verify messages persist after refresh

## Rolling Back

### Backend
```bash
# List previous Lambda versions
aws lambda list-versions-by-function --function-name family-messenger-message-handler

# Roll back to previous version
aws lambda update-function-code \
  --function-name family-messenger-message-handler \
  --zip-file fileb://backend/message_handler.zip \
  --no-cli-pager
```

### Frontend
```bash
# From Vercel dashboard, select previous deployment
# Or use CLI:
vercel rollback [deployment-url]
```

## Deployment Checklist

- [ ] Infrastructure changes reviewed
- [ ] Lambda functions updated with latest code
- [ ] Environment variables set correctly
- [ ] GitHub pushed (triggers Vercel deploy)
- [ ] Smoke test completed
- [ ] CloudWatch logs reviewed for errors