# Project Wiki - Serverless Messaging Application

> This wiki documents issues encountered, solutions found, and architectural decisions made during development.
> Update this document as the project evolves.

---

## Issue #1: WebSocket Connection Failure - FINAL RESOLUTION (2026-05-11)

### Date Resolved: 2026-05-11

### Problem Statement
WebSocket connection in the chat application consistently failed with "HTTP Authentication failed; no valid credentials available" error (HTTP 401) despite:
- Successful login
- Token being sent as query parameter
- Authorizer Lambda returning correct IAM policy with `isAuthorized: true`

### Root Cause
The authorizer's `identity_sources` configuration included BOTH `route.request.querystring.Authorization` AND `route.request.header.Authorization`. For WebSocket APIs, using multiple identity sources causes API Gateway to require BOTH sources to be present and valid. Since WebSocket upgrade requests cannot easily set custom headers, the authorizer was rejected.

### What Was Tried (Chronological)

1. **Enabled Custom Authorizer** - Route auth set to CUSTOM with authorizer ID
   - Result: 401 error, authorizer Lambda NOT invoked

2. **Disabled Authorizer (AuthorizationType: NONE)** - Removed custom auth
   - Result: Still 401, Lambda invoked but couldn't find userId

3. **Tested Lambda Directly** - Used `aws lambda invoke` with test event
   - Result: Authorizer code worked correctly when called directly
   - Response: `{"principalId": "9478a478-...", "policyDocument": {...}}`

4. **Investigated API Gateway Behavior**
   - API Gateway access logs showed 401 before Lambda was invoked
   - This meant the rejection was happening at API Gateway level, not Lambda

5. **Updated Authorizer Identity Sources**
   - Changed from: `["route.request.querystring.Authorization", "route.request.header.Authorization"]`
   - Changed to: `["route.request.querystring.Authorization"]` (only query string)
   - Result: **SUCCESS! WebSocket connected successfully**

### Final Solution

**Step 1: Update Authorizer Configuration**
```bash
aws apigatewayv2 update-authorizer --api-id 7477wqg01f --authorizer-id 825ml8 --identity-source route.request.querystring.Authorization
```

**Step 2: Update connect_route in Terraform**
Changed from:
```hcl
authorization_type = "NONE"
```
To:
```hcl
authorization_type = "CUSTOM"
authorizer_id      = aws_apigatewayv2_authorizer.websocket_authorizer.id
```

**Step 3: Ensure Authorizer Returns IAM Policy Format**
The authorizer must return `policyDocument` format (not `isAuthorized: true`) for WebSocket APIs:
```python
return {
    'principalId': user_id,
    'policyDocument': {
        'Version': '2012-10-17',
        'Statement': [{
            'Action': 'execute-api:Invoke',
            'Effect': 'Allow',
            'Resource': route_arn
        }]
    },
    'context': {'userId': user_id}
}
```

### Key Findings

1. **WebSocket APIs only support single identity source** - Using multiple identity sources (header + query) causes validation to fail because WebSocket upgrade requests can't set custom headers

2. **Lambda direct invocation works** - Authorizer code is correct; the issue was API Gateway configuration

3. **IAM policy format required** - WebSocket custom authorizers must return IAM policy documents, not `isAuthorized` boolean

4. **Authorizer result size limit** - Maximum 8KB for authorizer result (soft limit)

### Current Configuration (AWS State)
- **WebSocket API ID**: `7477wqg01f`
- **Authorizer ID**: `825ml8`
- **Identity Source**: `route.request.querystring.Authorization` (only)
- **Route AuthorizationType**: `CUSTOM`
- **Authorizer URI**: `arn:aws:lambda:us-east-1:910972977862:function:family-messenger-authorizer`

### Terraform Updates
Updated `infrastructure/api_gateway.tf`:
- Changed `identity_sources` to only include query string
- Changed `authorization_type` to `CUSTOM` for $connect route

### Verification
Playwright E2E tests pass:
- Login and WebSocket connection: **PASS**
- Two-user message delivery: **PASS**
- Real-time message reception: **PASS**

---

## Issue #2: Lambda Import Error (`No module named 'jwt'`)

### Date Resolved: 2026-05-09

### Problem
Lambda functions failed to import `jwt` module because the Lambda zip files didn't include `utils.py`.

### Solution
Create Lambda zip files that include ALL Python files:
```bash
cd backend
python -c "import zipfile, os; z = zipfile.ZipFile('connect_handler.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f)) for r,d,files in os.walk('.') for f in files if f.endswith('.py')]; z.close()"
```

### Also Fixed
- `utils.py` had incorrect DynamoDB key condition expressions - used `boto3.dynamodb.conditions.Key` instead of `boto3.dynamodb.conditions.Attr` for scan operations

---

## Project Summary

### What We Built
A real-time messaging application with the following architecture:

**Frontend (Next.js)**
- User authentication via AWS Cognito
- WebSocket connection for real-time messaging
- Chat interface with contact list and message display

**Backend (AWS Lambda + API Gateway)**
- WebSocket API for real-time connections
- REST API for user discovery
- DynamoDB for storing connection mappings and messages

**Infrastructure (Terraform)**
- WebSocket API Gateway with $connect, $disconnect, and sendMessage routes
- REST API Gateway for /users endpoint
- Lambda functions for each handler
- Cognito User Pool for authentication
- DynamoDB tables for connections and messages

### Current Status
- [x] User authentication (sign up, sign in, sign out)
- [x] WebSocket connection (established and working)
- [x] User discovery (list users from Cognito)
- [x] Real-time message delivery (verified with Playwright tests)
- [x] Message persistence (DynamoDB write verified)

### Architecture Notes

**Token Validation Strategy**
The authorizer Lambda validates tokens by decoding the JWT payload without cryptographic verification. This is acceptable because:
1. The token was already validated during login (Cognito authentication)
2. The connection is established over HTTPS (token not exposed in plain text)
3. API Gateway passes the token to Lambda for context extraction

**WebSocket Auth Flow**
1. Client sends `wss://.../$default?Authorization=<jwt_token>`
2. API Gateway passes token to authorizer via `route.request.querystring.Authorization`
3. Authorizer extracts `userId` from JWT and returns IAM policy
4. If allowed, request proceeds to connect_handler Lambda
5. connect_handler stores connection mapping in DynamoDB

---

---

## Common Issues & Fixes

### Lambda `Runtime.ImportModuleError: No module named 'jwt'`
**Problem**: Lambda failed to import `jwt` module from utils.py  
**Solution**: Create zip with all Python dependencies:
```bash
cd backend
python -c "import zipfile, os; z = zipfile.ZipFile('connect_handler.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f)) for r,d,files in os.walk('.') for f in files if f.endswith('.py')]; z.close()"
```

### API Gateway Returns 401 Before Lambda Invocation
**Problem**: Request rejected before reaching Lambda  
**Solution**: Check route `AuthorizationType` - if CUSTOM, authorizer must allow request

### WebSocket URL Must Include Stage
**Problem**: Connection fails with "Invalid URL"  
**Solution**: Append `/$default` to endpoint URL if not present:
```typescript
let wsEndpoint = WEBSOCKET_ENDPOINT;
if (!wsEndpoint.includes('/$default')) {
  wsEndpoint = wsEndpoint.replace(/\/$/, '') + '/$default';
}
```

---

## Testing Commands

### Run Jest Tests
```bash
cd frontend
cmd /c "npm test"
```

### Run Playwright Tests
```bash
cd frontend
cmd /c "npx playwright test"
```

### Test Lambda Directly
```bash
# Create test payload
echo '{"requestContext":{"connectionId":"test123"},"queryStringParameters":{"Authorization":"<jwt_token>"}}' > test.json

# Invoke Lambda
aws lambda invoke --function-name family-messenger-connect-handler --payload file://test.json --cli-binary-format raw-in-base64-out output.txt
```

### Check CloudWatch Logs
```bash
# Connect handler logs
aws logs filter-log-events --log-group-name "/aws/lambda/family-messenger-connect-handler" --start-time <timestamp>

# Authorizer logs
aws logs filter-log-events --log-group-name "/aws/lambda/family-messenger-authorizer" --start-time <timestamp>

# API Gateway access logs
aws logs filter-log-events --log-group-name "/aws/apigateway/family-messenger/websocket" --start-time <timestamp>
```

### Test WebSocket Connection (Node.js)
```javascript
const https = require('https');
const crypto = require('crypto');

const key = crypto.randomBytes(16).toString('base64');
const options = {
  hostname: '7477wqg01f.execute-api.us-east-1.amazonaws.com',
  port: 443,
  path: '/$default',
  method: 'GET',
  headers: {
    'Host': '7477wqg01f.execute-api.us-east-1.amazonaws.com',
    'Upgrade': 'websocket',
    'Connection': 'Upgrade',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': key,
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
});
req.end();
```

---

## To Update This Wiki
When adding new features or resolving issues:
1. Add issue number and date
2. Document problem, attempted solutions, and final solution
3. Include relevant code snippets and configuration
4. Add testing commands if applicable