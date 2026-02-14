# Delayed Information System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement delayed player movement information so room occupants hear ambiguous "footsteps" hints for 2 ticks before learning who entered/left.

**Architecture:** Add a `PendingReveal` queue to track delayed movement reveals. When players move, queue pending reveals for both the source and destination rooms. Each tick, decrement counters and include hints in room descriptions. When countdown reaches zero, players become visible in room occupants list.

**Tech Stack:** TypeScript, Bun test framework, existing GameState/TickProcessor architecture

---

## Task 1: Define Types and Constants

**Files:**
- Modify: `src/types/game.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for PendingReveal type**

```typescript
// tests/game/delayed-info.test.ts
import { describe, expect, test } from 'bun:test';
import { PendingRevealSchema, REVEAL_DELAY_TICKS } from '@/types/game';

describe('Delayed Information Types', () => {
  test('PendingRevealSchema validates valid enter reveal', () => {
    const reveal = {
      playerId: 'player-1',
      roomId: 'center',
      direction: 'east' as const,
      ticksRemaining: 2,
      type: 'enter' as const,
    };
    const result = PendingRevealSchema.safeParse(reveal);
    expect(result.success).toBe(true);
  });

  test('PendingRevealSchema validates valid leave reveal', () => {
    const reveal = {
      playerId: 'player-1',
      roomId: 'center',
      direction: 'west' as const,
      ticksRemaining: 2,
      type: 'leave' as const,
    };
    const result = PendingRevealSchema.safeParse(reveal);
    expect(result.success).toBe(true);
  });

  test('REVEAL_DELAY_TICKS constant is 2', () => {
    expect(REVEAL_DELAY_TICKS).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "Cannot find module '@/types/game' exported member 'PendingRevealSchema'"

**Step 3: Add types to src/types/game.ts**

Add after line 68 (after EventType enum):

```typescript
// --- Delayed Information Types ---

export type MovementDirection = 'north' | 'south' | 'east' | 'west';
export type RevealType = 'enter' | 'leave';

export const MovementDirectionSchema = z.enum(['north', 'south', 'east', 'west']);
export const RevealTypeSchema = z.enum(['enter', 'leave']);

export const PendingRevealSchema = z.object({
  playerId: z.string(),
  roomId: z.string(),
  direction: MovementDirectionSchema,
  ticksRemaining: z.number().int().min(0),
  type: RevealTypeSchema,
});
export type PendingReveal = z.infer<typeof PendingRevealSchema>;

// Configurable constant for reveal delay
export const REVEAL_DELAY_TICKS = 2;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/game.ts tests/game/delayed-info.test.ts
git commit -m "feat: add PendingReveal type and REVEAL_DELAY_TICKS constant"
```

---

## Task 2: Add Direction Calculation to RoomManager

**Files:**
- Modify: `src/game/rooms.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for direction calculation**

```typescript
// Add to tests/game/delayed-info.test.ts
import { RoomManager } from '@/game/rooms';

describe('RoomManager Direction Calculation', () => {
  const roomManager = new RoomManager();

  test('getDirection returns correct cardinal direction', () => {
    // center (0,0) -> electrical-room (1,0) = east
    const direction = roomManager.getDirection('center', 'electrical-room');
    expect(direction).toBe('east');
  });

  test('getDirection returns west for opposite movement', () => {
    // electrical-room (1,0) -> center (0,0) = west
    const direction = roomManager.getDirection('electrical-room', 'center');
    expect(direction).toBe('west');
  });

  test('getDirection returns north for northward movement', () => {
    // center (0,0) -> hallway-north (0,1) = north
    const direction = roomManager.getDirection('center', 'hallway-north');
    expect(direction).toBe('north');
  });

  test('getDirection returns south for southward movement', () => {
    // hallway-north (0,1) -> center (0,0) = south
    const direction = roomManager.getDirection('hallway-north', 'center');
    expect(direction).toBe('south');
  });

  test('getDirection returns null for unconnected rooms', () => {
    const direction = roomManager.getDirection('center', 'council-room');
    expect(direction).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "roomManager.getDirection is not a function"

**Step 3: Add getDirection method to RoomManager**

Add to `src/game/rooms.ts` after the `validateMovement` method (around line 97):

```typescript
import { MovementDirection } from '@/types/game';

// Add at top of file with existing imports

// Add method to RoomManager class:
  /**
   * Get the cardinal direction from one room to another
   * Returns null if rooms are not directly connected
   */
  getDirection(fromRoomId: string, toRoomId: string): MovementDirection | null {
    const fromRoom = this.getRoom(fromRoomId);
    const toRoom = this.getRoom(toRoomId);

    if (!fromRoom || !toRoom) return null;

    // Check if rooms are connected
    if (!fromRoom.exits.includes(toRoomId)) return null;

    const dx = toRoom.position.x - fromRoom.position.x;
    const dy = toRoom.position.y - fromRoom.position.y;

    // Determine direction based on position difference
    if (dx > 0) return 'east';
    if (dx < 0) return 'west';
    if (dy > 0) return 'north';
    if (dy < 0) return 'south';

    return null; // Same position (shouldn't happen with valid data)
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/rooms.ts tests/game/delayed-info.test.ts
git commit -m "feat: add getDirection method to RoomManager for movement direction"
```

---

## Task 3: Add PendingRevealQueue Class

**Files:**
- Create: `src/game/pending-reveal-queue.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for PendingRevealQueue**

```typescript
// Add to tests/game/delayed-info.test.ts
import { PendingRevealQueue } from '@/game/pending-reveal-queue';
import { PendingReveal, REVEAL_DELAY_TICKS } from '@/types/game';

describe('PendingRevealQueue', () => {
  let queue: PendingRevealQueue;

  beforeEach(() => {
    queue = new PendingRevealQueue();
  });

  test('queueReveal adds a reveal with correct ticks', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending).toHaveLength(1);
    expect(pending[0].ticksRemaining).toBe(REVEAL_DELAY_TICKS);
  });

  test('getPendingRevealsForRoom returns only reveals for that room', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'enter');

    const centerReveals = queue.getPendingRevealsForRoom('center');
    expect(centerReveals).toHaveLength(1);
    expect(centerReveals[0].playerId).toBe('player-1');
  });

  test('decrementAll reduces ticksRemaining for all reveals', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending[0].ticksRemaining).toBe(1);
  });

  test('getReadyReveals returns reveals with ticksRemaining === 0', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    queue.decrementAll();

    const ready = queue.getReadyReveals();
    expect(ready).toHaveLength(1);
    expect(ready[0].playerId).toBe('player-1');
  });

  test('removeReveal removes specific reveal', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    const reveal = queue.getPendingRevealsForRoom('center')[0];
    queue.removeReveal(reveal);

    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending).toHaveLength(0);
  });

  test('clear removes all reveals', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    queue.clear();

    expect(queue.getReadyReveals()).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "Cannot find module '@/game/pending-reveal-queue'"

**Step 3: Create PendingRevealQueue class**

Create `src/game/pending-reveal-queue.ts`:

```typescript
import { PendingReveal, MovementDirection, RevealType, REVEAL_DELAY_TICKS } from '@/types/game';
import { logger } from '@/utils/logger';

/**
 * Manages the queue of pending player reveals for the delayed information system.
 * When a player enters or leaves a room, a reveal is queued and counts down over
 * several ticks before the player becomes visible to other room occupants.
 */
export class PendingRevealQueue {
  private reveals: Map<string, PendingReveal> = new Map();
  private nextId: number = 0;

  /**
   * Queue a new pending reveal
   */
  queueReveal(
    playerId: string,
    roomId: string,
    direction: MovementDirection,
    type: RevealType,
  ): PendingReveal {
    const id = `reveal-${this.nextId++}`;
    const reveal: PendingReveal = {
      playerId,
      roomId,
      direction,
      ticksRemaining: REVEAL_DELAY_TICKS,
      type,
    };
    this.reveals.set(id, reveal);

    logger.debug('Queued pending reveal', { id, playerId, roomId, direction, type });
    return reveal;
  }

  /**
   * Get all pending reveals for a specific room (with ticksRemaining > 0)
   */
  getPendingRevealsForRoom(roomId: string): PendingReveal[] {
    return Array.from(this.reveals.values()).filter(
      (r) => r.roomId === roomId && r.ticksRemaining > 0,
    );
  }

  /**
   * Decrement ticksRemaining for all reveals
   */
  decrementAll(): void {
    this.reveals.forEach((reveal) => {
      if (reveal.ticksRemaining > 0) {
        reveal.ticksRemaining--;
      }
    });
  }

  /**
   * Get all reveals that are ready to be processed (ticksRemaining === 0)
   */
  getReadyReveals(): PendingReveal[] {
    return Array.from(this.reveals.values()).filter((r) => r.ticksRemaining === 0);
  }

  /**
   * Remove a specific reveal from the queue
   */
  removeReveal(reveal: PendingReveal): void {
    const entry = Array.from(this.reveals.entries()).find(
      ([_, r]) =>
        r.playerId === reveal.playerId &&
        r.roomId === reveal.roomId &&
        r.ticksRemaining === reveal.ticksRemaining,
    );
    if (entry) {
      this.reveals.delete(entry[0]);
    }
  }

  /**
   * Clear all pending reveals (for game reset)
   */
  clear(): void {
    this.reveals.clear();
    this.nextId = 0;
  }

  /**
   * Get total count of pending reveals (for debugging)
   */
  size(): number {
    return this.reveals.size;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/pending-reveal-queue.ts tests/game/delayed-info.test.ts
git commit -m "feat: add PendingRevealQueue class for managing delayed reveals"
```

---

## Task 4: Integrate PendingRevealQueue into GameState

**Files:**
- Modify: `src/game/state.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for GameState integration**

```typescript
// Add to tests/game/delayed-info.test.ts
import { GameState } from '@/game/state';
import { createMockPlayer } from '../framework/test_base';
import { PlayerRole, PlayerStatus } from '@/types/game';

describe('GameState Delayed Information Integration', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  test('movePlayer queues pending reveal for destination room', () => {
    // Add player in center room
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);

    // Move to electrical-room
    gameState.movePlayer('player-1', 'electrical-room');

    // Check pending reveals for electrical-room
    const queue = gameState.getPendingRevealQueue();
    const reveals = queue.getPendingRevealsForRoom('electrical-room');
    expect(reveals).toHaveLength(1);
    expect(reveals[0].type).toBe('enter');
    expect(reveals[0].playerId).toBe('player-1');
  });

  test('movePlayer queues pending reveal for source room (leave)', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);

    gameState.movePlayer('player-1', 'electrical-room');

    // Check pending reveals for center room (leave event)
    const queue = gameState.getPendingRevealQueue();
    const centerReveals = queue.getPendingRevealsForRoom('center');
    expect(centerReveals).toHaveLength(1);
    expect(centerReveals[0].type).toBe('leave');
  });

  test('getPlayersVisibleInRoom excludes players with pending enter reveals', () => {
    const player1 = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    const player2 = createMockPlayer({
      id: 'player-2',
      location: { roomId: 'electrical-room', x: 1, y: 0 },
    });
    gameState.addPlayer(player1);
    gameState.addPlayer(player2);

    // Player 2 moves to center
    gameState.movePlayer('player-2', 'center');

    // Player 2 should not be visible yet (has pending reveal)
    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible.map((p) => p.id)).toContain('player-1');
    expect(visible.map((p) => p.id)).not.toContain('player-2');
  });

  test('reset clears pending reveal queue', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    gameState.reset();

    expect(gameState.getPendingRevealQueue().size()).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "gameState.getPendingRevealQueue is not a function"

**Step 3: Modify GameState to integrate PendingRevealQueue**

Add to `src/game/state.ts`:

At the top, add import:
```typescript
import { PendingRevealQueue } from './pending-reveal-queue';
```

In the class, add private field (around line 59):
```typescript
  private pendingRevealQueue: PendingRevealQueue;
```

In constructor, initialize it (around line 70):
```typescript
    this.pendingRevealQueue = new PendingRevealQueue();
```

Add getter method (after `getRoundStartTime()` around line 591):
```typescript
  /**
   * Get the pending reveal queue for delayed information
   */
  getPendingRevealQueue(): PendingRevealQueue {
    return this.pendingRevealQueue;
  }
```

Add visibility method:
```typescript
  /**
   * Get players who are visible in a room (excluding those with pending enter reveals)
   */
  getPlayersVisibleInRoom(roomId: string): Player[] {
    const pendingReveals = this.pendingRevealQueue.getPendingRevealsForRoom(roomId);
    const hiddenPlayerIds = new Set(
      pendingReveals.filter((r) => r.type === 'enter').map((r) => r.playerId),
    );

    return Array.from(this._players.values()).filter(
      (p) => p.location.roomId === roomId && !hiddenPlayerIds.has(p.id),
    );
  }
```

Modify `movePlayer` method to queue reveals. After line 520 (after updating player location), add:

```typescript
    // Queue pending reveals for delayed information
    const direction = this.roomManager.getDirection(currentRoomId, targetRoomId);
    if (direction) {
      // Leave reveal for source room
      const oppositeDirection = this.getOppositeDirection(direction);
      this.pendingRevealQueue.queueReveal(
        playerId,
        currentRoomId,
        oppositeDirection,
        'leave',
      );
      // Enter reveal for destination room
      this.pendingRevealQueue.queueReveal(playerId, targetRoomId, direction, 'enter');
    }
```

Add helper method for opposite direction:
```typescript
  private getOppositeDirection(direction: string): string {
    const opposites: Record<string, string> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    return opposites[direction] || direction;
  }
```

In `reset()` method, add (around line 639):
```typescript
    this.pendingRevealQueue.clear();
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/state.ts tests/game/delayed-info.test.ts
git commit -m "feat: integrate PendingRevealQueue into GameState for movement tracking"
```

---

## Task 5: Process Reveals in TickProcessor

**Files:**
- Modify: `src/tick/processor.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for tick processing**

```typescript
// Add to tests/game/delayed-info.test.ts
import { TickProcessor } from '@/tick/processor';

describe('TickProcessor Delayed Information', () => {
  let gameState: GameState;
  let tickProcessor: TickProcessor;

  beforeEach(() => {
    gameState = new GameState();
    tickProcessor = gameState.getTickProcessor();
  });

  test('processTick decrements reveal counters', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    const queue = gameState.getPendingRevealQueue();
    const revealsBefore = queue.getPendingRevealsForRoom('electrical-room');
    expect(revealsBefore[0].ticksRemaining).toBe(2);

    // Simulate tick processing (call internal method)
    tickProcessor.processPendingReveals();

    const revealsAfter = queue.getPendingRevealsForRoom('electrical-room');
    expect(revealsAfter[0].ticksRemaining).toBe(1);
  });

  test('player becomes visible after reveal delay expires', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    // Before: player not visible
    expect(gameState.getPlayersVisibleInRoom('electrical-room').map((p) => p.id)).not.toContain('player-1');

    // Process 2 ticks worth of reveals
    tickProcessor.processPendingReveals();
    tickProcessor.processPendingReveals();

    // After: player should be visible
    expect(gameState.getPlayersVisibleInRoom('electrical-room').map((p) => p.id)).toContain('player-1');
  });

  test('reveal is discarded if player left before reveal', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    // Player leaves before reveal expires
    gameState.movePlayer('player-1', 'center');

    // Process reveals
    tickProcessor.processPendingReveals();
    tickProcessor.processPendingReveals();

    // Player should NOT be visible in electrical-room (they left)
    expect(gameState.getPlayersVisibleInRoom('electrical-room').map((p) => p.id)).not.toContain('player-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "tickProcessor.processPendingReveals is not a function"

**Step 3: Add reveal processing to TickProcessor**

In `src/tick/processor.ts`, add new public method:

```typescript
  /**
   * Process pending reveals for delayed information system
   * This is called as part of processTick but exposed for testing
   */
  processPendingReveals(): void {
    const queue = this.gameState.getPendingRevealQueue();

    // Get reveals that are ready (ticksRemaining === 0)
    const readyReveals = queue.getReadyReveals();

    // For each ready reveal, check if player is still in room
    readyReveals.forEach((reveal) => {
      if (reveal.type === 'enter') {
        const player = this.gameState.players.get(reveal.playerId);
        // Only keep reveal if player is still in the room
        if (player && player.location.roomId === reveal.roomId) {
          logger.debug('Player reveal processed - now visible', {
            playerId: reveal.playerId,
            roomId: reveal.roomId,
          });
        }
        // Remove the reveal regardless (visibility is now handled by queue state)
      }
      queue.removeReveal(reveal);
    });

    // Decrement all remaining reveals for next tick
    queue.decrementAll();
  }
```

Modify `processTick()` method to call `processPendingReveals()`. Add after line 90 (after `this.processActions()`):

```typescript
      // Step 5: Process pending reveals for delayed information
      this.processPendingReveals();
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tick/processor.ts tests/game/delayed-info.test.ts
git commit -m "feat: add reveal processing to TickProcessor for delayed information"
```

---

## Task 6: Generate Footstep Hints in Room Descriptions

**Files:**
- Modify: `src/tick/processor.ts`
- Test: `tests/game/delayed-info.test.ts`

**Step 1: Write the failing test for footsteps hints**

```typescript
// Add to tests/game/delayed-info.test.ts
describe('Footsteps Hints', () => {
  let gameState: GameState;
  let tickProcessor: TickProcessor;

  beforeEach(() => {
    gameState = new GameState();
    tickProcessor = gameState.getTickProcessor();
  });

  test('getFootstepsHint returns correct message for enter', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    const hints = tickProcessor.getFootstepsHintsForRoom('electrical-room');
    expect(hints).toContain('You hear footsteps from the west');
  });

  test('getFootstepsHint returns correct message for leave', () => {
    const player = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    gameState.addPlayer(player);
    gameState.movePlayer('player-1', 'electrical-room');

    const hints = tickProcessor.getFootstepsHintsForRoom('center');
    expect(hints).toContain('You hear footsteps towards the east');
  });

  test('getFootstepsHint returns empty array when no pending reveals', () => {
    const hints = tickProcessor.getFootstepsHintsForRoom('center');
    expect(hints).toHaveLength(0);
  });

  test('getFootstepsHint handles multiple pending reveals', () => {
    const player1 = createMockPlayer({
      id: 'player-1',
      location: { roomId: 'center', x: 0, y: 0 },
    });
    const player2 = createMockPlayer({
      id: 'player-2',
      location: { roomId: 'hallway-north', x: 0, y: 1 },
    });
    gameState.addPlayer(player1);
    gameState.addPlayer(player2);

    gameState.movePlayer('player-1', 'electrical-room');
    gameState.movePlayer('player-2', 'center');

    const hints = tickProcessor.getFootstepsHintsForRoom('center');
    expect(hints).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: FAIL - "tickProcessor.getFootstepsHintsForRoom is not a function"

**Step 3: Add footsteps hint generation to TickProcessor**

Add method to `src/tick/processor.ts`:

```typescript
  /**
   * Get footsteps hints for a room based on pending reveals
   */
  getFootstepsHintsForRoom(roomId: string): string[] {
    const queue = this.gameState.getPendingRevealQueue();
    const reveals = queue.getPendingRevealsForRoom(roomId);

    return reveals.map((reveal) => {
      if (reveal.type === 'enter') {
        return `You hear footsteps from the ${reveal.direction}`;
      } else {
        return `You hear footsteps towards the ${reveal.direction}`;
      }
    });
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/delayed-info.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tick/processor.ts tests/game/delayed-info.test.ts
git commit -m "feat: add footsteps hint generation for delayed information"
```

---

## Task 7: Run Full Test Suite

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "test: verify delayed information system passes all tests"
```

---

## Summary

The delayed information system is now complete. When players move:
1. Pending reveals are queued for both source (leave) and destination (enter) rooms
2. Each tick decrements the reveal counters
3. Room descriptions include footsteps hints during the delay period
4. After 2 ticks, players become visible in room occupants lists
5. If a player leaves before being revealed, the reveal is discarded
