export interface CodeBreakerState {
  secretCode: string[];
  attempts: number;
  maxAttempts: number;
  complete: boolean;
  history: { guess: string[]; correctPosition: number; correctValue: number }[];
}

export class CodeBreakerMinigame {
  private playerStates: Map<string, CodeBreakerState> = new Map();
  private readonly CODE_LENGTH = 4;
  private readonly DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  private readonly MAX_ATTEMPTS = 10;

  initialize(playerId: string): CodeBreakerState {
    const secretCode: string[] = [];
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      secretCode.push(this.randomDigit());
    }

    const state: CodeBreakerState = {
      secretCode,
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
      complete: false,
      history: [],
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { code: string }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: CodeBreakerState;
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
        message: 'Code already cracked!',
        isComplete: true,
        state,
      };
    }

    if (state.attempts >= state.maxAttempts) {
      return {
        success: false,
        message: `Maximum attempts (${state.maxAttempts}) reached. The code was: ${state.secretCode.join('')}`,
        isComplete: false,
        state,
      };
    }

    // Parse code
    const code = action.code.split('').map((c) => parseInt(c, 10));
    if (
      code.length !== this.CODE_LENGTH ||
      code.some((d) => isNaN(d) || d < 0 || d > 9)
    ) {
      return {
        success: false,
        message: `Invalid code format. Use ${this.CODE_LENGTH} digits (0-9), e.g., "1234".`,
        isComplete: false,
        state,
      };
    }

    state.attempts++;

    // Calculate feedback
    let correctPosition = 0;
    let correctValue = 0;
    const secretCopy = [...state.secretCode];
    const guessCopy = [...code];

    // First pass: find correct position matches
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      if (secretCopy[i] === guessCopy[i]) {
        correctPosition++;
        secretCopy[i] = -1; // Mark as matched
        guessCopy[i] = -1;
      }
    }

    // Second pass: find correct value but wrong position
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      if (guessCopy[i] !== -1) {
        const index = secretCopy.indexOf(guessCopy[i]);
        if (index !== -1) {
          correctValue++;
          secretCopy[index] = -1; // Mark as matched
        }
      }
    }

    state.history.push({
      guess: code,
      correctPosition,
      correctValue,
    });

    if (correctPosition === this.CODE_LENGTH) {
      state.complete = true;
      return {
        success: true,
        message: `Code cracked! The secret code was ${state.secretCode.join('')}. Attempts: ${state.attempts}`,
        isComplete: true,
        state,
      };
    }

    return {
      success: true,
      message: `Guess ${state.attempts}/${state.maxAttempts}. ${correctPosition} in correct position, ${correctValue} correct value but wrong position.`,
      isComplete: false,
      state,
    };
  }

  getState(playerId: string): CodeBreakerState | null {
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

  private randomDigit(): number {
    return this.DIGITS[Math.floor(Math.random() * this.DIGITS.length)];
  }

  getDifficulty(): number {
    // 5-10 attempts typically
    return this.randomBetween(5, 10);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
