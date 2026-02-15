# Map System Design

**Issue:** HAR-75
**Date:** 2026-02-14

## Overview

Multi-map support infrastructure for among-us-ai. The system allows maps to be defined, registered, and randomly selected on game start. Maps are NOT player-selected - the system assigns a random map uniformly when the game launches.

## Architecture

```
src/game/maps/
  types.ts           # MapDefinition interface, Zod schemas
  loader.ts          # MapLoader class with registration
  test-map.ts        # Existing test map converted to MapDefinition
  index.ts           # Re-exports
```

## Components

### MapDefinition Interface

Full-scope map definition including:
- Rooms with positions and connections
- Vent networks (room property)
- Sabotage locations
- Special room identifiers (emergency button, logs)

```typescript
export const MapDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),

  // Core room data
  rooms: z.array(RoomSchema),

  // Room-level vent connections (roomId -> vent info)
  vents: z.record(z.string(), VentConnectionSchema).optional(),

  // Sabotage locations available on this map
  sabotageLocations: z.array(SabotageLocationSchema),

  // Special room identifiers
  emergencyButtonRoom: z.string(),
  logsRoom: z.string(),
});
```

### MapLoader Class

- `register(map)` - Register a map definition (first registered becomes default)
- `get(mapId)` - Get a specific map
- `getMapIds()` - List all registered map IDs
- `selectRandom()` - Uniform random selection
- `getDefault()` - Get first registered map
- `has(mapId)` - Check if map exists

### RoomManager Refactor

- Constructor accepts `MapDefinition` instead of hardcoded `ROOMS`
- Added `getMapId()` method
- All other methods unchanged

### GameState Changes

- `currentMap: MapDefinition | null` - Stores selected map
- `loadMap(map)` - Creates new RoomManager and syncs rooms
- `getCurrentMap()` - Get current map definition
- `getMapId()` - Get current map ID

### GameCoordinator Changes

- Registers all maps at construction
- `startGame()` calls `selectRandom()` then `loadMap()`
- `getAvailableMaps()` for debugging

## Integration Points

**Files to create:**
- `src/game/maps/types.ts`
- `src/game/maps/loader.ts`
- `src/game/maps/test-map.ts`
- `src/game/maps/index.ts`

**Files to modify:**
- `src/game/rooms.ts` - Accept MapDefinition in constructor
- `src/game/state.ts` - Add loadMap(), store currentMap
- `src/game/coordinator.ts` - Register maps, select random on start
- `src/types/game.ts` - Export MapDefinition types
- Tests that reference old `ROOMS` constant

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Map selection | Random on launch | Not player-selected, uniform distribution |
| Vent definition | Room property | Simpler than separate network definitions |
| Spawn config | None | All rooms are valid spawn locations |
| Map storage | In-memory registration | No file-based loading needed for MVP |
| Default map | First registered | Simple, deterministic fallback |

## Flow

1. Server start → `GameCoordinator` registers all maps with `MapLoader`
2. Game start → `selectRandom()` picks a map uniformly
3. `GameState.loadMap()` → creates new `RoomManager` with map data
4. Game proceeds with selected map's rooms, vents, sabotage locations
