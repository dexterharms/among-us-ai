import { describe, test, expect, beforeEach } from 'bun:test';
import { MapLoader } from '@/game/maps/loader';
import type { MapDefinition } from '@/game/maps/types';

// Minimal test map for testing MapLoader
const TEST_MAP: MapDefinition = {
  id: 'test-map',
  name: 'Test Map',
  rooms: [
    {
      id: 'test-room',
      name: 'Test Room',
      exits: [],
      interactables: [],
      position: { x: 0, y: 0 },
    },
  ],
  sabotageLocations: [{ type: 'lights', roomId: 'test-room' }],
  emergencyButtonRoom: 'test-room',
  logsRoom: 'test-room',
};

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
