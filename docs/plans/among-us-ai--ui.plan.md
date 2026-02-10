# Among Us AI - UI & Action Logging Plan

**Date:** 2026-02-09
**Project:** among-us-ai
**Goal:** Add comprehensive action logging with live visualization UI

---

## Overview

Build a React-based UI to visualize real-time game actions and state for an Among Us AI implementation, with comprehensive action logging and SSE streaming.

---

## Requirements

### 1. Action Logging System

**Scope:**
- Log EVERY action (not just log room actions)
- Each action includes current game state
- All actions streamed via SSE
- Unprotected for now (future: admin status protection)

**Data Model:**
```typescript
interface GameAction {
  id: string;
  timestamp: number;
  type: string; // action type (meeting, vote, movement, task, etc.)
  actor: string; // player name/ID
  action: any; // action-specific data
  gameState: GameState; // snapshot of game state at this moment
}

interface GameState {
  players: Player[];
  phase: 'lobby' | 'game' | 'meeting' | 'voting' | 'ended';
  map?: string;
  impostors?: string[];
  tasks?: Task[];
  bodies?: Body[];
  // ... other game state fields
}
```

### 2. SSE Streaming

**Endpoint:** `/api/stream/actions`
- Stream all game actions in real-time
- Use Server-Sent Events (SSE)
- No auth for now (add admin check later)

**Bun Implementation:**
```typescript
Bun.serve({
  fetch(req) {
    if (req.url.endsWith('/api/stream/actions')) {
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // Stream actions as they occur
            actionStream.subscribe((action) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(action)}\n\n`));
            });
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }
  },
});
```

### 3. React Website

**Features:**
- Live log viewer (scrolling list of actions)
- Visual game state representation (from log events)
- Dark/light mode (system preference by default, toggle in top-right)
- Same server as Bun API (single repo)

**Tech Stack:**
- React (latest)
- Base UI components library ⚠️ *Clarify specific library*
- Vite for bundling
- TypeScript

**UI Components Needed:**
- `LogViewer` - Scrollable list of game actions
- `GameStateVisualization` - Visual representation of map, players, etc.
- `ThemeToggle` - Dark/light mode toggle (top-right)
- `Layout` - Main page layout

**Theme System:**
```typescript
// Default: system preference
// Toggle: manual override
// Persist: localStorage

const ThemeProvider = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className={theme}>
      {/* ... */}
    </div>
  );
};
```

---

## Project Structure

```
among-us-ai/
├── server/
│   ├── src/
│   │   ├── index.ts          # Bun server entry
│   │   ├── game.ts           # Game logic
│   │   ├── actions.ts        # Action logging
│   │   ├── sse.ts            # SSE streaming
│   │   └── types.ts          # Shared types
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── LogViewer.tsx
│   │   │   ├── GameStateVisualization.tsx
│   │   │   └── ThemeToggle.tsx
│   │   └── hooks/
│   │       └── useEventStream.ts  # SSE client hook
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── package.json              # Root workspace
```

---

## Implementation Plan

### Phase 1: Research & Setup

1. **Clarify Base UI library** - Which specific component library?
   - shadcn/ui?
   - MUI Base?
   - Radix UI?
   - Chakra UI?
   - Other?

2. **Initialize project structure**
   - Create `projects/among-us-ai/` directory
   - Set up Bun project in `server/`
   - Set up Vite + React + TypeScript in `web/`
   - Install dependencies

3. **Define shared types** (`types.ts`)
   - GameAction
   - GameState
   - Player
   - Task
   - Body
   - Map data

### Phase 2: Action Logging (Server)

1. **Create action logging module** (`actions.ts`)
   - In-memory action store
   - Add action with game state snapshot
   - Query actions by time range

2. **Create SSE streaming module** (`sse.ts`)
   - Event emitter for actions
   - SSE endpoint handler
   - Client subscription management

3. **Integrate into game logic** (`game.ts`)
   - Wrap all game actions with logging
   - Capture game state before/after each action

### Phase 3: React UI

1. **Set up Vite + React + TypeScript**
   - Configure Vite
   - Set up routing (if needed)
   - Install UI library

2. **Create SSE client hook** (`useEventStream.ts`)
   - Connect to `/api/stream/actions`
   - Handle reconnection
   - Parse SSE events
   - Expose actions array

3. **Build components:**
   - `ThemeToggle` - Dark/light mode toggle
   - `LogViewer` - Scrolling action list
   - `GameStateVisualization` - Visual game state

4. **Build main App layout**
   - Theme provider
   - Top-right theme toggle
   - Main content area

### Phase 4: Integration & Testing

1. **Server integration**
   - Serve React static files from Bun server
   - Ensure CORS/SSE headers are correct

2. **Testing**
   - Write tests for action logging
   - Write tests for SSE streaming
   - Write tests for React components
   - End-to-end tests for full flow

3. **Deployment verification**
   - Run server locally
   - Test live action streaming
   - Test theme toggle
   - Test game state visualization

---

## Questions & Clarifications

1. **Base UI Library:** Which specific component library do you mean?
   - shadcn/ui (modern, customizable)
   - MUI Base (Material Design base components)
   - Radix UI (unstyled, accessible primitives)
   - Chakra UI (modern, composable)
   - Other?

2. **Game Logic:** Does game logic already exist?
   - Should we start from scratch?
   - Or integrate with existing among-us-ai code?

3. **Game State Visualization:**
   - What visual representation do you want?
   - Map view with player positions?
   - Simple player status list?
   - Something else?

---

## Next Steps

1. Get clarification on Base UI library
2. Get clarity on existing game code
3. Initialize project structure
4. Start implementation following plan
