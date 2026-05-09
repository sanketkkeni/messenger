import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/chat');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      {/* Header */}
      <header className="p-6">
        <nav className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary-500" />
            <span className="text-xl font-bold">Family Messenger</span>
          </div>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Connect with Your Family in Real-Time
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Secure, fast, and simple messaging built on serverless architecture.
            No servers to manage, no infrastructure to maintain.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
            >
              Start Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-gray-600 hover:border-gray-500 rounded-xl text-lg font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-6xl">
          <div className="glass-dark p-8 rounded-2xl text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Messaging</h3>
            <p className="text-gray-400">
              Instant delivery with WebSocket technology. See messages appear the moment they're sent.
            </p>
          </div>
          <div className="glass-dark p-8 rounded-2xl text-center">
            <div className="w-16 h-16 bg-accent-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-accent-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure by Design</h3>
            <p className="text-gray-400">
              Built on AWS Cognito with JWT authentication. Your messages stay private.
            </p>
          </div>
          <div className="glass-dark p-8 rounded-2xl text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Always Available</h3>
            <p className="text-gray-400">
              Serverless architecture means no downtime. Scale automatically with demand.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-500 text-sm">
        Built with Next.js, AWS Lambda, and DynamoDB
      </footer>
    </div>
  );
}