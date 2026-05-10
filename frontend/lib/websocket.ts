/**
 * WebSocket Connection Module
 * 
 * This module manages the WebSocket connection to API Gateway for real-time messaging.
 * It provides functions for connecting, disconnecting, and sending messages over WebSocket.
 * 
 * Connection Flow:
 * 1. Frontend calls connect(token) with the idToken from Cognito login
 * 2. Token is sent as query parameter (?Authorization=<token>)
 * 3. API Gateway passes token to connect_handler Lambda via $connect route
 * 4. connect_handler validates token and stores connection in DynamoDB
 * 5. On success, WebSocket connection is established for real-time messaging
 * 
 * Message Flow:
 * 1. Client sends message via sendMessage(recipientId, text)
 * 2. Message goes to message_handler Lambda via sendMessage route
 * 3. message_handler looks up recipient's connectionId in DynamoDB
 * 4. message_handler sends message via API Gateway Management API to recipient's WebSocket
 */

// Environment configuration from frontend/.env.local
const WEBSOCKET_ENDPOINT = process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT?.replace(/\/$/, '') || '';
const REST_API_ENDPOINT = process.env.NEXT_PUBLIC_REST_API_ENDPOINT?.replace(/\/$/, '') || '';

// WebSocket instance and reconnection state
let socket: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 1000;

// Event callback registries
let messageCallbacks: ((data: any) => void)[] = [];
let connectionCallbacks: ((status: 'connected' | 'disconnected' | 'connecting') => void)[] = [];

export function clearAllCallbacks(): void {
  messageCallbacks = [];
  connectionCallbacks = [];
}

/**
 * Register a callback for incoming WebSocket messages
 * @param callback - Function called with parsed message data
 */
export function onMessage(callback: (data: any) => void): void {
  messageCallbacks.push(callback);
}

/**
 * Unregister a callback for incoming WebSocket messages
 */
export function offMessage(callback: (data: any) => void): void {
  messageCallbacks = messageCallbacks.filter(cb => cb !== callback);
}

/**
 * Register a callback for connection status changes
 * @param callback - Function called with new connection status
 */
export function onConnectionChange(callback: (status: 'connected' | 'disconnected' | 'connecting') => void): void {
  connectionCallbacks.push(callback);
}

/**
 * Unregister a callback for connection status changes
 */
export function offConnectionChange(callback: (status: 'connected' | 'disconnected' | 'connecting') => void): void {
  connectionCallbacks = connectionCallbacks.filter(cb => cb !== callback);
}

/**
 * Notify all registered message callbacks of a new message
 */
export function notifyConnectionChange(status: 'connected' | 'disconnected' | 'connecting'): void {
  connectionCallbacks.forEach((cb) => cb(status));
}

/**
 * Notify all registered message callbacks of new data
 */
export function notifyMessage(data: any): void {
  messageCallbacks.forEach((cb) => cb(data));
}

/**
 * Establish WebSocket connection with API Gateway
 * 
 * @param token - idToken from Cognito login (used for authentication)
 * @returns Promise that resolves to true if connection successful
 */
export function connect(token: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Return early if already connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }

    notifyConnectionChange('connecting');

    // Ensure URL includes the stage ($default) required by API Gateway WebSocket
    // The endpoint in .env.local may or may not include the stage
    let wsEndpoint = WEBSOCKET_ENDPOINT;
    if (!wsEndpoint.includes('/$default')) {
      wsEndpoint = wsEndpoint.replace(/\/$/, '') + '/$default';
    }
    
    // Token is passed as query parameter for authentication
    // API Gateway custom authorizer reads this from route.request.querystring.Authorization
    const wsUrl = `${wsEndpoint}?Authorization=${encodeURIComponent(token)}`;
    
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      reject(err);
      return;
    }

    // Connection established successfully
    socket.onopen = () => {
      reconnectAttempts = 0;
      notifyConnectionChange('connected');
      resolve(true);
    };

    // Handle disconnection with exponential backoff reconnection
    socket.onclose = (event) => {
      notifyConnectionChange('disconnected');
      socket = null;

      // Attempt reconnection with exponential backoff
      if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
        setTimeout(() => {
          connect(token).catch(console.error);
        }, delay);
      }
    };

    // Log WebSocket errors (browser shows generic message)
    socket.onerror = (error) => {
      reject(error);
    };

    // Parse incoming JSON messages and notify callbacks
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        notifyMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  });
}

/**
 * Close WebSocket connection gracefully
 */
export function disconnect(): void {
  if (socket) {
    socket.close(1000, 'User disconnected');
    socket = null;
  }
  // Prevent automatic reconnection
  reconnectAttempts = maxReconnectAttempts;
}

/**
 * Send a message to a specific user via WebSocket
 * 
 * @param recipientId - Target user's ID (cognito:username)
 * @param text - Message text content
 * @returns true if message sent successfully
 */
export function sendMessage(recipientId: string, text: string): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  const message = {
    action: 'sendMessage',
    recipientId,
    text,
  };

  socket.send(JSON.stringify(message));
  return true;
}

/**
 * Check if WebSocket connection is active
 * @returns true if connected and ready
 */
export function isConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

/**
 * Fetch list of users from REST API
 * Used for user discovery/selection in the chat UI
 * 
 * @param accessToken - Valid access token from Cognito login
 * @returns Array of user objects with email, username, etc.
 */
export async function fetchUsers(accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${REST_API_ENDPOINT}/users`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get the configured WebSocket endpoint URL
 * @returns WebSocket endpoint from environment
 */
export function getWebSocketUrl(): string {
  return WEBSOCKET_ENDPOINT;
}

/**
 * Get the configured REST API endpoint URL
 * @returns REST API endpoint from environment
 */
export function getRestApiUrl(): string {
  return REST_API_ENDPOINT;
}
