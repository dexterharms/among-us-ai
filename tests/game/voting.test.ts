import { describe, test, expect, beforeEach } from 'bun:test';
import { VotingSystem } from '@/game/voting';
import { GameState } from '@/game/state';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  type DeadBody,
  type Player,
} from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('VotingSystem', () => {
  let gameState: GameState;
  let votingSystem: VotingSystem;
  let players: Player[];
  let mole: Player;
  let loyalists: Player[];

  beforeEach(() => {
    gameState = new GameState();
    votingSystem = new VotingSystem(gameState, gameState.getSSEManager());

    // Create players: 1 mole, 5 loyalists
    mole = createMockPlayer({
      id: 'player-1',
      name: 'The Mole',
      role: PlayerRole.MOLE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    loyalists = [
      createMockPlayer({
        id: 'player-2',
        name: 'Loyalist 2',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 10, y: 10 },
      }),
      createMockPlayer({
        id: 'player-3',
        name: 'Loyalist 3',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 20, y: 20 },
      }),
      createMockPlayer({
        id: 'player-4',
        name: 'Loyalist 4',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 30, y: 30 },
      }),
      createMockPlayer({
        id: 'player-5',
        name: 'Loyalist 5',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 40, y: 40 },
      }),
      createMockPlayer({
        id: 'player-6',
        name: 'Loyalist 6',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 50, y: 50 },
      }),
    ];

    players = [mole, ...loyalists];
    players.forEach((player) => gameState.addPlayer(player));
  });

  describe('Initialization', () => {
    test('should initialize with empty votes', () => {
      expect(votingSystem.votes.size).toBe(0);
    });

    test('should initialize with councilStartedAt set', () => {
      expect(votingSystem.councilStartedAt).toBeDefined();
      expect(votingSystem.councilStartedAt).toBeNumber();
    });

    test('should initialize with empty livingPlayers array', () => {
      expect(votingSystem.livingPlayers).toHaveLength(0);
    });
  });

  describe('startCouncil', () => {
    test('should set game phase to VOTING', () => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });

    test('should clear previous votes', () => {
      // Simulate previous votes
      votingSystem.votes.set('player-2', 'player-1');

      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should update councilStartedAt timestamp', () => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      const now = Date.now();
      expect(votingSystem.councilStartedAt).toBeLessThanOrEqual(now);
    });

    test('should populate livingPlayers with alive players', () => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      expect(votingSystem.livingPlayers).toHaveLength(players.length);
      expect(votingSystem.livingPlayers).toContain('player-1');
      expect(votingSystem.livingPlayers).toContain('player-2');
      expect(votingSystem.livingPlayers).toContain('player-6');
    });

    test('should not include dead players in livingPlayers', () => {
      // Mark a player as dead
      players[1].status = PlayerStatus.DEAD;

      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      expect(votingSystem.livingPlayers.length).toBe(players.length - 1);
      expect(votingSystem.livingPlayers).not.toContain('player-2');
    });

    test('should not include ejected players in livingPlayers', () => {
      // Mark a player as ejected
      players[2].status = PlayerStatus.EJECTED;

      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);

      expect(votingSystem.livingPlayers.length).toBe(players.length - 1);
      expect(votingSystem.livingPlayers).not.toContain('player-3');
    });
  });

  describe('castVote', () => {
    beforeEach(() => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);
    });

    test('should record vote for valid target', () => {
      votingSystem.castVote('player-2', 'player-1');

      expect(votingSystem.votes.size).toBe(1);
      expect(votingSystem.votes.get('player-2')).toBe('player-1');
    });

    test('should record skip vote as "skip"', () => {
      votingSystem.castVote('player-2', null);

      expect(votingSystem.votes.size).toBe(1);
      expect(votingSystem.votes.get('player-2')).toBe('skip');
    });

    test('should not allow dead player to vote', () => {
      players[1].status = PlayerStatus.DEAD;

      votingSystem.castVote('player-2', 'player-1');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow ejected player to vote', () => {
      players[1].status = PlayerStatus.EJECTED;

      votingSystem.castVote('player-2', 'player-1');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow voting for dead player', () => {
      players[1].status = PlayerStatus.DEAD;

      votingSystem.castVote('player-3', 'player-2');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow voting for ejected player', () => {
      players[1].status = PlayerStatus.EJECTED;

      votingSystem.castVote('player-3', 'player-2');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow non-existent player to vote', () => {
      votingSystem.castVote('non-existent', 'player-1');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow voting for non-existent player', () => {
      votingSystem.castVote('player-2', 'non-existent');

      expect(votingSystem.votes.size).toBe(0);
    });

    test('should not allow duplicate votes from same player', () => {
      votingSystem.castVote('player-2', 'player-1');
      votingSystem.castVote('player-2', 'player-3');

      expect(votingSystem.votes.size).toBe(1);
      expect(votingSystem.votes.get('player-2')).toBe('player-1');
    });

    test('should allow multiple players to vote', () => {
      votingSystem.castVote('player-2', 'player-1');
      votingSystem.castVote('player-3', 'player-2');
      votingSystem.castVote('player-4', 'player-1');

      expect(votingSystem.votes.size).toBe(3);
    });
  });

  describe('ejectPlayer', () => {
    beforeEach(() => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);
    });

    test('should set player status to EJECTED', () => {
      votingSystem.ejectPlayer('player-2');

      expect(players[1].status).toBe(PlayerStatus.EJECTED);
    });

    test('should not change other players status', () => {
      votingSystem.ejectPlayer('player-2');

      expect(players[0].status).toBe(PlayerStatus.ALIVE);
      expect(players[2].status).toBe(PlayerStatus.ALIVE);
    });

    test('should handle ejection of non-existent player gracefully', () => {
      expect(() => votingSystem.ejectPlayer('non-existent')).not.toThrow();
    });
  });

  describe('checkWinCondition', () => {
    beforeEach(() => {
      const deadBodies: DeadBody[] = [];
      votingSystem.startCouncil(deadBodies);
    });

    test('should trigger loyalists win when all moles ejected', () => {
      votingSystem.ejectPlayer('player-1'); // Eject mole
      votingSystem['checkWinCondition'](); // Explicitly check win condition

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger loyalists win if moles remain', () => {
      votingSystem.ejectPlayer('player-2'); // Eject loyalist
      votingSystem['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });

    test('should trigger moles win when moles >= loyalists', () => {
      // Kill 4 loyalists, leaving 1 mole and 1 loyalist
      players[1].status = PlayerStatus.DEAD;
      players[2].status = PlayerStatus.DEAD;
      players[3].status = PlayerStatus.DEAD;
      players[4].status = PlayerStatus.DEAD;

      votingSystem['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger win when moles < loyalists', () => {
      // Kill 1 loyalist
      players[1].status = PlayerStatus.DEAD;

      votingSystem['checkWinCondition']();

      expect(gameState.getPhase()).toBe(GamePhase.VOTING);
    });
  });

  describe('getLivingPlayerCount', () => {
    test('should count all alive players', () => {
      const count = votingSystem.getLivingPlayerCount();
      expect(count).toBe(players.length);
    });

    test('should not count dead players', () => {
      players[1].status = PlayerStatus.DEAD;
      players[2].status = PlayerStatus.DEAD;

      const count = votingSystem.getLivingPlayerCount();
      expect(count).toBe(players.length - 2);
    });

    test('should not count ejected players', () => {
      players[1].status = PlayerStatus.EJECTED;
      players[2].status = PlayerStatus.EJECTED;

      const count = votingSystem.getLivingPlayerCount();
      expect(count).toBe(players.length - 2);
    });

    test('should return 0 when all players are dead/ejected', () => {
      players.forEach((p) => {
        p.status = PlayerStatus.DEAD;
      });

      const count = votingSystem.getLivingPlayerCount();
      expect(count).toBe(0);
    });
  });
});
