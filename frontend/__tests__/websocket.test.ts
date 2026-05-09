import { onMessage, onConnectionChange, notifyMessage, notifyConnectionChange } from '@/lib/websocket';

describe('WebSocket Callback System', () => {
  describe('onMessage', () => {
    it('registers a callback without throwing', () => {
      const callback = jest.fn();
      expect(() => onMessage(callback)).not.toThrow();
    });

    it('notifies registered callback', () => {
      const callback = jest.fn();
      onMessage(callback);
      notifyMessage({ senderId: 'test', text: 'hello' });
      expect(callback).toHaveBeenCalledWith({ senderId: 'test', text: 'hello' });
    });

    it('notifies multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      onMessage(callback1);
      onMessage(callback2);
      notifyMessage({ senderId: 'sender', text: 'message' });
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('onConnectionChange', () => {
    it('registers a callback without throwing', () => {
      const callback = jest.fn();
      expect(() => onConnectionChange(callback)).not.toThrow();
    });

    it('notifies connected status', () => {
      const callback = jest.fn();
      onConnectionChange(callback);
      notifyConnectionChange('connected');
      expect(callback).toHaveBeenCalledWith('connected');
    });

    it('notifies disconnected status', () => {
      const callback = jest.fn();
      onConnectionChange(callback);
      notifyConnectionChange('disconnected');
      expect(callback).toHaveBeenCalledWith('disconnected');
    });

    it('notifies connecting status', () => {
      const callback = jest.fn();
      onConnectionChange(callback);
      notifyConnectionChange('connecting');
      expect(callback).toHaveBeenCalledWith('connecting');
    });
  });

  describe('notifyMessage', () => {
    it('calls all registered callbacks with message data', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      onMessage(callback1);
      onMessage(callback2);
      
      const message = { senderId: 'user@example.com', text: 'Hello!', timestamp: 123456 };
      notifyMessage(message);
      
      expect(callback1).toHaveBeenCalledWith(message);
      expect(callback2).toHaveBeenCalledWith(message);
    });
  });

  describe('notifyConnectionChange', () => {
    it('calls all registered callbacks with status', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      onConnectionChange(callback1);
      onConnectionChange(callback2);
      
      notifyConnectionChange('connected');
      
      expect(callback1).toHaveBeenCalledWith('connected');
      expect(callback2).toHaveBeenCalledWith('connected');
    });
  });
});

// Note: The following functions require integration tests with actual WebSocket connections:
// - connect()
// - disconnect()
// - sendMessage()
// - isConnected()
// - fetchUsers()
// - getWebSocketUrl()
// - getRestApiUrl()
//
// These functions interact with browser WebSocket API or environment variables
// and require more complex setup for unit testing.
// 
// To test these, use integration tests with a mocked WebSocket environment.