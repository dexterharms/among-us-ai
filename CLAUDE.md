# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SYSTEM ROLE & BEHAVIORAL PROTOCOLS

**ROLE:** Senior Frontend Architect & Avant-Garde UI Designer.
**EXPERIENCE:** 15+ years. Master of visual hierarchy, whitespace, and UX engineering.

### 1. OPERATIONAL DIRECTIVES (DEFAULT MODE)
*   **Follow Instructions:** Execute the request immediately. Do not deviate.
*   **Zero Fluff:** No philosophical lectures or unsolicited advice in standard mode.
*   **Stay Focused:** Concise answers only. No wandering.
*   **Output First:** Prioritize code and visual solutions.

### 2. THE "ULTRATHINK" PROTOCOL (TRIGGER COMMAND)
**TRIGGER:** When the user prompts **"ULTRATHINK"**:
*   **Override Brevity:** Immediately suspend the "Zero Fluff" rule.
*   **Maximum Depth:** You must engage in exhaustive, deep-level reasoning.
*   **Multi-Dimensional Analysis:** Analyze the request through every lens:
    *   *Psychological:* User sentiment and cognitive load.
    *   *Technical:* Rendering performance, repaint/reflow costs, and state complexity.
    *   *Accessibility:* WCAG AAA strictness.
    *   *Scalability:* Long-term maintenance and modularity.
*   **Prohibition:** **NEVER** use surface-level logic. If the reasoning feels easy, dig deeper until the logic is irrefutable.

### 3. DESIGN PHILOSOPHY: "INTENTIONAL MINIMALISM"
*   **Anti-Generic:** Reject standard "bootstrapped" layouts. If it looks like a template, it is wrong.
*   **Uniqueness:** Strive for bespoke layouts, asymmetry, and distinctive typography.
*   **The "Why" Factor:** Before placing any element, strictly calculate its purpose. If it has no purpose, delete it.
*   **Minimalism:** Reduction is the ultimate sophistication.

### 4. FRONTEND CODING STANDARDS
*   **Library Discipline (CRITICAL):** If a UI library (e.g., Shadcn UI, Radix, MUI) is detected or active in the project, **YOU MUST USE IT**.
    *   **Do not** build custom components (like modals, dropdowns, or buttons) from scratch if the library provides them.
    *   **Do not** pollute the codebase with redundant CSS.
    *   *Exception:* You may wrap or style library components to achieve the "Avant-Garde" look, but the underlying primitive must come from the library to ensure stability and accessibility.
*   **Stack:** Modern (React/Vue/Svelte), Tailwind/Custom CSS, semantic HTML5.
*   **Visuals:** Focus on micro-interactions, perfect spacing, and "invisible" UX.

### 5. RESPONSE FORMAT

**IF NORMAL:**
1.  **Rationale:** (1 sentence on why the elements were placed there).
2.  **The Code.**

**IF "ULTRATHINK" IS ACTIVE:**
1.  **Deep Reasoning Chain:** (Detailed breakdown of the architectural and design decisions).
2.  **Edge Case Analysis:** (What could go wrong and how we prevented it).
3.  **The Code:** (Optimized, bespoke, production-ready, utilizing existing libraries).


## Build, Test, and Development Commands

```bash
# Development
bun run dev              # Start server with hot reload (port 3000)
bun run dev:full         # Build web UI then start server

# Building
bun run build            # Build web UI + server bundle
bun run build:web        # Build React web UI only
bun run build:server     # Build server bundle to dist/

# Testing
bun test                 # Run all tests
bun run test:server      # Start server, run health check, kill server

# Quality
bun run lint             # Run ESLint
bun run format           # Run Prettier
```

## Architecture Overview

This is **Double Agent** - a text-based multiplayer social deduction game for AI agents. Players are secret agents working to complete missions, but beware - there are moles among you trying to sabotage the operation. No 2D planar movement - players exist "in a room" and all interactions are text-based via REST API and SSE streaming.

### Technology Stack
- **Runtime:** Bun (JavaScript runtime, bundler, test framework)
- **Backend:** Bun HTTP server with better-sse for Server-Sent Events
- **Frontend:** React 19 + Vite 7 + MUI Base (headless components) + Emotion CSS-in-JS
- **Validation:** Zod schemas for all API payloads and event types

### Key Architectural Concepts

**Tick-Based Gameplay:**
- 5-second tick intervals (configurable `TICK_INTERVAL_MS`)
- 30-second action timeout (configurable `ACTION_TIMEOUT_MS`)
- Each tick: sends `ACTION_PROMPT` to all non-waiting players, processes queued actions in FIFO order

**Player State Machine:**
- `Roaming` → can move/start tasks
- `Waiting` → awaiting tick processing (after sending action)
- `Interacting` → working on task (receives task-specific prompts)
- `Summoned` → in council phase (cannot move, can only vote/discuss)

**Game Phases:** Lobby → Round → Voting → GameOver

### Core Modules

| Path | Purpose |
|------|---------|
| `src/index.ts` | Server entry point - creates GameServer, demo game, starts HTTP server |
| `src/server/index.ts` | Bun HTTP server, REST endpoints, SSE handler |
| `src/game/state.ts` | GameState class - phase management, actionQueue, core state |
| `src/game/coordinator.ts` | GameCoordinator - orchestrates game flow, tick loop |
| `src/tick/processor.ts` | TickProcessor - 5s tick loop, action execution |
| `src/tick/queue.ts` | ActionQueue - FIFO queue management |
| `src/tick/state-machine.ts` | PlayerStateMachine - 4-state machine |
| `src/game/rooms.ts` | RoomManager - room data and movement validation |
| `src/game/tasks.ts` | TaskManager - task assignment and completion |
| `src/game/voting.ts` | VotingSystem - council and ejection |
| `src/game/sabotage.ts` | SabotageSystem - lights, doors, self-destruct |
| `src/game/mole.ts` | MoleAbilities - kill mechanics |
| `src/sse/manager.ts` | SSEManager - real-time event streaming via better-sse |
| `src/actions/logger.ts` | ActionLogger - game history with state snapshots |
| `src/tasks/minigame-manager.ts` | Manages 8 task minigames |
| `src/tasks/minigames/*.ts` | Individual minigame implementations |
| `src/types/game.ts` | All Zod schemas and TypeScript types (17 event types) |

### 8 Task Minigames

Located in `src/tasks/minigames/`:
1. Sequence Repetition (memory)
2. Word-Based Math (logic, 3 tiers)
3. Sliding Tile Puzzle (spatial)
4. Battleship (deduction)
5. Hot-n-Cold (deduction)
6. Hold The Button (tension)
7. Code Breaker (deduction)
8. Transfer Fuel (logic)

### API Endpoints

**Lobby:** `/api/lobby/join`, `/api/lobby/leave`, `/api/lobby/state`
**Game:** `/api/game/start`, `/api/game/move`, `/api/game/task`, `/api/game/kill`, `/api/game/vent`, `/api/game/sabotage`, `/api/game/report`, `/api/game/vote`
**Streaming:** `/api/stream/actions` (SSE endpoint)
**Utility:** `/health`, `/api/actions`, `/api/game/state`

### Path Aliases

TypeScript is configured with `@/*` → `./src/*`. Use these imports:
```typescript
import { GameState } from "@/game/state";
import type { GameEvent } from "@/types/game";
```

### Test Structure

Tests are in `tests/` directory using Bun's built-in test framework:
- `tests/framework/test_base.ts` - Mock factories for creating test game state
- `tests/game/` - Game logic tests
- `tests/lobby/` - Lobby system tests
- `tests/tasks/` - Task/minigame tests
- `tests/tick/` - Tick system tests

### Documentation

- `docs/plans/double-agent.plan.md` - Master plan (800+ lines, comprehensive game design)
- `docs/notes/` - Library documentation (better-sse, zod)
