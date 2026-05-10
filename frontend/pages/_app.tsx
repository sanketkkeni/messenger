/**
 * Next.js Application Entry Point
 * 
 * This file wraps the application with context providers for authentication
 * and WebSocket functionality. It ensures these providers are available
 * throughout the application.
 * 
 * Provider Hierarchy:
 * AuthProvider -> Provides authentication state and functions
 *   └── WebSocketProvider -> Provides WebSocket connection and messaging
 *       └── Component -> Page components have access to both contexts
 */

import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { WebSocketProvider } from '../context/WebSocketContext';

/**
 * Root application component
 * 
 * Wraps all pages with authentication and WebSocket providers.
 * The mounted check prevents SSR/hydration mismatches with localStorage.
 */
export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted to true after initial render (client-side only)
    setMounted(true);
  }, []);

  // Avoid rendering until mounted to prevent localStorage access errors
  if (!mounted) {
    return null;
  }

  return (
    <AuthProvider>
      <WebSocketProvider>
        <Component {...pageProps} />
      </WebSocketProvider>
    </AuthProvider>
  );
}
