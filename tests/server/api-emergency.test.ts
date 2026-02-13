import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GameServer } from '@/server/index';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';

describe('POST /api/game/emergency endpoint', () => {
  let server: GameServer;
  let port: number;

  beforeEach(async () => {
    // Use a random available port
    server = new GameServer(0);
    await server.start();

    // Get the actual port assigned
    port = server.getPort();

    const gameState = server.getGameState();

    // Create test player in council-room
    const player = {
      id: 'player-1',
      name: 'Player One',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'council-room', x: 0, y: 0 },
      tasks: [],
    };

    gameState.addPlayer(player);
    gameState.setPhase(GamePhase.ROUND);
  });

  afterEach(() => {
    server.stop();
  });

  describe('validation', () => {
    it('should return 400 when playerId is missing', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('playerId');
    });

    it('should return failure when player not found', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'non-existent' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('not found');
    });
  });

  describe('successful emergency call', () => {
    it('should return success when emergency call is valid', async () => {
      const gameState = server.getGameState();

      // Mock round start time to be past warm-up (20 seconds)
      const warmUpDuration = 20000;
      gameState['roundStartTime'] = Date.now() - warmUpDuration - 1000;

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(true);
    });
  });

  describe('failure cases', () => {
    it('should return failure when player is not in council room', async () => {
      const gameState = server.getGameState();
      const player = gameState.players.get('player-1');
      if (player) {
        player.location.roomId = 'room-0'; // Not council-room
      }

      // Mock round start time to be past warm-up
      gameState['roundStartTime'] = Date.now() - 21000;

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('council room');
    });

    it('should return failure during warm-up period', async () => {
      const gameState = server.getGameState();

      // Set round start time to now (within warm-up period)
      gameState['roundStartTime'] = Date.now();

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('warm-up');
    });

    it('should return failure when player is dead', async () => {
      const gameState = server.getGameState();
      const player = gameState.players.get('player-1');
      if (player) {
        player.status = PlayerStatus.DEAD;
      }

      // Mock round start time to be past warm-up
      gameState['roundStartTime'] = Date.now() - 21000;

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('not alive');
    });
  });
});
