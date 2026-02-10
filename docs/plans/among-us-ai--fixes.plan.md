# Among Us AI - Bug Fixes Plan

**Created:** 2026-02-10
**Status:** In Progress
**Target Project:** `~/.dexter/projects/among-us-ai`

---

## Implementation Progress

**Completed:**
- ✅ Fix #1: Updated `coordinator.ts`, `imposter.ts`, `voting.ts`, `lobby/manager.ts` to accept SSEManager
- ✅ Fix #2: Updated `PlayerEjectedPayload` schema to support null playerId and optional role
- ✅ Fix #5: Added lobby events to EventType enum (PLAYER_JOINED_LOBBY, PLAYER_LEFT_LOBBY, PLAYER_READY, COUNTDOWN_STARTED, COUNTDOWN_CANCELLED, LOBBY_STATE)
- ✅ Fix #6: Updated `SSEManager.sendTo()` with proper session ID tracking (now `sendToSession()` and `sendTo(playerId)`)
- ✅ Fix #10: Added voting timeout (2 minutes) to VotingSystem with `VOTING_TIMEOUT_MS`

**In Progress:**
- 🔄 Need to update `GameState` to add `imposterCount` getter and `movePlayer()` method
- 🔄 Need to wire up `GameCoordinator`, `VotingSystem`, `ImposterAbilities` in GameServer
- 🔄 Need to create API endpoints for game actions (POST /api/...)

**Pending:**
- ⏳ Fix #8: Logger typo - code already handles both 'WARN' and 'WARNING', no change needed
- ⏳ Fix #11: Task completion win condition - deferred until puzzles implemented

---

## Overview

This plan addresses 12 bugs/issues identified during code review. Each fix includes the affected files, the problem, and the solution.

---

## Fix #1: Use Real SSE Manager

**Problem:** Mock SSE managers in `coordinator.ts`, `imposter.ts`, `voting.ts`, and `lobby/manager.ts` just console.log instead of broadcasting to clients.

**Files to Change:**
- `src/game/coordinator.ts`
- `src/game/imposter.ts`
- `src/game/voting.ts`
- `src/lobby/manager.ts`

**Solution:**
1. Add constructor parameter to accept `SSEManager` instance
2. Remove inline mock sseManager objects
3. Pass the real SSEManager from GameState when instantiating these classes
4. In `GameState`, pass `this.sseManager` to VotingSystem, ImposterAbilities, etc.

**Example:**
```typescript
// Before
export class VotingSystem {
  private sseManager = {
    broadcast: (event, data) => console.log(...)
  };
}

// After
export class VotingSystem {
  constructor(private gameState: GameState, private sseManager: SSEManager) {}
}
```

---

## Fix #2: Update PlayerEjectedPayload Schema for "none"

**Problem:** `finalizeVoting()` sends `{ playerId: 'none', role: 'none' }` for ties, but schema expects `PlayerRole`.

**Files to Change:**
- `src/types/game.ts`

**Solution:**
Update `PlayerEjectedPayload` to support null/undefined for no-ejection cases:

```typescript
export const PlayerEjectedPayload = z.object({
  playerId: z.string().nullable(),  // null for no ejection
  role: PlayerRoleSchema.nullable().optional(),  // optional when no ejection
  tie: z.boolean().optional(),
});
```

Then update the broadcast in `voting.ts`:
```typescript
this.sseManager.broadcast(EventType.PLAYER_EJECTED, {
  playerId: null,
  tie: true,
});
```

---

## Fix #3: Unify Council Phase Logic

**Problem:** Both `GameState.startCouncilPhase()` and `VotingSystem.startCouncil()` exist with overlapping logic. `VotingSystem` is never wired up.

**Files to Change:**
- `src/game/state.ts`
- `src/game/voting.ts`

**Solution:**
1. Remove `GameState.startCouncilPhase()` method
2. Add `VotingSystem` as a property of `GameState`
3. When `shouldStartCouncil()` returns true, call `this.votingSystem.startCouncil()`
4. Pass deadBodies to the voting system

```typescript
// In GameState
private votingSystem: VotingSystem;

constructor() {
  // ... existing init
  this.votingSystem = new VotingSystem(this, this.sseManager);
}

startCouncilPhase(): void {
  this.votingSystem.startCouncil(this.deadBodies);
}
```

---

## Fix #4: Implement movePlayer() Method

**Problem:** No movement system - players are spawned but can't move. `RoomManager.validateMovement()` exists but is never called.

**Files to Change:**
- `src/game/state.ts`
- `src/types/game.ts` (ensure PLAYER_MOVED event type exists)

**Solution:**
Add `movePlayer()` method to GameState:

```typescript
movePlayer(playerId: string, targetRoomId: string): boolean {
  const player = this.players.get(playerId);
  if (!player || player.status !== PlayerStatus.ALIVE) return false;
  
  const currentRoom = player.location.roomId;
  if (!this.roomManager.validateMovement(currentRoom, targetRoomId)) {
    return false;
  }
  
  const targetRoom = this.roomManager.getRoom(targetRoomId);
  if (!targetRoom) return false;
  
  player.location = {
    roomId: targetRoomId,
    x: targetRoom.position.x,
    y: targetRoom.position.y,
  };
  
  const event: GameEvent = {
    timestamp: Date.now(),
    type: EventType.PLAYER_MOVED,
    payload: { playerId, newLocation: player.location },
  };
  this.logAndBroadcast(event);
  
  return true;
}
```

---

## Fix #5: Design POST Endpoint System

**Problem:** No API for AI agents to submit actions.

**File to Create:**
- `plans/among-us-ai--api.plan.md`

**Solution:** See separate plan file for full API design.

---

## Fix #6: Fix sendTo() Usage

**Problem:** `SSEManager.sendTo()` iterates sessions but `better-sse` doesn't expose session IDs. Falls back to broadcast.

**Files to Change:**
- `src/sse/manager.ts`

**Solution:**
Two options:

**Option A: Session ID Mapping**
```typescript
export class SSEManager {
  private channel: Channel;
  private sessions: Map<string, Session> = new Map();
  
  async handleConnection(req: Request): Promise<Response> {
    return createResponse(req, (session) => {
      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, session);
      this.channel.register(session);
      
      session.on('disconnected', () => {
        this.sessions.delete(sessionId);
      });
    });
  }
  
  async sendTo(sessionId: string, event: GameEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.push(event, event.type);
    }
  }
}
```

**Option B: Remove sendTo, use broadcast only**
If per-player messaging isn't needed, document that sendTo is not supported and remove it.

---

## Fix #7: Add imposterCount Field

**Problem:** `GameStateSchema` expects `imposterCount` but class only has `getImposterCount()` method.

**Files to Change:**
- `src/game/state.ts`

**Solution:**
Add computed getter that satisfies serialization:

```typescript
// Add to GameState class
get imposterCount(): number {
  return this.getImposterCount();
}
```

Or store it as a field and update when imposters die:
```typescript
private _imposterCount: number = 0;

get imposterCount(): number {
  return this._imposterCount;
}

// Update when game starts
assignRoles(): void {
  // ... count imposters
  this._imposterCount = imposterCount;
}
```

---

## Fix #8: Fix Logger Typo

**Problem:** In `utils/logger.ts`, the case label says `case 'WARN':` but enum value is `LogLevel.WARN`, and there's a `case 'WARNING':` fallback.

**Files to Change:**
- `src/utils/logger.ts`

**Solution:**
```typescript
private parseLogLevel(level: string): LogLevel {
  switch (level) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
    case 'WARNING':  // Accept both
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    case 'NONE':
      return LogLevel.NONE;
    default:
      return LogLevel.INFO;
  }
}
```

This is actually already handled correctly. The "typo" is just that both 'WARN' and 'WARNING' are accepted, which is fine. **No change needed.**

---

## Fix #9: Fix LobbyManager Event Strings

**Problem:** LobbyManager broadcasts strings like `'playerJoined'`, `'countdownStarted'` which don't exist in `EventType` enum.

**Files to Change:**
- `src/lobby/manager.ts`
- `src/types/game.ts`

**Solution:**
Add lobby events to EventType enum:

```typescript
// In types/game.ts
export enum EventType {
  // ... existing events
  PLAYER_JOINED_LOBBY = 'PlayerJoinedLobby',
  PLAYER_LEFT_LOBBY = 'PlayerLeftLobby',
  PLAYER_READY = 'PlayerReady',
  COUNTDOWN_STARTED = 'CountdownStarted',
  COUNTDOWN_CANCELLED = 'CountdownCancelled',
  LOBBY_STATE = 'LobbyState',
}
```

Then update LobbyManager to use these:
```typescript
this.sseManager.broadcast(EventType.PLAYER_JOINED_LOBBY, { player });
```

---

## Fix #10: Add Voting Timeout (2 minutes)

**Problem:** Voting has no timeout - will wait forever if not all votes come in.

**Files to Change:**
- `src/game/voting.ts`

**Solution:**
Add timer in `startCouncil()`:

```typescript
private votingTimeout: Timer | null = null;
private readonly VOTING_TIMEOUT_MS = 120000; // 2 minutes

startCouncil(deadBodies: DeadBody[]): void {
  // ... existing logic
  
  // Start voting timeout
  if (this.votingTimeout) clearTimeout(this.votingTimeout);
  this.votingTimeout = setTimeout(() => {
    logger.warn('Voting timed out, finalizing with current votes');
    this.finalizeVoting();
  }, this.VOTING_TIMEOUT_MS);
}

finalizeVoting(decisionTargetId?: string | null): void {
  // Clear timeout
  if (this.votingTimeout) {
    clearTimeout(this.votingTimeout);
    this.votingTimeout = null;
  }
  // ... rest of logic
}
```

---

## Fix #11: Task Completion Win Condition

**Status:** Deferred - no puzzles implemented yet. Current behavior is acceptable for testing.

---

## Fix #12: Implement/Wire GameCoordinator

**Problem:** `GameCoordinator` exists but is never instantiated. It's dead code.

**Files to Change:**
- `src/index.ts`
- `src/server/index.ts`
- `src/game/coordinator.ts`

**Solution:**
Wire up GameCoordinator in the main flow:

```typescript
// In server/index.ts or index.ts
import { GameCoordinator } from '@/game/coordinator';
import { LobbyManager } from '@/lobby/manager';
import { GameState } from '@/game/state';

export class GameServer {
  private gameState: GameState;
  private lobbyManager: LobbyManager;
  private gameCoordinator: GameCoordinator;
  
  constructor(port: number = 3000) {
    this.gameState = new GameState();
    this.lobbyManager = new LobbyManager(this.gameState.getSSEManager());
    this.gameCoordinator = new GameCoordinator(this.lobbyManager, this.gameState);
  }
  
  // Use gameCoordinator.startGame() when lobby is ready
}
```

Add API endpoints to trigger coordinator actions:
- `POST /api/lobby/join` → `lobbyManager.join()`
- `POST /api/lobby/ready` → `lobbyManager.setReady()`
- `POST /api/game/start` → `gameCoordinator.startGame()`

---

## Implementation Order

Recommended order for implementing fixes:

1. **#1 - Real SSE Manager** (foundational)
2. **#7 - Add imposterCount** (quick win, needed for serialization)
3. **#2 - Fix PlayerEjectedPayload schema** (fixes type errors)
4. **#4 - Implement movePlayer()** (enables gameplay)
5. **#3 - Unify council phase** (architectural cleanup)
6. **#10 - Voting timeout** (prevents deadlocks)
7. **#9 - Fix lobby event strings** (type consistency)
8. **#6 - Fix sendTo()** (optional, depends on needs)
9. **#12 - Wire GameCoordinator** (ties everything together)
10. **#5 - Design API plan** (separate document)
11. **#8 - Logger typo** (no change needed)

---

## Testing Strategy

After each fix:
1. Run `bun test` to ensure no regressions
2. Start server with `bun run dev`
3. Connect to SSE stream and verify events
4. Test the specific fix with curl/browser

---

## Notes

- **Fix #8** (logger) doesn't actually need changes - the code handles both 'WARN' and 'WARNING' correctly.
- **Fix #11** (task win condition) is deferred until puzzles are implemented.
- **Fix #5** (API plan) should be written to `plans/among-us-ai--api.plan.md` as a separate document.
