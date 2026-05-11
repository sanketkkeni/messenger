# Cognito Configuration

This document describes the Amazon Cognito User Pool configuration for authentication.

## Overview

Amazon Cognito provides user authentication and authorization. It handles user sign-up, sign-in, email verification, and JWT token issuance.

## Cognito Resources

| Resource | Name/ID |
|----------|---------|
| User Pool | `us-east-1_tQ9N9Y8LF` |
| User Pool Name | `family-messenger-users` |
| App Client | `6pbdutoj0p9bhrp2hia7qcflj6` |
| Region | us-east-1 |

---

## User Pool Configuration

### Basic Settings

| Setting | Value |
|---------|-------|
| Pool Name | `family-messenger-users` |
| Pool ID | `us-east-1_tQ9N9Y8LF` |
| Region | us-east-1 |

### Username Attributes

| Setting | Value |
|---------|-------|
| Username | Email address |
| Required Attributes | email |

### Verification

| Setting | Value |
|---------|-------|
| Email | Required for sign-up |
| Verification Method | Code sent via email |

---

## Password Policy

| Setting | Value |
|---------|-------|
| Minimum Length | 8 characters |
| Uppercase Required | Yes |
| Lowercase Required | Yes |
| Numbers Required | Yes |
| Symbols Required | No |

---

## App Client Configuration

### Client Settings

| Setting | Value |
|---------|-------|
| Client ID | `6pbdutoj0p9bhrp2nia7qcflj6` |
| Client Name | `family-messenger-client` |
| Refresh Token Expiry | 30 days |

### Auth Flows

| Auth Flow | Enabled | Description |
|-----------|---------|-------------|
| USER_PASSWORD_AUTH | ✓ | Email + password login |
| REFRESH_TOKEN_AUTH | ✓ | Token refresh |

### OAuth 2.0
Not configured (using SDK direct calls)

---

## User Sign-Up Flow

### Step 1: User Submits Registration
```typescript
const signUpResult = await cognitoClient.send(new SignUpCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  Username: 'user@example.com',
  Password: 'Password123',
  UserAttributes: [{ Name: 'email', Value: 'user@example.com' }]
}));
```

### Step 2: Cognito Creates User
- User status: `UNCONFIRMED`
- Verification code sent to email

### Step 3: User Confirms Email
```typescript
await cognitoClient.send(new ConfirmSignUpCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  Username: 'user@example.com',
  ConfirmationCode: '123456'
}));
```

### Step 4: User Status Updated
- User status: `CONFIRMED`

---

## User Login Flow

### Step 1: User Submits Credentials
```typescript
const authResult = await cognitoClient.send(new InitiateAuthCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  AuthFlow: 'USER_PASSWORD_AUTH',
  AuthParameters: {
    USERNAME: 'user@example.com',
    PASSWORD: 'Password123'
  }
}));
```

### Step 2: Cognito Validates Credentials
- Verifies password
- Checks user status is `CONFIRMED`

### Step 3: Tokens Returned
```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJ...",
    "IdToken": "eyJ...",
    "RefreshToken": "...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  }
}
```

---

## Token Configuration

### Token Types

| Token | Purpose | Expiry |
|-------|---------|--------|
| idToken | WebSocket authentication | 1 hour |
| accessToken | REST API authorization | 1 hour |
| refreshToken | Session restoration | 30 days |

### JWT Claims

#### idToken Claims
```json
{
  "sub": "user-uuid",
  "cognito:username": "user-uuid",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_tQ9N9Y8LF",
  "aud": "6pbdutoj0p9bhrp2hia7qcflj6",
  "exp": 1778520000,
  "iat": 1778516400
}
```

#### accessToken Claims
```json
{
  "sub": "user-uuid",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_tQ9N9Y8LF",
  "client_id": "6pbdutoj0p9bhrp2hia7qcflj6",
  "username": "user-uuid",
  "scope": "aws.cognito.signin.user.admin",
  "exp": 1778520000,
  "iat": 1778516400
}
```

---

## Token Refresh Flow

### Step 1: Frontend Detects Expired Token
```typescript
try {
  const userData = await getUser(accessToken);
  setUser(userData);
} catch {
  // Token expired, try refresh
  const newTokens = await refreshTokens(refreshToken);
  storeTokens(newTokens);
}
```

### Step 2: Request New Tokens
```typescript
const authResult = await cognitoClient.send(new InitiateAuthCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  AuthFlow: 'REFRESH_TOKEN_AUTH',
  AuthParameters: {
    REFRESH_TOKEN: refreshToken
  }
}));
```

### Step 3: New Tokens Returned
```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJ...",
    "IdToken": "eyJ...",
    "ExpiresIn": 3600
  }
}
```

---

## User Attributes

### Standard Attributes

| Attribute | Type | Required | Verified |
|-----------|------|---------|---------|
| email | String | Yes | Yes (via verification) |
| email_verified | Boolean | No | - |
| sub | String (UUID) | - | - |

---

## User Status

| Status | Description | Can Login |
|--------|-------------|-----------|
| UNCONFIRMED | Email not verified | No |
| CONFIRMED | Email verified | Yes |
| RESET_REQUIRED | Password reset required | No |
| FORCE_CHANGE_PASSWORD | Must change password | No |

---

## CloudWatch Integration

### Log Group
`/aws/cognito/family-messenger-users`

### Log Types
- Sign-up events
- Sign-in events
- Verification events
- Token refresh events
- Password changes

---

## Terraform Configuration

### User Pool
```hcl
resource "aws_cognito_user_pool" "family_messenger" {
  name = "family-messenger-users"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers = true
    require_symbols = false
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }
}
```

### User Pool Client
```hcl
resource "aws_cognito_user_pool_client" "family_messenger_client" {
  name            = "family-messenger-client"
  user_pool_id    = aws_cognito_user_pool.family_messenger.id
  explicit_auth_flows = [
    "USER_PASSWORD_AUTH",
    "REFRESH_TOKEN_AUTH"
  ]
}
```

---

## Security Considerations

### 1. Email Verification
All users must verify their email before logging in.

### 2. Password Policy
Strong password requirements (uppercase, lowercase, numbers).

### 3. Token Expiry
Tokens expire after 1 hour, requiring periodic refresh.

### 4. Refresh Token Rotation
Refresh tokens can be rotated for additional security.

### Future Enhancements
- MFA (Multi-Factor Authentication)
- Account takeover protection
- Adaptive authentication

---

## Managing Users

### Via AWS Console
1. Go to Cognito console
2. Select user pool `family-messenger-users`
3. Click "Users" to view/manage users

### Via AWS CLI
```bash
# List users
aws cognito-idp list-users --user-pool-id us-east-1_tQ9N9Y8LF

# Admin disable user
aws cognito-idp admin-disable-user \
  --user-pool-id us-east-1_tQ9N9Y8LF \
  --username user@example.com

# Admin delete user
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_tQ9N9Y8LF \
  --username user@example.com
```

---

## Next Steps

- [CloudWatch Logs](14_cloudwatch_logs.md) - Log groups and monitoring
- [Security Considerations](19_security_considerations.md) - Security best practices
