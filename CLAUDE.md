# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
