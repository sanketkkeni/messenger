# 18 - Troubleshooting Guide

## Common Issues and Solutions

### 1. WebSocket Connection Fails

**Symptoms**: Console shows "Disconnected", messages not appearing in real-time

**Diagnosis**:
1. Check browser console for error messages
2. Verify WebSocket URL is correct
3. Check Lambda CloudWatch logs for connect handler errors

**Solutions**:
- Verify JWT token is valid and not expired
- Clear browser storage and re-login
- Check API Gateway WebSocket stage configuration

**Log Commands**:
```bash
# Check connect handler logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-connect-handler \
  --start-time $(date -d '1 hour ago' +%s)000
```

### 2. Authentication Errors

**Symptoms**: 401 Unauthorized, redirect to login page unexpectedly

**Diagnosis**:
1. Check if token expired (access tokens valid 1 hour)
2. Verify refresh token mechanism is working
3. Check browser cookies are not blocked

**Solutions**:
- Clear browser cookies and cache, then login again
- Check system clock is correct (token validation fails with time skew)
- Verify Cognito configuration hasn't changed

### 3. Messages Not Appearing

**Symptoms**: Sent messages don't appear for recipient

**Diagnosis**:
1. Check WebSocket is connected for both users
2. Verify message handler is invoked
3. Check DynamoDB for message records

**Solutions**:
- Both users refresh the page
- Check sender's CloudWatch logs for errors
- Verify DynamoDB has the message record

**Log Commands**:
```bash
# Check message handler
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-message-handler \
  --filter-pattern "ERROR"
```

### 4. Chat History Not Loading

**Symptoms**: Past messages don't appear when opening conversation

**Diagnosis**:
1. Check history_handler Lambda logs
2. Verify REST API is accessible
3. Check DynamoDB query results

**Solutions**:
- Verify user is authenticated
- Check API Gateway REST API stages
- Review DynamoDB table records

### 5. CORS Errors

**Symptoms**: Network errors in browser console about CORS

**Diagnosis**:
1. Check API Gateway CORS configuration
2. Verify origin matches Vercel URL
3. Check preflight (OPTIONS) requests

**Solutions**:
- Ensure API Gateway has CORS configured with correct origin
- Check `Access-Control-Allow-Origin` header in response
- Verify `Access-Control-Allow-Credentials` is set if using cookies

### 6. Terraform Apply Fails

**Symptoms**: Terraform plan/apply errors

**Common Issues**:
- Missing provider configuration
- Duplicate resource definitions
- Invalid attribute values

**Solutions**:
- Run `terraform init` to ensure providers are installed
- Review plan output for specific error messages
- Check for duplicate outputs in .tf files
- Verify attribute names match AWS provider documentation

### 7. Lambda Function Errors

**Symptoms**: Function invocation fails or returns errors

**Diagnosis**:
1. Check CloudWatch logs for the specific Lambda
2. Verify environment variables are set
3. Check IAM permissions

**Solutions**:
- Redeploy Lambda with updated code
- Verify environment variables in Lambda config
- Check IAM role has required permissions

**Log Commands**:
```bash
# Recent errors from all Lambda functions
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-message-handler \
  --filter-pattern "ERROR" \
  --start-time $(date -d '24 hours ago' +%s)000
```

## Debugging Tips

1. **Enable CloudWatch Contributor Insights** for API Gateway
   - Identify top callers and latency issues

2. **X-Ray Tracing** for Lambda
   - Add tracing configuration to capture detailed performance data

3. **Test Locally**
   - Use SAM CLI to invoke Lambda functions locally
   - Test API Gateway endpoints with Postman/curl

4. **Browser DevTools**
   - Network tab: Check request/response headers
   - Application tab: Check cookies and localStorage
   - Console: View real-time error messages

## Getting Help

1. Check CloudWatch logs first
2. Review WIKI.md for known issues
3. Check AWS Service Health Dashboard
4. Open GitHub issue with:
   - Timestamp of issue
   - CloudWatch log excerpt
   - Steps to reproduce
   - Expected vs actual behavior