# Among Us AI — Master Plan

**Created:** 2026-02-11
**Status:** Active
**Project:** `~/.dexter/projects/among-us-ai`

---

## Overview

A text-based multiplayer social deduction game for AI agents (and humans). 4-8 players spawn on a map, complete tasks, and try to identify the imposters among them before being eliminated.

**Core Constraint:** No 2D planar movement. Players exist "in a room" or "out of a room." All interactions are text-based via REST API and SSE streaming.

---

## Game Flow

### 1. Lobby Phase

**Start Conditions:**
- First-come-first-serve lobby
- Minimum 4 players, maximum 8 players
- 45-second timer starts when 4th player joins
- If 8 players join, game starts immediately (no timer)

**Player Actions:**
- `POST /api/lobby/join` — Join lobby with player name
- `POST /api/lobby/leave` — Leave lobby

**Events:**
- `PLAYER_JOINED_LOBBY` — Broadcast when player joins
- `PLAYER_LEFT_LOBBY` — Broadcast when player leaves
- `LOBBY_STATE` — Current player list

**No Ready Check:** Joining the lobby is implicitly "ready." AI players don't need to confirm readiness.

### 2. Game Start

**Role Assignment:**
- 7-8 players: **2 Imposters**
- 4-6 players: **1 Imposter**
- Roles assigned randomly
- `ROLE_REVEALED` event sent privately to each player

**Spawn:**
- All players spawn in random rooms
- Each player assigned random subset of tasks from map's task pool

**Phase Transition:**
- `GAME_STARTED` event broadcast with player count and imposter count
- `ROUND_STARTED` event broadcast
- Game enters Round phase

### 3. Round Phase

**Tick System:**
- Global 5-second tick
- Each tick sends `ACTION_PROMPT` to all non-waiting players
- Prompt includes: current phase, round timer, location, room occupants, exits, available actions, flavor text

**Player States:**
- **Idle:** Receives ticks normally
- **Waiting:** Sent a tick, awaiting response
- **Reading:** In logs room, receiving chat history instead of normal prompts

**Timeout:**
- 30 seconds to respond after receiving a tick
- After timeout, player marked as idle again (no penalty)
- Next tick will reach them

**Room Visibility:**
Players see:
- Room name and description (with flavor text)
- All interactables in room (tasks, button, logs, vents)
- All players currently in room (by name)
- All exits (connected rooms)
- Any dead bodies in room

**Delayed Information (Ambiguity):**
When a player enters/leaves a room:
- First 2-5 ticks: "You hear footsteps from the east" / "Footsteps fading to the west"
- After delay: "Player A has entered from the east" / "Player A has left to the west"
- This restores ambiguity lost by dropping 2D planar movement

**Player Actions:**
- `POST /api/game/move` — Move to connected room
- `POST /api/game/task` — Attempt task at current location
- `POST /api/game/kill` — (Imposters only) Kill player in same room
- `POST /api/game/vent` — (Imposters only) Travel through vent to connected vent
- `POST /api/game/sabotage` — (Imposters only) Trigger sabotage
- `POST /api/game/report` — Report dead body in room
- `POST /api/game/button` — Press emergency meeting button (council room only)

### 4. Council Phase

**Triggers:**
1. Dead body reported (`POST /api/game/report`)
2. Emergency button pressed (`POST /api/game/button`)

**Emergency Button Restrictions:**
- Located in council room
- 20-second warm-up at round start before button becomes active
- Once per game per player

**Council Flow:**
- `COUNCIL_CALLED` event broadcast with caller ID and reason
- All players moved to council room
- Discussion phase (no time limit, driven by player conversation)
- Voting phase begins when players cast votes

**Voting:**
- `POST /api/game/vote` — Cast vote for player ID or null (skip)
- Only alive players can vote
- Each player votes once per council
- 2-minute timeout from council start
- `VOTE_CAST` event broadcast after each vote

**Ejection:**
- Plurality wins (most votes, not majority)
- Ties result in no ejection
- `PLAYER_EJECTED` event broadcast with player ID and role
- If tie: `playerId: null, tie: true`

**Win Check:**
- After ejection, check if game should end (see Win Conditions)

### 5. Tasks

**Task Assignment:**
- Each player assigned random subset of tasks from map's task pool
- Tasks are interactable objects in rooms
- Task completion updates player's individual progress
- Task progress is NOT announced (no "Player A completed task" logs)
- Imposters cannot complete tasks (but can pretend — see Fake Tasks)

**Ghost Tasks:**
- Dead players (ghosts) MUST continue completing tasks
- Ghosts cannot interact in council (no voting, no discussion)
- Ghosts must wait for council to complete before resuming tasks
- Ghost task progress counts toward crewmate win condition

**Fake Tasks (Imposters):**
- Imposters cannot actually complete tasks
- No logs announce task progress
- Players cannot prove they're crewmate by performing tasks
- The opposite is also true: not performing tasks doesn't prove imposter

**Task Win Condition:**
- When all LIVING crewmates complete all their tasks, crewmates win
- Dead crewmates' tasks do NOT count (only living)

### 6. Sabotage

**Imposter-Only Action:**
- `POST /api/game/sabotage` — Trigger sabotage
- Cooldown: ~60 seconds (may vary by type)

**Sabotage Types:**

| Type | Effect | Fix Method |
|------|--------|------------|
| **Lights Out** | Room visibility lost, only exits visible | 4 global light switches (flip-switch-1, flip-switch-2, etc.) |
| **Doors** | Exits require 2-digit code entry | Enter code one digit at a time |
| **Self-Destruct** | Global timer starts | At least one crewmate presses stop button |

**Lights Out Details:**
- 4 global light switches
- Each switch flips the state at that position
- Two players flipping same switch simultaneously = no change (cancels out)
- Flavor text alerts players: "The lights flicker and die"
- Exits still visible (like exit signs)

**Sabotage During Tasks:**
- Crewmates on tasks are forced to quit
- Next tick includes sabotage flavor text and exit reminders

### 7. Vents

**Imposter-Only Transportation:**
- Vents are interactables in specific rooms
- Vent network connects certain rooms
- Imposters can instantly travel between connected vents
- **NOT visible to crewmates** (currently, may change later)

### 8. Kills

**Imposter-Only Action:**
- `POST /api/game/kill` — Kill player in same room
- Requires: Imposter role, alive status, same room as target, not on cooldown

**Kill Cooldown:**
- 30 seconds per imposter
- Tracked individually per imposter

**Kill Effects:**
- Target status set to `DEAD`
- Dead body created at kill location
- `YOU_DIED` event sent privately to victim (includes killer ID)
- `PLAYER_KILLED` event broadcast (includes who died)
- Win condition checked immediately after kill

**Dead Bodies:**
- Remain in room until reported
- Any player in room can report via `POST /api/game/report`
- `BODY_FOUND` event broadcast with location

### 9. Win Conditions

**Crewmates Win:**
- All living crewmates complete all their tasks, OR
- All imposters are ejected

**Imposters Win:**
- Number of living imposters ≥ number of living crewmates, OR
- Sabotage critical system and crewmates fail to fix in time

**Win Check Triggers:**
- After every kill
- After every ejection
- After task completion

**Game End:**
- `GAME_ENDED` event broadcast with winner and reason
- Phase set to `GAME_OVER`
- `GAME_OVER_SUMMARY` event broadcast

---

## Crew Advantages

### Logs Room

**Interactable Logs:**
- Located in a predetermined room on each map
- Players can interact to enter "reading" state
- While reading, pings send chat/action logs since last ping
- Logs are NOT complete — only key actions, not everything

**Logs Content:**
- Player movements (with delay/ambiguity)
- Bodies found
- Council calls
- Ejections
- NOT: task progress, kill attempts, sabotage triggers

**Use Case:**
- Players can keep logs and reference them in council
- "At 2:34 you said you were in electrical, but the logs show you entered from storage!"

---

## Flavor Text

**Room Descriptions:**
- Each room has atmospheric description
- Updates based on game state (bloodstains after kill, flickering lights during sabotage, etc.)

**Examples:**
- "The electrical room hums with power. Cables snake along the walls."
- "Something feels wrong here. There's a stain on the floor that wasn't here before."
- "The emergency lights cast everything in a dim red glow. Exit signs glow above the doorways."

**Purpose:**
- Immersion
- Subtle clues (bloodstains indicate recent death nearby)
- Ambiance

---

## Maps

**Static Layouts:**
- Maps are predefined, not randomized
- Each map has: rooms, exits, interactables, vent network

**Currently Implemented:**
- `map0` — Test map (basic layout for development)

**Planned:**
- 2 production maps (simpler than real Among Us maps, but inspired by them)
- Each map has unique sabotage locations
- Each map has unique crew advantages (logs room location, etc.)

**Map Contents:**
- Rooms with positions (for adjacency, not 2D movement)
- Exits (connections between rooms)
- Interactables:
  - Tasks (specific to map)
  - Emergency button (council room only)
  - Logs terminal (logs room only)
  - Vents (imposter-only, specific rooms)
  - Sabotage fix points (specific to sabotage type)

---

## API Endpoints

### Lobby
- `POST /api/lobby/join` — Join lobby
- `POST /api/lobby/leave` — Leave lobby
- `GET /api/lobby/state` — Get current lobby state

### Game
- `POST /api/game/start` — Start game (automatic after lobby timer)
- `POST /api/game/move` — Move to connected room
- `POST /api/game/task` — Attempt task
- `POST /api/game/kill` — (Imposters) Kill player
- `POST /api/game/vent` — (Imposters) Travel through vent
- `POST /api/game/sabotage` — (Imposters) Trigger sabotage
- `POST /api/game/report` — Report dead body
- `POST /api/game/button` — Press emergency button
- `POST /api/game/vote` — Cast vote in council
- `GET /api/game/state` — Get current game state

### Streaming
- `GET /api/stream/actions` — SSE stream for real-time events

### Utility
- `GET /health` — Health check
- `GET /api/actions` — Get action history
- `GET /api/actions/recent` — Get recent actions
- `GET /api/actions/since` — Get actions since timestamp

---

## SSE Events

### Lobby Events
- `PLAYER_JOINED_LOBBY`
- `PLAYER_LEFT_LOBBY`
- `LOBBY_STATE`

### Game Events
- `GAME_STARTED`
- `ROUND_STARTED`
- `ROLE_REVEALED` (private)
- `ACTION_PROMPT` (tick)
- `PLAYER_MOVED`
- `PLAYER_KILLED`
- `YOU_DIED` (private)
- `BODY_FOUND`
- `COUNCIL_CALLED`
- `VOTE_CAST`
- `PLAYER_EJECTED`
- `TASK_COMPLETED`
- `GAME_ENDED`
- `GAME_OVER_SUMMARY`

---

## Out of Scope

These are explicitly NOT being implemented:

- **Special roles** (Engineer, Scientist, Shapeshifter, etc.)
- **Complex tasks** (only simple puzzles/tediums)
- **2D planar movement** (players are in/out of rooms, not coordinates)
- **Complex traversal** (moving platforms, ladders, etc.)
- **Animation confirmation** (no visual task progress)
- **Visual tasks** (no way to prove crewmate via task)
- **Special game modes** (Hide & Seek, etc.)
- **Game settings configuration** (hardcoded for MVP)
- **Ghost haunting** (complex, post-MVP)

---

## Implementation Status

### ✅ Completed (MVP Core)
- [x] REST API for game actions
- [x] SSE streaming for real-time events
- [x] Lobby system (join/leave)
- [x] Game phase transitions
- [x] Role assignment
- [x] Room navigation
- [x] Kill mechanics with cooldown
- [x] Win condition detection
- [x] Voting system with timeout
- [x] Player ejection
- [x] Task system with win condition (living crewmates only)
- [x] Action logging

### 🔄 In Progress
- [ ] React web UI for visualization
- [ ] Dark/light theme toggle

### 📋 Planned (MVP Remaining)
- [ ] Tick/ping system with waiting state
- [ ] Delayed information (footsteps ambiguity)
- [ ] Sabotage system (lights, doors, self-destruct)
- [ ] Vent network
- [ ] Emergency button (20s warm-up, once per game)
- [ ] Ghost task continuation
- [ ] Logs room advantage
- [ ] Flavor text system
- [ ] Production maps (2 maps)

### 📅 Post-MVP
- [ ] Ghost haunting
- [ ] More sabotage types
- [ ] More maps
- [ ] Game settings
- [ ] Vent visibility for crewmates (maybe)

---

## Technical Architecture

```
among-us-ai/
├── src/
│   ├── server/
│   │   └── index.ts          # Bun server, REST endpoints, SSE handler
│   ├── game/
│   │   ├── state.ts          # GameState class, phase management
│   │   ├── coordinator.ts    # GameCoordinator, game flow orchestration
│   │   ├── rooms.ts          # RoomManager, room data and movement
│   │   ├── tasks.ts          # TaskManager, task completion and win check
│   │   ├── voting.ts         # VotingSystem, council and ejection
│   │   └── imposter.ts       # ImposterAbilities, kill and sabotage
│   ├── lobby/
│   │   └── manager.ts        # LobbyManager, player joining and countdown
│   ├── sse/
│   │   └── manager.ts        # SSEManager, real-time event streaming
│   ├── actions/
│   │   └── logger.ts         # ActionLogger, game history
│   ├── tasks/
│   │   ├── types.ts          # Task type definitions
│   │   ├── definitions/      # Per-map task definitions
│   │   └── index.ts          # Task registry
│   └── types/
│       └── game.ts           # All Zod schemas and TypeScript types
├── web/                      # React UI (separate Vite project)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   └── vite.config.ts
├── tests/
│   ├── game/                 # Game logic tests
│   ├── lobby/                # Lobby tests
│   └── framework/            # Test utilities
├── docs/
│   ├── notes/                # Reference notes (Among Us rules, libraries)
│   └── plans/                # Planning documents (this file)
└── package.json
```

---

## Testing Strategy

- **Unit Tests:** All game logic (tasks, voting, kills, movement, win conditions)
- **Integration Tests:** API endpoints, SSE streaming
- **E2E Tests:** Full game flow from lobby to game end

**Current Coverage:**
- ✅ Task system (15 tests)
- ✅ Room navigation (23 tests)
- ✅ Voting system
- ✅ Kill mechanics
- ✅ Win conditions

---

## Questions / Open Items

1. **Sabotage cooldown:** Is 60s good? Different per type?
2. **Delayed information timing:** 2-5 ticks = 10-25 seconds. Is that right?
3. **Logs content:** What counts as "key actions" vs "everything"?
4. **Production maps:** Need to design 2 maps with unique characteristics

---

*This plan is the source of truth for among-us-ai development. Update it as decisions change.*
