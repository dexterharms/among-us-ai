/**
 * PlayerState represents the current state of a player in the game.
 *
 * State Machine:
 *
 * Roaming (not interacting, can move)
 *    ↓ (receive tick, send action)
 * Waiting (awaiting tick processing)
 *    ↓ (tick processes action)
 * Roaming ←────────────────────────┘
 *    ↓ (start task interaction)
 * Interacting (in task progress)
 *    ↓ (receive task prompt, send action)
 * Waiting
 *    ↓ (tick processes task action)
 * Interacting ←──────────────────┘
 *    ↓ (council called)
 * Summoned (in council, can't move)
 *
 * State Definitions:
 * - Roaming: Player can move to connected rooms or start task interactions
 * - Interacting: Player is actively working on a task (receives task-specific prompts)
 * - Waiting: Player has sent an action, waiting for tick to process it
 * - Summoned: Player is in council phase (cannot move, can only vote/discuss)
 */
export enum PlayerState {
  ROAMING = 'Roaming',
  INTERACTING = 'Interacting',
  WAITING = 'Waiting',
  SUMMONED = 'Summoned',
}

/**
 * Valid state transitions in the player state machine.
 * Format: [fromState]: [toState1, toState2, ...]
 *
 * Notes:
 * - SUMMONED can be reached from any state (council can be called at any time)
 * - INTERACTING can go to SUMMONED when forced out by council
 */
const VALID_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  [PlayerState.ROAMING]: [
    PlayerState.INTERACTING, // Start task interaction
    PlayerState.WAITING, // Submit action
    PlayerState.SUMMONED, // Council called
  ],
  [PlayerState.INTERACTING]: [
    PlayerState.WAITING, // Submit task action
    PlayerState.ROAMING, // Complete task or quit
    // Note: Cannot go directly to SUMMONED - must complete/quit task first
  ],
  [PlayerState.WAITING]: [
    PlayerState.ROAMING, // Action processed, back to roaming
    PlayerState.INTERACTING, // Action processed, start task
    // Note: Cannot go directly to SUMMONED - must process action first
  ],
  [PlayerState.SUMMONED]: [
    PlayerState.ROAMING, // Council ended, back to game
    PlayerState.WAITING, // Cast vote
  ],
};

/**
 * Result of a state transition validation
 */
export interface TransitionResult {
  success: boolean;
  error?: string;
}

/**
 * PlayerStateMachine manages player state transitions.
 * Validates that transitions follow the state machine rules.
 */
export class PlayerStateMachine {
  private playerStates: Map<string, PlayerState> = new Map();

  /**
   * Get the current state of a player
   * Defaults to ROAMING if player has no recorded state
   */
  getPlayerState(playerId: string): PlayerState {
    return (
      this.playerStates.get(playerId) || PlayerState.ROAMING
    );
  }

  /**
   * Set the initial state for a player (typically ROAMING)
   */
  setPlayerState(playerId: string, state: PlayerState): void {
    this.playerStates.set(playerId, state);
  }

  /**
   * Transition a player to a new state with validation
   * Throws error if transition is invalid
   */
  transition(playerId: string, newState: PlayerState): void {
    const currentState = this.getPlayerState(playerId);
    const result = PlayerStateMachine.validateTransition(
      currentState,
      newState,
    );

    if (!result.success) {
      throw new Error(
        `Invalid state transition for player ${playerId}: ${currentState} → ${newState}. ${result.error}`,
      );
    }

    this.playerStates.set(playerId, newState);
  }

  /**
   * Check if a state transition is valid
   */
  static canTransition(from: PlayerState, to: PlayerState): boolean {
    const validTargets = VALID_TRANSITIONS[from];
    return validTargets.includes(to);
  }

  /**
   * Get all valid target states for a given source state
   */
  static getValidTransitions(from: PlayerState): PlayerState[] {
    return [...VALID_TRANSITIONS[from]];
  }

  /**
   * Validate a state transition and return result
   */
  static validateTransition(
    from: PlayerState,
    to: PlayerState,
  ): TransitionResult {
    if (PlayerStateMachine.canTransition(from, to)) {
      return { success: true };
    }

    const validTargets = VALID_TRANSITIONS[from];
    return {
      success: false,
      error: `Cannot transition from ${from} to ${to}. Valid targets: ${validTargets.join(', ')}`,
    };
  }

  /**
   * Clear a player from the state machine (e.g., when they leave the game)
   */
  removePlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Clear all players (e.g., when resetting the game)
   */
  clear(): void {
    this.playerStates.clear();
  }

  /**
   * Get all players in a specific state
   */
  getPlayersInState(state: PlayerState): string[] {
    const players: string[] = [];
    this.playerStates.forEach((playerState, playerId) => {
      if (playerState === state) {
        players.push(playerId);
      }
    });
    return players;
  }
}
