import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signIn, signUp, getUser, storeTokens, clearTokens, getStoredTokens, storeUserId, getStoredUserId, User } from '../lib/auth';
import { connect } from '../lib/websocket';

// Context type definition with WebSocket reconnect callback
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: check if user already has valid tokens (e.g., page refresh)
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
        
        // Reconnect WebSocket if tokens are valid
        console.log('[AuthContext] Restored session, connecting WebSocket...');
        connect(tokens.idToken).catch(console.error);
      } catch (err) {
        console.error('[AuthContext] Session validation failed:', err);
        clearTokens();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login handler: stores tokens and triggers WebSocket connection
  const handleSignIn = async (email: string, password: string) => {
    try {
      setError(null);
      const tokens = await signIn(email, password);
      storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken);

      const userData = await getUser(tokens.accessToken);
      setUser(userData);
      storeUserId(userData.username);
      
      // Connect WebSocket after successful login
      console.log('[AuthContext] Login successful, connecting WebSocket...');
      connect(tokens.idToken).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      throw err;
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      setError(null);
      await signUp(email, password);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      throw err;
    }
  };

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}