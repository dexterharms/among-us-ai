export interface WordMathState {
  problem: string;
  answer: number;
  tier: 'easy' | 'medium' | 'hard';
  attempts: number;
}

export class WordMathMinigame {
  private playerStates: Map<string, WordMathState> = new Map();

  initialize(playerId: string): WordMathState {
    const tier: 'easy' | 'medium' | 'hard' = this.randomTier();
    const { problem, answer } = this.generateProblem(tier);

    const state: WordMathState = {
      problem,
      answer,
      tier,
      attempts: 0,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { answer: number }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: WordMathState;
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

    state.attempts++;

    if (action.answer === state.answer) {
      return {
        success: true,
        message: 'Correct! Math problem solved.',
        isComplete: true,
        state,
      };
    } else {
      return {
        success: false,
        message: `Incorrect. ${state.problem} Try again.`,
        isComplete: false,
        state,
      };
    }
  }

  getState(playerId: string): WordMathState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;
    // Word math is complete when correct answer given
    // We track this via attempts but actual completion is when correct
    return false; // Minigame handles completion in handleAction
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  private randomTier(): 'easy' | 'medium' | 'hard' {
    const tiers: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    return tiers[Math.floor(Math.random() * tiers.length)];
  }

  private generateProblem(tier: 'easy' | 'medium' | 'hard'): { problem: string; answer: number } {
    switch (tier) {
      case 'easy':
        const apples = this.randomBetween(1, 10);
        const added = this.randomBetween(1, 5);
        return {
          problem: `If you have ${apples} apples and get ${added} more, how many do you have?`,
          answer: apples + added,
        };
      case 'medium':
        const fuelPerHour = this.randomBetween(3, 8);
        const fuelTotal = this.randomBetween(10, 30);
        return {
          problem: `The reactor uses ${fuelPerHour} fuel per hour. You have ${fuelTotal} fuel. How many hours?`,
          answer: Math.floor(fuelTotal / fuelPerHour),
        };
      case 'hard':
        const tables = this.randomBetween(5, 15);
        const broken = this.randomBetween(1, 4);
        const addedTables = this.randomBetween(2, 6);
        return {
          problem: `The main hall has ${tables} tables. ${broken} break. You add ${addedTables} new ones. How many total?`,
          answer: tables - broken + addedTables,
        };
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDifficulty(): number {
    // 1-3 ticks depending on tier
    return this.randomBetween(2, 6);
  }
}
