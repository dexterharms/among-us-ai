import { createChannel, createResponse, Channel, Session } from 'better-sse';
import { GameEvent } from '@/types/game';

/**
 * SSE Manager - Server-Sent Events for real-time game action streaming
 *
 * Broadcasts all game events to connected clients in real-time.
 * Supports per-session messaging via session ID mapping.
 */
export class SSEManager {
  private channel: Channel;
  private sessions: Map<string, Session> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionId

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
   */
  async sendTo(playerId: string, event: GameEvent): Promise<boolean> {
    const sessionId = this.playerSessions.get(playerId);
    if (sessionId) {
      return this.sendToSession(sessionId, event);
    }
    // Fallback to broadcast if player session not found
    this.broadcast(event);
    return false;
  }

  /**
   * Register a player ID to a session ID for targeted messaging
   */
  registerPlayerSession(playerId: string, sessionId: string): void {
    this.playerSessions.set(playerId, sessionId);
  }

  /**
   * Unregister a player session
   */
  unregisterPlayerSession(playerId: string): void {
    this.playerSessions.delete(playerId);
  }

  /**
   * Handle a new SSE connection request
   * Returns a Response object for Bun server
   */
  async handleConnection(req: Request): Promise<Response> {
    const sessionId = crypto.randomUUID();

    return createResponse(req, (session) => {
      // Store session with ID
      this.sessions.set(sessionId, session);
      this.channel.register(session);

      // Send session ID to client
      session.push({ sessionId, type: 'Connected' }, 'Connected');

      // Cleanup on disconnect
      session.on('disconnected', () => {
        this.sessions.delete(sessionId);
        // Also cleanup any player session mappings
        for (const [playerId, sid] of this.playerSessions.entries()) {
          if (sid === sessionId) {
            this.playerSessions.delete(playerId);
            break;
          }
        }
      });
    });
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
   * Cleanup all sessions
   */
  disconnectAll(): void {
    // Note: better-sse doesn't have a direct disconnectAll method
    // Sessions will be cleaned up when clients disconnect
    this.sessions.clear();
    this.playerSessions.clear();
  }
}
