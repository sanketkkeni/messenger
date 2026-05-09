import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connect, disconnect, sendMessage, onMessage, onConnectionChange, isConnected, notifyMessage, notifyConnectionChange } from '../lib/websocket';
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

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const handleConnectionChange = (status: 'connected' | 'disconnected' | 'connecting') => {
      setConnected(status === 'connected');
    };

    const handleNewMessage = (data: Message) => {
      setMessages((prev) => [...prev, data]);
    };

    onConnectionChange(handleConnectionChange);
    onMessage(handleNewMessage);

    const tokens = getStoredTokens();
    if (tokens?.idToken) {
      connect(tokens.idToken).catch(console.error);
    }

    return () => {
      disconnect();
    };
  }, []);

  const handleSendMessage = (recipientId: string, text: string): boolean => {
    return sendMessage(recipientId, text);
  };

  const handleConnect = async (): Promise<boolean> => {
    const tokens = getStoredTokens();
    if (!tokens?.idToken) {
      console.error('No token available');
      return false;
    }

    try {
      await connect(tokens.idToken);
      return true;
    } catch (error) {
      console.error('Failed to connect:', error);
      return false;
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
  };

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

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}