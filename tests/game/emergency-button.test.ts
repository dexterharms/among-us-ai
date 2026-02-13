import { describe, test, expect, beforeEach } from 'bun:test';
import { EmergencyButtonSystem } from '@/game/emergency-button';
import { GameState } from '@/game/state';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';
import { SabotageType } from '@/game/sabotage';

describe('EmergencyButtonSystem', () => {
  let system: EmergencyButtonSystem;
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    system = new EmergencyButtonSystem(gameState);
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

    test('returns false 1ms before warm-up expires', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const roundStart = Date.now() - 19999; // 1ms before warm-up expires
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('warm-up');
    });

    test('returns true exactly at warm-up boundary', () => {
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });
      const roundStart = Date.now() - 20000; // Exactly at warm-up boundary
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(true);
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

  describe('sabotage blocking', () => {
    test('returns false during active sabotage', () => {
      // Add an imposter to trigger sabotage
      gameState.addPlayer({
        id: 'imposter',
        name: 'Imposter',
        role: PlayerRole.IMPOSTER,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });

      // Add a crewmate who will try to call emergency
      gameState.addPlayer({
        id: 'p1',
        name: 'Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      });

      // Set game phase to ROUND (required for sabotage)
      gameState.setPhase(GamePhase.ROUND);

      // Trigger a sabotage (by the imposter)
      const sabotageSystem = gameState.getSabotageSystem();
      const sabotageResult = sabotageSystem.triggerSabotage('imposter', { type: SabotageType.LIGHTS });
      expect(sabotageResult.success).toBe(true);

      const roundStart = Date.now() - 30000;
      const result = system.canCallEmergency('p1', 'council-room', roundStart);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('sabotage');
    });
  });
});
