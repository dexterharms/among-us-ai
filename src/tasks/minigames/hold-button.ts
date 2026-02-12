export interface HoldButtonState {
  isHolding: boolean;
  progress: number;
  targetTicks: number;
  ticksHeld: number;
  complete: boolean;
}

export class HoldButtonMinigame {
  private playerStates: Map<string, HoldButtonState> = new Map();
  private readonly TARGET_TICKS = 5; // Constant 5 ticks per plan

  initialize(playerId: string): HoldButtonState {
    const state: HoldButtonState = {
      isHolding: false,
      progress: 0,
      targetTicks: this.TARGET_TICKS,
      ticksHeld: 0,
      complete: false,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { action: 'start' | 'quit' }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: HoldButtonState;
  } {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return {
        success: false,
        message: 'Task not initialized',
        isComplete: false,
        state: this.initialize(playerId),
      };
    }

    if (action.action === 'start') {
      if (state.isHolding) {
        return {
          success: true,
          message: 'Already holding button...',
          isComplete: false,
          state,
        };
      }

      state.isHolding = true;
      return {
        success: true,
        message: 'Button pressed! Keep holding...',
        isComplete: false,
        state,
      };
    }

    if (action.action === 'quit') {
      state.isHolding = false;
      state.ticksHeld = 0;
      state.progress = 0;

      return {
        success: false,
        message: 'Button released. Progress reset.',
        isComplete: false,
        state,
      };
    }

    return {
      success: false,
      message: 'Invalid action. Use "start" or "quit".',
      isComplete: false,
      state,
    };
  }

  tick(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state || !state.isHolding || state.complete) {
      return;
    }

    state.ticksHeld++;
    state.progress = (state.ticksHeld / state.targetTicks) * 100;

    if (state.ticksHeld >= state.targetTicks) {
      state.isHolding = false;
      state.complete = true;
    }
  }

  getState(playerId: string): HoldButtonState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;
    return state.complete;
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  getDifficulty(): number {
    // Constant 5 ticks per plan
    return 5;
  }
}
