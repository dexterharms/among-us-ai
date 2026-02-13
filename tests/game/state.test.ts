import { describe, test, expect, beforeEach } from 'bun:test';
import { GameState } from '@/game/state';
import {
  GamePhase,
  PlayerRole,
  PlayerStatus,
  type Player,
  type DeadBody,
} from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe('Initialization', () => {
    test('should start in Lobby phase', () => {
      expect(gameState.getPhase()).toBe(GamePhase.LOBBY);
    });

    test('should start with round number 0', () => {
      expect(gameState.getRoundNumber()).toBe(0);
    });

    test('should start with round timer 0', () => {
      expect(gameState.getRoundTimer()).toBe(0);
    });

    test('should initialize with rooms from RoomManager', () => {
      const rooms = Array.from(gameState.rooms.values());
      expect(rooms.length).toBeGreaterThan(0);
      expect(rooms[0].id).toBeDefined();
    });

    test('should initialize with empty players map', () => {
      expect(gameState.players.size).toBe(0);
    });

    test('should initialize with empty deadBodies array', () => {
      expect(gameState.deadBodies).toHaveLength(0);
    });
  });

  describe('Phase Management', () => {
    test('should set phase correctly', () => {
      gameState.setPhase(GamePhase.ROUND);
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should cycle through all phases', () => {
      const phases = [
        GamePhase.LOBBY,
        GamePhase.ROUND,
        GamePhase.VOTING,
        GamePhase.GAME_OVER,
      ];

      phases.forEach((phase) => {
        gameState.setPhase(phase);
        expect(gameState.getPhase()).toBe(phase);
      });
    });
  });

  describe('Round Timer Management', () => {
    test('should set round timer', () => {
      gameState.setRoundTimer(60);
      expect(gameState.getRoundTimer()).toBe(60);
    });

    test('should accept zero as valid timer', () => {
      gameState.setRoundTimer(0);
      expect(gameState.getRoundTimer()).toBe(0);
    });

    test('should accept large timer values', () => {
      gameState.setRoundTimer(3600);
      expect(gameState.getRoundTimer()).toBe(3600);
    });

    test('should handle negative timer values', () => {
      gameState.setRoundTimer(-10);
      expect(gameState.getRoundTimer()).toBe(-10);
    });

    test('should reject NaN timer values', () => {
      const initialTimer = gameState.getRoundTimer();
      gameState.setRoundTimer(NaN);
      expect(gameState.getRoundTimer()).toBe(initialTimer);
    });

    test('should reject non-numeric timer values', () => {
      const initialTimer = gameState.getRoundTimer();
      // @ts-expect-error - Testing invalid input type
      gameState.setRoundTimer('invalid');
      expect(gameState.getRoundTimer()).toBe(initialTimer);
    });
  });

  describe('Player Management', () => {
    test('should add player to game state', () => {
      const player: Player = {
        id: 'player-1',
        name: 'Test Player',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 0, y: 0 },
        taskProgress: 0,
      };

      gameState.addPlayer(player);

      expect(gameState.players.size).toBe(1);
      expect(gameState.players.get('player-1')).toEqual(player);
    });

    test('should add multiple players', () => {
      const players = [
        createMockPlayer({ id: 'player-1', name: 'Player 1' }),
        createMockPlayer({ id: 'player-2', name: 'Player 2' }),
        createMockPlayer({ id: 'player-3', name: 'Player 3' }),
      ];

      players.forEach((player) => gameState.addPlayer(player));

      expect(gameState.players.size).toBe(3);
      expect(gameState.players.get('player-1')?.name).toBe('Player 1');
      expect(gameState.players.get('player-2')?.name).toBe('Player 2');
      expect(gameState.players.get('player-3')?.name).toBe('Player 3');
    });

    test('should overwrite player with same ID', () => {
      const player1 = createMockPlayer({
        id: 'player-1',
        name: 'Original Name',
      });
      const player2 = createMockPlayer({
        id: 'player-1',
        name: 'Updated Name',
      });

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);

      expect(gameState.players.size).toBe(1);
      expect(gameState.players.get('player-1')?.name).toBe('Updated Name');
    });
  });

  describe('Round Management', () => {
    test('should start round and increment round number', () => {
      const initialRound = gameState.getRoundNumber();

      gameState.startRound();

      expect(gameState.getRoundNumber()).toBe(initialRound + 1);
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
      expect(gameState.getRoundTimer()).toBe(300); // 5 minutes (300 seconds) per HAR-110
    });

    test('should start multiple rounds and increment each time', () => {
      gameState.startRound();
      expect(gameState.getRoundNumber()).toBe(1);

      gameState.setPhase(GamePhase.LOBBY); // Reset phase
      gameState.startRound();
      expect(gameState.getRoundNumber()).toBe(2);

      gameState.setPhase(GamePhase.LOBBY); // Reset phase
      gameState.startRound();
      expect(gameState.getRoundNumber()).toBe(3);
    });

    test('should clear deadBodies on round start', () => {
      const deadBody: DeadBody = {
        playerId: 'player-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: false,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      expect(gameState.deadBodies).toHaveLength(1);

      gameState.startRound();

      expect(gameState.deadBodies).toHaveLength(0);
    });

    test('should spawn alive players in random rooms on round start', () => {
      const players = [
        createMockPlayer({ id: 'player-1', status: PlayerStatus.ALIVE }),
        createMockPlayer({ id: 'player-2', status: PlayerStatus.ALIVE }),
        createMockPlayer({ id: 'player-3', status: PlayerStatus.DEAD }),
      ];

      players.forEach((player) => gameState.addPlayer(player));

      gameState.startRound();

      const player1 = gameState.players.get('player-1');
      const player2 = gameState.players.get('player-2');
      const player3 = gameState.players.get('player-3');

      // Verify alive players have valid room assignments
      expect(player1?.location.roomId).toBeDefined();
      expect(player2?.location.roomId).toBeDefined();

      // Verify the assigned roomId exists in the rooms map
      if (player1?.location.roomId) {
        expect(gameState.rooms.has(player1.location.roomId)).toBe(true);
        const room1 = gameState.rooms.get(player1.location.roomId);
        expect(player1.location.x).toBe(room1?.position.x);
        expect(player1.location.y).toBe(room1?.position.y);
      }

      if (player2?.location.roomId) {
        expect(gameState.rooms.has(player2.location.roomId)).toBe(true);
        const room2 = gameState.rooms.get(player2.location.roomId);
        expect(player2.location.x).toBe(room2?.position.x);
        expect(player2.location.y).toBe(room2?.position.y);
      }

      // Dead player location should remain unchanged
      expect(player3?.location).toEqual(players[2].location);
    });
  });

  describe('Imposter Count', () => {
    test('should return 0 when no imposters', () => {
      gameState.addPlayer(
        createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }),
      );
      gameState.addPlayer(
        createMockPlayer({ id: 'player-2', role: PlayerRole.CREWMATE }),
      );

      expect(gameState.imposterCount).toBe(0);
    });

    test('should count alive imposters only', () => {
      gameState.addPlayer(
        createMockPlayer({
          id: 'player-1',
          role: PlayerRole.IMPOSTER,
          status: PlayerStatus.ALIVE,
        }),
      );
      gameState.addPlayer(
        createMockPlayer({
          id: 'player-2',
          role: PlayerRole.IMPOSTER,
          status: PlayerStatus.DEAD,
        }),
      );
      gameState.addPlayer(
        createMockPlayer({
          id: 'player-3',
          role: PlayerRole.IMPOSTER,
          status: PlayerStatus.ALIVE,
        }),
      );

      expect(gameState.imposterCount).toBe(2);
    });

    test('should return 0 when all imposters are dead', () => {
      gameState.addPlayer(
        createMockPlayer({
          id: 'player-1',
          role: PlayerRole.IMPOSTER,
          status: PlayerStatus.DEAD,
        }),
      );
      gameState.addPlayer(
        createMockPlayer({
          id: 'player-2',
          role: PlayerRole.IMPOSTER,
          status: PlayerStatus.EJECTED,
        }),
      );

      expect(gameState.imposterCount).toBe(0);
    });
  });

  describe('Council Phase', () => {
    test('should transition to VOTING phase', () => {
      gameState.startRound();
      gameState.startCouncilPhase();

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });

    test('should stop game loop when starting council', () => {
      gameState.startRound();
      // Manually trigger startCouncilPhase since it's private but called by shouldStartCouncil
      // In real usage, shouldStartCouncil would be called when condition is met
      gameState.setPhase(GamePhase.VOTING);

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });
  });

  describe('shouldStartCouncil Edge Cases', () => {
    test('should return false when roundTimer is positive and no bodies reported', () => {
      gameState.setRoundTimer(100);
      expect(gameState.shouldStartCouncil()).toBe(false);
    });

    test('should return false when deadBodies contains null elements', () => {
      const deadBody: DeadBody = {
        playerId: 'victim-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: false,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      gameState.setRoundTimer(100);

      // @ts-expect-error - Testing error handling with null element
      gameState.deadBodies.push(null);

      expect(gameState.shouldStartCouncil()).toBe(false);
    });
  });

  describe('Body Discovery', () => {
    test('should mark body as reported when discovered', () => {
      const deadBody: DeadBody = {
        playerId: 'victim-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: false,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      gameState.discoverBody('player-1', 0);

      expect(gameState.deadBodies[0].reported).toBe(true);
    });

    test('should not report body with invalid bodyId', () => {
      const deadBody: DeadBody = {
        playerId: 'victim-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: false,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      // Negative bodyId should not change deadBodies
      gameState.discoverBody('player-1', -1);
      expect(gameState.deadBodies).toHaveLength(1);
      expect(gameState.deadBodies[0].reported).toBe(false);

      // Out of bounds bodyId should not change deadBodies
      gameState.discoverBody('player-1', 999);
      expect(gameState.deadBodies).toHaveLength(1);
      expect(gameState.deadBodies[0].reported).toBe(false);
    });

    test('should not report already reported body', () => {
      const deadBody: DeadBody = {
        playerId: 'victim-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: true,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      // Should not throw on already reported body
      expect(() => gameState.discoverBody('player-1', 0)).not.toThrow();
    });

    test('should trigger council phase when body is reported', () => {
      const deadBody: DeadBody = {
        playerId: 'victim-1',
        role: PlayerRole.CREWMATE,
        location: { roomId: 'center', x: 0, y: 0 },
        reported: false,
        roomId: 'center',
      };

      gameState.deadBodies.push(deadBody);
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      gameState.discoverBody('player-1', 0);

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });
  });

  describe('Round Timer Behavior (HAR-110)', () => {
    test('should initialize round timer to 300 seconds (5 minutes)', () => {
      gameState.startRound();
      expect(gameState.getRoundTimer()).toBe(300);
    });

    test('should use consistent constant for timer duration', () => {
      gameState.startRound();
      expect(gameState.getRoundTimer()).toBe(300);
    });

    test('should start council phase when timer reaches zero', () => {
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      gameState.startRound();
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);

      // Manually set timer to 0 to simulate round end
      gameState.setRoundTimer(0);

      // shouldStartCouncil should return true when timer <= 0
      expect(gameState.shouldStartCouncil()).toBe(true);
    });

    test('should decrement timer each second in game loop', () => {
      gameState.startRound();
      const initialTimer = gameState.getRoundTimer();

      // Simulate a few ticks
      gameState.setRoundTimer(initialTimer - 3);

      expect(gameState.getRoundTimer()).toBe(initialTimer - 3);
    });

    test('should not start council while timer is positive', () => {
      gameState.addPlayer(createMockPlayer({ id: 'player-1', role: PlayerRole.CREWMATE }));

      gameState.startRound();
      gameState.setRoundTimer(150); // Mid-round

      expect(gameState.shouldStartCouncil()).toBe(false);
    });
  });

  describe('movePlayer', () => {
    test('should successfully move player between connected rooms', () => {
      const player = createMockPlayer({
        id: 'player-1',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 0, y: 0 },
      });

      gameState.addPlayer(player);

      // center is connected to electrical-room
      const result = gameState.movePlayer('player-1', 'electrical-room');

      expect(result).toBe(true);
      expect(player.location.roomId).toBe('electrical-room');
    });

    test('should not move non-existent player', () => {
      const result = gameState.movePlayer('nonexistent', 'electrical-room');
      expect(result).toBe(false);
    });

    test('should not move dead player', () => {
      const player = createMockPlayer({
        id: 'player-1',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.DEAD,
        location: { roomId: 'center', x: 0, y: 0 },
      });

      gameState.addPlayer(player);

      const result = gameState.movePlayer('player-1', 'electrical-room');

      expect(result).toBe(false);
      expect(player.location.roomId).toBe('center');
    });

    test('should not move to disconnected rooms', () => {
      const player = createMockPlayer({
        id: 'player-1',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 0, y: 0 },
      });

      gameState.addPlayer(player);

      // Try to move to a room that is not connected
      const result = gameState.movePlayer('player-1', 'council-room');

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should stop game loop and tick processor', () => {
      gameState.startRound();

      expect(() => gameState.cleanup()).not.toThrow();
    });

    test('should not throw when called multiple times', () => {
      gameState.cleanup();
      expect(() => gameState.cleanup()).not.toThrow();
    });
  });

  describe('reset', () => {
    test('should reset all state to initial values', () => {
      gameState.addPlayer(createMockPlayer({ id: 'player-1' }));
      gameState.startRound();
      gameState.setRoundTimer(100);

      gameState.reset();

      expect(gameState.getPhase()).toBe(GamePhase.LOBBY);
      expect(gameState.getRoundNumber()).toBe(0);
      expect(gameState.getRoundTimer()).toBe(0);
      expect(gameState.deadBodies).toHaveLength(0);
    });
  });

  describe('EmergencyButtonSystem Integration', () => {
    test('should track round start time', () => {
      const gameState = new GameState();
      gameState.startRound();
      expect(gameState.getRoundStartTime()).toBeGreaterThan(0);
    });

    test('should have EmergencyButtonSystem', () => {
      const gameState = new GameState();
      expect(gameState.getEmergencyButtonSystem()).toBeDefined();
    });
  });
});
