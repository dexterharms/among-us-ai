import { describe, test, expect, beforeEach } from 'bun:test';
import { ImposterAbilities } from '@/game/imposter';
import { GameState } from '@/game/state';
import { PlayerRole, PlayerStatus, GamePhase, InteractableType, type Player } from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('ImposterAbilities - Vent System', () => {
  let gameState: GameState;
  let imposterAbilities: ImposterAbilities;
  let imposter: Player;
  let crewmate: Player;

  beforeEach(() => {
    gameState = new GameState();
    imposterAbilities = new ImposterAbilities(gameState, gameState.getSSEManager());

    imposter = createMockPlayer({
      id: 'imposter-1',
      name: 'The Imposter',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    crewmate = createMockPlayer({
      id: 'crewmate-1',
      name: 'Crewmate One',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    gameState.addPlayer(imposter);
    gameState.addPlayer(crewmate);
    gameState.setPhase(GamePhase.ROUND);
  });

  describe('canVent', () => {
    test('returns true for imposter in room with vent', () => {
      // Add vent to center room
      const room = gameState.rooms.get('center');
      if (room) {
        room.interactables.push({
          id: 'vent-1',
          type: InteractableType.VENT,
          name: 'Vent',
          action: 'Use Vent',
          x: 1,
          y: 1,
        });
      }

      const result = imposterAbilities['canVent'](imposter.id, 'center');
      expect(result).toBe(true);
    });

    test('returns false when player is not imposter', () => {
      const result = imposterAbilities['canVent'](crewmate.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when player is dead', () => {
      imposter.status = PlayerStatus.DEAD;
      const result = imposterAbilities['canVent'](imposter.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const result = imposterAbilities['canVent'](imposter.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when room has no vent', () => {
      const result = imposterAbilities['canVent'](imposter.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when player does not exist', () => {
      const result = imposterAbilities['canVent']('non-existent-player', 'center');
      expect(result).toBe(false);
    });

    test('returns false when target room does not exist', () => {
      const result = imposterAbilities['canVent'](imposter.id, 'non-existent-room');
      expect(result).toBe(false);
    });
  });

  describe('attemptVent', () => {
    beforeEach(() => {
      // Add vents to rooms for testing
      const centerRoom = gameState.rooms.get('center');
      const hallwayRoom = gameState.rooms.get('hallway-west');

      if (centerRoom) {
        centerRoom.interactables.push({
          id: 'vent-center',
          type: InteractableType.VENT,
          name: 'Vent to Hallway',
          action: 'Use Vent',
          x: 1,
          y: 1,
        });
      }

      if (hallwayRoom) {
        hallwayRoom.interactables.push({
          id: 'vent-hallway-west',
          type: InteractableType.VENT,
          name: 'Vent to Center',
          action: 'Use Vent',
          x: -1,
          y: 1,
        });
      }

      gameState.setPhase(GamePhase.ROUND);
    });

    test('should move imposter to connected vent room', () => {
      const hallwayRoom = gameState.rooms.get('hallway-west');
      expect(hallwayRoom).toBeDefined();

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location.roomId).toBe('hallway-west');
      expect(imposter.location.x).toBe(hallwayRoom!.position.x);
      expect(imposter.location.y).toBe(hallwayRoom!.position.y);
    });

    test('should fail if player is not imposter', () => {
      const originalLocation = { ...crewmate.location };

      imposterAbilities.attemptVent(crewmate.id, 'hallway-west');

      expect(crewmate.location).toEqual(originalLocation);
    });

    test('should fail if player is dead', () => {
      imposter.status = PlayerStatus.DEAD;
      const originalLocation = { ...imposter.location };

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const originalLocation = { ...imposter.location };

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if current room has no vent', () => {
      // Move imposter to a room without vents (and remove vents from center for this test)
      const room = gameState.rooms.get('center');
      if (room) {
        room.interactables = room.interactables.filter(i => i.type !== InteractableType.VENT);
      }

      const originalLocation = { ...imposter.location };

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if target room has no vent', () => {
      // Remove vent from hallway-west for this test
      const hallwayRoom = gameState.rooms.get('hallway-west');
      if (hallwayRoom) {
        hallwayRoom.interactables = hallwayRoom.interactables.filter(i => i.type !== InteractableType.VENT);
      }

      const originalLocation = { ...imposter.location };

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should not crash when player does not exist', () => {
      // Should not throw and should not crash
      imposterAbilities.attemptVent('non-existent-player', 'hallway-west');
      // Verify imposter location unchanged (sanity check)
      expect(imposter.location.roomId).toBe('center');
    });

    test('should not crash when target room does not exist', () => {
      const originalLocation = { ...imposter.location };

      imposterAbilities.attemptVent(imposter.id, 'non-existent-room');

      expect(imposter.location).toEqual(originalLocation);
    });
  });

  describe('ventCooldown', () => {
    beforeEach(() => {
      // Add vents to rooms for testing
      const centerRoom = gameState.rooms.get('center');
      const hallwayRoom = gameState.rooms.get('hallway-west');

      if (centerRoom) {
        centerRoom.interactables.push({
          id: 'vent-center',
          type: InteractableType.VENT,
          name: 'Vent to Hallway',
          action: 'Use Vent',
          x: 1,
          y: 1,
        });
      }

      if (hallwayRoom) {
        hallwayRoom.interactables.push({
          id: 'vent-hallway-west',
          type: InteractableType.VENT,
          name: 'Vent to Center',
          action: 'Use Vent',
          x: -1,
          y: 1,
        });
      }

      gameState.setPhase(GamePhase.ROUND);
    });

    test('should have VENT_COOLDOWN set to 30000ms (30 seconds)', () => {
      expect(imposterAbilities['VENT_COOLDOWN']).toBe(30000);
    });

    test('should set cooldown after venting', () => {
      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      // Cooldown should be set (non-zero)
      const remaining = imposterAbilities.getVentCooldownRemaining(imposter.id);
      expect(remaining).toBeGreaterThan(0);
    });

    test('should prevent venting during cooldown', () => {
      // First vent
      imposterAbilities.attemptVent(imposter.id, 'hallway-west');
      expect(imposter.location.roomId).toBe('hallway-west');

      const originalLocation = { ...imposter.location };

      // Try to vent again immediately (should fail due to cooldown)
      imposterAbilities.attemptVent(imposter.id, 'center');

      // Location should not change
      expect(imposter.location).toEqual(originalLocation);
    });

    test('should allow venting after cooldown expires', () => {
      // First vent
      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      // Manually expire the cooldown
      (imposterAbilities as any).ventCooldowns.set(imposter.id, Date.now() - 1);

      // Should be able to vent again
      imposterAbilities.attemptVent(imposter.id, 'center');
      expect(imposter.location.roomId).toBe('center');
    });
  });

  describe('getVentCooldownRemaining', () => {
    test('should return 0 when no cooldown set', () => {
      const remaining = imposterAbilities.getVentCooldownRemaining(imposter.id);
      expect(remaining).toBe(0);
    });
  });
});
