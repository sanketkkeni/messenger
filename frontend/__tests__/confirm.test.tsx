import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import Confirm from '@/pages/confirm';

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    query: { email: 'test@example.com' },
    isReady: true,
  }),
}));

// Mock auth
const mockConfirmSignUp = jest.fn();
jest.mock('@/lib/auth', () => ({
  confirmSignUp: (...args: any[]) => mockConfirmSignUp(...args),
}));

describe('Confirm Page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockConfirmSignUp.mockReset();
  });

  it('renders verification code form', () => {
    render(<Confirm />);
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify account/i })).toBeInTheDocument();
  });

  it('displays the email address', () => {
    render(<Confirm />);
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it('calls confirmSignUp with code on submit', async () => {
    mockConfirmSignUp.mockResolvedValueOnce(true);
    
    render(<Confirm />);
    
    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify account/i });

    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockConfirmSignUp).toHaveBeenCalledWith('test@example.com', '123456');
    });
  });

  it('shows error for short code', async () => {
    render(<Confirm />);
    
    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify account/i });

    fireEvent.change(codeInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/valid verification code/i)).toBeInTheDocument();
    });
  });

  it('displays error when verification fails', async () => {
    mockConfirmSignUp.mockRejectedValueOnce(new Error('Invalid code'));
    
    render(<Confirm />);
    
    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify account/i });

    fireEvent.change(codeInput, { target: { value: 'wrongcode' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
    });
  });

  it('shows "Request new code" link', () => {
    render(<Confirm />);
    expect(screen.getByRole('button', { name: /request new code/i })).toBeInTheDocument();
  });

  it('redirects to signup when clicking request new code', () => {
    render(<Confirm />);
    fireEvent.click(screen.getByRole('button', { name: /request new code/i }));
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });

  it('shows success view after verification', async () => {
    mockConfirmSignUp.mockResolvedValueOnce(true);
    
    render(<Confirm />);
    
    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify account/i });

    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('shows loading state while verifying', async () => {
    mockConfirmSignUp.mockImplementation(() => new Promise(() => {}));
    
    render(<Confirm />);
    
    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify account/i });

    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /verify account/i })).toBeDisabled();
    });
  });
});