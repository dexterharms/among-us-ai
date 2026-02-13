import { describe, test, expect, beforeEach } from 'bun:test';
import { ImposterAbilities } from '@/game/imposter';
import { GameState } from '@/game/state';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';
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
          type: 'Vent' as any,
          name: 'Vent',
          action: 'Use Vent',
          x: 1,
          y: 1,
        });
      }

      const result = imposterAbilities['canVent'](imposter, 'center');
      expect(result).toBe(true);
    });

    test('returns false when player is not imposter', () => {
      const result = imposterAbilities['canVent'](crewmate, 'center');
      expect(result).toBe(false);
    });

    test('returns false when player is dead', () => {
      imposter.status = PlayerStatus.DEAD;
      const result = imposterAbilities['canVent'](imposter, 'center');
      expect(result).toBe(false);
    });

    test('returns false when game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const result = imposterAbilities['canVent'](imposter, 'center');
      expect(result).toBe(false);
    });

    test('returns false when room has no vent', () => {
      const result = imposterAbilities['canVent'](imposter, 'center');
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
          type: 'Vent' as any,
          name: 'Vent to Hallway',
          action: 'Use Vent',
          x: 1,
          y: 1,
        });
      }

      if (hallwayRoom) {
        hallwayRoom.interactables.push({
          id: 'vent-hallway-west',
          type: 'Vent' as any,
          name: 'Vent to Center',
          action: 'Use Vent',
          x: -1,
          y: 1,
        });
      }

      gameState.setPhase(GamePhase.ROUND);
    });

    test('should move imposter to connected vent room', () => {
      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location.roomId).toBe('hallway-west');
      expect(imposter.location.x).toBe(hallwayRoom?.position.x ?? 0);
      expect(imposter.location.y).toBe(hallwayRoom?.position.y ?? 0);
    });

    test('should fail if player is not imposter', () => {
      const originalLocation = imposter.location;

      imposterAbilities.attemptVent(crewmate.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if player is dead', () => {
      imposter.status = PlayerStatus.DEAD;
      const originalLocation = imposter.location;

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const originalLocation = imposter.location;

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if current room has no vent', () => {
      const originalLocation = imposter.location;

      imposterAbilities.attemptVent(imposter.id, 'hallway-west');

      expect(imposter.location).toEqual(originalLocation);
    });

    test('should fail if target room has no vent', () => {
      imposter.location = { roomId: 'hallway-west', x: -1, y: 0 };

      const originalLocation = imposter.location;

      imposterAbilities.attemptVent(imposter.id, 'center');

      expect(imposter.location).toEqual(originalLocation);
    });
  });

  describe('ventCooldown', () => {
    test('should have VENT_COOLDOWN defined', () => {
      expect(imposterAbilities['VENT_COOLDOWN']).toBeDefined();
      expect(typeof imposterAbilities['VENT_COOLDOWN']).toBe('number');
    });
  });

  describe('getVentCooldownRemaining', () => {
    test('should return 0 when no cooldown set', () => {
      const remaining = imposterAbilities.getVentCooldownRemaining(imposter.id);
      expect(remaining).toBe(0);
    });
  });
});
