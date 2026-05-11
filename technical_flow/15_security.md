# 15 - Security Best Practices

## Authentication Security

### Cognito User Pool
- Password policy: minimum 8 characters, requires uppercase, lowercase, and numbers
- MFA: Consider enabling TOTP for additional security
- Email verification required for password reset

### JWT Token Security
- Tokens expire after 1 hour
- Refresh tokens stored in secure HttpOnly cookies
- Tokens contain `cognito:username` and `sub` for user identification

### WebSocket Authorization
- Lambda authorizer validates JWT on connection
- Connection-based auth for send/disconnect (DynamoDB lookup)
- Token passed via query string (browser WebSocket limitation)

## Authorization Model

### Message Authorization
- Users can only send messages to their own connections
- Connect handler validates user identity from JWT
- Message handler verifies connection ownership via DynamoDB

### Data Isolation
- DynamoDB table design: PK=conversationId, SK=timestamp
- No user-to-user direct data access (all via WebSocket connections)

## Infrastructure Security

### IAM Roles
- Lambda execution roles follow least privilege principle
- Separate permissions for read/write operations
- No wildcards in resource ARNs

### API Gateway
- No public endpoints (all authenticated)
- WebSocket uses custom authorizer
- REST API uses Cognito authorizer

### Security Headers

CORS configuration in API Gateway:
```
Access-Control-Allow-Origin: https://sanketmessenger.vercel.app
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

## Vulnerabilities Addressed

1. **Session Hijacking**: HttpOnly, Secure cookies
2. **Token Theft**: Short-lived access tokens (1 hour)
3. **Unauthorized Access**: Lambda authorizer validates every connection
4. **Data Injection**: Parameterized DynamoDB queries
5. **CORS Attacks**: Explicit origin whitelisting

## Security Improvements (Future)

1. Enable MFA for Cognito users
2. Add rate limiting on API endpoints
3. Implement WebSocket message signing
4. Add request signing for DynamoDB operations
5. Enable CloudTrail for audit logging
6. Regular security audits with AWS Config