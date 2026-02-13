# Emergency Button System Design

**Created:** 2026-02-13
**Linear Issue:** HAR-74
**Status:** Approved

---

## Overview

Implement the emergency button system that allows players to call council meetings from the council room. The button has a 20-second warm-up period at the start of each round and is limited to once per game per player.

---

## Data Model Changes

### Player Schema

Add optional field to track emergency meeting usage:

```typescript
emergencyMeetingsUsed: z.number().min(0).optional()
```

### GameState

Add the following:
- `roundStartTime: number` - timestamp when current round started
- `emergencyButtonSystem: EmergencyButtonSystem` - new system instance

### Event Type

Reuse existing `COUNCIL_CALLED` event with:
- `reason: "Emergency Meeting"`
- `callerId: <playerId>` - the player who pressed the button

---

## EmergencyButtonSystem Class

**File:** `src/game/emergency-button.ts`

```typescript
class EmergencyButtonSystem {
  private readonly WARMUP_DURATION_MS = 20000; // 20 seconds
  private readonly MAX_EMERGENCY_MEETINGS_PER_PLAYER = 1;
  private gameState: GameState;
  private sseManager: SSEManager;

  constructor(gameState: GameState, sseManager: SSEManager);

  // Validate if player can call emergency
  canCallEmergency(playerId: string, roomId: string, roundStartTime: number):
    { valid: boolean; reason?: string }

  // Execute emergency call
  callEmergency(playerId: string, roomId: string, roundStartTime: number):
    { success: boolean; reason?: string }

  // Reset per-game state
  reset(): void
}
```

### Validation Checks (in order)

1. Player exists and is alive
2. Player is in the council room (room has emergency button interactable)
3. 20-second warm-up has passed since round start
4. Player hasn't exceeded max emergency meetings
5. No active sabotage blocking emergency calls

---

## Integration Points

### GameState (`src/game/state.ts`)

- Set `roundStartTime` in `startRound()` method
- Initialize `emergencyButtonSystem` in constructor
- Add public method `callEmergency(playerId: string)`
- Expose `getRoundStartTime()` getter

### Room Definition (`src/game/rooms.ts`)

Move emergency button interactable:
- **From:** `center` (Central Hall)
- **To:** `council-room` (Council Room)

### Server Endpoint (`src/server/index.ts`)

```typescript
// POST /api/game/emergency
Request:  { playerId: string }
Response: { success: boolean; reason?: string }
```

### Sabotage Integration

Check for active sabotage before allowing emergency call:
- If `sabotageSystem.hasActiveSabotage()` returns true, reject with reason

---

## Testing Strategy

### Unit Tests (`tests/game/emergency-button.test.ts`)

- Warm-up period validation (blocked during, allowed after)
- Room validation (must be in council room)
- Per-player usage limit enforcement
- Dead player rejection
- Active sabotage blocking
- Usage counter increment on successful call
- Council phase trigger on success
- Reset functionality

### Integration Tests

- API endpoint success/failure responses
- Wrong room validation
- Full flow: round start → wait 20s → call emergency → council starts

### Existing Test Updates

- Update room tests to verify button location in council-room

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/game/emergency-button.ts` | Create |
| `src/types/game.ts` | Modify (add Player field) |
| `src/game/state.ts` | Modify (integrate system) |
| `src/game/rooms.ts` | Modify (move button) |
| `src/server/index.ts` | Modify (add endpoint) |
| `tests/game/emergency-button.test.ts` | Create |
