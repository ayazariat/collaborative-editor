# Collaborative Editor

A **production-grade real-time collaborative document editor** similar to Google Docs. It lets multiple people work on the same document at the same time, with changes appearing instantly for everyone. Built with modern web technologies for reliability, performance, and scalability.

## ✨ What It Does

The app is designed for teams who need to write and edit documents together in real-time. Here's what you can do:

- **Real-time Collaboration**: Edit documents simultaneously with others, see changes instantly
- **Rich Text Formatting**: Bold, italics, headings, lists, blockquotes, code blocks, and highlights
- **Live Presence**: See colored cursors showing where others are typing and who's online
- **Professional Authentication**: Sign in with email/password or social providers (Google, GitHub)
- **Document Management**: Create, share, and manage documents with proper permissions
- **Offline Support**: Work offline and sync when back online
- **Keyboard Shortcuts**: Full keyboard support for efficient editing
- **Auto-save**: Documents save automatically with visual indicators
- **Error Recovery**: Robust error handling and graceful degradation

## 🚀 Production Features

### Authentication & Security
- Supabase Auth with social login (Google, GitHub)
- Secure user sessions and token management
- Row-level security and data isolation
- XSS protection and input sanitization

### Real-time Collaboration
- CRDT-based synchronization (Yjs) for conflict-free editing
- WebSocket server for low-latency communication
- Presence indicators with user avatars and cursors
- Automatic reconnection and offline queue

### Performance & Reliability
- Error boundaries for crash recovery
- Connection status monitoring
- Optimized rendering and state management
- Graceful degradation for network issues

### User Experience
- Comprehensive toolbar with all formatting options
- Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z, etc.)
- Responsive design for mobile and desktop
- Loading states and progress indicators
- Professional UI with accessibility compliance

## 🛠️ How to Run the App

### Prerequisites

- Node.js 18+ installed
- npm (comes with Node.js)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Up Environment (Recommended for full features)

Create a `.env.local` file in the root directory:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_WS_URL=ws://localhost:1234
```

Get these values from your [Supabase project](https://supabase.com).

### Step 3: Start the WebSocket Server

In one terminal:

```bash
npm run ws-server
```

This starts the WebSocket relay server on port 1234.

### Step 4: Start the Next.js App

In another terminal:

```bash
npm run dev
```

This starts the frontend on http://localhost:3000

### Step 5: Open in Browser

Go to http://localhost:3000 in your browser.

## 🎯 Usage Guide

### For New Users
1. **Sign Up**: Click "Continue without signing in" or use social login
2. **Create Document**: Click "New Document" to start writing
3. **Invite Others**: Share the document URL for collaboration

### Keyboard Shortcuts
- `Ctrl+B`: Bold text
- `Ctrl+I`: Italic text
- `Ctrl+Shift+7`: Bullet list
- `Ctrl+Shift+8`: Numbered list
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo

### Collaboration Features
- **Presence**: See who's online and where they're typing
- **Cursors**: Colored cursors show other users' positions
- **Real-time Sync**: Changes appear instantly for all users
- **Conflict Resolution**: CRDT ensures no data loss during conflicts

## 🏗️ Architecture

### Frontend (Next.js 14)
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS
- **Editor**: TipTap with Yjs integration
- **Authentication**: Supabase Auth UI
- **Real-time**: WebSocket via Yjs

### Backend (WebSocket)
- **Server**: Node.js with ws library
- **Architecture**: Stateless relay server
- **Synchronization**: Yjs WebSocket provider
- **Health**: `/health` endpoint for monitoring

### Database (Supabase)
- **Database**: PostgreSQL
- **Auth**: Built-in user management
- **Real-time**: Supabase real-time subscriptions
- **Security**: Row Level Security (RLS)

## 📊 Performance

- **Real-time Sync**: Sub-100ms latency for text changes
- **Conflict Resolution**: Mathematical guarantees (CRDT)
- **Offline Support**: Local storage with automatic sync
- **Scalability**: Room-based architecture, no global broadcasts
- **Bundle Size**: Optimized with code splitting

## 🔒 Security

- **Authentication**: Secure token-based auth
- **Authorization**: Document-level permissions
- **Data Protection**: Encrypted connections (WSS)
- **Input Validation**: Sanitized rich text content
- **Rate Limiting**: API protection against abuse

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
# Deploy to Vercel with environment variables
```

### Backend (Render/Railway)
```bash
# WebSocket server ready for deployment
# Includes health checks and graceful shutdown
```

### Database (Supabase)
```bash
# Run the provided schema.sql
# RLS policies automatically configured
```

## 🧪 Testing

### Setup Verification
```bash
node test-setup.js
```

### Manual Testing
- Create documents with/without authentication
- Test real-time collaboration in multiple browser tabs
- Verify offline functionality
- Test keyboard shortcuts and toolbar

## 📚 API Reference

### WebSocket Server
- `ws://localhost:1234/{documentId}` - Connect to document room
- `GET /health` - Health check endpoint

### Supabase Tables
- `documents` - Document metadata
- `collaborators` - Sharing permissions
- `comments` - Document comments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project uses the MIT License. See LICENSE file for details.

## 🙏 Acknowledgments

Built with:
- [Yjs](https://yjs.dev) - CRDT for real-time collaboration
- [TipTap](https://tiptap.dev) - Rich text editor
- [Supabase](https://supabase.com) - Backend as a service
- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
