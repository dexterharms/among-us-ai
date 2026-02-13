export interface ContainerState {
  capacity: number;
  current: number;
}

export interface TransferFuelState {
  containers: ContainerState[];
  targetAmount: number;
  targetContainer: number;
  attempts: number;
  complete: boolean;
}

export class TransferFuelMinigame {
  private playerStates: Map<string, TransferFuelState> = new Map();

  // Container configurations: [capacity1, capacity2, targetAmount]
  private readonly CONFIGS = [
    [5, 3, 4],
    [4, 7, 2],
    [7, 5, 3],
    [8, 3, 4],
    [5, 5, 2],
  ];

  initialize(playerId: string): TransferFuelState {
    const config = this.CONFIGS[Math.floor(Math.random() * this.CONFIGS.length)];

    const state: TransferFuelState = {
      containers: [
        { capacity: config[0], current: 0 },
        { capacity: config[1], current: 0 },
      ],
      targetAmount: config[2],
      targetContainer: 0,
      attempts: 0,
      complete: false,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(
    playerId: string,
    action: { action: 'fill' | 'pour' | 'empty'; container: number },
  ): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: TransferFuelState;
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

    const { container: containerIndex } = action;

    if (containerIndex < 0 || containerIndex >= state.containers.length) {
      return {
        success: false,
        message: `Invalid container. Use 0 or 1.`,
        isComplete: false,
        state,
      };
    }

    state.attempts++;

    switch (action.action) {
      case 'fill':
        return this.handleFill(state, containerIndex);
      case 'empty':
        return this.handleEmpty(state, containerIndex);
      case 'pour':
        return this.handlePour(state, containerIndex);
      default:
        return {
          success: false,
          message: 'Invalid action. Use "fill", "pour", or "empty".',
          isComplete: false,
          state,
        };
    }
  }

  private handleFill(
    state: TransferFuelState,
    containerIndex: number,
  ): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: TransferFuelState;
  } {
    const container = state.containers[containerIndex];
    if (container.current === container.capacity) {
      return {
        success: false,
        message: `Container ${containerIndex} is already full.`,
        isComplete: false,
        state,
      };
    }

    container.current = container.capacity;
    return {
      success: true,
      message: `Container ${containerIndex} filled to capacity (${container.capacity}L).`,
      isComplete: false,
      state,
    };
  }

  private handleEmpty(
    state: TransferFuelState,
    containerIndex: number,
  ): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: TransferFuelState;
  } {
    const container = state.containers[containerIndex];
    if (container.current === 0) {
      return {
        success: false,
        message: `Container ${containerIndex} is already empty.`,
        isComplete: false,
        state,
      };
    }

    container.current = 0;
    return {
      success: true,
      message: `Container ${containerIndex} emptied.`,
      isComplete: false,
      state,
    };
  }

  private handlePour(
    state: TransferFuelState,
    sourceContainerIndex: number,
  ): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: TransferFuelState;
  } {
    const source = state.containers[sourceContainerIndex];
    if (source.current === 0) {
      return {
        success: false,
        message: `Container ${sourceContainerIndex} is empty. Nothing to pour.`,
        isComplete: false,
        state,
      };
    }

    const targetContainerIndex = sourceContainerIndex === 0 ? 1 : 0;
    const target = state.containers[targetContainerIndex];

    // Pour until source is empty or target is full
    const spaceInTarget = target.capacity - target.current;
    const amountToPour = Math.min(source.current, spaceInTarget);

    source.current -= amountToPour;
    target.current += amountToPour;

    return {
      success: true,
      message: `Poured ${amountToPour}L from container ${sourceContainerIndex} to ${targetContainerIndex}.`,
      isComplete: false,
      state,
    };
  }

  getState(playerId: string): TransferFuelState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;

    const targetContainer = state.containers[state.targetContainer];
    if (targetContainer.current === state.targetAmount) {
      state.complete = true;
      return true;
    }

    return state.complete;
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  getDifficulty(): number {
    // Typically 5-10 actions
    return this.randomBetween(5, 8);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
