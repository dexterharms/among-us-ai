/**
 * QueuedAction represents a player action waiting to be processed by the tick system.
 */
export interface QueuedAction {
  playerId: string;
  action: string;
  timestamp: number;
  payload: any;
}

/**
 * ActionQueue manages the queue of player actions to be processed each tick.
 * Actions are processed in FIFO (first-in, first-out) order.
 */
export class ActionQueue {
  private queue: QueuedAction[] = [];

  /**
   * Add an action to the queue
   */
  enqueue(action: QueuedAction): void {
    this.queue.push(action);
  }

  /**
   * Remove all actions from queue and return them in order
   * This is called each tick by the processor
   */
  dequeueAll(): QueuedAction[] {
    const actions = [...this.queue];
    this.queue = [];
    return actions;
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear all actions from queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get all actions without removing them (for inspection)
   */
  peekAll(): QueuedAction[] {
    return [...this.queue];
  }
}
