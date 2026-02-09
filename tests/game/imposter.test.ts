import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ImposterAbilities } from '@/game/imposter';
import { GameState } from '@/game/state';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  type Player,
} from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('ImposterAbilities', () => {
  let gameState: GameState;
  let imposterAbilities: ImposterAbilities;
  let imposter1: Player;
  let imposter2: Player;
  let crewmates: Player[];

  beforeEach(() => {
    gameState = new GameState();
    imposterAbilities = new ImposterAbilities(gameState);

    // Create players: 2 imposters, 8 crewmates
    // We need enough players so that early kills don't end the game
    imposter1 = createMockPlayer({
      id: 'imposter-1',
      name: 'The Imposter 1',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    imposter2 = createMockPlayer({
      id: 'imposter-2',
      name: 'The Imposter 2',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 5, y: 5 },
    });

    crewmates = Array.from({ length: 8 }, (_, i) =>
      createMockPlayer({
        id: `crewmate-${i}`,
        name: `Crewmate ${i}`,
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 10 + i * 10, y: 10 + i * 10 },
      }),
    );

    // Add players to game state
    gameState.addPlayer(imposter1);
    gameState.addPlayer(imposter2);
    crewmates.forEach((player) => gameState.addPlayer(player));

    // Set game to ROUND phase
    gameState.setPhase(GamePhase.ROUND);
  });

  afterEach(() => {
    // Cleanup - stop game loops
    gameState['stopGameLoop']();
  });

  describe('Initialization', () => {
    test('should initialize with empty kill cooldowns', () => {
      expect(imposterAbilities['killCooldowns'].size).toBe(0);
    });

    test('should have KILL_COOLDOWN set to 30000ms (30 seconds)', () => {
      expect(imposterAbilities['KILL_COOLDOWN']).toBe(30000);
    });
  });

  describe('attemptKill - Valid Kills', () => {
    test('should successfully kill crewmate in same room', () => {
      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.DEAD);
      expect(gameState.deadBodies).toHaveLength(1);
      expect(gameState.deadBodies[0].playerId).toBe('crewmate-0');
    });

    test('should create dead body with correct location', () => {
      const originalLocation = crewmates[1].location;
      imposterAbilities.attemptKill('imposter-1', 'crewmate-1');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.location).toEqual(originalLocation);
    });

    test('should create dead body with correct role', () => {
      imposterAbilities.attemptKill('imposter-1', 'crewmate-2');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.role).toBe(PlayerRole.CREWMATE);
    });

    test('should set kill cooldown after successful kill', () => {
      const beforeKill = Date.now();
      imposterAbilities.attemptKill('imposter-1', 'crewmate-3');
      const afterKill = Date.now();

      const cooldownEnd =
        imposterAbilities['killCooldowns'].get('imposter-1');
      expect(cooldownEnd).toBeDefined();
      expect(cooldownEnd).toBeGreaterThanOrEqual(beforeKill + 30000);
      expect(cooldownEnd).toBeLessThanOrEqual(afterKill + 30000);
    });

    test('should mark dead body as not reported', () => {
      imposterAbilities.attemptKill('imposter-1', 'crewmate-4');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.reported).toBe(false);
    });

    test('should allow multiple kills to multiple targets', () => {
      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');
      expect(crewmates[0].status).toBe(PlayerStatus.DEAD);

      // Simulate cooldown expiration by setting cooldown to past
      imposterAbilities['killCooldowns'].set('imposter-1', Date.now() - 1000);
      imposterAbilities.attemptKill('imposter-1', 'crewmate-1');

      expect(crewmates[1].status).toBe(PlayerStatus.DEAD);
      expect(gameState.deadBodies).toHaveLength(2);
    });
  });

  describe('attemptKill - Invalid Kills', () => {
    test('should not kill when imposter is not an imposter', () => {
      const fakeImposter = createMockPlayer({
        id: 'fake-imposter',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 100, y: 100 },
      });
      gameState.addPlayer(fakeImposter);

      imposterAbilities.attemptKill('fake-imposter', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target is also an imposter', () => {
      imposterAbilities.attemptKill('imposter-1', 'imposter-2');

      expect(imposter2.status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when imposter is dead', () => {
      imposter1.status = PlayerStatus.DEAD;

      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target is already dead', () => {
      crewmates[0].status = PlayerStatus.DEAD;

      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);

      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when players are in different rooms', () => {
      imposter1.location = { roomId: 'center', x: 0, y: 0 };
      crewmates[0].location = { roomId: 'hallway-west', x: -10, y: 0 };

      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when kill is on cooldown', () => {
      // First kill
      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');
      expect(crewmates[0].status).toBe(PlayerStatus.DEAD);

      // Reset crewmate for second kill attempt
      crewmates[0].status = PlayerStatus.ALIVE;
      crewmates[0].location = { roomId: 'center', x: 100, y: 100 };

      // Second kill attempt (should fail due to cooldown)
      imposterAbilities.attemptKill('imposter-1', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(1); // Only first kill
    });

    test('should not kill when imposter does not exist', () => {
      imposterAbilities.attemptKill('non-existent', 'crewmate-0');

      expect(crewmates[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target does not exist', () => {
      imposterAbilities.attemptKill('imposter-1', 'non-existent');

      expect(gameState.deadBodies).toHaveLength(0);
    });
  });

  describe('canKill', () => {
    test('should return true for valid kill conditions', () => {
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(true);
    });

    test('should return false when killer is not imposter', () => {
      const crewmateKiller = createMockPlayer({
        id: 'crewmate-killer',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 20, y: 20 },
      });
      const canKill = imposterAbilities['canKill'](crewmateKiller, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when target is imposter', () => {
      const targetImposter = createMockPlayer({
        id: 'imposter-2',
        role: PlayerRole.IMPOSTER,
        location: { roomId: 'center', x: 5, y: 5 },
      });
      const canKill = imposterAbilities['canKill'](imposter1, targetImposter);
      expect(canKill).toBe(false);
    });

    test('should return false when killer is dead', () => {
      imposter1.status = PlayerStatus.DEAD;
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when target is dead', () => {
      crewmates[0].status = PlayerStatus.DEAD;
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when players are in different rooms', () => {
      imposter1.location = { roomId: 'center', x: 0, y: 0 };
      crewmates[0].location = { roomId: 'hallway-west', x: -10, y: 0 };
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when on cooldown', () => {
      // Set a future cooldown time
      imposterAbilities['killCooldowns'].set(
        'imposter-1',
        Date.now() + 10000,
      );
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(false);
    });

    test('should return true when cooldown has expired', () => {
      // Set a past cooldown time
      imposterAbilities['killCooldowns'].set(
        'imposter-1',
        Date.now() - 1000,
      );
      const canKill = imposterAbilities['canKill'](imposter1, crewmates[0]);
      expect(canKill).toBe(true);
    });
  });

  describe('checkWinCondition', () => {
    test('should trigger imposters win when imposters >= crewmates', () => {
      // Kill 7 crewmates, leaving 2 imposters and 1 crewmate
      for (let i = 0; i < 7; i++) {
        crewmates[i].status = PlayerStatus.DEAD;
      }

      imposterAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should trigger crewmates win when no imposters alive', () => {
      // Kill all imposters
      imposter1.status = PlayerStatus.DEAD;
      imposter2.status = PlayerStatus.DEAD;

      imposterAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger win condition when imposters < crewmates', () => {
      // Kill 1 crewmate
      crewmates[0].status = PlayerStatus.DEAD;

      imposterAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should not trigger win condition when there are multiple imposters', () => {
      // Keep all players alive: 2 imposters, 8 crewmates
      // 2 < 8, so no win
      imposterAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should trigger imposters win when imposters = crewmates', () => {
      // Kill 6 crewmates, leaving 2 imposters and 2 crewmates
      for (let i = 0; i < 6; i++) {
        crewmates[i].status = PlayerStatus.DEAD;
      }

      imposterAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });
  });
});
