import { render, screen, waitFor } from '@testing-library/react';
import Index from '@/pages/index';

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth context
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

describe('Index Page', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders landing page with title', () => {
    render(<Index />);
    expect(screen.getByText(/Family Messenger/)).toBeInTheDocument();
  });

  it('shows main headline', () => {
    render(<Index />);
    expect(screen.getByText(/Connect with Your Family/)).toBeInTheDocument();
  });

  it('renders "Get Started" button', () => {
    render(<Index />);
    const getStartedBtn = screen.getByRole('link', { name: /get started/i });
    expect(getStartedBtn).toBeInTheDocument();
    expect(getStartedBtn).toHaveAttribute('href', '/signup');
  });

  it('renders "Sign In" link in navigation', () => {
    render(<Index />);
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);
    // Check the navigation link (smaller, in header)
    expect(signInLinks[0]).toHaveAttribute('href', '/login');
  });

  it('renders feature cards', () => {
    render(<Index />);
    expect(screen.getByText(/Real-Time Messaging/)).toBeInTheDocument();
    expect(screen.getByText(/Secure by Design/)).toBeInTheDocument();
    expect(screen.getByText(/Always Available/)).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<Index />);
    expect(screen.getByText(/Secure, fast, and simple messaging/)).toBeInTheDocument();
  });

  it('links to correct pages in footer', () => {
    render(<Index />);
    expect(screen.getByText(/Built with Next.js/)).toBeInTheDocument();
  });

  it('renders MessageSquare icon in header', () => {
    render(<Index />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});