import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GameServer } from '@/server/index';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';
import { EmergencyButtonSystem } from '@/game/emergency-button';
import { SabotageType } from '@/game/sabotage';

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
      emergencyMeetingsUsed: 0,
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
      gameState['roundStartTime'] = Date.now() - EmergencyButtonSystem.WARMUP_DURATION_MS - 1000;

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

    it('should return failure when player already used emergency meeting', async () => {
      const gameState = server.getGameState();
      const player = gameState.players.get('player-1');
      if (player) {
        player.emergencyMeetingsUsed = 1; // Already used
      }

      // Mock round start time to be past warm-up
      gameState['roundStartTime'] = Date.now() - EmergencyButtonSystem.WARMUP_DURATION_MS - 1000;

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('already used');
    });

    it('should return failure during active sabotage', async () => {
      const gameState = server.getGameState();

      // Add an imposter to trigger sabotage
      const imposter = {
        id: 'imposter-1',
        name: 'Imposter One',
        role: PlayerRole.IMPOSTER,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'council-room', x: -2, y: 0 },
        emergencyMeetingsUsed: 0,
      };
      gameState.addPlayer(imposter);

      // Mock round start time to be past warm-up
      gameState['roundStartTime'] = Date.now() - EmergencyButtonSystem.WARMUP_DURATION_MS - 1000;

      // Trigger lights sabotage
      const sabotageSystem = gameState.getSabotageSystem();
      const sabotageResult = sabotageSystem.triggerSabotage('imposter-1', { type: SabotageType.LIGHTS });
      expect(sabotageResult.success).toBe(true);

      const response = await fetch(`http://localhost:${port}/api/game/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'player-1' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason?: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('sabotage');
    });
  });
});
