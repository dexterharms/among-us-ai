# better-sse

**Version:** 0.16.1
**Source:** https://github.com/MatthewWid/better-sse
**Docs:** https://matthewwid.github.io/better-sse

## Overview

Dead simple, dependency-less, spec-compliant server-sent events implementation written in TypeScript. Framework-agnostic, works with Express, Hono, Fastify, Nest, Next.js, Bun, Deno.

## Why SSE over WebSockets?

- Operates directly over HTTP (no connection upgrade required)
- Native event ID generation and automatic reconnection
- Comparable performance to WebSockets, especially over HTTP/2
- Bandwidth and battery efficient for mobile devices

## Key Features

- **Channels:** Broadcast events to many clients at once
- **Event buffers:** Batch events for improved performance
- **Keep-alive pings:** Automatically keep connections open
- **Streams:** Pipe Node.js streams and iterables directly as events
- **Reconnection config:** Trust or ignore client-given last event ID

## Basic Usage

### Server (Express)

```typescript
import { createSession } from "better-sse"

app.get("/sse", async (req, res) => {
  const session = await createSession(req, res)
  session.push("Hello world!", "message")
})
```

### Server (Hono)

```typescript
import { createResponse } from "better-sse"

app.get("/sse", (c) =>
  createResponse(c.req.raw, (session) => {
    session.push("Hello world!", "message")
  })
)
```

### Client

```typescript
const eventSource = new EventSource("/sse")

eventSource.addEventListener("message", ({ data }) => {
  const contents = JSON.parse(data)
  console.log(contents)
})
```

## Channels (Broadcast to Many)

```typescript
import { createSession, createChannel } from "better-sse"

const channel = createChannel()

app.get("/sse", async (req, res) => {
  const session = await createSession(req, res)
  channel.register(session)
  channel.broadcast("A user has joined.", "join-notification")
})
```

## Batching

```typescript
await session.batch(async (buffer) => {
  await buffer.iterate(["My", "huge", "event", "list"])
})
```

## In among-us-ai

Used for real-time game state updates pushed from server to clients (game events, player actions, voting, etc.).
