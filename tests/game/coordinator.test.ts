import { describe, test, expect, beforeEach } from 'bun:test';
import { GameCoordinator } from '@/game/coordinator';
import { GameState } from '@/game/state';
import { LobbyManager } from '@/lobby/manager';
import { SSEManager } from '@/sse/manager';
import { PlayerRole, PlayerStatus, type Player } from '@/types/game';

describe('GameCoordinator', () => {
  let coordinator: GameCoordinator;
  let gameState: GameState;
  let lobbyManager: LobbyManager;
  let sseManager: SSEManager;

  beforeEach(() => {
    sseManager = new SSEManager();
    gameState = new GameState();
    lobbyManager = new LobbyManager(sseManager);
    coordinator = new GameCoordinator(lobbyManager, gameState, sseManager);
  });

  describe('Map Selection', () => {
    test('should have MapLoader initialized', () => {
      expect(coordinator.getMapLoader()).toBeDefined();
    });

    test('should have test-map registered', () => {
      const mapIds = coordinator.getAvailableMaps();
      expect(mapIds).toContain('test-map');
    });

    test('should select map on game start', () => {
      // Add enough players to start
      const players: Player[] = [
        {
          id: 'p1',
          name: 'Alice',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
          emergencyMeetingsUsed: 0,
        },
        {
          id: 'p2',
          name: 'Bob',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
          emergencyMeetingsUsed: 0,
        },
        {
          id: 'p3',
          name: 'Charlie',
          role: PlayerRole.CREWMATE,
          status: PlayerStatus.ALIVE,
          location: { roomId: 'center', x: 0, y: 0 },
          emergencyMeetingsUsed: 0,
        },
      ];

      players.forEach((p) => lobbyManager.join(p));
      players.forEach((p) => lobbyManager.setReady(p.id, true));

      coordinator.startGame();

      expect(gameState.getMapId()).toBe('test-map');
    });
  });
});
