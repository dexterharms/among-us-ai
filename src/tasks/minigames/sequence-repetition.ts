import { Player } from '@/types/game';

export interface SequenceRepetitionState {
  sequence: string[];
  currentIndex: number;
  attempts: number;
  variant: 'numbers' | 'colors' | 'words';
}

export class SequenceRepetitionMinigame {
  private playerStates: Map<string, SequenceRepetitionState> = new Map();

  initialize(playerId: string): SequenceRepetitionState {
    const variant: 'numbers' | 'colors' | 'words' = this.randomVariant();
    const sequenceLength = this.randomBetween(5, 10);
    const sequence = this.generateSequence(variant, sequenceLength);

    const state: SequenceRepetitionState = {
      sequence,
      currentIndex: 0,
      attempts: 0,
      variant,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { value: string }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: SequenceRepetitionState;
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

    // Check if current item matches
    const expectedItem = state.sequence[state.currentIndex];
    if (action.value === expectedItem) {
      // Correct item
      state.currentIndex++;

      // Check if complete
      if (state.currentIndex >= state.sequence.length) {
        return {
          success: true,
          message: 'Sequence completed successfully!',
          isComplete: true,
          state,
        };
      }

      return {
        success: true,
        message: `Correct! Next item...`,
        isComplete: false,
        state,
      };
    } else {
      // Incorrect - restart from beginning
      state.currentIndex = 0;
      return {
        success: false,
        message: `Incorrect! The correct sequence was: ${state.sequence.join(' ')}. Try again from the beginning.`,
        isComplete: false,
        state,
      };
    }
  }

  getState(playerId: string): SequenceRepetitionState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;
    return state.currentIndex >= state.sequence.length;
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  private randomVariant(): 'numbers' | 'colors' | 'words' {
    const variants: ('numbers' | 'colors' | 'words')[] = ['numbers', 'colors', 'words'];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private generateSequence(variant: 'numbers' | 'colors' | 'words', length: number): string[] {
    switch (variant) {
      case 'numbers':
        return Array.from({ length }, () => Math.floor(Math.random() * 10).toString());
      case 'colors':
        const colors = ['red', 'blue', 'green', 'yellow'];
        return Array.from({ length }, () => colors[Math.floor(Math.random() * colors.length)]);
      case 'words':
        const words = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape'];
        return Array.from({ length }, () => words[Math.floor(Math.random() * words.length)]);
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDifficulty(): number {
    // 5-10 items, average 2 attempts per item = 10-20 ticks
    // Normalize to 2-10 scale
    return this.randomBetween(4, 8);
  }
}
