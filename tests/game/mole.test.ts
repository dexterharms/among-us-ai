import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MoleAbilities } from '@/game/mole';
import { GameState } from '@/game/state';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  type Player,
} from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('MoleAbilities', () => {
  let gameState: GameState;
  let moleAbilities: MoleAbilities;
  let mole1: Player;
  let mole2: Player;
  let loyalists: Player[];

  beforeEach(() => {
    gameState = new GameState();
    moleAbilities = new MoleAbilities(gameState, gameState.getSSEManager());

    // Create players: 2 moles, 8 loyalists
    // We need enough players so that early kills don't end the game
    mole1 = createMockPlayer({
      id: 'mole-1',
      name: 'The Mole 1',
      role: PlayerRole.MOLE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    mole2 = createMockPlayer({
      id: 'mole-2',
      name: 'The Mole 2',
      role: PlayerRole.MOLE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 5, y: 5 },
    });

    loyalists = Array.from({ length: 8 }, (_, i) =>
      createMockPlayer({
        id: `loyalist-${i}`,
        name: `Loyalist ${i}`,
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 10 + i * 10, y: 10 + i * 10 },
      }),
    );

    // Add players to game state
    gameState.addPlayer(mole1);
    gameState.addPlayer(mole2);
    loyalists.forEach((player) => gameState.addPlayer(player));

    // Set game to ROUND phase
    gameState.setPhase(GamePhase.ROUND);
  });

  afterEach(() => {
    // Cleanup - stop game loops
    gameState['stopGameLoop']();
  });

  describe('Initialization', () => {
    test('should initialize with empty kill cooldowns', () => {
      expect(moleAbilities['killCooldowns'].size).toBe(0);
    });

    test('should have KILL_COOLDOWN set to 30000ms (30 seconds)', () => {
      expect(moleAbilities['KILL_COOLDOWN']).toBe(30000);
    });
  });

  describe('attemptKill - Valid Kills', () => {
    test('should successfully kill loyalist in same room', () => {
      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.DEAD);
      expect(gameState.deadBodies).toHaveLength(1);
      expect(gameState.deadBodies[0].playerId).toBe('loyalist-0');
    });

    test('should create dead body with correct location', () => {
      const originalLocation = loyalists[1].location;
      moleAbilities.attemptKill('mole-1', 'loyalist-1');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.location).toEqual(originalLocation);
    });

    test('should create dead body with correct role', () => {
      moleAbilities.attemptKill('mole-1', 'loyalist-2');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.role).toBe(PlayerRole.LOYALIST);
    });

    test('should set kill cooldown after successful kill', () => {
      const beforeKill = Date.now();
      moleAbilities.attemptKill('mole-1', 'loyalist-3');
      const afterKill = Date.now();

      const cooldownEnd =
        moleAbilities['killCooldowns'].get('mole-1');
      expect(cooldownEnd).toBeDefined();
      expect(cooldownEnd).toBeGreaterThanOrEqual(beforeKill + 30000);
      expect(cooldownEnd).toBeLessThanOrEqual(afterKill + 30000);
    });

    test('should mark dead body as not reported', () => {
      moleAbilities.attemptKill('mole-1', 'loyalist-4');

      const deadBody = gameState.deadBodies[0];
      expect(deadBody.reported).toBe(false);
    });

    test('should allow multiple kills to multiple targets', () => {
      moleAbilities.attemptKill('mole-1', 'loyalist-0');
      expect(loyalists[0].status).toBe(PlayerStatus.DEAD);

      // Simulate cooldown expiration by setting cooldown to past
      moleAbilities['killCooldowns'].set('mole-1', Date.now() - 1000);
      moleAbilities.attemptKill('mole-1', 'loyalist-1');

      expect(loyalists[1].status).toBe(PlayerStatus.DEAD);
      expect(gameState.deadBodies).toHaveLength(2);
    });
  });

  describe('attemptKill - Invalid Kills', () => {
    test('should not kill when mole is not a mole', () => {
      const fakeMole = createMockPlayer({
        id: 'fake-mole',
        role: PlayerRole.LOYALIST,
        location: { roomId: 'center', x: 100, y: 100 },
      });
      gameState.addPlayer(fakeMole);

      moleAbilities.attemptKill('fake-mole', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target is also a mole', () => {
      moleAbilities.attemptKill('mole-1', 'mole-2');

      expect(mole2.status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when mole is dead', () => {
      mole1.status = PlayerStatus.DEAD;

      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target is already dead', () => {
      loyalists[0].status = PlayerStatus.DEAD;

      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when game phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);

      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when players are in different rooms', () => {
      mole1.location = { roomId: 'center', x: 0, y: 0 };
      loyalists[0].location = { roomId: 'hallway-west', x: -10, y: 0 };

      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when kill is on cooldown', () => {
      // First kill
      moleAbilities.attemptKill('mole-1', 'loyalist-0');
      expect(loyalists[0].status).toBe(PlayerStatus.DEAD);

      // Reset loyalist for second kill attempt
      loyalists[0].status = PlayerStatus.ALIVE;
      loyalists[0].location = { roomId: 'center', x: 100, y: 100 };

      // Second kill attempt (should fail due to cooldown)
      moleAbilities.attemptKill('mole-1', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(1); // Only first kill
    });

    test('should not kill when mole does not exist', () => {
      moleAbilities.attemptKill('non-existent', 'loyalist-0');

      expect(loyalists[0].status).toBe(PlayerStatus.ALIVE);
      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should not kill when target does not exist', () => {
      moleAbilities.attemptKill('mole-1', 'non-existent');

      expect(gameState.deadBodies).toHaveLength(0);
    });
  });

  describe('canKill', () => {
    test('should return true for valid kill conditions', () => {
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(true);
    });

    test('should return false when killer is not mole', () => {
      const loyalistKiller = createMockPlayer({
        id: 'loyalist-killer',
        role: PlayerRole.LOYALIST,
        location: { roomId: 'center', x: 20, y: 20 },
      });
      const canKill = moleAbilities['canKill'](loyalistKiller, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when target is mole', () => {
      const targetMole = createMockPlayer({
        id: 'mole-2',
        role: PlayerRole.MOLE,
        location: { roomId: 'center', x: 5, y: 5 },
      });
      const canKill = moleAbilities['canKill'](mole1, targetMole);
      expect(canKill).toBe(false);
    });

    test('should return false when killer is dead', () => {
      mole1.status = PlayerStatus.DEAD;
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when target is dead', () => {
      loyalists[0].status = PlayerStatus.DEAD;
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when phase is not ROUND', () => {
      gameState.setPhase(GamePhase.LOBBY);
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when players are in different rooms', () => {
      mole1.location = { roomId: 'center', x: 0, y: 0 };
      loyalists[0].location = { roomId: 'hallway-west', x: -10, y: 0 };
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return false when on cooldown', () => {
      // Set a future cooldown time
      moleAbilities['killCooldowns'].set(
        'mole-1',
        Date.now() + 10000,
      );
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(false);
    });

    test('should return true when cooldown has expired', () => {
      // Set a past cooldown time
      moleAbilities['killCooldowns'].set(
        'mole-1',
        Date.now() - 1000,
      );
      const canKill = moleAbilities['canKill'](mole1, loyalists[0]);
      expect(canKill).toBe(true);
    });
  });

  describe('checkWinCondition', () => {
    test('should trigger moles win when moles >= loyalists', () => {
      // Kill 7 loyalists, leaving 2 moles and 1 loyalist
      for (let i = 0; i < 7; i++) {
        loyalists[i].status = PlayerStatus.DEAD;
      }

      moleAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should trigger loyalists win when no moles alive', () => {
      // Kill all moles
      mole1.status = PlayerStatus.DEAD;
      mole2.status = PlayerStatus.DEAD;

      moleAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger win condition when moles < loyalists', () => {
      // Kill 1 loyalist
      loyalists[0].status = PlayerStatus.DEAD;

      moleAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should not trigger win condition when there are multiple moles', () => {
      // Keep all players alive: 2 moles, 8 loyalists
      // 2 < 8, so no win
      moleAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should trigger moles win when moles = loyalists', () => {
      // Kill 6 loyalists, leaving 2 moles and 2 loyalists
      for (let i = 0; i < 6; i++) {
        loyalists[i].status = PlayerStatus.DEAD;
      }

      moleAbilities['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });
  });
});
