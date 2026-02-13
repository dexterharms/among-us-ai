import { createChannel, createResponse, Channel, Session } from 'better-sse';
import { GameEvent } from '@/types/game';
import { validateToken } from '@/utils/jwt';
import { logger } from '@/utils/logger';

/**
 * SSE Manager - Server-Sent Events for real-time game action streaming
 *
 * Broadcasts all game events to connected clients in real-time.
 * Supports per-session messaging via session ID mapping.
 * Requires authentication via JWT token.
 */
export class SSEManager {
  private channel: Channel;
  private sessions: Map<string, Session> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionId
  private authenticatedPlayers: Map<string, string> = new Map(); // playerId -> sessionId (for validation)

  constructor() {
    this.channel = createChannel();
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: GameEvent): void {
    this.channel.broadcast(event, event.type);
  }

  /**
   * Send an event to a specific session by sessionId
   */
  async sendToSession(sessionId: string, event: GameEvent): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.push(event, event.type);
      return true;
    }
    return false;
  }

  /**
   * Send an event to a specific player by playerId
   * Only works for authenticated players. Does not broadcast on failure.
   */
  async sendTo(playerId: string, event: GameEvent): Promise<boolean> {
    const sessionId = this.playerSessions.get(playerId);
    if (sessionId) {
      return this.sendToSession(sessionId, event);
    }
    // No fallback to broadcast - log warning and return false
    logger.warn('Failed to send private event to player - session not found', {
      playerId,
      eventType: event.type,
      connectedPlayers: Array.from(this.playerSessions.keys()),
    });
    return false;
  }

  /**
   * Handle a new SSE connection request
   * Requires valid JWT token in query string: ?token=xxx
   * Returns a Response object for Bun server
   */
  async handleConnection(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    // Require authentication token
    if (!token) {
      logger.warn('SSE connection rejected - no token provided', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Validate token
    const decoded = await validateToken(token);
    if (!decoded) {
      logger.warn('SSE connection rejected - invalid token', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const playerId = decoded.playerId;
    const sessionId = crypto.randomUUID();

    return createResponse(req, (session) => {
      // Store session with ID
      this.sessions.set(sessionId, session);
      this.channel.register(session);

      // Associate session with authenticated player
      this.playerSessions.set(playerId, sessionId);
      this.authenticatedPlayers.set(playerId, sessionId);

      logger.info('SSE connection established', {
        playerId,
        sessionId,
        timestamp: Date.now(),
      });

      // Send session ID to client
      session.push({ sessionId, type: 'Connected' }, 'Connected');

      // Cleanup on disconnect
      session.on('disconnected', () => {
        this.sessions.delete(sessionId);
        this.playerSessions.delete(playerId);
        this.authenticatedPlayers.delete(playerId);
        logger.info('SSE connection closed', {
          playerId,
          sessionId,
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * Check if a player has an authenticated session
   * @param playerId - The player's unique identifier
   * @returns True if player has an authenticated session
   */
  hasAuthenticatedSession(playerId: string): boolean {
    return this.authenticatedPlayers.has(playerId);
  }

  /**
   * Get the channel for direct access (if needed)
   */
  getChannel(): Channel {
    return this.channel;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.channel.sessionCount;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get authenticated player count
   */
  getAuthenticatedPlayerCount(): number {
    return this.authenticatedPlayers.size;
  }

  /**
   * Cleanup all sessions
   */
  disconnectAll(): void {
    // Note: better-sse doesn't have a direct disconnectAll method
    // Sessions will be cleaned up when clients disconnect
    this.sessions.clear();
    this.playerSessions.clear();
    this.authenticatedPlayers.clear();
  }
}
