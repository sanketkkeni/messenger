/**
 * Authentication Context Provider
 * 
 * This React context manages the authentication state for the application.
 * It provides authentication functions and user data to all components.
 * 
 * Responsibilities:
 * - Session restoration on page load (check stored tokens validity)
 * - User login/logout handling
 * - WebSocket connection trigger after authentication
 * - Error handling for authentication failures
 * 
 * Token Flow:
 * 1. User signs in with email/password via signIn()
 * 2. Tokens stored in localStorage via storeTokens()
 * 3. WebSocket connection established using idToken
 * 4. On page reload, tokens validated via getUser()
 * 5. User signs out, tokens cleared via clearTokens()
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signIn, signUp, getUser, storeTokens, clearTokens, getStoredTokens, storeUserId, getStoredUserId, refreshTokens, User } from '../lib/auth';
import { connect } from '../lib/websocket';

// Context type definition
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

// Create context with undefined default (throws if used outside provider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 * 
 * Wrap your app with this provider to access authentication functionality:
 * 
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * 
 * Then use in components:
 * 
 *   const { user, signIn, signOut } = useAuth();
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: check if user already has valid tokens (session restoration)
  useEffect(() => {
    const checkAuth = async () => {
      const tokens = getStoredTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getUser(tokens.accessToken);
        setUser(userData);
        storeUserId(userData.username);
        connect(tokens.idToken).catch(console.error);
      } catch {
        try {
          const newTokens = await refreshTokens(tokens.refreshToken);
          storeTokens(newTokens.accessToken, newTokens.idToken, newTokens.refreshToken);
          const userData = await getUser(newTokens.accessToken);
          setUser(userData);
          storeUserId(userData.username);
          connect(newTokens.idToken).catch(console.error);
        } catch {
          clearTokens();
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Handle user login
   * 
   * Steps:
   * 1. Call signIn() to authenticate with Cognito
   * 2. Store tokens in localStorage
   * 3. Fetch user profile
   * 4. Store user ID
   * 5. Connect WebSocket
   */
  const handleSignIn = async (email: string, password: string) => {
    try {
      setError(null);
      
      // Authenticate with Cognito
      const tokens = await signIn(email, password);
      storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken);

      // Get user profile
      const userData = await getUser(tokens.accessToken);
      setUser(userData);
      storeUserId(userData.username);
      
      // Establish WebSocket connection
      connect(tokens.idToken).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      throw err;
    }
  };

  /**
   * Handle user registration
   * Note: Registration requires email confirmation before login
   */
  const handleSignUp = async (email: string, password: string) => {
    try {
      setError(null);
      await signUp(email, password);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      throw err;
    }
  };

  /**
   * Handle user logout
   * Clears tokens and resets user state
   */
  const handleSignOut = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * 
 * Usage:
 *   const { user, loading, signIn } = useAuth();
 * 
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
