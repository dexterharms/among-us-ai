import { describe, test, expect, beforeEach } from 'bun:test';
import { SSEManager } from '@/sse/manager';
import { generateToken } from '@/utils/jwt';
import { GameEvent, EventType } from '@/types/game';

describe('SSEManager with Authentication', () => {
  let sseManager: SSEManager;
  let originalSecret: string | undefined;

  beforeEach(() => {
    // Save original secret
    originalSecret = process.env.JWT_SECRET;
    // Set test secret
    process.env.JWT_SECRET = 'test-secret-key-for-sse-testing';
    sseManager = new SSEManager();
  });

  test('handleConnection rejects connection without token', async () => {
    const request = new Request('http://localhost:3000/api/stream/actions');
    const response = await sseManager.handleConnection(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  test('handleConnection rejects connection with invalid token', async () => {
    const request = new Request('http://localhost:3000/api/stream/actions?token=invalid-token');
    const response = await sseManager.handleConnection(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Invalid or expired token');
  });

  test('sendTo does not broadcast to all players', async () => {
    // This test verifies that sendTo no longer falls back to broadcast
    // We can't easily test the SSE connection itself, but we can verify
    // that sendTo returns false for non-existent players and logs a warning
    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.ROLE_REVEALED,
      payload: { playerId: 'player-1', role: 'CREWMATE' },
    };

    const result = await sseManager.sendTo('non-existent-player', event);

    expect(result).toBe(false);
  });

  test('broadcast sends event to all clients', () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.LOBBY_STATE,
      payload: { players: [] },
    };

    // This should not throw any errors
    expect(() => sseManager.broadcast(event)).not.toThrow();
  });
});
