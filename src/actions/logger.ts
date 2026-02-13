import { GameEvent, GameState } from '@/types/game';

export interface ActionWithState {
  event: GameEvent;
  gameState: GameState;
}

/**
 * Action Logger - Records all game actions with full game state snapshots
 *
 * This maintains an in-memory log of all actions for real-time streaming
 * and post-hoc validation of game order.
 */
export class ActionLogger {
  private actions: ActionWithState[] = [];
  private maxHistory: number = 10000; // Store up to 10,000 actions

  /**
   * Log an action with the current game state
   */
  logAction(event: GameEvent, gameState: GameState): void {
    const action: ActionWithState = {
      event,
      gameState: this.cloneGameState(gameState),
    };

    this.actions.push(action);

    // Trim history if needed
    if (this.actions.length > this.maxHistory) {
      this.actions = this.actions.slice(-this.maxHistory);
    }
  }

  /**
   * Get all actions
   */
  getAllActions(): ActionWithState[] {
    return [...this.actions];
  }

  /**
   * Get actions since a specific timestamp
   */
  getActionsSince(timestamp: number): ActionWithState[] {
    return this.actions.filter((a) => a.event.timestamp >= timestamp);
  }

  /**
   * Get actions in a time range
   */
  getActionsInRange(start: number, end: number): ActionWithState[] {
    return this.actions.filter(
      (a) => a.event.timestamp >= start && a.event.timestamp <= end
    );
  }

  /**
   * Get the most recent N actions
   */
  getRecentActions(count: number): ActionWithState[] {
    return this.actions.slice(-count);
  }

  /**
   * Clear all actions
   */
  clear(): void {
    this.actions = [];
  }

  /**
   * Clone game state for immutability
   * Deep clone to prevent mutation of logged state
   *
   * Note: We extract only the loggable fields to avoid circular references
   * from GameState's manager objects (TaskManager, SSEManager, etc.)
   */
  private cloneGameState(state: GameState): GameState {
    return {
      id: state.id,
      phase: state.phase,
      roundNumber: state.roundNumber,
      roundTimer: state.roundTimer,
      deadBodies: state.deadBodies,
      players: new Map(state.players),
      rooms: new Map(state.rooms),
    } as GameState;
  }

  /**
   * Get statistics about the action log
   */
  getStats(): {
    totalActions: number;
    firstTimestamp: number | null;
    lastTimestamp: number | null;
    memoryUsageBytes: number;
  } {
    if (this.actions.length === 0) {
      return {
        totalActions: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        memoryUsageBytes: 0,
      };
    }

    const first = this.actions[0];
    const last = this.actions[this.actions.length - 1];

    return {
      totalActions: this.actions.length,
      firstTimestamp: first.event.timestamp,
      lastTimestamp: last.event.timestamp,
      memoryUsageBytes: JSON.stringify(this.actions).length,
    };
  }
}
