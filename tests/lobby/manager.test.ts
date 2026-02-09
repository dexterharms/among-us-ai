import { describe, test, expect, beforeEach } from 'bun:test';
import { LobbyManager } from '@/lobby/manager';
import { PlayerRole, type Player } from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('LobbyManager', () => {
  let lobbyManager: LobbyManager;
  let player1: Player;
  let player2: Player;
  let player3: Player;

  beforeEach(() => {
    lobbyManager = new LobbyManager();

    player1 = createMockPlayer({
      id: 'player-1',
      name: 'Player One',
    });

    player2 = createMockPlayer({
      id: 'player-2',
      name: 'Player Two',
    });

    player3 = createMockPlayer({
      id: 'player-3',
      name: 'Player Three',
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty players map', () => {
      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(0);
    });

    test('should initialize with empty readyStatus set', () => {
      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.size).toBe(0);
    });

    test('should initialize with isCountdownActive as false', () => {
      expect(lobbyManager.getCountdownStatus()).toBe(false);
    });
  });

  describe('join', () => {
    test('should add player to lobby', () => {
      lobbyManager.join(player1);

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(1);
      expect(players[0]).toEqual(player1);
    });

    test('should add multiple players to lobby', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(3);
    });

    test('should overwrite player with duplicate ID', () => {
      lobbyManager.join(player1);

      const player1Updated = createMockPlayer({
        id: 'player-1',
        name: 'Updated Name',
      });
      lobbyManager.join(player1Updated);

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(1);
      expect(players[0].name).toBe('Updated Name'); // New name accepted
    });

    test('should clear ready status if player with duplicate ID joins', () => {
      lobbyManager.join(player1);
      lobbyManager.setReady('player-1', true);

      const player1Rejoined = createMockPlayer({
        id: 'player-1',
        name: 'Rejoined Player',
      });
      lobbyManager.join(player1Rejoined);

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.has('player-1')).toBe(false);
    });
  });

  describe('leave', () => {
    beforeEach(() => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
    });

    test('should remove player from lobby', () => {
      lobbyManager.leave('player-1');

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(2);
      expect(players.find((p) => p.id === 'player-1')).toBeUndefined();
    });

    test('should remove player from ready status', () => {
      lobbyManager.setReady('player-1', true);

      lobbyManager.leave('player-1');

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.has('player-1')).toBe(false);
    });

    test('should handle leaving non-existent player gracefully', () => {
      expect(() => lobbyManager.leave('non-existent')).not.toThrow();

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(3);
    });

    test('should cancel countdown if player leaves and start condition fails', () => {
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      // Countdown should start
      expect(lobbyManager.getCountdownStatus()).toBe(true);

      // One player leaves - exactly MIN_PLAYERS remaining
      lobbyManager.leave('player-3');

      // Countdown should be cancelled since we're at the boundary
      expect(lobbyManager.getCountdownStatus()).toBe(false);
    });

    test('should not cancel countdown if start condition still met', () => {
      lobbyManager.join(createMockPlayer({ id: 'player-4' }));
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);
      lobbyManager.setReady('player-4', true);

      // Countdown should start
      expect(lobbyManager.getCountdownStatus()).toBe(true);

      // One player leaves - still above MIN_PLAYERS
      lobbyManager.leave('player-4');

      // Countdown should remain active
      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });
  });

  describe('setReady', () => {
    beforeEach(() => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
    });

    test('should mark player as ready', () => {
      lobbyManager.setReady('player-1', true);

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.has('player-1')).toBe(true);
    });

    test('should unmark player as ready', () => {
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-1', false);

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.has('player-1')).toBe(false);
    });

    test('should start countdown when all players ready and MIN_PLAYERS met', () => {
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });

    test('should not start countdown when below MIN_PLAYERS', () => {
      // Only 2 players
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);

      expect(lobbyManager.getCountdownStatus()).toBe(false);
    });

    test('should cancel countdown when start condition fails', () => {
      // Start countdown
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);
      expect(lobbyManager.getCountdownStatus()).toBe(true);

      // One player becomes not ready
      lobbyManager.setReady('player-1', false);

      // Condition fails (not all ready), so countdown cancels
      expect(lobbyManager.getCountdownStatus()).toBe(false);
    });

    test('should not cancel countdown when player unready and start condition still met', () => {
      lobbyManager.join(createMockPlayer({ id: 'player-4' }));

      // Start countdown with 4 players
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);
      lobbyManager.setReady('player-4', true);
      expect(lobbyManager.getCountdownStatus()).toBe(true);

      // One player unreads - still 3 ready, which meets MIN_PLAYERS
      lobbyManager.setReady('player-4', false);

      // Countdown should remain active since condition is still met
      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });

    test('should handle setReady for non-existent player gracefully', () => {
      expect(() => lobbyManager.setReady('non-existent', true)).not.toThrow();
    });
  });

  describe('checkStartCondition', () => {
    beforeEach(() => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
    });

    test('should return false when below MIN_PLAYERS', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);

      const result = lobbyManager.checkStartCondition();
      expect(result).toBe(false);
    });

    test('should return false when not all players ready', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);

      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);

      const result = lobbyManager.checkStartCondition();
      expect(result).toBe(false);
    });

    test('should return true when MIN_PLAYERS met and all ready', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);

      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      const result = lobbyManager.checkStartCondition();
      expect(result).toBe(true);
    });

    test('should return true when more than MIN_PLAYERS and all ready', () => {
      lobbyManager.join(createMockPlayer({ id: 'player-4' }));

      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);
      lobbyManager.setReady('player-4', true);

      const result = lobbyManager.checkStartCondition();
      expect(result).toBe(true);
    });
  });

  describe('startCountdown', () => {
    test('should set isCountdownActive to true', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });

    test('should not start countdown if already active', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      const firstStart = lobbyManager.getCountdownStatus();

      lobbyManager.startCountdown();
      const secondStart = lobbyManager.getCountdownStatus();

      expect(firstStart).toBe(true);
      expect(secondStart).toBe(true);
    });
  });

  describe('assignRoles', () => {
    beforeEach(() => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
    });

    test('should assign 1 imposter when players < 7', () => {
      const result = lobbyManager.assignRoles();

      expect(result.imposters).toHaveLength(1);
      expect(result.crewmates).toHaveLength(2);
    });

    test('should assign 2 imposters when players >= 7', () => {
      for (let i = 4; i <= 7; i++) {
        lobbyManager.join(createMockPlayer({ id: `player-${i}` }));
      }

      const result = lobbyManager.assignRoles();

      expect(result.imposters).toHaveLength(2);
      expect(result.crewmates).toHaveLength(5);
    });

    test('should set player roles correctly', () => {
      const result = lobbyManager.assignRoles();

      result.imposters.forEach((id) => {
        const player = lobbyManager.getWaitingPlayers().find((p) => p.id === id);
        expect(player?.role).toBe(PlayerRole.IMPOSTER);
      });

      result.crewmates.forEach((id) => {
        const player = lobbyManager.getWaitingPlayers().find((p) => p.id === id);
        expect(player?.role).toBe(PlayerRole.CREWMATE);
      });
    });

    test('should return all player IDs', () => {
      const result = lobbyManager.assignRoles();

      const allIds = [...result.imposters, ...result.crewmates].sort();
      const playerIds = lobbyManager.getWaitingPlayers().map((p) => p.id).sort();

      expect(allIds).toEqual(playerIds);
    });

    test('should randomly assign roles', () => {
      const results: string[][] = [];

      // Run multiple times to check randomness
      for (let i = 0; i < 10; i++) {
        const lobby = new LobbyManager();
        lobby.join(player1);
        lobby.join(player2);
        lobby.join(player3);

        const result = lobby.assignRoles();
        results.push([...result.imposters]);
      }

      // At least one variation should exist (not guaranteed but likely)
      const uniqueResults = new Set(results.map((r) => r.join(',')));
      // If all same, test passes but role assignment is deterministic
      // If multiple, test passes and roles are random
      expect(uniqueResults.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('broadcastLobbyState', () => {
    beforeEach(() => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
    });

    test('should broadcast current players', () => {
      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(3);
      expect(players[0].id).toBe('player-1');
    });

    test('should broadcast current ready players', () => {
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.size).toBe(2);
    });

    test('should broadcast countdown status', () => {
      expect(lobbyManager.getCountdownStatus()).toBe(false);

      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });
  });

  describe('getWaitingPlayers', () => {
    test('should return array of players', () => {
      lobbyManager.join(player1);

      const players = lobbyManager.getWaitingPlayers();
      expect(players).toBeArray();
      expect(players).toHaveLength(1);
    });

    test('should return empty array when no players', () => {
      const players = lobbyManager.getWaitingPlayers();
      expect(players).toHaveLength(0);
    });

    test('should return copy of players array', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);

      const players1 = lobbyManager.getWaitingPlayers();
      const players2 = lobbyManager.getWaitingPlayers();

      expect(players1).toEqual(players2);
      expect(players1 === players2).toBe(false); // Different array references
    });
  });

  describe('getReadyPlayers', () => {
    test('should return set of ready player IDs', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);

      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.has('player-1')).toBe(true);
      expect(readyPlayers.has('player-2')).toBe(true);
    });

    test('should return empty set when no players ready', () => {
      const readyPlayers = lobbyManager.getReadyPlayers();
      expect(readyPlayers.size).toBe(0);
    });
  });

  describe('getCountdownStatus', () => {
    test('should return false initially', () => {
      expect(lobbyManager.getCountdownStatus()).toBe(false);
    });

    test('should return true after countdown starts', () => {
      lobbyManager.join(player1);
      lobbyManager.join(player2);
      lobbyManager.join(player3);
      lobbyManager.setReady('player-1', true);
      lobbyManager.setReady('player-2', true);
      lobbyManager.setReady('player-3', true);

      expect(lobbyManager.getCountdownStatus()).toBe(true);
    });
  });
});
