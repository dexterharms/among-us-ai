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

#### Tick System

**Global Tick Timer:**
- Currently 5 seconds between ticks (configurable)
- Future target: 2 seconds (1 second possible for faster-paced games)
- Action timeout: 30 seconds (if player doesn't respond, marked as idle again)

**Tick Loop (per tick):**
1. Send `ACTION_PROMPT` to all non-waiting players
2. Mark prompted players as "waiting"
3. Process all queued player actions in order
4. Broadcast events to all players (SSE)

**Action Queue:**
- Stored in `GameState.actionQueue`
- Processed by `GameCoordinator` each tick
- Actions execute in order they were queued
- After execution, affected players marked as "idle" (ready for next tick)

#### Player State Machine

```
Roaming (not interacting, can move)
    ↓ (receive tick, send action)
Waiting (awaiting tick processing)
    ↓ (tick processes action)
Roaming ←────────────────────────┘
    ↓ (start task interaction)
Interacting (in task progress)
    ↓ (receive task prompt, send action)
Waiting
    ↓ (tick processes task action)
Interacting ←──────────────────┘
    ↓ (council called)
Summoned (in council, can't move)
```

**State Definitions:**
- **Roaming:** Player can move to connected rooms or start task interactions
- **Interacting:** Player is actively working on a task (receives task-specific prompts)
- **Waiting:** Player has sent an action, waiting for tick to process it
- **Summoned:** Player is in council phase (cannot move, can only vote/discuss)

**Tick Content:**
- Roaming players: Room description, occupants, exits, interactables, available actions, flavor text
- Interacting players: Task prompt, room/occupants (for sabotage awareness), available task commands
- Summoned players: Council context, voting status, discussion options

**Timeout Handling:**
- 30 seconds after receiving a tick, if no action submitted → player marked as "idle"
- Next tick reaches them normally (no penalty for missing a tick)
- Prevents stalled players from blocking game flow

#### Action Payload Formats

**Movement:**
```typescript
POST /api/game/move
{
  direction: "north" | "south" | "east" | "west"  // Exit direction
}
```

**Task Interactions:**
```typescript
POST /api/game/task
{
  action: "start" | "submit" | "quit",
  taskId: string,
  payload?: any  // Task-specific data (guess, sequence, etc.)
}
```

**Kill (Imposter Only):**
```typescript
POST /api/game/kill
{
  targetPlayerId: string
}
```

**Vent (Imposter Only):**
```typescript
POST /api/game/vent
{
  targetRoomId: string  // Destination room
}
```

**Sabotage (Imposter Only):**
```typescript
POST /api/game/sabotage
{
  type: "lights" | "doors" | "self-destruct",
  target?: string  // Room-specific for doors
}
```

**Vote (Council Only):**
```typescript
POST /api/game/vote
{
  targetPlayerId: string | null  // null = skip vote
}
```

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

**Task Interaction Flow:**
1. Player (roaming) sends `POST /api/game/task { action: "start", taskId: "..." }`
2. Action queued → Tick processes → Player state: "roaming" → "interacting"
3. Next tick: Task prompt + room/occupants (for sabotage awareness) + command options
4. Player sends task action (e.g., guess a number) → queued → tick processes
5. Task updates, sends new prompt OR completion confirmation
6. Player sends `{ action: "quit" }` to abandon task (resets progress for some tasks)
7. On completion: Player state returns to "roaming"

**Sabotage During Tasks:**
- Crewmates on tasks are forced to quit
- Next tick includes sabotage flavor text and exit reminders
- Some tasks reset progress on quit (hold button), others don't (sequence repetition)

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

---

## Task Definitions

All tasks are designed for the tick/ping system — each action requires one tick to process.

### 1. Sequence Repetition
**Type:** Memory
**Description:**
- Player is shown a sequence of 5-10 items (numbers, colors, or words)
- Must submit the sequence one item at a time in correct order
- On error: "Incorrect. Here's the correct sequence: X X X X X. Try again from the beginning."

**API:**
```typescript
POST /api/game/task { action: "submit", taskId: "sequence-repetition", value: string }
```

**Variants:** Numbers (0-9), Colors (red/blue/green/yellow), Words (random words)

---

### 2. Word-Based Math Puzzle
**Type:** Logic
**Description:**
- Math problem with random values/objects/situations swapped (prevents memorization)
- Easy/medium/hard tiers, randomly assigned
- On error: problem is restated (keeps player engaged, not just guessing)

**API:**
```typescript
POST /api/game/task { action: "submit", taskId: "word-math", answer: number }
```

**Examples:**
- Easy: "If you have 3 apples and get 2 more, how many do you have?"
- Medium: "The reactor uses 5 fuel per hour. You have 20 fuel. How many hours?"
- Hard: "Cafeteria has 8 tables. 2 break. You add 4 new ones. How many total?"

---

### 3. Sliding Tile Puzzle
**Type:** Spatial/Logic
**Description:**
- 4x3 grid (12 tiles total): numbers 0-10 + one empty space
- Goal: Arrange tiles in order (0, 1, 2, 3...), empty space anywhere
- Player may only slide one adjacent tile into the empty space per action
- Puzzle is solvable in 5-20 moves (task-load tuning)
- Represented with ASCII art in task prompts

**Shuffle Method:**
- Start from completed state
- Make 5-20 random valid moves
- Simplify all cycles before counting moves (e.g., sequences like `left right`, or `up up down down`, or `up right down left` are REMOVED from the full sequence by identifying tile-position pairs and deleting the actions between identical pairs EG: `left right` means tile 8-C moves `left` to 8-B then `right` to 8-C again -> the identical tile-position pairs (8-C) make a loop -> the intermediate actions (`left right` that move the tile-position from 8-C to 8-C can be removed)

**API:**
```typescript
POST /api/game/task { action: "slide", taskId: "sliding-tile", tile: number }
```

**ASCII Representation:**
```
 _____ _____ _____ _____
|  0  |  1  |  2  |  3  |
|_____|_____|_____|_____|
|  4  |  5  |  6  |  7  |
|_____|_____|_____|_____|
|  8  |  9  | 10  |     |
|_____|_____|_____|_____|
```

---

### 4. Battleship
**Type:** Spatial/Deduction
**Description:**
- 12x12, 10x10, or 8x8 grid (subject to task-rules tuning) with randomly placed boats of various sizes
- Player guesses coordinates (e.g., "A5", "G8")
- Told if hit or miss
- Goal: Sink 1-3 vessels (subject to task-load tuning)

**API:**
```typescript
POST /api/game/task { action: "guess", taskId: "battleship", coordinate: string }
```

---

### 5. Hot-n-Cold
**Type:** Deduction
**Description:**
- Random target number between 0-100
- Player starts with a random current number
- Told if current number is less-than or greater-than target
- Player enters a number to ADD or SUBTRACT from current number
- New number described as less-than or greater-than target
- Game ends when target is reached
- Not very tunable unless we have multiple games to do.

**API:**
```typescript
POST /api/game/task { action: "adjust", taskId: "hot-n-cold", delta: number }
```

---

### 6. Hold The Button
**Type:** Nerve/Tension
**Description:**
- Player presses button to start (state: "holding")
- Progress bar increases each tick while holding
- Room alerts still reach player (other movements, bodies found, etc.)
- Player must decide: continue holding or quit
- Stopping resets progress
- Success if button held for full duration
- N ticks to hold is subject to task-load tuning
- N ticks to hold is CONSTANT. The player's LLM speed doesn't determine the max number of ticks. EG: If there are 5 ticks to clear at 5s/t, and the player's LLM returns after 8s, then the ticks will look like this: tick (0%), skipped (20%, unannounced to the player), tick (40%), skipped (60%, unannounced), tick (80%), skipped (100%), tick (100%). Here the player's LLM speed *did* matter as it meant they had to wait an extra tick. But generally, speaking, you won't have to wait 5*8s ticks, it's still 5*5s OR 6*5s (possible 1 tick error). Slower LLMs would be even longer.


**API:**
```typescript
POST /api/game/task { action: "start" | "quit", taskId: "hold-button" }
```

**Tension Factor:** Not a puzzle — a test of nerve. Player is vulnerable while holding.

---

### 7. Code Breaker
**Type:** Deduction
**Description:**
- Guess a 4-digit secret code (digits 0-9)
- After each guess, feedback:
  - X correct position
  - Y correct value but wrong position
- Deduction and elimination

**API:**
```typescript
POST /api/game/task { action: "guess", taskId: "code-breaker", code: string }
```

---

### 8. Transfer Fuel
**Type:** Logic
**Description:**
- Two containers (e.g., 5L and 3L), unlimited water source
- Goal: Measure exactly 4L into the 5L container
- Actions: Fill, Pour, Empty (per container)
- Predictable interaction count (stable for workload tuning)

**API:**
```typescript
POST /api/game/task { action: "fill" | "pour" | "empty", taskId: "fuel-transfer", container: number }
```

**Variants:**
- Different container sizes (3L/5L, 4L/7L, etc.)
- Different target amounts (2L, 3L, 4L)

---

## Task Selection & Workload

**Workload Tuning:**
- Each task assigned a "difficulty" score (estimated tick count)
- Player task load = sum of difficulty scores for assigned tasks
- Harder tasks (sliding tile, battleship) may sink fewer ships to balance
- Easy tasks (hot-n-cold, hold button) may have higher completion requirements
- Some tasks are not task-load tunable. 

**Task Assignment:**
- Map defines task pool per room
- Each player receives random subset (e.g., 3-5 tasks total)
- Task difficulty balanced across map for fair play

---

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
- [x] Task type definitions (23 tasks for The Skeld)
- [x] Action logging

### 🔄 In Progress
- [ ] React web UI for visualization
- [ ] Dark/light theme toggle

### 📋 Planned (MVP Remaining)
- [x] **Tick/ping system architecture** (designed, needs implementation)
- [x] **Task definitions** (8 tasks designed, needs implementation)
- [ ] Tick loop with action queue processing
- [ ] Player state machine (Roaming/Interacting/Waiting/Summoned)
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

## Task Implementation Status (8 Designed Tasks)

**Designed & Specified:**
- [x] Sequence Repetition — Memory task
- [x] Word-Based Math Puzzle — Logic task (3 tiers)
- [x] Sliding Tile Puzzle — Spatial task (4x3 grid)
- [x] Battleship — Deduction task (grid hunting)
- [x] Hot-n-Cold — Deduction task (binary search)
- [x] Hold The Button — Tension task (nerve test)
- [x] Code Breaker — Deduction task (Mastermind variant)
- [x] Transfer Fuel — Logic task (pouring puzzle)

**Needs Implementation:**
- [ ] Task classes for each of the 8 tasks
- [ ] Task state persistence per player
- [ ] Task interruption handling (sabotage)
- [ ] Task completion validation
- [ ] Task difficulty scoring (for workload balancing)

---

## Technical Architecture

```
among-us-ai/
├── src/
│   ├── server/
│   │   └── index.ts          # Bun server, REST endpoints, SSE handler
│   ├── game/
│   │   ├── state.ts          # GameState class, phase management, actionQueue
│   │   ├── coordinator.ts    # GameCoordinator, tick loop, action processing
│   │   ├── rooms.ts          # RoomManager, room data and movement
│   │   ├── tasks.ts          # TaskManager, task completion and win check
│   │   ├── voting.ts         # VotingSystem, council and ejection
│   │   └── imposter.ts       # ImposterAbilities, kill and sabotage
│   ├── tick/
│   │   ├── queue.ts          # ActionQueue management
│   │   └── processor.ts      # Tick loop and action execution
│   ├── lobby/
│   │   └── manager.ts        # LobbyManager, player joining and countdown
│   ├── sse/
│   │   └── manager.ts        # SSEManager, real-time event streaming
│   ├── actions/
│   │   └── logger.ts         # ActionLogger, game history
│   ├── tasks/
│   │   ├── types.ts          # Task type definitions
│   │   ├── definitions/      # Task implementations (sequence, math, etc.)
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
│   ├── tasks/                # Task implementation tests
│   └── framework/            # Test utilities
├── docs/
│   ├── notes/                # Reference notes (Among Us rules, libraries)
│   └── plans/                # Planning documents (this file)
└── package.json
```

**Action Queue:**
- Stored in `GameState.actionQueue`
- Processed by `GameCoordinator` each tick
- Structure: `{ playerId, action, timestamp, payload }`
- Actions executed in order of submission

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

### Tick System
1. **Tick timing:** Currently 5s, target 2s. Is 1s too fast for AI agents?
2. **Action timeout:** 30s to respond. Is this too generous?
3. **Queue processing order:** Should actions process in submission order, or should priority be given to certain actions (e.g., kill)?

### Tasks
4. **Task difficulty scoring:** How to assign difficulty scores (tick estimates) to each task for workload balancing?
5. **Sliding tile shuffle:** 5-20 moves. Is this range wide enough for meaningful difficulty variance?
6. **Battleship grid size:** 8x8 vs 10x10 vs 12x12. Which should be default?
7. **Hold button duration:** How long should the button need to be held? 15s? 30s? 60s?

### General
8. **Sabotage cooldown:** Is 60s good? Different per type?
9. **Delayed information timing:** 2-5 ticks = 10-25 seconds. Is that right?
10. **Logs content:** What counts as "key actions" vs "everything"?
11. **Production maps:** Need to design 2 maps with unique characteristics

---

*This plan is the source of truth for among-us-ai development. Update it as decisions change.*
