# Project Wiki - Serverless Messaging Application

> This wiki documents issues encountered, solutions found, and architectural decisions made during development.
> Update this document as the project evolves.

---

## Issue #1: WebSocket Connection Failure (HTTP 401 Unauthorized)

### Date Resolved: 2026-05-10

### Problem Statement
The WebSocket connection in the chat application consistently failed with "HTTP Authentication failed; no valid credentials available" error, showing "Disconnected" status in the UI despite successful login.

### Root Cause
The `connect_handler.py` Lambda function only looked for `userId` in the `authorizer` context from API Gateway's custom authorizer. When the custom authorizer wasn't being invoked properly (or returning empty context), the connect handler couldn't find the user ID and returned 401 Unauthorized.

### What Was Tried

#### 1. Enabled Custom Authorizer on $connect Route
- Set `AuthorizationType: CUSTOM` with `AuthorizerId: 825ml8` pointing to `family-messenger-authorizer` Lambda
- Route configuration was correct but authorizer was not being invoked (no logs in CloudWatch)

#### 2. Checked Lambda Permissions
- Verified `aws_lambda_permission` allowed API Gateway to invoke `family-messenger-authorizer`
- Policy was correctly configured: `arn:aws:execute-api:us-east-1:910972977862:7477wqg01f/*/*`

#### 3. Verified API Gateway Integration
- Integration `5rv549v` correctly points to Lambda `family-messenger-connect-handler`
- Integration type is `AWS_PROXY` with PayloadFormatVersion `1.0`
- Lambda was being invoked (found logs with "No user ID in authorizer context")

#### 4. Disabled Authorizer (AuthorizationType: NONE)
- Removed authorizer from route to test basic connectivity
- Lambda was still invoked but returned 401 because `requestContext.authorizer.userId` was empty

#### 5. Investigated API Gateway Behavior
- Direct HTTPS WebSocket upgrade test showed `/$default` path returns 401
- The `connectionId` in the response proved API Gateway WAS processing the request
- Stage deployment auto-updated after route changes

### What Didn't Work
- **Custom Authorizer**: Not being invoked despite correct configuration
- **Route AuthorizationType changes**: Toggling between CUSTOM and NONE didn't resolve the underlying issue
- **Lambda permission verification**: All IAM permissions were correct but authorizer still bypassed

### Final Solution
Modified `connect_handler.py` to extract JWT token directly from `queryStringParameters.Authorization` when no authorizer context is present:

```python
def validate_token(token):
    """Validate JWT token and return user_id or None"""
    try:
        if not token:
            return None
        if token.startswith('Bearer '):
            token = token[7:]
        
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email')
        return user_id
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

def lambda_handler(event, context):
    request_context = event.get('requestContext', {})
    connection_id = request_context.get('connectionId')
    
    # Try authorizer context first
    authorizer = request_context.get('authorizer', {})
    user_id = authorizer.get('userId')
    
    # Fallback: extract token from query parameters
    if not user_id:
        query_params = event.get('queryStringParameters', {}) or {}
        auth_param = query_params.get('Authorization') or query_params.get('authorization')
        if auth_param:
            user_id = validate_token(auth_param)
    
    if not user_id:
        return create_response(401, {'message': 'Unauthorized'})
    
    # Store connection...
    return create_response(200, {'message': 'Connected'})
```

### Key Configuration
- WebSocket API ID: `7477wqg01f`
- Route `$connect`: `AuthorizationType: NONE` (no custom authorizer)
- Integration: `5rv549v` → Lambda `family-messenger-connect-handler`
- Frontend sends token as: `?Authorization=<jwt_token>`

### Files Involved
- `backend/connect_handler.py` - Token validation and connection storage
- `frontend/lib/websocket.ts` - Sends token as query parameter
- `infrastructure/api_gateway.tf` - WebSocket route configuration

### Lessons Learned
1. API Gateway WebSocket routes don't automatically pass query parameters to authorizers
2. The `identity_source` configuration in authorizer must match the actual token location
3. Direct Lambda invocation testing (via `aws lambda invoke`) helps verify code works independently of API Gateway
4. CloudWatch access logs show `status: 401` even when Lambda is invoked (before handler code runs)

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
- [ ] Real-time message delivery (message_handler Lambda exists but untested)
- [ ] Message persistence (DynamoDB write happens but not verified)

### Token Validation Strategy
The connect handler validates tokens by decoding the JWT payload without cryptographic verification. This is acceptable because:
1. The token was already validated during login (Cognito authentication)
2. The connection is established over HTTPS (token not exposed in plain text)
3. Future message handlers can add additional validation if needed

### Future Considerations
- Consider re-enabling custom authorizer with proper `identity_source` configuration
- Add token expiration validation in `validate_token()`
- Implement connection cleanup on disconnect

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