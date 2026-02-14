# Delayed Information System Design

**Date:** 2026-02-13
**Issue:** HAR-96
**Status:** Approved

---

## Overview

When a player enters or leaves a room, other occupants receive ambiguous "footsteps" hints for 2 ticks before the player's identity is revealed through the room occupants list. This restores ambiguity lost by dropping 2D planar movement.

---

## Data Structure

Add to `GameState`:

```typescript
pendingReveals: Map<string, PendingReveal>

interface PendingReveal {
  playerId: string
  roomId: string
  direction: 'north' | 'south' | 'east' | 'west'
  ticksRemaining: number  // Start at REVEAL_DELAY_TICKS (2)
  type: 'enter' | 'leave'
}
```

## Constants

```typescript
const REVEAL_DELAY_TICKS = 2  // Configurable
```

---

## Flow

### On Movement (entering room)

1. Player moves from Room A to Room B
2. Queue pending reveal: `{ playerId, roomId: B, direction: 'east', ticksRemaining: 2, type: 'enter' }`
3. Player appears in Room B immediately (but marked as hidden from occupants list)

### On Movement (leaving room)

1. Player moves from Room A to Room B
2. Queue pending reveal for Room A: `{ playerId, roomId: A, direction: 'west', ticksRemaining: 2, type: 'leave' }`

### Each Tick

1. For each pending reveal, decrement `ticksRemaining`
2. When building room descriptions:
   - Check for pending reveals with `ticksRemaining > 0` for that room
   - Add footsteps hint to room description
3. When `ticksRemaining === 0`:
   - Check if player still in room (for 'enter' type)
   - If yes: reveal (player becomes visible in occupants list)
   - If no: discard reveal
4. Remove expired reveals from queue

---

## Room Description Hints

- Enter: `"You hear footsteps from the ${direction}"`
- Leave: `"You hear footsteps towards the ${direction}"`

---

## Direction Calculation

Store direction as the cardinal direction between connected rooms. Use existing room connection data from `RoomManager` to determine which direction the movement came from or went to.

---

## Edge Cases

- **Player leaves before reveal:** At reveal time, check if player is still in room. If not, discard the reveal.
- **Multiple movements:** Each movement queues its own pending reveal. They process independently.

---

## Integration Points

| File | Change |
|------|--------|
| `src/game/state.ts` | Add `pendingReveals` map, queue reveals on movement |
| `src/tick/processor.ts` | Decrement counters, build hints, process reveals |
| `src/game/rooms.ts` | Provide direction between connected rooms |
| `src/types/game.ts` | Add `PendingReveal` interface |

---

## Testing Strategy

- Unit tests for reveal queue management
- Unit tests for direction calculation
- Integration tests for tick-based reveal timing
- Test edge case: player leaves before reveal
