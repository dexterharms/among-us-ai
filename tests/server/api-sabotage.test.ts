import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GameServer } from '@/server/index';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';
import { SabotageType } from '@/game/sabotage';

describe('POST /api/game/sabotage endpoint', () => {
  let server: GameServer;
  let port: number;

  beforeEach(async () => {
    // Use a random available port
    server = new GameServer(0);
    await server.start();

    // Get the actual port assigned
    port = server.getPort();

    const gameState = server.getGameState();

    // Create test players
    const imposter = {
      id: 'imposter-1',
      name: 'Imposter One',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'room-0', x: 0, y: 0 },
      tasks: [],
    };

    const crewmate = {
      id: 'crewmate-1',
      name: 'Crewmate One',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'room-0', x: 0, y: 0 },
      tasks: [],
    };

    gameState.addPlayer(imposter);
    gameState.addPlayer(crewmate);
    gameState.phase = GamePhase.ROUND;
  });

  afterEach(() => {
    server.stop();
  });

  describe('validation', () => {
    it('should return 400 when playerId is missing', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sabotageType: SabotageType.LIGHTS_OUT }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('playerId');
    });

    it('should return 400 when sabotageType is missing', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'imposter-1' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('sabotageType');
    });

    it('should return 400 when player does not exist', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'non-existent',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('not found');
    });
  });

  describe('successful sabotage', () => {
    it('should return success when imposter triggers lights sabotage', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('should return success when imposter triggers doors sabotage with target room', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.DOORS,
          targetRoomId: 'room-0',
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('should return success when imposter triggers self-destruct sabotage', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.SELF_DESTRUCT,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe('failure cases', () => {
    it('should return failure when crewmate tries to sabotage', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'crewmate-1',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('imposter');
    });

    it('should return failure when sabotage is already active', async () => {
      // First sabotage
      await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      // Second sabotage (should fail - cooldown or already active)
      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it('should return failure when imposter is dead', async () => {
      // Make imposter dead
      const gameState = server.getGameState();
      const imposter = gameState.players.get('imposter-1');
      if (imposter) imposter.status = PlayerStatus.DEAD;

      const response = await fetch(`http://localhost:${port}/api/game/sabotage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'imposter-1',
          sabotageType: SabotageType.LIGHTS_OUT,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('Dead');
    });
  });
});
