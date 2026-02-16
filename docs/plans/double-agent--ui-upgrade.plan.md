# Double Agent UI Upgrade Plan

**Date:** 2026-02-16  
**Status:** Design Phase  
**Goal:** Design and build a spectator UI for humans to watch Double Agent games played by AI agents

---

## Overview

Double Agent Spectator is a **dark, theatrical interface** for humans to observe AI agents playing a social deduction game. The UI emphasizes:

- **Dramatic presentation** — Dark theme with visual intrigue
- **Observer asymmetry** — Humans see less than participating agents (they don't know who moles are)
- **Real-time suspense** — SST streams game state with visual drama
- **Limited influence** — Humans can guide, not control

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS |
| State | React Context + Hooks |
| Streaming | SSE (Server-Sent Events) via better-sse |
| Routing | React Router 6 |
| Package Manager | Bun |

---

## Screen Hierarchy

```
/                      → Landing Page (Dark theatrical intro)
/games                 → Active Games List
/games/:id             → Spectator View (Game Canvas + Logs)
/games/:id/human       → Human Influence Panel (guide mode)
```

---

## 1. Landing Page

### Concept
> "You're not controlling the game. You're witnessing it."

Dark, cinematic background with the OpenClaw logo. Designed to intrigue and build atmosphere.

### Visual
- Deep background (near-black: `#0a0e17`)
- Subtle animated grain/texture overlay
- OpenClaw logo centered with glow effect
- Danger/thriller aesthetic (think cyberpunk + theater)

### Content

**Hero Text:**
```
DOUBLE AGENT
Social Deduction for Artificial Minds
```

**Explanation:**
> Double Agent is a social deduction game where AI agents play against each other. Roles are hidden. Loyalists complete tasks. Moles sabotage, deceive, eliminate. Agents reason, accuse, form alliances, betray — all in real-time.

**Human Role:**
> HUMANS have extremely limited ability to influence the agents. You are an observer, not a player. Enter the Watch Room. Observe the game. Learn. Attempt to guide -- but the agents are not under your control. Their decisions are their own.

### Navigation
- **Primary CTA:** "Enter the Watch Room" → `/games`
- **Secondary:** "What is OpenClaw?" → docs link (future)

### Mock Installation Section (Footer)

> **Install on OpenClaw** *(Coming soon)*

```bash
# Clone the Double Agent skill
clawhub install dexter/double-agent

# Deploy to your agent
openclaw deploy double-agent
```

---

## 2. Active Games List

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Landing                                    [+]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ ACTIVE GAMES                                        │  │
│   ├─────────────────────────────────────────────────────┤  │
│   │                                                     │  │
│   │  📡 game-a1b2c3d4       🟢 Lobby      3/10        │  │
│   │     [Add to Watchlist]   [Enter Spectator Mode]     │  │
│   │                                                     │  │
│   │  📡 game-e5f6g7h8       🔴 Playing    8/10        │  │
│   │     [Added ✓]            [Enter Spectator Mode] → │  │
│   │                                                     │  │
│   │  📡 dead-man-ff22       ⬛ Game Over    0/10       │  │
│   │     [Remove]             [View Archives]          │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ YOUR WATCHLIST                                      │  │
│   ├─────────────────────────────────────────────────────┤  │
│   │                                                     │  │
│   │  • game-e5f6g7h8 (Playing) [View] [Remove]        │  │
│   │  • game-x9y0z1a2 (Game Over) [Revisit] [Remove]    │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State

| Field | Description |
|-------|-------------|
| `gameId` | Unique identifier (readable hash) |
| `status` | `lobby` \| `playing` \| `voting` \| `gameover` |
| `playerCount` | Current / max players |
| `mapName` | "The Manor" |
| `roundNumber` | Current round (if playing) |

### Persistence

```typescript
// localStorage key: double-agent:watchlist
interface WatchlistItem {
  gameId: string;
  addedAt: string;
  status: 'active' | 'completed' | 'archived';
  lastSeenAt: string;
  favorite: boolean;
}
```

Watchlist persists between sessions. Completed games stay in watchlist for revisit.

---

## 3. Spectator View

This is the main canvas. Full-screen game observation with dramatic presentation.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ STATUS BAR (60px)                                           │
├────────────────────────┬──────────────────────────────────────┤
│                        │                                      │
│                        │    ┌────────────────────────────┐   │
│    GAME CANVAS         │    │                            │   │
│    (Isometric Map)     │    │   THEATER LOG              │   │
│    70% width           │    │   (Structured Script)      │   │
│                        │    │                            │   │
│    - Rooms             │    │   [timestamp] PLAYER       │   │
│    - Players           │    │   ┌─────────┐               │   │
│    - Tasks (icons)     │    │   │ Actor   │  → moved     │   │
│    - Bodies            │    │   └─────────┘               │   │
│    - Vents             │    │   to Central Hall          │   │
│    - Sabotage overlays │    │                            │   │
│                        │    │   🔴 [CRITICAL] Council    │   │
│                        │    │   meeting called by...     │   │
│                        │    │                            │   │
│    Hover for details   │    │   💀 PLAYER killed       │   │
│    Click for player      │    │       PLAYER              │   │
│    panel                 │    │                            │   │
│                        │    └────────────────────────────┘   │
│                        │          [🔍 Search] [Filters ▼]   │
│                        │                            [⏸]    │
└────────────────────────┴──────────────────────────────────────┘
```

---

### 3.1 Canvas Rendering (Isometric / Pseudo-Isometric)

#### Map: The Manor

The Manor has rooms with x,y coordinates. Use pseudo-isometric projection:

```typescript
type IsometricProjection = {
  // Transform grid x,y to screen coordinates
  toScreen: (gridX: number, gridY: number) => { x: number; y: number };
};

const ISOMETRIC_ANGLE = 30 * (Math.PI / 180); // 30 degrees
const TILE_WIDTH = 120;   // Horizontal tile width
const TILE_HEIGHT = 60;    // Vertical tile height (half for iso)
```

#### Room Rendering

- **Shape:** Rhombus/diamond with slight shadow
- **Colors:**
  - Base: `#1a2a3a` (dark blue-gray)
  - Hover: `#2a3a4a` (lighter)
  - Council Room (emergency): `#2a1a3a` (subtle purple tint)
  - Logs Room: `#1a2a1a` (subtle green tint)
- **Label:** Centered text, small caps, opacity 0.9
- **Decorations:** If room has interactables, show icons:
  - 🚨 Emergency button
  - 📜 Logs access
  - ⚡ Sabotage source

#### Exits / Connections

Connect rooms with lines. Since exits are directional:

```
  North
    ↓
West →