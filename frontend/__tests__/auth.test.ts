import { storeTokens, getStoredTokens, clearTokens, storeUserId, getStoredUserId } from '@/lib/auth';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Auth Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('storeTokens', () => {
    it('stores accessToken in localStorage', () => {
      storeTokens('access123', 'id456', 'refresh789');
      expect(localStorage.getItem('accessToken')).toBe('access123');
    });

    it('stores idToken in localStorage', () => {
      storeTokens('access123', 'id456', 'refresh789');
      expect(localStorage.getItem('idToken')).toBe('id456');
    });

    it('stores refreshToken in localStorage', () => {
      storeTokens('access123', 'id456', 'refresh789');
      expect(localStorage.getItem('refreshToken')).toBe('refresh789');
    });

    it('stores all three tokens at once', () => {
      storeTokens('access', 'id', 'refresh');
      expect(localStorage.getItem('accessToken')).toBe('access');
      expect(localStorage.getItem('idToken')).toBe('id');
      expect(localStorage.getItem('refreshToken')).toBe('refresh');
    });
  });

  describe('getStoredTokens', () => {
    it('returns tokens when all three are present', () => {
      localStorage.setItem('accessToken', 'a');
      localStorage.setItem('idToken', 'b');
      localStorage.setItem('refreshToken', 'c');
      
      const tokens = getStoredTokens();
      
      expect(tokens).toEqual({
        accessToken: 'a',
        idToken: 'b',
        refreshToken: 'c',
      });
    });

    it('returns null when accessToken is missing', () => {
      localStorage.setItem('idToken', 'b');
      localStorage.setItem('refreshToken', 'c');
      
      expect(getStoredTokens()).toBeNull();
    });

    it('returns null when idToken is missing', () => {
      localStorage.setItem('accessToken', 'a');
      localStorage.setItem('refreshToken', 'c');
      
      expect(getStoredTokens()).toBeNull();
    });

    it('returns null when refreshToken is missing', () => {
      localStorage.setItem('accessToken', 'a');
      localStorage.setItem('idToken', 'b');
      
      expect(getStoredTokens()).toBeNull();
    });

    it('returns null when no tokens exist', () => {
      expect(getStoredTokens()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes accessToken', () => {
      localStorage.setItem('accessToken', 'a');
      clearTokens();
      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    it('removes idToken', () => {
      localStorage.setItem('idToken', 'b');
      clearTokens();
      expect(localStorage.getItem('idToken')).toBeNull();
    });

    it('removes refreshToken', () => {
      localStorage.setItem('refreshToken', 'c');
      clearTokens();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('removes userId', () => {
      localStorage.setItem('userId', 'user123');
      clearTokens();
      expect(localStorage.getItem('userId')).toBeNull();
    });

    it('clears all tokens at once', () => {
      localStorage.setItem('accessToken', 'a');
      localStorage.setItem('idToken', 'b');
      localStorage.setItem('refreshToken', 'c');
      localStorage.setItem('userId', 'user');
      
      clearTokens();
      
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('idToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();
    });
  });

  describe('storeUserId', () => {
    it('stores userId in localStorage', () => {
      storeUserId('user123');
      expect(localStorage.getItem('userId')).toBe('user123');
    });

    it('overwrites existing userId', () => {
      storeUserId('user1');
      storeUserId('user2');
      expect(localStorage.getItem('userId')).toBe('user2');
    });
  });

  describe('getStoredUserId', () => {
    it('returns userId when present', () => {
      localStorage.setItem('userId', 'user456');
      expect(getStoredUserId()).toBe('user456');
    });

    it('returns null when userId is not present', () => {
      expect(getStoredUserId()).toBeNull();
    });
  });
});

// Note: The following API functions require integration tests with AWS Cognito:
// - signUp()
// - confirmSignUp()
// - signIn()
// - getUser()
// - signOut()
// 
// These functions interact with AWS SDK and cannot be easily unit tested
// without complex mocking of the CognitoIdentityProviderClient.
// 
// To test these, use integration tests that call against a real or mocked
// Cognito environment.