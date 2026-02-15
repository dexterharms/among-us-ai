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
