import { describe, it, expect, beforeEach } from 'bun:test';
import { GameServer } from '@/server/index';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';
import { SabotageType } from '@/game/sabotage';

describe('POST /api/game/fix endpoint', () => {
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

  describe('validation', () => {
    it('should return 400 when playerId is missing', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixType: 'lights' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('playerId');
    });

    it('should return 400 when fixType is missing', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'crewmate-1' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('fixType');
    });

    it('should return 400 when player does not exist', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'non-existent', fixType: 'lights' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('not found');
    });
  });

  describe('successful fix', () => {
    it('should return success when crewmate fixes lights sabotage', async () => {
      // First, trigger a lights sabotage
      const gameState = server.getGameState();
      const sabotageSystem = gameState.getSabotageSystem();
      sabotageSystem.triggerSabotage('imposter-1', { type: SabotageType.LIGHTS_OUT });

      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'crewmate-1',
          fixType: 'lights',
          fixData: { switchId: 'switch-1' },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('should return success when fixing self-destruct with stop button', async () => {
      // Trigger self-destruct sabotage
      const gameState = server.getGameState();
      const sabotageSystem = gameState.getSabotageSystem();
      sabotageSystem.triggerSabotage('imposter-1', { type: SabotageType.SELF_DESTRUCT });

      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'crewmate-1',
          fixType: 'self-destruct',
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe('failure cases', () => {
    it('should return failure when no sabotage is active', async () => {
      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'crewmate-1',
          fixType: 'lights',
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('No active sabotage');
    });

    it('should return failure when player is dead', async () => {
      // Trigger sabotage
      const gameState = server.getGameState();
      const sabotageSystem = gameState.getSabotageSystem();
      sabotageSystem.triggerSabotage('imposter-1', { type: SabotageType.LIGHTS_OUT });

      // Make crewmate dead
      const crewmate = gameState.players.get('crewmate-1');
      if (crewmate) crewmate.status = PlayerStatus.DEAD;

      const response = await fetch(`http://localhost:${port}/api/game/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'crewmate-1',
          fixType: 'lights',
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toContain('Dead');
    });
  });
});
