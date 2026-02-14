import {
  PendingReveal,
  MovementDirection,
  RevealType,
  REVEAL_DELAY_TICKS,
} from '@/types/game';
import { logger } from '@/utils/logger';

/**
 * Manages queue of pending player reveals for delayed information system.
 * When a player enters or leaves a room, a reveal is queued and counts down over
 * several ticks before player becomes visible to other room occupants.
 */
export class PendingRevealQueue {
  private reveals: Map<string, PendingReveal> = new Map();
  private nextId: number = 0;

  /**
   * Queue a new pending reveal
   */
  queueReveal(
    playerId: string,
    roomId: string,
    direction: MovementDirection,
    type: RevealType,
  ): PendingReveal {
    const id = `reveal-${this.nextId++}`;
    const reveal: PendingReveal = {
      playerId,
      roomId,
      direction,
      ticksRemaining: REVEAL_DELAY_TICKS,
      type,
    };
    this.reveals.set(id, reveal);

    logger.debug('Queued pending reveal', { id, playerId, roomId, direction, type });
    return reveal;
  }

  /**
   * Get all pending reveals for a specific room (with ticksRemaining > 0)
   */
  getPendingRevealsForRoom(roomId: string): PendingReveal[] {
    return Array.from(this.reveals.values()).filter(
      (r) => r.roomId === roomId && r.ticksRemaining > 0,
    );
  }

  /**
   * Decrement ticksRemaining for all reveals
   */
  decrementAll(): void {
    this.reveals.forEach((reveal) => {
      if (reveal.ticksRemaining > 0) {
        reveal.ticksRemaining--;
      }
    });
  }

  /**
   * Get all reveals that are ready to be processed (ticksRemaining === 0)
   */
  getReadyReveals(): PendingReveal[] {
    return Array.from(this.reveals.values()).filter((r) => r.ticksRemaining === 0);
  }

  /**
   * Remove a specific reveal from queue
   */
  removeReveal(reveal: PendingReveal): void {
    const entry = Array.from(this.reveals.entries()).find(
      ([_, r]) =>
        r.playerId === reveal.playerId &&
        r.roomId === reveal.roomId &&
        r.ticksRemaining === reveal.ticksRemaining,
    );
    if (entry) {
      this.reveals.delete(entry[0]);
    }
  }

  /**
   * Clear all pending reveals (for game reset)
   */
  clear(): void {
    this.reveals.clear();
    this.nextId = 0;
  }

  /**
   * Get total count of pending reveals (for debugging)
   */
  size(): number {
    return this.reveals.size;
  }
}
