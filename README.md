# Family Messenger

A private, real-time messaging app for family members. Send messages instantly, similar to WhatsApp or iMessage.

## Live App

**Production URL:** https://sanketmessenger.vercel.app

## Features

- **Real-time messaging** - Messages delivered instantly via WebSocket
- **Secure authentication** - Login with email and password
- **Private** - Only invited family members can access
- **Works everywhere** - Access from any device with a browser

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────►│   Vercel    │────►│    AWS       │
│  (Frontend) │◄────│  (Hosting) │◄────│  (Backend)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Technology Stack

| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosts the web app (frontend) |
| **AWS API Gateway** | Routes messages between users (WebSocket) |
| **AWS Lambda** | Runs backend code (Python) |
| **AWS Cognito** | Handles login/signup (authentication) |
| **AWS DynamoDB** | Stores messages and connections (database) |
| **Next.js** | Builds the user interface (React framework) |

## How to Use

### Sign Up
1. Go to https://sanketmessenger.vercel.app
2. Click "Get Started"
3. Enter your email and password (8+ characters with uppercase, lowercase, and numbers)
4. Check your email for a verification code
5. Enter the code to confirm your account

### Log In
1. Enter your registered email and password
2. Click "Sign In"

### Send a Message
1. After logging in, you'll see your family members in the sidebar
2. Click on a contact to open a chat
3. Type your message and press Enter or click Send
4. Your message appears instantly on your screen
5. The recipient sees it in real-time on their device

### Log Out
1. Click the logout icon in the top-right corner
2. You'll be redirected to the login page

## Who Has Access?

Anyone with a valid email address can create an account:
1. Go to the app and click "Get Started"
2. Enter your email and create a password
3. Verify your email with the code sent to your inbox
4. Start chatting with family members

## Architecture (High-Level)

```
User opens app
        │
        ▼
┌───────────────────┐     ┌─────────────────┐
│  Vercel (Frontend)│────►│  AWS Cognito    │
│  Next.js website  │     │  (Login/Auth)  │
└───────────────────┘     └─────────────────┘
        │                         │
        │                         │
        ▼                         ▼
┌───────────────────┐     ┌─────────────────┐
│  User selects     │     │  AWS DynamoDB   │
│  contact          │     │  (Messages DB)  │
└───────────────────┘     └─────────────────┘
        │
        ▼
┌───────────────────┐     ┌─────────────────┐
│  Send message     │────►│  AWS Lambda     │
│  (WebSocket)      │◄────│  (Routes msgs)  │
└───────────────────┘     └─────────────────┘
        │
        ▼
┌───────────────────┐
│  Recipient sees   │
│  message instantly│
└───────────────────┘
```

## Documentation

### User Documentation
- [WIKI.md](WIKI.md) - Debugging guide and issues resolved
- [PLAN.md](PLAN.md) - Implementation plan and milestones
- [AGENTS.md](AGENTS.md) - Developer notes

### Technical Documentation
- [technical_flow/](technical_flow/) - 21 in-depth technical documents
- [technical_flow/architecture_diagram.md](technical_flow/architecture_diagram.md) - Visual Mermaid diagrams showing system architecture, flows, and Terraform-managed infrastructure

## License

Personal/family use only.
