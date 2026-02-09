import { createChannel, createResponse, Channel, Session } from 'better-sse';
import { GameEvent } from '@/types/game';
import { Server } from 'bun';

/**
 * SSE Manager - Server-Sent Events for real-time game action streaming
 *
 * Broadcasts all game events to connected clients in real-time.
 */
export class SSEManager {
  private channel: Channel;

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
   * Send an event to a specific client
   */
  async sendTo(sessionId: string, event: GameEvent): Promise<void> {
    // better-sse channels don't support direct client messaging by ID
    // We can iterate through sessions to find the right one
    for (const session of this.channel.activeSessions) {
      // Note: better-sse doesn't expose session IDs by default
      // This is a limitation - for now use broadcast-only
    }
    this.broadcast(event);
  }

  /**
   * Handle a new SSE connection request
   * Returns a Response object for Bun server
   */
  async handleConnection(req: Request): Promise<Response> {
    return createResponse(req, (session) => {
      this.channel.register(session);
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
   * Cleanup all sessions
   */
  disconnectAll(): void {
    // Note: better-sse doesn't have a direct disconnectAll method
    // Sessions will be cleaned up when clients disconnect
  }
}
