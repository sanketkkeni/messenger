# User Authentication

This document describes the complete user authentication flow, from signup to login and token management.

## Overview

The application uses Amazon Cognito User Pools for authentication. Users sign up with an email address, verify via email code, and then can log in with their credentials.

## Key Resources
- **User Pool ID**: `us-east-1_tQ9N9Y8LF`
- **App Client ID**: `6pbdutoj0p9bhrp2hia7qcflj6`
- **Region**: `us-east-1`

## Signup Flow

### Step 1: User Initiates Signup
User submits email and password through the signup form at `/signup`.

### Step 2: Frontend Calls Cognito
```typescript
// frontend/lib/auth.ts - signUp function
const command = new SignUpCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  Username: email,
  Password: password,
  UserAttributes: [{ Name: 'email', Value: email }]
});
await cognitoClient.send(command);
```

### Step 3: Cognito Creates User
- User record created in Cognito User Pool (`us-east-1_tQ9N9Y8LF`)
- Initial status: `UNCONFIRMED`
- Verification code sent to email address

### Step 4: Email Verification
User receives 6-digit code via email and submits it through `/confirm` page.

### Step 5: Frontend Confirms Signup
```typescript
// frontend/lib/auth.ts - confirmSignUp function
const command = new ConfirmSignUpCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  Username: email,
  ConfirmationCode: code
});
await cognitoClient.send(command);
```

### Step 6: User Status Updated
- User status changes from `UNCONFIRMED` to `CONFIRMED`
- User can now log in

### Signup State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIGNUP FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

User                     Frontend                    Cognito                    Email
  │                          │                          │                         │
  │  1. Submit email +        │                          │                         │
  │     password              │                          │                         │
  │ ──────────────────────────►                          │                         │
  │                          │  2. SignUp API call       │                         │
  │                          │ ──────────────────────────► │                         │
  │                          │                          │  3. Create user         │
  │                          │                          │ ─► UNCONFIRMED           │
  │                          │                          │                         │ 4. Send verification
  │                          │                          │                         │    code
  │                          │ ◄────────────────────────────────────────────── │
  │  5. "Check your email"   │                          │                         │
  │ ◄─────────────────────────                          │                         │
  │                          │                          │                         │
  │  6. Enter verification   │                          │                         │
  │     code                 │                          │                         │
  │ ──────────────────────────►                          │                         │
  │                          │  7. ConfirmSignUp API      │                         │
  │                          │ ──────────────────────────► │                         │
  │                          │                          │  8. Update status       │
  │                          │                          │ ─► CONFIRMED            │
  │                          │ ◄────────────────────────────────────────────── │
  │  9. Redirect to login    │                          │                         │
  │ ◄─────────────────────────                          │                         │
```

## Login Flow

### Step 1: User Submits Credentials
User enters email and password at `/login`.

### Step 2: Frontend Calls Cognito
```typescript
// frontend/lib/auth.ts - signIn function
const command = new InitiateAuthCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  AuthFlow: 'USER_PASSWORD_AUTH',
  AuthParameters: {
    USERNAME: email,
    PASSWORD: password
  }
});
const response = await cognitoClient.send(command);
```

### Step 3: Cognito Validates Credentials
- Cognito verifies email and password against `us-east-1_tQ9N9Y8LF`
- Checks user status is `CONFIRMED`
- If valid, issues JWT tokens

### Step 4: Tokens Returned
Cognito returns three tokens:
| Token | Type | Purpose | Expiry |
|-------|------|---------|--------|
| idToken | JWT | WebSocket authentication | 1 hour |
| accessToken | JWT | REST API authorization | 1 hour |
| refreshToken | Opaque | Session restoration | 30 days |

### Step 5: Frontend Stores Tokens
```typescript
// frontend/lib/auth.ts - storeTokens function
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('idToken', idToken);
localStorage.setItem('refreshToken', refreshToken);
```

### Step 6: User Profile Fetched
```typescript
// frontend/lib/auth.ts - getUser function
const command = new GetUserCommand({ AccessToken: accessToken });
const response = await cognitoClient.send(command);
// Returns: { username, email, email_verified }
```

### Login State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LOGIN FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

User                     Frontend                    Cognito                    DynamoDB
  │                          │                          │                         │
  │  1. Submit email +        │                          │                         │
  │     password              │                          │                         │
  │ ──────────────────────────►                          │                         │
  │                          │  2. InitiateAuth          │                         │
  │                          │     (USER_PASSWORD_AUTH)   │                         │
  │                          │ ──────────────────────────► │                         │
  │                          │                          │  3. Validate credentials   │
  │                          │                          │ ─► Check user status      │
  │                          │  4. Return tokens          │                         │
  │                          │ ◄───────────────────────── │                         │
  │                          │     - idToken              │                         │
  │                          │     - accessToken         │                         │
  │                          │     - refreshToken         │                         │
  │                          │                          │                         │
  │                          │  5. Store in localStorage │                         │
  │                          │ ──────────────────────────►│ (localStorage)          │
  │                          │                          │                         │
  │                          │  6. GetUser API call      │                         │
  │                          │ ──────────────────────────► │                         │
  │                          │ ◄───────────────────────── │                         │
  │                          │     { username, email }    │                         │
  │                          │                          │                         │
  │                          │  7. WebSocket connect    │                         │
  │                          │     with idToken          │                         │
  │                          │ ──────────────────────────► │                         │
  │                          │                          │  8. Store connection     │
  │                          │                          │ ─► (if $connect)         │
  │  9. Redirect to /chat    │                          │                         │
  │ ◄─────────────────────────                          │                         │
```

## Authenticated API Calls

### REST API Calls (using accessToken)
```typescript
// frontend/lib/websocket.ts - fetchUsers function
const response = await fetch(`${REST_API_ENDPOINT}/users`, {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});
```

### WebSocket Connection (using idToken)
```typescript
// frontend/lib/websocket.ts - connect function
const wsUrl = `${WEBSOCKET_ENDPOINT}?Authorization=${encodeURIComponent(idToken)}`;
socket = new WebSocket(wsUrl);
```

## Token Validation

### idToken Validation (WebSocket)
The `family-messenger-authorizer` Lambda validates the idToken:
1. Decodes JWT payload (base64url)
2. Extracts `cognito:username` or `sub` as userId
3. Returns IAM policy allowing connection

### accessToken Validation (REST API)
REST API handlers validate accessToken:
1. Extract token from `Authorization: Bearer <token>` header
2. Decode JWT payload
3. Verify user exists in Cognito

## Cognito Auth Flows

### USER_PASSWORD_AUTH (Login)
```
Client ──► Cognito ──► User Pool
              │
              ▼
         Validate username/password
              │
              ▼
         Return: idToken, accessToken, refreshToken
```

### REFRESH_TOKEN_AUTH (Session Restoration)
```
Client ──► Cognito ──► User Pool
              │
              ▼
         Validate refreshToken
              │
              ▼
         Return: idToken, accessToken (new)
```

### SIGN_UP (Registration)
```
Client ──► Cognito ──► User Pool
              │
              ▼
         Create unconfirmed user
              │
              ▼
         Send verification code via email
```

### CONFIRM_SIGN_UP (Email Verification)
```
Client ──► Cognito ──► User Pool
              │
              ▼
         Verify code
              │
              ▼
         Update user status to CONFIRMED
```

## Frontend Authentication State

### AuthContext
The `AuthContext` React context manages authentication state:

```typescript
// frontend/context/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}
```

### Auth State Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTH STATE MANAGEMENT                                 │
└─────────────────────────────────────────────────────────────────────────────┘

App Load                    AuthContext                    localStorage
   │                              │                              │
   │  1. Check localStorage        │                              │
   │ ─────────────────────────────►                              │
   │                              │  2. getStoredTokens()          │
   │                              │ ──────────────────────────────► │
   │                              │ ◄────────────────────────────── │
   │                              │     { accessToken, idToken,     │
   │                              │       refreshToken }             │
   │                              │                              │
   │                              │  3. getUser(accessToken)        │
   │                              │ ──────────────────────────────► │ (Cognito)
   │                              │                              │
   │  4a. If valid:               │                              │
   │      - Set user state        │                              │
   │      - Connect WebSocket     │                              │
   │ ◄────────────────────────────│                              │
   │                              │                              │
   │  4b. If invalid:              │                              │
   │      - Try refreshTokens()    │                              │
   │      - If fails: clearTokens │                              │
   │ ◄────────────────────────────│                              │
```

## Sign Out Flow

### Step 1: User Clicks Sign Out
```typescript
// frontend/context/AuthContext.tsx - handleSignOut
signOut() {
  clearTokens();       // Clear localStorage
  setUser(null);       // Reset user state
  router.push('/login'); // Redirect
}
```

### Step 2: Optional Server-Side Invalidation
```typescript
// frontend/lib/auth.ts - signOut function (optional)
const command = new GlobalSignOutCommand({ AccessToken: accessToken });
await cognitoClient.send(command);
```

### Sign Out State Diagram
```
User                     Frontend                    Cognito
  │                          │                          │
  │  1. Click "Sign Out"     │                          │
  │ ──────────────────────────►                          │
  │                          │  2. GlobalSignOut API      │
  │                          │     (optional)             │
  │                          │ ──────────────────────────► │
  │                          │                          │  3. Invalidate tokens
  │                          │ ◄───────────────────────── │                         │
  │                          │                          │                         │
  │                          │  4. clearTokens()         │
  │                          │ ──────────────────────────► │ (localStorage)
  │                          │                          │                         │
  │                          │  5. setUser(null)         │
  │                          │ ──────────────────────────► │ (React state)
  │                          │                          │                         │
  │  6. Redirect to /login   │                          │                         │
  │ ◄─────────────────────────                          │                         │
```

## Next Steps

- [Session Persistence](04_session_persistence.md) - Token refresh, localStorage management
- [WebSocket Connection](05_websocket_connection.md) - Connection establishment
