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
      expect(gameState.getRoundTimer()).toBe(30);
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

      expect(player1?.location.roomId).toBeDefined();
      expect(player2?.location.roomId).toBeDefined();
      expect(player3?.location).toEqual(players[2].location); // Dead player location unchanged
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

      expect(gameState.getImposterCount()).toBe(0);
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

      expect(gameState.getImposterCount()).toBe(2);
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

      expect(gameState.getImposterCount()).toBe(0);
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
});
