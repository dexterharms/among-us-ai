export interface HotColdState {
  target: number;
  current: number;
  attempts: number;
  complete: boolean;
}

export class HotColdMinigame {
  private playerStates: Map<string, HotColdState> = new Map();

  initialize(playerId: string): HotColdState {
    const target = this.randomBetween(0, 100);
    const current = this.randomBetween(0, 100);

    const state: HotColdState = {
      target,
      current,
      attempts: 0,
      complete: false,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { delta: number }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: HotColdState;
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

    if (state.complete) {
      return {
        success: true,
        message: 'Task already completed!',
        isComplete: true,
        state,
      };
    }

    state.attempts++;
    state.current += action.delta;

    // Clamp to 0-100 range
    state.current = Math.max(0, Math.min(100, state.current));

    if (state.current === state.target) {
      state.complete = true;
      return {
        success: true,
        message: `Target reached! Final number: ${state.current}. Completed in ${state.attempts} adjustments.`,
        isComplete: true,
        state,
      };
    }

    const comparison =
      state.current < state.target ? 'less-than' : 'greater-than';
    return {
      success: true,
      message: `Current number (${state.current}) is ${comparison} the target.`,
      isComplete: false,
      state,
    };
  }

  getState(playerId: string): HotColdState | null {
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

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDifficulty(): number {
    // Binary search typically takes 5-10 adjustments
    return this.randomBetween(3, 7);
  }
}
