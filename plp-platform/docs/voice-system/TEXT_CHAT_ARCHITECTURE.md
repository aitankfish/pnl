# PNL Text Chat - Architecture & Implementation Guide

> Real-time chat for market discussions. Built on existing infrastructure.

## Overview

Text chat for PNL market pages using existing MongoDB + Socket.IO infrastructure. Zero additional cost.

**Key Features:**
- Real-time messaging per market
- Position badges (YES/NO/Founder)
- Message history (last 100 messages)
- Reply/quote functionality
- Reactions
- Founder pinned messages
- Mobile responsive

---

## Architecture

### Simple & Efficient

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Next.js    │  │  Socket.IO  │  │    Chat     │         │
│  │  Frontend   │  │   Client    │  │  Component  │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          │ HTTP           │ WebSocket
          │                │
┌─────────┼────────────────┼──────────────────────────────────┐
│         ▼                ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 EXISTING SERVER                      │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐                 │    │
│  │  │  API Routes  │  │  Socket.IO   │                 │    │
│  │  │  /api/chat   │  │   (existing) │                 │    │
│  │  └──────────────┘  └──────────────┘                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    MONGODB                           │    │
│  │                   (existing)                         │    │
│  │                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐                   │    │
│  │  │  messages   │  │  reactions  │                   │    │
│  │  │ collection  │  │ collection  │                   │    │
│  │  └─────────────┘  └─────────────┘                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Additional Cost: $0
```

---

## Database Schema

### Messages Collection

```typescript
interface ChatMessage {
  _id: ObjectId;
  marketAddress: string;        // Index
  walletAddress: string;        // Sender
  displayName: string;          // Cached display name
  message: string;              // Max 500 chars
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;         // SOL amount
  isFounder: boolean;
  isPinned: boolean;
  replyTo: ObjectId | null;     // Reply to another message
  createdAt: Date;              // Index (TTL: 30 days)
  editedAt: Date | null;
  deletedAt: Date | null;       // Soft delete
}

// Indexes
{ marketAddress: 1, createdAt: -1 }  // Fetch messages
{ marketAddress: 1, isPinned: 1 }    // Fetch pinned
{ createdAt: 1 }                      // TTL index (30 days)
```

### Reactions Collection

```typescript
interface MessageReaction {
  _id: ObjectId;
  messageId: ObjectId;          // Index
  walletAddress: string;
  emoji: string;                // Single emoji
  createdAt: Date;
}

// Index
{ messageId: 1, walletAddress: 1 }  // Unique per user per message
```

---

## API Specifications

### GET /api/chat/[marketAddress]

Fetch message history.

**Query Params:**
- `limit`: number (default: 50, max: 100)
- `before`: string (cursor for pagination)

**Response:**
```typescript
{
  success: boolean;
  data: {
    messages: ChatMessage[];
    hasMore: boolean;
    cursor: string | null;
  }
}
```

### POST /api/chat/[marketAddress]

Send a message.

**Request:**
```typescript
{
  walletAddress: string;
  message: string;
  replyTo?: string;  // Message ID
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    message: ChatMessage;
  }
}
```

### POST /api/chat/[marketAddress]/react

Add reaction to message.

**Request:**
```typescript
{
  walletAddress: string;
  messageId: string;
  emoji: string;
}
```

### DELETE /api/chat/[marketAddress]/[messageId]

Delete own message (soft delete).

### POST /api/chat/[marketAddress]/pin

Pin/unpin message (founder only).

**Request:**
```typescript
{
  founderWallet: string;
  messageId: string;
  pinned: boolean;
}
```

---

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ marketAddress }` | Join chat room |
| `chat:leave` | `{ marketAddress }` | Leave chat room |
| `chat:send` | `{ marketAddress, message, replyTo? }` | Send message |
| `chat:react` | `{ messageId, emoji }` | Add reaction |
| `chat:typing` | `{ marketAddress }` | User is typing |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:message` | `{ message: ChatMessage }` | New message |
| `chat:reaction` | `{ messageId, emoji, count }` | Reaction added |
| `chat:deleted` | `{ messageId }` | Message deleted |
| `chat:pinned` | `{ messageId, pinned }` | Pin status changed |
| `chat:typing` | `{ walletAddress }` | Someone is typing |
| `chat:user_count` | `{ count }` | Users in chat room |

---

## Frontend Components

```
src/components/chat/
├── ChatRoom.tsx           # Main container
├── MessageList.tsx        # Scrollable message list
├── MessageItem.tsx        # Single message
├── MessageInput.tsx       # Input field + send
├── ReactionPicker.tsx     # Emoji picker
├── PinnedMessages.tsx     # Pinned messages bar
└── TypingIndicator.tsx    # "X is typing..."
```

### ChatRoom Component

```tsx
interface ChatRoomProps {
  marketAddress: string;
  className?: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ marketAddress }) => {
  const { messages, sendMessage, isLoading } = useChat(marketAddress);
  const { primaryWallet } = useWallet();

  return (
    <div className="flex flex-col h-full">
      <PinnedMessages marketAddress={marketAddress} />
      <MessageList messages={messages} isLoading={isLoading} />
      <TypingIndicator marketAddress={marketAddress} />
      <MessageInput
        onSend={sendMessage}
        disabled={!primaryWallet}
      />
    </div>
  );
};
```

### useChat Hook

```tsx
const useChat = (marketAddress: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    // Fetch initial messages
    fetchMessages(marketAddress).then(setMessages);

    // Join room
    socket.emit('chat:join', { marketAddress });

    // Listen for new messages
    socket.on('chat:message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.emit('chat:leave', { marketAddress });
      socket.off('chat:message');
    };
  }, [marketAddress]);

  const sendMessage = async (text: string, replyTo?: string) => {
    const response = await fetch(`/api/chat/${marketAddress}`, {
      method: 'POST',
      body: JSON.stringify({ message: text, replyTo }),
    });
    return response.json();
  };

  return { messages, sendMessage, isLoading };
};
```

---

## Implementation Phases

### Phase 1: Basic Chat (3-4 days)

```
Day 1: Database & API
├── [ ] Create messages collection with indexes
├── [ ] GET /api/chat/[marketAddress] - fetch messages
├── [ ] POST /api/chat/[marketAddress] - send message
└── [ ] Test with Postman

Day 2: Socket.IO Integration
├── [ ] Add chat namespace to Socket.IO
├── [ ] Implement chat:join, chat:leave
├── [ ] Implement chat:send, chat:message
└── [ ] Test real-time messaging

Day 3-4: Frontend
├── [ ] ChatRoom component
├── [ ] MessageList component
├── [ ] MessageInput component
├── [ ] Position badges (YES/NO/Founder)
├── [ ] Integrate into market page
└── [ ] Mobile responsive
```

### Phase 2: Features (2-3 days)

```
├── [ ] Reply/quote functionality
├── [ ] Reactions with emoji picker
├── [ ] Typing indicator
├── [ ] Pinned messages (founder)
├── [ ] Delete own messages
└── [ ] Message timestamp formatting
```

### Phase 3: Polish (1-2 days)

```
├── [ ] Auto-scroll to new messages
├── [ ] Load more (pagination)
├── [ ] Unread message indicator
├── [ ] Connection status
├── [ ] Error handling
└── [ ] Rate limiting (5 messages/min)
```

---

## Rate Limiting

```typescript
const RATE_LIMITS = {
  messagesPerMinute: 5,
  messagesPerHour: 50,
  maxMessageLength: 500,
  maxReactionsPerMessage: 1,  // Per user
};

// Redis rate limiting
async function checkRateLimit(walletAddress: string): Promise<boolean> {
  const key = `ratelimit:chat:${walletAddress}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  return count <= RATE_LIMITS.messagesPerMinute;
}
```

---

## Moderation

### Founder Powers
- Pin/unpin messages
- Delete any message in their market
- Mute users (prevent sending for X minutes)

### Auto-moderation
- Spam detection (repeated messages)
- Link filtering (optional)
- Rate limiting

### User Actions
- Delete own messages
- Report messages (future)
- Block users (future)

---

## Cost

**$0 additional** - Uses existing MongoDB and Socket.IO.

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 3-4 days | Working chat with real-time messages |
| Phase 2 | 2-3 days | Reactions, replies, pins |
| Phase 3 | 1-2 days | Polish and edge cases |
| **Total** | **6-9 days** | Production-ready chat |

---

*Document Version: 1.0*
*Created: December 2024*
