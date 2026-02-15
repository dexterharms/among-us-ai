import { describe, test, expect, beforeEach } from 'bun:test';
import { MoleAbilities } from '@/game/mole';
import { GameState } from '@/game/state';
import { PlayerRole, PlayerStatus, GamePhase, InteractableType, type Player } from '@/types/game';
import { createMockPlayer } from '../framework/test_base';
import { TEST_MAP } from '@/game/maps';

describe('MoleAbilities - Vent System', () => {
  let gameState: GameState;
  let moleAbilities: MoleAbilities;
  let mole: Player;
  let loyalist: Player;

  beforeEach(() => {
    gameState = new GameState();
    gameState.loadMap(TEST_MAP);
    moleAbilities = new MoleAbilities(gameState, gameState.getSSEManager());

    mole = createMockPlayer({
      id: 'mole-1',
      name: 'The Mole',
      role: PlayerRole.MOLE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    loyalist = createMockPlayer({
      id: 'loyalist-1',
      name: 'Loyalist One',
      role: PlayerRole.LOYALIST,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    gameState.addPlayer(mole);
    gameState.addPlayer(loyalist);
    gameState.setPhase(GamePhase.ROUND);
  });

  describe('canVent', () => {
    test('returns true for mole in room with vent', () => {
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

      const result = moleAbilities['canVent'](mole.id, 'center');
      expect(result).toBe(true);
    });

    test('returns false when player is not mole', () => {
      const result = moleAbilities['canVent'](loyalist.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when player is dead', () => {
      mole.status = PlayerStatus.DEAD;
      const result = moleAbilities['canVent'](mole.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const result = moleAbilities['canVent'](mole.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when room has no vent', () => {
      const result = moleAbilities['canVent'](mole.id, 'center');
      expect(result).toBe(false);
    });

    test('returns false when player does not exist', () => {
      const result = moleAbilities['canVent']('non-existent-player', 'center');
      expect(result).toBe(false);
    });

    test('returns false when target room does not exist', () => {
      const result = moleAbilities['canVent'](mole.id, 'non-existent-room');
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

    test('should move mole to connected vent room', () => {
      const hallwayRoom = gameState.rooms.get('hallway-west');
      expect(hallwayRoom).toBeDefined();

      moleAbilities.attemptVent(mole.id, 'hallway-west');

      expect(mole.location.roomId).toBe('hallway-west');
      expect(mole.location.x).toBe(hallwayRoom!.position.x);
      expect(mole.location.y).toBe(hallwayRoom!.position.y);
    });

    test('should fail if player is not mole', () => {
      const originalLocation = { ...loyalist.location };

      moleAbilities.attemptVent(loyalist.id, 'hallway-west');

      expect(loyalist.location).toEqual(originalLocation);
    });

    test('should fail if player is dead', () => {
      mole.status = PlayerStatus.DEAD;
      const originalLocation = { ...mole.location };

      moleAbilities.attemptVent(mole.id, 'hallway-west');

      expect(mole.location).toEqual(originalLocation);
    });

    test('should fail if game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const originalLocation = { ...mole.location };

      moleAbilities.attemptVent(mole.id, 'hallway-west');

      expect(mole.location).toEqual(originalLocation);
    });

    test('should fail if current room has no vent', () => {
      // Move mole to a room without vents (and remove vents from center for this test)
      const room = gameState.rooms.get('center');
      if (room) {
        room.interactables = room.interactables.filter(i => i.type !== InteractableType.VENT);
      }

      const originalLocation = { ...mole.location };

      moleAbilities.attemptVent(mole.id, 'hallway-west');

      expect(mole.location).toEqual(originalLocation);
    });

    test('should fail if target room has no vent', () => {
      // Remove vent from hallway-west for this test
      const hallwayRoom = gameState.rooms.get('hallway-west');
      if (hallwayRoom) {
        hallwayRoom.interactables = hallwayRoom.interactables.filter(i => i.type !== InteractableType.VENT);
      }

      const originalLocation = { ...mole.location };

      moleAbilities.attemptVent(mole.id, 'hallway-west');

      expect(mole.location).toEqual(originalLocation);
    });

    test('should not crash when player does not exist', () => {
      // Should not throw and should not crash
      moleAbilities.attemptVent('non-existent-player', 'hallway-west');
      // Verify mole location unchanged (sanity check)
      expect(mole.location.roomId).toBe('center');
    });

    test('should not crash when target room does not exist', () => {
      const originalLocation = { ...mole.location };

      moleAbilities.attemptVent(mole.id, 'non-existent-room');

      expect(mole.location).toEqual(originalLocation);
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
      expect(moleAbilities['VENT_COOLDOWN']).toBe(30000);
    });

    test('should set cooldown after venting', () => {
      moleAbilities.attemptVent(mole.id, 'hallway-west');

      // Cooldown should be set (non-zero)
      const remaining = moleAbilities.getVentCooldownRemaining(mole.id);
      expect(remaining).toBeGreaterThan(0);
    });

    test('should prevent venting during cooldown', () => {
      // First vent
      moleAbilities.attemptVent(mole.id, 'hallway-west');
      expect(mole.location.roomId).toBe('hallway-west');

      const originalLocation = { ...mole.location };

      // Try to vent again immediately (should fail due to cooldown)
      moleAbilities.attemptVent(mole.id, 'center');

      // Location should not change
      expect(mole.location).toEqual(originalLocation);
    });

    test('should allow venting after cooldown expires', () => {
      // First vent
      moleAbilities.attemptVent(mole.id, 'hallway-west');

      // Manually expire the cooldown
      (moleAbilities as any).ventCooldowns.set(mole.id, Date.now() - 1);

      // Should be able to vent again
      moleAbilities.attemptVent(mole.id, 'center');
      expect(mole.location.roomId).toBe('center');
    });
  });

  describe('getVentCooldownRemaining', () => {
    test('should return 0 when no cooldown set', () => {
      const remaining = moleAbilities.getVentCooldownRemaining(mole.id);
      expect(remaining).toBe(0);
    });
  });
});
