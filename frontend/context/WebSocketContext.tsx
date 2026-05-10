/**
 * WebSocketContext - Manages WebSocket connection state and message handling
 * 
 * This context provider:
 * - Initializes WebSocket connection on mount when auth tokens are available
 * - Listens for connection status changes and updates React state
 * - Handles incoming messages and maintains message history
 * - Provides connect/disconnect/sendMessage functions to child components
 * 
 * Token Flow:
 * 1. Reads idToken from localStorage via getStoredTokens()
 * 2. Passes token to connect() which adds it as query param to WebSocket URL
 * 3. API Gateway authorizer validates the token before allowing $connect route
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { connect, disconnect, sendMessage, onMessage, onConnectionChange, offMessage, offConnectionChange } from '../lib/websocket';
import { getStoredTokens } from '../lib/auth';

interface Message {
  senderId: string;
  text: string;
  timestamp: number;
  conversationId: string;
}

interface WebSocketContextType {
  connected: boolean;
  messages: Message[];
  sendMessage: (recipientId: string, text: string) => boolean;
  clearMessages: () => void;
  connectWebSocket: () => Promise<boolean>;
  disconnectWebSocket: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Main provider component - wraps the app to provide WebSocket functionality
export function WebSocketProvider({ children }: { children: ReactNode }) {
  // connected: tracks WebSocket connection state (true/false)
  // messages: stores all received messages for display
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // Use useCallback to create stable function references for cleanup
  const handleConnectionChange = useCallback((status: 'connected' | 'disconnected' | 'connecting') => {
    console.log('[WebSocketContext] Connection status changed:', status);
    setConnected(status === 'connected');
  }, []);

  const handleNewMessage = useCallback((data: Message) => {
    // Deduplicate by checking if we already received this exact message
    setMessages((prev) => {
      const isDuplicate = prev.some(
        m => m.senderId === data.senderId && 
             m.text === data.text && 
             m.timestamp === data.timestamp &&
             m.conversationId === data.conversationId
      );
      if (isDuplicate) {
        console.log('[WebSocketContext] Ignoring duplicate message');
        return prev;
      }
      return [...prev, data];
    });
  }, []);

  // Initialize WebSocket connection on component mount
  useEffect(() => {
    console.log('[WebSocketContext] Initializing...');
    const tokens = getStoredTokens();
    console.log('[WebSocketContext] Tokens available:', !!tokens?.idToken);

    // Only connect if we have an idToken (set after successful login)
    if (tokens?.idToken) {
      console.log('[WebSocketContext] Calling connect with token...');
      connect(tokens.idToken).catch(console.error);
    }

    // Register the callbacks with the websocket module
    onConnectionChange(handleConnectionChange);
    onMessage(handleNewMessage);

    // Cleanup: unregister callbacks and disconnect when component unmounts
    return () => {
      console.log('[WebSocketContext] Cleaning up...');
      offConnectionChange(handleConnectionChange);
      offMessage(handleNewMessage);
      disconnect();
    };
  }, [handleConnectionChange, handleNewMessage]);

  // Send a message via WebSocket to a specific recipient
  const handleSendMessage = (recipientId: string, text: string): boolean => {
    return sendMessage(recipientId, text);
  };

  // Manual reconnect function (can be called from UI if needed)
  const handleConnect = async (): Promise<boolean> => {
    const tokens = getStoredTokens();
    if (!tokens?.idToken) {
      console.error('[WebSocketContext] No token available for connection');
      return false;
    }

    try {
      await connect(tokens.idToken);
      return true;
    } catch (error) {
      console.error('[WebSocketContext] Failed to connect:', error);
      return false;
    }
  };

  // Manual disconnect function
  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
  };

  // Clear message history (e.g., when switching conversations)
  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        messages,
        sendMessage: handleSendMessage,
        clearMessages,
        connectWebSocket: handleConnect,
        disconnectWebSocket: handleDisconnect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// Custom hook for consuming WebSocket context in components
// Usage: const { connected, sendMessage } = useWebSocket();
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}