# Map System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement multi-map infrastructure with MapDefinition interface, MapLoader class, and random map selection on game start.

**Architecture:** Create `src/game/maps/` module with types, loader, and test map. Refactor RoomManager to accept MapDefinition via constructor. Add map loading to GameState. Integrate random map selection in GameCoordinator.startGame().

**Tech Stack:** TypeScript, Zod schemas, Bun test framework

---

## Task 1: Create MapDefinition Types

**Files:**
- Create: `src/game/maps/types.ts`
- Test: `tests/game/maps/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/game/maps/types.test.ts
import { describe, test, expect } from 'bun:test';
import {
  MapDefinitionSchema,
  SabotageLocationSchema,
  VentConnectionSchema,
} from '@/game/maps/types';
import { RoomSchema } from '@/types/game';

describe('MapDefinition Types', () => {
  describe('SabotageLocationSchema', () => {
    test('should validate lights sabotage', () => {
      const result = SabotageLocationSchema.safeParse({
        type: 'lights',
        roomId: 'electrical-room',
      });
      expect(result.success).toBe(true);
    });

    test('should validate doors sabotage with targetRoomId', () => {
      const result = SabotageLocationSchema.safeParse({
        type: 'doors',
        roomId: 'council-room',
        targetRoomId: 'hallway-west',
      });
      expect(result.success).toBe(true);
    });

    test('should validate self-destruct sabotage', () => {
      const result = SabotageLocationSchema.safeParse({
        type: 'self-destruct',
        roomId: 'electrical-room',
      });
      expect(result.success).toBe(true);
    });

    test('should reject invalid sabotage type', () => {
      const result = SabotageLocationSchema.safeParse({
        type: 'invalid',
        roomId: 'electrical-room',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('VentConnectionSchema', () => {
    test('should validate vent connections', () => {
      const result = VentConnectionSchema.safeParse({
        connectsTo: ['electrical-room', 'security'],
      });
      expect(result.success).toBe(true);
    });

    test('should allow empty connectsTo array', () => {
      const result = VentConnectionSchema.safeParse({
        connectsTo: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('MapDefinitionSchema', () => {
    const validRoom = {
      id: 'test-room',
      name: 'Test Room',
      exits: ['other-room'],
      interactables: [],
      position: { x: 0, y: 0 },
    };

    const validMap = {
      id: 'test-map',
      name: 'Test Map',
      description: 'A test map',
      rooms: [validRoom],
      vents: {},
      sabotageLocations: [{ type: 'lights', roomId: 'test-room' }],
      emergencyButtonRoom: 'test-room',
      logsRoom: 'test-room',
    };

    test('should validate a complete map definition', () => {
      const result = MapDefinitionSchema.safeParse(validMap);
      expect(result.success).toBe(true);
    });

    test('should require id', () => {
      const { id, ...mapWithoutId } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutId);
      expect(result.success).toBe(false);
    });

    test('should require name', () => {
      const { name, ...mapWithoutName } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutName);
      expect(result.success).toBe(false);
    });

    test('should require rooms array', () => {
      const { rooms, ...mapWithoutRooms } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutRooms);
      expect(result.success).toBe(false);
    });

    test('should require sabotageLocations', () => {
      const { sabotageLocations, ...mapWithoutSabotage } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutSabotage);
      expect(result.success).toBe(false);
    });

    test('should require emergencyButtonRoom', () => {
      const { emergencyButtonRoom, ...mapWithoutButton } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutButton);
      expect(result.success).toBe(false);
    });

    test('should require logsRoom', () => {
      const { logsRoom, ...mapWithoutLogs } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutLogs);
      expect(result.success).toBe(false);
    });

    test('should make description optional', () => {
      const { description, ...mapWithoutDesc } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutDesc);
      expect(result.success).toBe(true);
    });

    test('should make vents optional', () => {
      const { vents, ...mapWithoutVents } = validMap;
      const result = MapDefinitionSchema.safeParse(mapWithoutVents);
      expect(result.success).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/maps/types.test.ts`
Expected: FAIL with "Cannot find module '@/game/maps/types'"

**Step 3: Write minimal implementation**

```typescript
// src/game/maps/types.ts
import { z } from 'zod';
import { RoomSchema } from '@/types/game';

/**
 * Sabotage location configuration for a map
 */
export const SabotageLocationSchema = z.object({
  type: z.enum(['lights', 'doors', 'self-destruct']),
  roomId: z.string(),
  targetRoomId: z.string().optional(),
});

export type SabotageLocation = z.infer<typeof SabotageLocationSchema>;

/**
 * Vent connection configuration for a room
 */
export const VentConnectionSchema = z.object({
  connectsTo: z.array(z.string()),
});

export type VentConnection = z.infer<typeof VentConnectionSchema>;

/**
 * Complete map definition including rooms, vents, sabotage locations, and special rooms
 */
export const MapDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rooms: z.array(RoomSchema),
  vents: z.record(z.string(), VentConnectionSchema).optional(),
  sabotageLocations: z.array(SabotageLocationSchema),
  emergencyButtonRoom: z.string(),
  logsRoom: z.string(),
});

export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/maps/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/maps/types.ts tests/game/maps/types.test.ts
git commit -m "feat(maps): add MapDefinition types and schemas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create MapLoader Class

**Files:**
- Create: `src/game/maps/loader.ts`
- Test: `tests/game/maps/loader.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/game/maps/loader.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { MapLoader } from '@/game/maps/loader';
import { TEST_MAP } from '@/game/maps/test-map';
import type { MapDefinition } from '@/game/maps/types';

describe('MapLoader', () => {
  let loader: MapLoader;

  beforeEach(() => {
    loader = new MapLoader();
  });

  describe('register', () => {
    test('should register a valid map', () => {
      loader.register(TEST_MAP);
      expect(loader.has('test-map')).toBe(true);
    });

    test('should set first registered map as default', () => {
      loader.register(TEST_MAP);
      expect(loader.getDefault()?.id).toBe('test-map');
    });

    test('should not change default when registering additional maps', () => {
      loader.register(TEST_MAP);
      const secondMap: MapDefinition = {
        ...TEST_MAP,
        id: 'second-map',
        name: 'Second Map',
      };
      loader.register(secondMap);
      expect(loader.getDefault()?.id).toBe('test-map');
    });

    test('should validate map on registration', () => {
      const invalidMap = { id: 'invalid' } as MapDefinition;
      expect(() => loader.register(invalidMap)).toThrow();
    });
  });

  describe('get', () => {
    test('should return map by ID', () => {
      loader.register(TEST_MAP);
      const map = loader.get('test-map');
      expect(map?.id).toBe('test-map');
    });

    test('should return undefined for unknown ID', () => {
      const map = loader.get('unknown-map');
      expect(map).toBeUndefined();
    });
  });

  describe('getMapIds', () => {
    test('should return empty array when no maps registered', () => {
      expect(loader.getMapIds()).toEqual([]);
    });

    test('should return all registered map IDs', () => {
      loader.register(TEST_MAP);
      const secondMap: MapDefinition = {
        ...TEST_MAP,
        id: 'second-map',
        name: 'Second Map',
      };
      loader.register(secondMap);
      expect(loader.getMapIds()).toContain('test-map');
      expect(loader.getMapIds()).toContain('second-map');
      expect(loader.getMapIds().length).toBe(2);
    });
  });

  describe('selectRandom', () => {
    test('should throw when no maps registered', () => {
      expect(() => loader.selectRandom()).toThrow('No maps registered');
    });

    test('should return the only map when one is registered', () => {
      loader.register(TEST_MAP);
      const selected = loader.selectRandom();
      expect(selected.id).toBe('test-map');
    });

    test('should return one of the registered maps', () => {
      loader.register(TEST_MAP);
      const secondMap: MapDefinition = {
        ...TEST_MAP,
        id: 'second-map',
        name: 'Second Map',
      };
      loader.register(secondMap);
      const selected = loader.selectRandom();
      expect(['test-map', 'second-map']).toContain(selected.id);
    });

    test('should select uniformly (statistical test)', () => {
      loader.register(TEST_MAP);
      const secondMap: MapDefinition = {
        ...TEST_MAP,
        id: 'second-map',
        name: 'Second Map',
      };
      loader.register(secondMap);

      // Run many selections to verify uniform distribution
      const counts: Record<string, number> = { 'test-map': 0, 'second-map': 0 };
      for (let i = 0; i < 100; i++) {
        const selected = loader.selectRandom();
        counts[selected.id]++;
      }

      // Both should be selected roughly 50 times (allow 30-70 range)
      expect(counts['test-map']).toBeGreaterThan(30);
      expect(counts['test-map']).toBeLessThan(70);
      expect(counts['second-map']).toBeGreaterThan(30);
      expect(counts['second-map']).toBeLessThan(70);
    });
  });

  describe('getDefault', () => {
    test('should return undefined when no maps registered', () => {
      expect(loader.getDefault()).toBeUndefined();
    });

    test('should return first registered map', () => {
      loader.register(TEST_MAP);
      expect(loader.getDefault()?.id).toBe('test-map');
    });
  });

  describe('has', () => {
    test('should return false for unregistered map', () => {
      expect(loader.has('unknown-map')).toBe(false);
    });

    test('should return true for registered map', () => {
      loader.register(TEST_MAP);
      expect(loader.has('test-map')).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/maps/loader.test.ts`
Expected: FAIL with "Cannot find module '@/game/maps/loader'"

**Step 3: Write minimal implementation**

```typescript
// src/game/maps/loader.ts
import { MapDefinition, MapDefinitionSchema } from './types';
import { logger } from '@/utils/logger';

/**
 * MapLoader manages map registration and selection
 */
export class MapLoader {
  private maps: Map<string, MapDefinition> = new Map();
  private defaultMapId: string | null = null;

  /**
   * Register a map definition
   * First registered map becomes the default
   */
  register(map: MapDefinition): void {
    const parsed = MapDefinitionSchema.parse(map);

    if (this.maps.size === 0) {
      this.defaultMapId = parsed.id;
    }

    this.maps.set(parsed.id, parsed);
    logger.debug('Map registered', { mapId: parsed.id, mapName: parsed.name });
  }

  /**
   * Get a specific map by ID
   */
  get(mapId: string): MapDefinition | undefined {
    return this.maps.get(mapId);
  }

  /**
   * Get all registered map IDs
   */
  getMapIds(): string[] {
    return Array.from(this.maps.keys());
  }

  /**
   * Select a random map (uniform distribution)
   */
  selectRandom(): MapDefinition {
    const mapIds = this.getMapIds();

    if (mapIds.length === 0) {
      throw new Error('No maps registered');
    }

    const randomIndex = Math.floor(Math.random() * mapIds.length);
    const selectedId = mapIds[randomIndex];
    const selectedMap = this.maps.get(selectedId)!;

    logger.info('Map selected randomly', {
      mapId: selectedId,
      mapName: selectedMap.name,
    });
    return selectedMap;
  }

  /**
   * Get the default map (first registered)
   */
  getDefault(): MapDefinition | undefined {
    if (!this.defaultMapId) return undefined;
    return this.maps.get(this.defaultMapId);
  }

  /**
   * Check if a map exists
   */
  has(mapId: string): boolean {
    return this.maps.has(mapId);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/maps/loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/maps/loader.ts tests/game/maps/loader.test.ts
git commit -m "feat(maps): add MapLoader class with registration and random selection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create Test Map Definition

**Files:**
- Create: `src/game/maps/test-map.ts`
- Test: `tests/game/maps/test-map.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/game/maps/test-map.test.ts
import { describe, test, expect } from 'bun:test';
import { TEST_MAP } from '@/game/maps/test-map';
import { MapDefinitionSchema } from '@/game/maps/types';

describe('TEST_MAP', () => {
  test('should be a valid MapDefinition', () => {
    const result = MapDefinitionSchema.safeParse(TEST_MAP);
    expect(result.success).toBe(true);
  });

  test('should have correct id', () => {
    expect(TEST_MAP.id).toBe('test-map');
  });

  test('should have correct name', () => {
    expect(TEST_MAP.name).toBe('Test Map');
  });

  test('should have 6 rooms matching existing ROOMS constant', () => {
    expect(TEST_MAP.rooms.length).toBe(6);
  });

  test('should have expected room IDs', () => {
    const roomIds = TEST_MAP.rooms.map((r) => r.id);
    expect(roomIds).toContain('center');
    expect(roomIds).toContain('hallway-west');
    expect(roomIds).toContain('council-room');
    expect(roomIds).toContain('hallway-north');
    expect(roomIds).toContain('logs-room');
    expect(roomIds).toContain('electrical-room');
  });

  test('should have emergency button in council-room', () => {
    expect(TEST_MAP.emergencyButtonRoom).toBe('council-room');
    const councilRoom = TEST_MAP.rooms.find((r) => r.id === 'council-room');
    const button = councilRoom?.interactables.find((i) => i.id === 'emergency-button');
    expect(button).toBeDefined();
  });

  test('should have logs in logs-room', () => {
    expect(TEST_MAP.logsRoom).toBe('logs-room');
    const logsRoom = TEST_MAP.rooms.find((r) => r.id === 'logs-room');
    const logs = logsRoom?.interactables.find((i) => i.id === 'ship-logs');
    expect(logs).toBeDefined();
  });

  test('should have sabotage locations', () => {
    expect(TEST_MAP.sabotageLocations.length).toBeGreaterThan(0);
  });

  test('should have lights sabotage in electrical-room', () => {
    const lightsSabotage = TEST_MAP.sabotageLocations.find(
      (s) => s.type === 'lights' && s.roomId === 'electrical-room',
    );
    expect(lightsSabotage).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/maps/test-map.test.ts`
Expected: FAIL with "Cannot find module '@/game/maps/test-map'"

**Step 3: Write minimal implementation**

```typescript
// src/game/maps/test-map.ts
import type { MapDefinition } from './types';

/**
 * Test map definition - converted from existing ROOMS constant
 */
export const TEST_MAP: MapDefinition = {
  id: 'test-map',
  name: 'Test Map',
  description: 'Development map for testing game mechanics',

  rooms: [
    {
      id: 'center',
      name: 'Central Hall',
      exits: ['hallway-west', 'hallway-north', 'electrical-room'],
      interactables: [],
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
    {
      id: 'hallway-north',
      name: 'North Hallway',
      exits: ['center', 'logs-room'],
      interactables: [],
      position: { x: 0, y: 1 },
    },
    {
      id: 'logs-room',
      name: 'Logs Room',
      exits: ['hallway-north'],
      interactables: [
        {
          id: 'ship-logs',
          type: 'Log',
          name: 'Ship Logs',
          action: 'View Logs',
        },
      ],
      position: { x: 0, y: 2 },
    },
    {
      id: 'electrical-room',
      name: 'Electrical',
      exits: ['center'],
      interactables: [
        {
          id: 'rewire-task',
          type: 'Task',
          name: 'Rewire',
          action: 'Fix Wiring',
        },
      ],
      position: { x: 1, y: 0 },
    },
  ],

  // No vents on test map
  vents: {},

  // Sabotage locations
  sabotageLocations: [
    { type: 'lights', roomId: 'electrical-room' },
    { type: 'doors', roomId: 'council-room', targetRoomId: 'hallway-west' },
    { type: 'self-destruct', roomId: 'electrical-room' },
  ],

  // Special rooms
  emergencyButtonRoom: 'council-room',
  logsRoom: 'logs-room',
};
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/maps/test-map.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/maps/test-map.ts tests/game/maps/test-map.test.ts
git commit -m "feat(maps): add test map definition from existing ROOMS

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create Maps Module Index

**Files:**
- Create: `src/game/maps/index.ts`

**Step 1: Write minimal implementation**

```typescript
// src/game/maps/index.ts
export { MapLoader } from './loader';
export { TEST_MAP } from './test-map';
export type {
  MapDefinition,
  SabotageLocation,
  VentConnection,
} from './types';
export {
  MapDefinitionSchema,
  SabotageLocationSchema,
  VentConnectionSchema,
} from './types';
```

**Step 2: Run all map tests to verify exports work**

Run: `bun test tests/game/maps/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/game/maps/index.ts
git commit -m "feat(maps): add module index with re-exports

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Refactor RoomManager to Accept MapDefinition

**Files:**
- Modify: `src/game/rooms.ts`
- Modify: `tests/game/rooms.test.ts`

**Step 1: Update the test to use MapDefinition**

```typescript
// tests/game/rooms.test.ts - key changes
import { describe, test, expect, beforeEach } from 'bun:test';
import { RoomManager } from '@/game/rooms';
import { TEST_MAP } from '@/game/maps';
import type { Room, MapDefinition } from '@/types/game';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager(TEST_MAP);
  });

  describe('Initialization', () => {
    test('should initialize with all map rooms', () => {
      const rooms = roomManager.getRooms();
      expect(rooms.length).toBe(TEST_MAP.rooms.length);
    });

    test('should store map ID', () => {
      expect(roomManager.getMapId()).toBe('test-map');
    });

    // ... rest of existing tests remain unchanged
  });

  // ... rest of existing test suites remain unchanged
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/rooms.test.ts`
Expected: FAIL with type/argument errors

**Step 3: Write implementation**

```typescript
// src/game/rooms.ts
import { Room, MovementDirection, MapDefinition } from '@/types/game';
import { logger } from '@/utils/logger';

export class RoomManager {
  private rooms: Map<string, Room>;
  private mapId: string;

  constructor(map: MapDefinition) {
    this.mapId = map.id;
    // Create deep copies of rooms to prevent shared mutable state across tests
    this.rooms = new Map(
      map.rooms.map((room) => [
        room.id,
        {
          ...room,
          interactables: [...room.interactables],
        },
      ]),
    );
  }

  getMapId(): string {
    return this.mapId;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  validateMovement(from: string, to: string): boolean {
    const fromRoom = this.getRoom(from);
    if (!fromRoom) return false;
    return fromRoom.exits.includes(to);
  }

  getDirection(fromRoomId: string, toRoomId: string): MovementDirection | null {
    const fromRoom = this.getRoom(fromRoomId);
    const toRoom = this.getRoom(toRoomId);

    // Handle null/undefined room lookup gracefully
    if (!fromRoom || !toRoom) {
      logger.debug('Direction calculation: room not found', {
        fromRoomId,
        toRoomId,
        fromRoomExists: !!fromRoom,
        toRoomExists: !!toRoom,
      });
      return null;
    }

    // Calculate position differences
    const dx = toRoom.position.x - fromRoom.position.x;
    const dy = toRoom.position.y - fromRoom.position.y;

    // Check if rooms are at same position
    if (dx === 0 && dy === 0) {
      logger.debug('Direction calculation: rooms at same position', {
        fromRoomId,
        toRoomId,
        position: fromRoom.position,
      });
      return null;
    }

    // Determine direction based on position differences
    let direction: MovementDirection | null = null;
    if (dx > 0) {
      direction = 'east';
    } else if (dx < 0) {
      direction = 'west';
    } else if (dy > 0) {
      direction = 'north';
    } else if (dy < 0) {
      direction = 'south';
    }

    logger.debug('Direction calculated', {
      fromRoomId,
      toRoomId,
      dx,
      dy,
      direction,
    });

    return direction;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/rooms.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/rooms.ts tests/game/rooms.test.ts
git commit -m "refactor(rooms): accept MapDefinition in RoomManager constructor

- Remove hardcoded ROOMS constant
- Add getMapId() method
- Require MapDefinition parameter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Add MapDefinition Type to game.ts

**Files:**
- Modify: `src/types/game.ts`

**Step 1: Add MapDefinition export**

Add at the end of `src/types/game.ts`:

```typescript
// Re-export map types
export type { MapDefinition, SabotageLocation, VentConnection } from '@/game/maps/types';
export { MapDefinitionSchema, SabotageLocationSchema, VentConnectionSchema } from '@/game/maps/types';
```

**Step 2: Run type check**

Run: `bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/game.ts
git commit -m "feat(types): re-export MapDefinition types from game.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Add Map Loading to GameState

**Files:**
- Modify: `src/game/state.ts`
- Modify: `tests/game/state.test.ts`

**Step 1: Add test for map loading**

```typescript
// tests/game/state.test.ts - add these tests
import { TEST_MAP } from '@/game/maps';

describe('Map Loading', () => {
  test('should have null currentMap before loading', () => {
    const gameState = new GameState();
    expect(gameState.getCurrentMap()).toBeNull();
    expect(gameState.getMapId()).toBeNull();
  });

  test('should load map and update rooms', () => {
    const gameState = new GameState();
    gameState.loadMap(TEST_MAP);

    expect(gameState.getCurrentMap()).toBe(TEST_MAP);
    expect(gameState.getMapId()).toBe('test-map');
  });

  test('should sync rooms map with loaded map', () => {
    const gameState = new GameState();
    gameState.loadMap(TEST_MAP);

    const rooms = Array.from(gameState.rooms.values());
    expect(rooms.length).toBe(TEST_MAP.rooms.length);

    TEST_MAP.rooms.forEach((mapRoom) => {
      const stateRoom = gameState.rooms.get(mapRoom.id);
      expect(stateRoom).toBeDefined();
      expect(stateRoom?.name).toBe(mapRoom.name);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/state.test.ts`
Expected: FAIL with "gameState.loadMap is not a function"

**Step 3: Add loadMap to GameState**

Add to `src/game/state.ts`:

```typescript
// Add import at top
import { MapDefinition } from '@/types/game';

// Add fields
private currentMap: MapDefinition | null = null;

// Add methods
/**
 * Load a map and reinitialize the room manager
 */
loadMap(map: MapDefinition): void {
  this.currentMap = map;
  this.roomManager = new RoomManager(map);

  // Reinitialize rooms from new RoomManager
  this._rooms.clear();
  this.roomManager.getRooms().forEach((room) => {
    this._rooms.set(room.id, room);
  });

  logger.info('Map loaded', { mapId: map.id, mapName: map.name });
}

/**
 * Get the current map definition
 */
getCurrentMap(): MapDefinition | null {
  return this.currentMap;
}

/**
 * Get the current map ID
 */
getMapId(): string | null {
  return this.currentMap?.id ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/state.ts tests/game/state.test.ts
git commit -m "feat(state): add map loading to GameState

- Add loadMap() method
- Add getCurrentMap() and getMapId() getters
- Sync rooms when loading map

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Integrate Map Selection in GameCoordinator

**Files:**
- Modify: `src/game/coordinator.ts`
- Test: `tests/game/coordinator.test.ts` (create if needed)

**Step 1: Add test for random map selection**

```typescript
// tests/game/coordinator.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { GameCoordinator } from '@/game/coordinator';
import { GameState } from '@/game/state';
import { LobbyManager } from '@/lobby/manager';
import { SSEManager } from '@/sse/manager';
import { PlayerRole, PlayerStatus, type Player } from '@/types/game';

describe('GameCoordinator', () => {
  let coordinator: GameCoordinator;
  let gameState: GameState;
  let lobbyManager: LobbyManager;
  let sseManager: SSEManager;

  beforeEach(() => {
    sseManager = new SSEManager();
    gameState = new GameState();
    lobbyManager = new LobbyManager(sseManager);
    coordinator = new GameCoordinator(lobbyManager, gameState, sseManager);
  });

  describe('Map Selection', () => {
    test('should have MapLoader initialized', () => {
      expect(coordinator.getMapLoader()).toBeDefined();
    });

    test('should have test-map registered', () => {
      const mapIds = coordinator.getAvailableMaps();
      expect(mapIds).toContain('test-map');
    });

    test('should select map on game start', () => {
      // Add enough players to start
      const players: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
        },
        {
          id: 'p2',
          name: 'Bob',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
        },
        {
          id: 'p3',
          name: 'Charlie',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
        },
      ];

      players.forEach((p) => lobbyManager.join(p));
      players.forEach((p) => lobbyManager.setReady(p.id, true));

      coordinator.startGame();

      expect(gameState.getMapId()).toBe('test-map');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/game/coordinator.test.ts`
Expected: FAIL with missing methods

**Step 3: Add map integration to GameCoordinator**

```typescript
// src/game/coordinator.ts
import { Player, PlayerRole, EventType, GameEvent, GamePhase } from '@/types/game';
import { GameState } from './state';
import { LobbyManager } from '@/lobby/manager';
import { SSEManager } from '@/sse/manager';
import { MapLoader } from './maps/loader';
import { TEST_MAP } from './maps/test-map';
import { logger } from '@/utils/logger';

/**
 * GameCoordinator manages the full game flow from lobby to game over.
 * It orchestrates transitions between LobbyManager, GameState, and handles game over events.
 */
export class GameCoordinator {
  private lobbyManager: LobbyManager;
  private gameState: GameState;
  private sseManager: SSEManager;
  private mapLoader: MapLoader;

  constructor(lobbyManager: LobbyManager, gameState: GameState, sseManager: SSEManager) {
    this.lobbyManager = lobbyManager;
    this.gameState = gameState;
    this.sseManager = sseManager;

    // Initialize map loader and register maps
    this.mapLoader = new MapLoader();
    this.mapLoader.register(TEST_MAP);
    // Future maps would be registered here
  }

  /**
   * Start a new game:
   * 1. Select random map
   * 2. Assign roles via LobbyManager
   * 3. Transfer players to GameState
   * 4. Start the first round
   */
  startGame(): void {
    // Get players from lobby
    const players = this.lobbyManager.getWaitingPlayers();

    if (players.length < 3) {
      logger.warn('Cannot start game: not enough players', {
        playerCount: players.length,
        minPlayers: 3,
      });
      return;
    }

    // Select random map
    const selectedMap = this.mapLoader.selectRandom();
    this.gameState.loadMap(selectedMap);

    // Assign roles (imposters vs crewmates)
    const { imposters, crewmates } = this.lobbyManager.assignRoles();

    // Reveal roles to players
    imposters.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const event: GameEvent = {
          timestamp: Date.now(),
          type: EventType.ROLE_REVEALED,
          payload: {
            playerId: player.id,
            role: player.role,
          },
        };
        this.sseManager.sendTo(player.id, event);
      }
    });

    crewmates.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const event: GameEvent = {
          timestamp: Date.now(),
          type: EventType.ROLE_REVEALED,
          payload: {
            playerId: player.id,
            role: player.role,
          },
        };
        this.sseManager.sendTo(player.id, event);
      }
    });

    // Transfer players to GameState
    players.forEach((player) => {
      this.gameState.addPlayer(player);
    });

    // Assign tasks to crewmates (HAR-32)
    this.gameState.getTaskManager().assignTasksToPlayers();

    // Start the first round
    this.gameState.startRound();

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.GAME_STARTED,
      payload: {
        playerCount: players.length,
        imposterCount: imposters.length,
      },
    };
    this.sseManager.broadcast(event);

    logger.info('Game started', {
      playerCount: players.length,
      imposterCount: imposters.length,
      mapId: selectedMap.id,
      mapName: selectedMap.name,
    });
  }

  /**
   * Restart the game for a new session:
   * - Clears all game state
   * - Keeps lobby players intact
   */
  restartGame(): void {
    logger.info('Restarting game');

    // Reset game state
    this.gameState.reset();

    // Start a new game with existing lobby players
    this.startGame();
  }

  /**
   * End the current game and return to lobby:
   * - Broadcasts game over event
   * - Keeps lobby players for next game
   */
  endGameAndReturnToLobby(): void {
    // Game over should already be set by GameState or VotingSystem
    if (this.gameState.getPhase() !== GamePhase.GAME_OVER) {
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_ENDED,
        payload: {
          winner: 'Crewmates',
          reason: 'Game ended',
        },
      };
      this.sseManager.broadcast(event);
      this.gameState.setPhase(GamePhase.GAME_OVER);
    }

    // Reset state for next game
    this.gameState.reset();
  }

  /**
   * Check if game is over and handle accordingly
   */
  checkGameEnd(): boolean {
    if (this.gameState.getPhase() === 'GameOver') {
      // Broadcast summary
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_OVER_SUMMARY,
        payload: {
          phase: 'GameOver',
          message: 'Game completed. Ready for next game?',
        },
      };
      this.sseManager.broadcast(event);
      return true;
    }
    return false;
  }

  /**
   * Get the lobby manager
   */
  getLobbyManager(): LobbyManager {
    return this.lobbyManager;
  }

  /**
   * Get the game state
   */
  getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Get the map loader
   */
  getMapLoader(): MapLoader {
    return this.mapLoader;
  }

  /**
   * Get available map IDs (for debugging/UI)
   */
  getAvailableMaps(): string[] {
    return this.mapLoader.getMapIds();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/game/coordinator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/coordinator.ts tests/game/coordinator.test.ts
git commit -m "feat(coordinator): integrate random map selection on game start

- Add MapLoader initialization with TEST_MAP
- Select random map in startGame()
- Add getMapLoader() and getAvailableMaps()

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Fix GameState Constructor to Not Require Map

**Files:**
- Modify: `src/game/state.ts`

**Step 1: Update GameState constructor**

The GameState currently initializes RoomManager without a map. We need to handle this gracefully:

```typescript
// src/game/state.ts - update constructor
constructor() {
  // Initialize with empty room manager - will be populated when map loads
  this.roomManager = new RoomManager({
    id: 'empty',
    name: 'Empty',
    rooms: [],
    sabotageLocations: [],
    emergencyButtonRoom: '',
    logsRoom: '',
  });
  this.actionLogger = new ActionLogger();
  this.sseManager = new SSEManager();
  this.taskManager = new TaskManager(this, this.sseManager);
  this.minigameManager = this.taskManager.getMinigameManager();
  this.votingSystem = new VotingSystem(this, this.sseManager);
  this.tickProcessor = new TickProcessor(this, this.sseManager);
  this.sabotageSystem = new SabotageSystem(this, this.sseManager, this.minigameManager);
  this.emergencyButtonSystem = new EmergencyButtonSystem(this);
  this.pendingRevealQueue = new PendingRevealQueue();

  // Rooms will be populated when loadMap is called
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/game/state.ts
git commit -m "refactor(state): initialize with empty map, load on game start

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run all tests**

Run: `bun test`
Expected: PASS

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run build**

Run: `bun run build`
Expected: Success

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(maps): complete map system implementation for HAR-75

- MapDefinition interface with rooms, vents, sabotage locations
- MapLoader class with registration and random selection
- TEST_MAP converted from existing ROOMS constant
- RoomManager refactored to accept MapDefinition
- GameState map loading with loadMap()
- GameCoordinator random map selection on game start

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | MapDefinition types | `src/game/maps/types.ts`, `tests/game/maps/types.test.ts` |
| 2 | MapLoader class | `src/game/maps/loader.ts`, `tests/game/maps/loader.test.ts` |
| 3 | TEST_MAP definition | `src/game/maps/test-map.ts`, `tests/game/maps/test-map.test.ts` |
| 4 | Module index | `src/game/maps/index.ts` |
| 5 | RoomManager refactor | `src/game/rooms.ts`, `tests/game/rooms.test.ts` |
| 6 | Type exports | `src/types/game.ts` |
| 7 | GameState map loading | `src/game/state.ts`, `tests/game/state.test.ts` |
| 8 | GameCoordinator integration | `src/game/coordinator.ts`, `tests/game/coordinator.test.ts` |
| 9 | GameState constructor fix | `src/game/state.ts` |
| 10 | Full test suite | All files |
