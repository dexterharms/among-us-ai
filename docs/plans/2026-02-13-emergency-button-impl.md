# Emergency Button System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement emergency button system allowing players to call council meetings from the council room with 20-second warm-up and once-per-game usage limit.

**Architecture:** Create EmergencyButtonSystem class for validation and execution, integrate with GameState for round timing, add API endpoint for emergency calls. Move button interactable from Central Hall to Council Room.

**Tech Stack:** TypeScript, Bun test framework, Zod schemas

---

### Task 1: Add Player Schema Field

**Files:**
- Modify: `src/types/game.ts:80-89`
- Test: `tests/types/player.test.ts` (new)

**Step 1: Write the failing test**

```typescript
// tests/types/player.test.ts
import { describe, test, expect } from 'bun:test';
import { PlayerSchema } from '@/types/game';

describe('PlayerSchema', () => {
  test('should accept emergencyMeetingsUsed field', () => {
    const player = {
      id: 'p1',
      name: 'Test',
      role: 'Crewmate',
      status: 'Alive',
      location: { roomId: 'room1', x: 0, y: 0 },
      emergencyMeetingsUsed: 0,
    };
    const result = PlayerSchema.safeParse(player);
    expect(result.success).toBe(true);
  });

  test('should default emergencyMeetingsUsed to 0 when not provided', () => {
    const player = {
      id: 'p1',
      name: 'Test',
      role: 'Crewmate',
      status: 'Alive',
      location: { roomId: 'room1', x: 0, y: 0 },
    };
    const result = PlayerSchema.safeParse(player);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/types/player.test.ts`
Expected: Test file doesn't exist yet or tests fail

**Step 3: Write minimal implementation**

Add to `src/types/game.ts` in the `PlayerSchema` (around line 86):

```typescript
export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: PlayerRoleSchema,
  status: PlayerStatusSchema,
  location: PlayerLocationSchema,
  taskProgress: z.number().min(0).max(100).optional(),
  killCooldown: z.number().min(0).optional(),
  tasks: z.array(z.string()).optional(),
  emergencyMeetingsUsed: z.number().min(0).default(0), // Add this line
});
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/types/player.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/types/game.ts tests/types/player.test.ts
git commit -m "feat: Add emergencyMeetingsUsed field to Player schema"
```

---

### Task 2: Move Emergency Button to Council Room

**Files:**
- Modify: `src/game/rooms.ts:3-17`

**Step 1: Write the failing test**

```typescript
// Add to tests/game/rooms.test.ts or create new file
import { describe, test, expect } from 'bun:test';
import { RoomManager } from '@/game/rooms';

describe('RoomManager - Emergency Button', () => {
  test('emergency button should be in council-room', () => {
    const roomManager = new RoomManager();
    const councilRoom = roomManager.getRoom('council-room');
    expect(councilRoom).toBeDefined();
    expect(councilRoom?.interactables).toBeDefined();
    const button = councilRoom?.interactables.find(i => i.id === 'emergency-button');
    expect(button).toBeDefined();
    expect(button?.type).toBe('Button');
  });

  test('center room should not have emergency button', () => {
    const roomManager = new RoomManager();
    const centerRoom = roomManager.getRoom('center');
    expect(centerRoom).toBeDefined();
    const button = centerRoom?.interactables.find(i => i.id === 'emergency-button');
    expect(button).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/rooms.test.ts`
Expected: Tests fail - button is in 'center' not 'council-room'

**Step 3: Write minimal implementation**

Modify `src/game/rooms.ts`:

```typescript
// Move the emergency-button from 'center' to 'council-room'
export const ROOMS: Room[] = [
  {
    id: 'center',
    name: 'Central Hall',
    exits: ['hallway-west', 'hallway-north', 'electrical-room'],
    interactables: [], // Remove emergency-button from here
    position: { x: 0, y: 0 },
  },
  {
    id: 'hallway-west',
    name: 'West Hallway',
    exits: ['center', 'council-room'],
    interactables: [],
    position: { x: -1, y: 0 },
  },
  {
    id: 'council-room',
    name: 'Council Room',
    exits: ['hallway-west'],
    interactables: [
      {
        id: 'emergency-button',
        type: 'Button',
        name: 'Emergency Button',
        action: 'Call Council',
      },
    ],
    position: { x: -2, y: 0 },
  },
  // ... rest of rooms unchanged
];
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/rooms.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/game/rooms.ts tests/game/rooms.test.ts
git commit -m "feat: Move emergency button from Central Hall to Council Room"
```

---

### Task 3: Create EmergencyButtonSystem Class

**Files:**
- Create: `src/game/emergency-button.ts`
- Test: `tests/game/emergency-button.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/game/emergency-button.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { EmergencyButtonSystem } from '@/game/emergency-button';
import { GameState } from '@/game/state';
import { SSEManager } from '@/sse/manager';
import { PlayerRole, PlayerStatus } from '@/types/game';

describe('EmergencyButtonSystem', () => {
  let system: EmergencyButtonSystem;
  let gameState: GameState;
  let sseManager: SSEManager;

  beforeEach(() => {
    gameState = new GameState();
    sseManager = new SSEManager();
    system = new EmergencyButtonSystem(gameState, sseManager);
  });

  describe('canCallEmergency', () => {
    test('returns false if player does not exist', () => {
      const result = system.canCallEmergency('nonexistent', 'council-room', Date.now() - 30000);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });

    test('returns false if player is dead', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Dead Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.DEAD,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const result = system.canCallEmergency('p1', 'council-room', Date.now() - 30000);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not alive');
    });

    test('returns false if player not in council room', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 0, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const result = system.canCallEmergency('p1', 'center', Date.now() - 30000);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('council room');
    });

    test('returns false during warm-up period', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const roundStart = Date.now(); // Just started
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('warm-up');
    });

    test('returns false if player already used emergency meeting', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 1, // Already used
      });
      const roundStart = Date.now() - 30000; // 30s ago
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already used');
    });

    test('returns true after warm-up with unused meeting', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const roundStart = Date.now() - 21000; // 21s ago (past warm-up)
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(true);
    });
  });

  describe('callEmergency', () => {
    test('increments emergencyMeetingsUsed on success', () => {
      const player = {
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      };
      gameState.addPlayer(player);
      const roundStart = Date.now() - 21000;

      const result = system.callEmergency('p1', 'council-room', roundStart);
      expect(result.success).toBe(true);
      expect(player.emergencyMeetingsUsed).toBe(1);
    });

    test('fails validation if cannot call emergency', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const roundStart = Date.now(); // In warm-up

      const result = system.callEmergency('p1', 'council-room', roundStart);
      expect(result.success).toBe(false);
    });
  });

  describe('reset', () => {
    test('resets internal state', () => {
      system.reset();
      // No state to check yet, just verify no errors
      expect(true).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/emergency-button.test.ts`
Expected: Module not found errors

**Step 3: Write minimal implementation**

```typescript
// src/game/emergency-button.ts
import { GameState } from './state';
import { SSEManager } from '@/sse/manager';
import { PlayerStatus, EventType, GameEvent } from '@/types/game';
import { logger } from '@/utils/logger';

export class EmergencyButtonSystem {
  private readonly WARMUP_DURATION_MS = 20000; // 20 seconds
  private readonly MAX_EMERGENCY_MEETINGS_PER_PLAYER = 1;

  constructor(
    private gameState: GameState,
    private sseManager: SSEManager,
  ) {}

  /**
   * Check if a player can call an emergency meeting
   */
  canCallEmergency(
    playerId: string,
    roomId: string,
    roundStartTime: number,
  ): { valid: boolean; reason?: string } {
    const player = this.gameState.players.get(playerId);

    // Check player exists
    if (!player) {
      return { valid: false, reason: 'Player not found' };
    }

    // Check player is alive
    if (player.status !== PlayerStatus.ALIVE) {
      return { valid: false, reason: 'Player is not alive' };
    }

    // Check player is in council room (room with emergency button)
    if (roomId !== 'council-room') {
      return { valid: false, reason: 'Emergency button is only in the council room' };
    }

    // Check warm-up period has passed
    const elapsed = Date.now() - roundStartTime;
    if (elapsed < this.WARMUP_DURATION_MS) {
      const remaining = Math.ceil((this.WARMUP_DURATION_MS - elapsed) / 1000);
      return { valid: false, reason: `Emergency button is warming up (${remaining}s remaining)` };
    }

    // Check player hasn't used all their emergency meetings
    const usedMeetings = player.emergencyMeetingsUsed ?? 0;
    if (usedMeetings >= this.MAX_EMERGENCY_MEETINGS_PER_PLAYER) {
      return { valid: false, reason: 'You have already used your emergency meeting' };
    }

    return { valid: true };
  }

  /**
   * Execute an emergency meeting call
   */
  callEmergency(
    playerId: string,
    roomId: string,
    roundStartTime: number,
  ): { success: boolean; reason?: string } {
    // Validate first
    const validation = this.canCallEmergency(playerId, roomId, roundStartTime);
    if (!validation.valid) {
      logger.warn('Emergency call rejected', { playerId, reason: validation.reason });
      return { success: false, reason: validation.reason };
    }

    const player = this.gameState.players.get(playerId)!;

    // Increment usage
    player.emergencyMeetingsUsed = (player.emergencyMeetingsUsed ?? 0) + 1;

    logger.logGameEvent(EventType.COUNCIL_CALLED, {
      callerId: playerId,
      callerName: player.name,
      reason: 'Emergency Meeting',
    });

    // Trigger council phase via game state
    this.gameState.startCouncilPhase();

    return { success: true };
  }

  /**
   * Reset system state (for new game)
   */
  reset(): void {
    // No internal state to reset currently
    logger.debug('EmergencyButtonSystem reset');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/emergency-button.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/game/emergency-button.ts tests/game/emergency-button.test.ts
git commit -m "feat: Create EmergencyButtonSystem class"
```

---

### Task 4: Integrate EmergencyButtonSystem into GameState

**Files:**
- Modify: `src/game/state.ts`

**Step 1: Write the failing test**

Add to `tests/game/state.test.ts`:

```typescript
test('should track round start time', () => {
  const gameState = new GameState();
  gameState.startRound();
  expect(gameState.getRoundStartTime()).toBeGreaterThan(0);
});

test('should have EmergencyButtonSystem', () => {
  const gameState = new GameState();
  expect(gameState.getEmergencyButtonSystem()).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/state.test.ts`
Expected: Tests fail - methods don't exist

**Step 3: Write minimal implementation**

Modify `src/game/state.ts`:

```typescript
// Add import at top
import { EmergencyButtonSystem } from './emergency-button';

// Add private field
private roundStartTime: number = 0;
private emergencyButtonSystem: EmergencyButtonSystem;

// In constructor, add:
this.emergencyButtonSystem = new EmergencyButtonSystem(this, this.sseManager);

// In startRound(), add:
this.roundStartTime = Date.now();

// Add getter methods
getRoundStartTime(): number {
  return this.roundStartTime;
}

getEmergencyButtonSystem(): EmergencyButtonSystem {
  return this.emergencyButtonSystem;
}

// Add callEmergency method
callEmergency(playerId: string): { success: boolean; reason?: string } {
  const player = this._players.get(playerId);
  if (!player) {
    return { success: false, reason: 'Player not found' };
  }
  return this.emergencyButtonSystem.callEmergency(
    playerId,
    player.location.roomId,
    this.roundStartTime,
  );
}

// In reset(), add:
this.roundStartTime = 0;
this.emergencyButtonSystem.reset();
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/state.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/game/state.ts tests/game/state.test.ts
git commit -m "feat: Integrate EmergencyButtonSystem into GameState"
```

---

### Task 5: Add Sabotage Blocking Check

**Files:**
- Modify: `src/game/emergency-button.ts`
- Test: `tests/game/emergency-button.test.ts`

**Step 1: Write the failing test**

Add to `tests/game/emergency-button.test.ts`:

```typescript
describe('sabotage blocking', () => {
  test('returns false during active sabotage', () => {
    gameState.addPlayer({
      id: 'p1',
      name: 'Player',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'council-room', x: -2, y: 0 },
      emergencyMeetingsUsed: 0,
    });

    // Trigger a sabotage
    const sabotageSystem = gameState.getSabotageSystem();
    sabotageSystem.triggerSabotage('p1', { type: 'lights' });

    const roundStart = Date.now() - 30000;
    const result = system.canCallEmergency('p1', 'council-room', roundStart);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('sabotage');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/emergency-button.test.ts`
Expected: Test fails - sabotage not checked

**Step 3: Write minimal implementation**

Modify `src/game/emergency-button.ts` canCallEmergency method:

```typescript
// Add check before returning { valid: true }
// Check for active sabotage
const sabotageSystem = this.gameState.getSabotageSystem();
if (sabotageSystem.hasActiveSabotage()) {
  return { valid: false, reason: 'Cannot call emergency meeting during active sabotage' };
}

return { valid: true };
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/emergency-button.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/game/emergency-button.ts tests/game/emergency-button.test.ts
git commit -m "feat: Block emergency calls during active sabotage"
```

---

### Task 6: Add POST /api/game/emergency Endpoint

**Files:**
- Modify: `src/server/index.ts`

**Step 1: Write the failing test**

Add to `tests/server/api.test.ts` or create integration test:

```typescript
describe('POST /api/game/emergency', () => {
  test('returns success when emergency call is valid', async () => {
    // Setup: Add player, start game, wait for warm-up
    // This would be an integration test
  });

  test('returns failure when player not in council room', async () => {
    // Setup: Add player in different room
  });

  test('returns failure during warm-up period', async () => {
    // Setup: Add player, just started round
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/server/api.test.ts`
Expected: Endpoint doesn't exist

**Step 3: Write minimal implementation**

Add to `src/server/index.ts` before the 404 handler:

```typescript
// API: Call emergency meeting
if (url.pathname === '/api/game/emergency' && req.method === 'POST') {
  try {
    const body = await req.json();
    const { playerId } = body as { playerId: string };

    if (!playerId) {
      return Response.json(
        { error: 'Missing required field: playerId' },
        { status: 400, headers: corsHeaders },
      );
    }

    const result = this.gameState.callEmergency(playerId);

    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error('Error calling emergency:', err);
    return Response.json(
      { error: 'Failed to call emergency meeting' },
      { status: 500, headers: corsHeaders },
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/server/index.ts tests/server/api.test.ts
git commit -m "feat: Add POST /api/game/emergency endpoint"
```

---

### Task 7: Run Full Test Suite and Fix Any Issues

**Files:**
- Various

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Fix any failures**

Address any test failures that arise.

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: Resolve test failures for emergency button system"
```

---

### Task 8: Create Feature Branch and Final Commit

**Step 1: Create feature branch from master**

```bash
git checkout master
git pull origin master
git checkout -b among-us-ai/har-74-emergency-button-system
```

**Step 2: Cherry-pick or rebase commits onto feature branch**

All commits should already be on master if following along. If not:

```bash
git cherry-pick <commit-hashes>
```

**Step 3: Push to origin**

```bash
git push origin among-us-ai/har-74-emergency-button-system
```

**Step 4: Create PR**

Use `gh pr create` with summary linking to Linear issue HAR-74.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add emergencyMeetingsUsed to Player schema |
| 2 | Move emergency button to council-room |
| 3 | Create EmergencyButtonSystem class |
| 4 | Integrate into GameState |
| 5 | Add sabotage blocking check |
| 6 | Add POST /api/game/emergency endpoint |
| 7 | Run tests and fix issues |
| 8 | Create branch and PR |
