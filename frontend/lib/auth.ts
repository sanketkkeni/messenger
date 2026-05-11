/**
 * Authentication Module
 * 
 * This module provides authentication functions for AWS Cognito User Pool.
 * It handles user sign-up, sign-in, token management, and session restoration.
 * 
 * Token Types:
 * - idToken: JWT containing user identity (used for WebSocket connection)
 * - accessToken: JWT for API authorization (used for /users endpoint)
 * - refreshToken: Opaque token for refreshing expired access/id tokens
 * 
 * LocalStorage Keys:
 * - accessToken, idToken, refreshToken: Authentication tokens
 * - userId: Cognito username (sub claim)
 */

import { CognitoIdentityProviderClient, SignUpCommand, GetUserCommand, InitiateAuthCommand, GlobalSignOutCommand, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

// Configuration from environment variables (set in frontend/.env.local)
const REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '';

// Cognito client singleton - reused across function calls
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

/**
 * User interface representing authenticated user data
 */
export interface User {
  username: string;
  email: string;
  email_verified: boolean;
}

/**
 * Sign up a new user with email and password
 * 
 * @param email - User's email address (used as username)
 * @param password - User's password (min 8 chars, requires uppercase, lowercase, number, symbol)
 * @param username - Optional custom username, defaults to email if not provided
 * @returns Object containing userConfirmed flag and userId (sub claim)
 */
export async function signUp(email: string, password: string, username?: string): Promise<{ userConfirmed: boolean; userId: string }> {
  const input = {
    ClientId: CLIENT_ID,
    Username: username || email,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
  };

  const command = new SignUpCommand(input);
  const response = await cognitoClient.send(command);

  return {
    userConfirmed: response.UserConfirmed || false,
    userId: response.UserSub || '',
  };
}

/**
 * Confirm user's email address with verification code
 * 
 * @param email - User's email address (must match signUp)
 * @param confirmationCode - 6-digit code sent to user's email
 * @returns true if confirmation successful
 */
export async function confirmSignUp(email: string, confirmationCode: string): Promise<boolean> {
  const command = new ConfirmSignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  });

  await cognitoClient.send(command);
  return true;
}

/**
 * Sign in existing user with email and password
 * 
 * Uses Cognito USER_PASSWORD_AUTH flow which sends credentials directly
 * to Cognito for authentication (not recommended for production without
 * additional security measures like MFA).
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Object containing accessToken, idToken, and refreshToken
 */
export async function signIn(email: string, password: string): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  const command = new InitiateAuthCommand({
    ClientId: CLIENT_ID,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const response = await cognitoClient.send(command);

  return {
    accessToken: response.AuthenticationResult?.AccessToken || '',
    idToken: response.AuthenticationResult?.IdToken || '',
    refreshToken: response.AuthenticationResult?.RefreshToken || '',
  };
}

/**
 * Get user profile using access token
 * 
 * @param accessToken - Valid access token from signIn
 * @returns User object with username, email, and email_verified status
 */
export async function getUser(accessToken: string): Promise<User> {
  const command = new GetUserCommand({ AccessToken: accessToken });
  const response = await cognitoClient.send(command);

  // Convert Cognito's attribute array to key-value object
  const attributes: Record<string, string> = {};
  response.UserAttributes?.forEach((attr) => {
    if (attr.Name && attr.Value) {
      attributes[attr.Name] = attr.Value;
    }
  });

  return {
    username: response.Username || '',
    email: attributes.email || '',
    email_verified: attributes.email_verified === 'true',
  };
}

/**
 * Sign out user by invalidating their access token
 * 
 * Note: This only invalidates the access token server-side.
 * Client should also call clearTokens() to remove local storage.
 * 
 * @param accessToken - Valid access token to invalidate
 */
export async function signOut(accessToken: string): Promise<void> {
  const command = new GlobalSignOutCommand({ AccessToken: accessToken });
  await cognitoClient.send(command);
}

/**
 * Refresh authentication tokens using refresh token
 * 
 * @param refreshToken - Valid refresh token from signIn
 * @returns Object containing new accessToken, idToken, and refreshToken
 */
export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  const command = new InitiateAuthCommand({
    ClientId: CLIENT_ID,
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  const response = await cognitoClient.send(command);

  return {
    accessToken: response.AuthenticationResult?.AccessToken || '',
    idToken: response.AuthenticationResult?.IdToken || '',
    refreshToken: response.AuthenticationResult?.RefreshToken || refreshToken,
  };
}

// ==================== Token Storage (Client-Side) ====================
// These functions manage authentication tokens in browser localStorage

/**
 * Store authentication tokens in localStorage
 * 
 * Tokens are stored separately for security/organization:
 * - idToken: Used for WebSocket connection authentication
 * - accessToken: Used for REST API calls
 * - refreshToken: Used to obtain new tokens when they expire
 * 
 * @param accessToken - JWT for API authorization
 * @param idToken - JWT containing user identity
 * @param refreshToken - Opaque token for token refresh
 */
export function storeTokens(accessToken: string, idToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
}

/**
 * Retrieve stored authentication tokens from localStorage
 * 
 * @returns Token object if all tokens present, null otherwise
 */
export function getStoredTokens(): { accessToken: string; idToken: string; refreshToken: string } | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem('accessToken');
  const idToken = localStorage.getItem('idToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (!accessToken || !idToken || !refreshToken) {
    return null;
  }

  return { accessToken, idToken, refreshToken };
}

/**
 * Clear all authentication tokens from localStorage
 * Call this on sign-out to prevent session restoration
 */
export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }
}

/**
 * Store user ID (cognito:username/sub claim) in localStorage
 * Used for session restoration without re-authentication
 * 
 * @param userId - The user's Cognito username (sub claim)
 */
export function storeUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId);
  }
}

/**
 * Retrieve stored user ID from localStorage
 * 
 * @returns User ID if stored, null otherwise
 */
export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
}
