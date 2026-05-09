import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { fetchUsers } from '../lib/websocket';
import { getStoredTokens, getStoredUserId } from '../lib/auth';
import { MessageSquare, LogOut, Send, Users, X } from 'lucide-react';

interface User {
  username: string;
  email: string;
  email_verified: boolean;
}

interface Message {
  senderId: string;
  text: string;
  timestamp: number;
  conversationId: string;
}

export default function Chat() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { connected, sendMessage, messages, clearMessages } = useWebSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadUsers = async () => {
      const tokens = getStoredTokens();
      if (!tokens?.accessToken) {
        setLoading(false);
        return;
      }

      const fetchedUsers = await fetchUsers(tokens.accessToken);
      setUsers(fetchedUsers.filter(u => u.username !== user?.username));
      setLoading(false);
    };

    loadUsers();
  }, [user, router]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedUser) return;

    sendMessage(selectedUser.username, messageText);
    setMessageText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  const filteredMessages = messages.filter(
    msg => msg.conversationId === getConversationId(user?.username || '', selectedUser?.username || '')
  );

  const getConversationId = (user1: string, user2: string) => {
    const sorted = [user1, user2].sort();
    return `${sorted[0]}#${sorted[1]}`;
  };

  const currentUserId = getStoredUserId();

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-dark-700 rounded-lg"
            >
              <Users className="h-5 w-5" />
            </button>
            <MessageSquare className="h-6 w-6 text-primary-500" />
            <span className="text-lg font-bold">Family Messenger</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - User List */}
        <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-80 bg-dark-800 border-r border-dark-600 flex flex-col`}>
          <div className="p-4 border-b border-dark-600">
            <h2 className="text-lg font-semibold">Contacts</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">Loading contacts...</div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-gray-400">No contacts found</div>
            ) : (
              <ul className="divide-y divide-dark-600">
                {users.map((u) => (
                  <li key={u.username}>
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-dark-700 transition-colors ${
                        selectedUser?.username === u.username ? 'bg-dark-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                          <span className="text-primary-400 font-semibold">
                            {u.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{u.email}</p>
                          <p className="text-sm text-gray-400 truncate">{u.username}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col bg-dark-900">
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className="bg-dark-800 border-b border-dark-600 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-semibold">
                    {selectedUser.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{selectedUser.email}</h3>
                  <p className="text-sm text-gray-400">{selectedUser.username}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden ml-auto p-2 hover:bg-dark-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredMessages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  filteredMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${
                          msg.senderId === currentUserId
                            ? 'bg-primary-600 rounded-br-md'
                            : 'bg-dark-700 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Area */}
              <div className="bg-dark-800 border-t border-dark-600 p-4">
                <div className="flex gap-3">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-4 py-3 resize-none focus:border-primary-500 transition-colors"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg font-medium transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
                <p className="text-gray-400">Choose a contact from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}