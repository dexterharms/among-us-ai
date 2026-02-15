import { describe, test, expect } from 'bun:test';
import { TEST_MAP } from '@/game/maps/test-map';
import { MapDefinitionSchema } from '@/game/maps/types';

describe('TEST_MAP', () => {
  test('should be a valid MapDefinition', () => {
    const result = MapDefinitionSchema.safeParse(TEST_MAP);
    expect(result.success).toBe(true);
  });

  test('should have correct id', () => {
    expect(TEST_MAP.id).toBe('the-manor');
  });

  test('should have correct name', () => {
    expect(TEST_MAP.name).toBe('The Manor');
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
