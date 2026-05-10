const WEBSOCKET_ENDPOINT = process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT?.replace(/\/$/, '') || '';
const REST_API_ENDPOINT = process.env.NEXT_PUBLIC_REST_API_ENDPOINT?.replace(/\/$/, '') || '';

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 1000;

let messageCallbacks: ((data: any) => void)[] = [];
let connectionCallbacks: ((status: 'connected' | 'disconnected' | 'connecting') => void)[] = [];

export function onMessage(callback: (data: any) => void): void {
  messageCallbacks.push(callback);
}

export function onConnectionChange(callback: (status: 'connected' | 'disconnected' | 'connecting') => void): void {
  connectionCallbacks.push(callback);
}

export function notifyConnectionChange(status: 'connected' | 'disconnected' | 'connecting'): void {
  connectionCallbacks.forEach((cb) => cb(status));
}

export function notifyMessage(data: any): void {
  messageCallbacks.forEach((cb) => cb(data));
}

export function connect(token: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }

    notifyConnectionChange('connecting');

    // For WebSocket, API Gateway expects Authorization in the query string
    // The route selection expression "$request.body.action" is for routing messages,
    // but the $connect route is triggered by the WebSocket upgrade request
    // Authorization is passed as a query parameter for the authorizer to validate
    
    // Ensure URL has stage ($default) if not already present
    let wsEndpoint = WEBSOCKET_ENDPOINT;
    if (!wsEndpoint.includes('/$default')) {
      wsEndpoint = wsEndpoint.replace(/\/$/, '') + '/$default';
    }
    
    const wsUrl = `${wsEndpoint}?Authorization=${encodeURIComponent(token)}`;
    console.log('[WebSocket] Full URL being used:', wsUrl);
    console.log('[WebSocket] Endpoint from config:', WEBSOCKET_ENDPOINT);
    
    // Create WebSocket connection
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[WebSocket] Failed to create WebSocket:', err);
      reject(err);
      return;
    }

    socket.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      reconnectAttempts = 0;
      notifyConnectionChange('connected');
      resolve(true);
    };

    socket.onclose = (event) => {
      console.log('[WebSocket] Disconnected', event.code, event.reason);
      notifyConnectionChange('disconnected');
      socket = null;

      if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        setTimeout(() => {
          connect(token).catch(console.error);
        }, delay);
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      reject(error);
    };

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

export function disconnect(): void {
  if (socket) {
    socket.close(1000, 'User disconnected');
    socket = null;
  }
  reconnectAttempts = maxReconnectAttempts;
}

export function sendMessage(recipientId: string, text: string): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not connected');
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

export function isConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

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
    console.error('Error fetching users:', error);
    return [];
  }
}

export function getWebSocketUrl(): string {
  return WEBSOCKET_ENDPOINT;
}

export function getRestApiUrl(): string {
  return REST_API_ENDPOINT;
}