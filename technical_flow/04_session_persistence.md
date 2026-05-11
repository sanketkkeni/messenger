# Session Persistence

This document describes how the application maintains user sessions across page refreshes and token expiration.

## Overview

Session persistence is achieved through:
1. Storage of JWT tokens in browser localStorage
2. Automatic token refresh when tokens expire
3. Session restoration on page load

## Key Resources
- **localStorage Keys**: `accessToken`, `idToken`, `refreshToken`, `userId`
- **Token Expiry**: idToken/accessToken expire after 1 hour
- **Refresh Token Expiry**: 30 days

## Token Storage

### localStorage Keys
| Key | Content | Purpose |
|-----|---------|---------|
| `accessToken` | JWT | REST API authorization |
| `idToken` | JWT | WebSocket authentication |
| `refreshToken` | Opaque string | Token refresh |
| `userId` | String | Cognito username (sub) |

### Storage Functions
```typescript
// frontend/lib/auth.ts
storeTokens(accessToken, idToken, refreshToken) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('idToken', idToken);
  localStorage.setItem('refreshToken', refreshToken);
}

clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('idToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userId');
}
```

## Session Restoration Flow

### On App Load (Page Refresh)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SESSION RESTORATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

Page Load              AuthContext                localStorage           Cognito
    │                        │                        │                    │
    │  1. Initialize         │                        │                    │
    │ ───────────────────────►                        │                    │
    │                        │                        │                    │
    │                        │  2. getStoredTokens() │                    │
    │                        │ ───────────────────────►                    │
    │                        │ ◄────────────────────── │                    │
    │                        │     (all three tokens)   │                    │
    │                        │                        │                    │
    │                        │  3. getUser(accessToken)                   │
    │                        │ ────────────────────────► │                    │
    │                        │                        │                    │
    │                        │     ┌─────────────────────────────────┐     │
    │                        │     │ SUCCESS PATH                    │     │
    │                        │     │ - Set user state               │     │
    │                        │     │ - Store userId in localStorage │     │
    │                        │     │ - Connect WebSocket            │     │
    │                        │     │ - Set loading=false            │     │
    │                        │     └─────────────────────────────────┘     │
    │                        │                        │                    │
    │  4a. User logged in    │                        │                    │
    │ ◄──────────────────────│                        │                    │
    │                        │                        │                    │
    │                        │     ┌─────────────────────────────────┐     │
    │                        │     │ FAILURE PATH                    │     │
    │                        │     │ (token expired)                 │     │
    │                        │     │ - Try refreshTokens(refresh)    │     │
    │                        │     │ - Store new tokens              │     │
    │                        │     │ - Retry getUser                  │     │
    │                        │     │ - If fails: clearTokens()       │     │
    │                        │     └─────────────────────────────────┘     │
    │                        │                        │                    │
    │  4b. Redirect to login  │                        │                    │
    │ ◄──────────────────────│                        │                    │
```

### Token Refresh on Failure

When `getUser()` fails (token expired), the application attempts to refresh tokens:

```typescript
// frontend/context/AuthContext.tsx - checkAuth function
try {
  const userData = await getUser(tokens.accessToken);
  setUser(userData);
  connect(tokens.idToken);
} catch {
  // Token likely expired - try refresh
  try {
    const newTokens = await refreshTokens(tokens.refreshToken);
    storeTokens(newTokens.accessToken, newTokens.idToken, newTokens.refreshToken);
    const userData = await getUser(newTokens.accessToken);
    setUser(userData);
    connect(newTokens.idToken);
  } catch {
    // Refresh failed - clear tokens
    clearTokens();
  }
}
```

## Token Refresh Process

### Step 1: Frontend Calls Cognito
```typescript
// frontend/lib/auth.ts - refreshTokens function
const command = new InitiateAuthCommand({
  ClientId: '6pbdutoj0p9bhrp2hia7qcflj6',
  AuthFlow: 'REFRESH_TOKEN_AUTH',
  AuthParameters: {
    REFRESH_TOKEN: refreshToken
  }
});
const response = await cognitoClient.send(command);
```

### Step 2: Cognito Validates Refresh Token
- Verifies refresh token is valid and not expired
- Checks user still exists and is enabled

### Step 3: New Tokens Issued
Cognito returns new tokens with same claims:
| Token | New Expiry |
|-------|------------|
| idToken | +1 hour from now |
| accessToken | +1 hour from now |
| refreshToken | Same (or new if rotated) |

### Step 4: Frontend Updates Storage
```typescript
storeTokens(newTokens.accessToken, newTokens.idToken, newTokens.refreshToken);
```

## Token Refresh State Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOKEN REFRESH FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

AuthContext                 Cognito                      localStorage
     │                        │                            │
     │  1. getUser(accessToken) failed                    │
     │     (token expired)      │                            │
     │ ◄─────────────────────── │                            │
     │                        │                            │
     │  2. InitiateAuth        │                            │
     │     (REFRESH_TOKEN_AUTH)│                            │
     │ ────────────────────────► │                            │
     │                        │  3. Validate refresh token  │
     │                        │ ─► Check expiry            │
     │                        │ ─► Check user status        │
     │  4. Return new tokens   │                            │
     │ ◄─────────────────────── │                            │
     │     - idToken (new)     │                            │
     │     - accessToken (new) │                            │
     │     - refreshToken      │                            │
     │                        │                            │
     │  5. storeTokens()       │                            │
     │ ────────────────────────► │                            │
     │                        │                            │
     │  6. getUser(newAccessToken)                        │
     │ ────────────────────────► │                            │
     │  7. Success!              │                            │
     │ ◄─────────────────────── │                            │
     │     { username, email }   │                            │
```

## WebSocket Reconnection

On session restoration, the WebSocket connection is automatically re-established:

```typescript
// frontend/context/AuthContext.tsx
connect(tokens.idToken).catch(console.error);
```

This ensures real-time messaging continues after page refresh.

## Session Expiration Scenarios

### Scenario 1: Short Session (1 hour since login)
```
User logs in → App open for 1 hour → Page refresh → Still logged in
```
- Tokens valid → getUser() succeeds → No refresh needed

### Scenario 2: Medium Session (2-3 hours)
```
User logs in → Leave for 2 hours → Return → Auto-refreshes tokens
```
- Tokens expired → refreshTokens() succeeds → New session

### Scenario 3: Long Session (>30 days)
```
User logs in → Don't use app for 30 days → Return → Must re-login
```
- Refresh token expired → clearTokens() → Redirect to login

## Security Considerations

### Token Storage
- Tokens stored in localStorage (accessible by JavaScript)
- In production, consider using httpOnly cookies for better security
- HTTPS required for token transmission

### Token Transmission
- All API calls use HTTPS
- WebSocket uses WSS (secure WebSocket)
- Authorization header: `Bearer <accessToken>`

### Token Invalidation
- Sign out invalidates tokens server-side via GlobalSignOut
- Password change invalidates all sessions
- Admin can force sign out via Cognito console

## WebSocket Context Session Handling

The WebSocketContext handles connection state during session restoration:

```typescript
// frontend/context/WebSocketContext.tsx
useEffect(() => {
  const tokens = getStoredTokens();
  if (tokens?.idToken) {
    connect(tokens.idToken);  // Reconnect with stored idToken
  }
}, []);
```

### Connection Cleanup
On component unmount (page unload):
```typescript
return () => {
  offConnectionChange(handleConnectionChange);
  offMessage(handleNewMessage);
  disconnect();
};
```

## Session Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE SESSION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐                              ┌─────────────────┐
│  LOCAL STORAGE   │                              │     COGNITO     │
│                 │                              │                 │
│  accessToken    │ ────────────────────────────► │  Validate       │
│  idToken        │ ────────────────────────────► │  Issue tokens   │
│  refreshToken   │ ────────────────────────────► │  Refresh tokens │
└─────────────────┘                              └─────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                         │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  AuthContext   │  │  WebSocket     │  │  Chat Page     │                │
│  │                │  │  Context       │  │                │                │
│  │  - user        │  │  - connected   │  │  - messages    │                │
│  │  - loading     │  │  - messages    │  │  - users       │                │
│  │  - signIn/out  │  │  - send/recv   │  │  - sendMsg     │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Differences from Traditional Sessions

| Aspect | Traditional Sessions | This Application |
|--------|---------------------|------------------|
| Storage | Server-side session | Client-side JWT |
| Validation | Session ID lookup | JWT signature validation |
| Scalability | Requires session store | Stateless JWT |
| Expiry | Server-managed | Client-managed with refresh |

## Next Steps

- [WebSocket Connection](05_websocket_connection.md) - Connection establishment
- [Security Considerations](19_security_considerations.md) - Token security best practices
