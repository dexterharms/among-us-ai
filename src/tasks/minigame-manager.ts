import { MinigameType } from './types';
import {
  SequenceRepetitionMinigame,
  SequenceRepetitionState,
} from './minigames/sequence-repetition';
import {
  WordMathMinigame,
  WordMathState,
} from './minigames/word-math';
import {
  SlidingTileMinigame,
  SlidingTileState,
} from './minigames/sliding-tile';
import {
  BattleshipMinigame,
  BattleshipState,
} from './minigames/battleship';
import {
  HotColdMinigame,
  HotColdState,
} from './minigames/hot-cold';
import {
  HoldButtonMinigame,
  HoldButtonState,
} from './minigames/hold-button';
import {
  CodeBreakerMinigame,
  CodeBreakerState,
} from './minigames/code-breaker';
import {
  TransferFuelMinigame,
  TransferFuelState,
} from './minigames/transfer-fuel';

export type MinigameState =
  | SequenceRepetitionState
  | WordMathState
  | SlidingTileState
  | BattleshipState
  | HotColdState
  | HoldButtonState
  | CodeBreakerState
  | TransferFuelState;

export interface MinigameAction {
  playerId: string;
  taskId: string;
  action: any;
}

export class MinigameManager {
  private sequenceRepetition = new SequenceRepetitionMinigame();
  private wordMath = new WordMathMinigame();
  private slidingTile = new SlidingTileMinigame();
  private battleship = new BattleshipMinigame();
  private hotCold = new HotColdMinigame();
  private holdButton = new HoldButtonMinigame();
  private codeBreaker = new CodeBreakerMinigame();
  private transferFuel = new TransferFuelMinigame();

  initializeMinigame(playerId: string, minigameType: MinigameType): MinigameState {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        return this.sequenceRepetition.initialize(playerId);
      case MinigameType.WORD_MATH:
        return this.wordMath.initialize(playerId);
      case MinigameType.SLIDING_TILE:
        return this.slidingTile.initialize(playerId);
      case MinigameType.BATTLESHIP:
        return this.battleship.initialize(playerId);
      case MinigameType.HOT_COLD:
        return this.hotCold.initialize(playerId);
      case MinigameType.HOLD_BUTTON:
        return this.holdButton.initialize(playerId);
      case MinigameType.CODE_BREAKER:
        return this.codeBreaker.initialize(playerId);
      case MinigameType.TRANSFER_FUEL:
        return this.transferFuel.initialize(playerId);
      default:
        throw new Error(`Unknown minigame type: ${minigameType}`);
    }
  }

  handleMinigameAction(
    playerId: string,
    minigameType: MinigameType,
    action: any,
  ): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: MinigameState;
  } {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        return this.sequenceRepetition.handleAction(playerId, action);
      case MinigameType.WORD_MATH:
        return this.wordMath.handleAction(playerId, action);
      case MinigameType.SLIDING_TILE:
        return this.slidingTile.handleAction(playerId, action);
      case MinigameType.BATTLESHIP:
        return this.battleship.handleAction(playerId, action);
      case MinigameType.HOT_COLD:
        return this.hotCold.handleAction(playerId, action);
      case MinigameType.HOLD_BUTTON:
        return this.holdButton.handleAction(playerId, action);
      case MinigameType.CODE_BREAKER:
        return this.codeBreaker.handleAction(playerId, action);
      case MinigameType.TRANSFER_FUEL:
        return this.transferFuel.handleAction(playerId, action);
      default:
        return {
          success: false,
          message: `Unknown minigame type: ${minigameType}`,
          isComplete: false,
          state: {} as MinigameState,
        };
    }
  }

  getMinigameState(playerId: string, minigameType: MinigameType): MinigameState | null {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        return this.sequenceRepetition.getState(playerId);
      case MinigameType.WORD_MATH:
        return this.wordMath.getState(playerId);
      case MinigameType.SLIDING_TILE:
        return this.slidingTile.getState(playerId);
      case MinigameType.BATTLESHIP:
        return this.battleship.getState(playerId);
      case MinigameType.HOT_COLD:
        return this.hotCold.getState(playerId);
      case MinigameType.HOLD_BUTTON:
        return this.holdButton.getState(playerId);
      case MinigameType.CODE_BREAKER:
        return this.codeBreaker.getState(playerId);
      case MinigameType.TRANSFER_FUEL:
        return this.transferFuel.getState(playerId);
      default:
        return null;
    }
  }

  isMinigameComplete(playerId: string, minigameType: MinigameType): boolean {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        return this.sequenceRepetition.isComplete(playerId);
      case MinigameType.WORD_MATH:
        return this.wordMath.isComplete(playerId);
      case MinigameType.SLIDING_TILE:
        return this.slidingTile.isComplete(playerId);
      case MinigameType.BATTLESHIP:
        return this.battleship.isComplete(playerId);
      case MinigameType.HOT_COLD:
        return this.hotCold.isComplete(playerId);
      case MinigameType.HOLD_BUTTON:
        return this.holdButton.isComplete(playerId);
      case MinigameType.CODE_BREAKER:
        return this.codeBreaker.isComplete(playerId);
      case MinigameType.TRANSFER_FUEL:
        return this.transferFuel.isComplete(playerId);
      default:
        return false;
    }
  }

  cleanupMinigame(playerId: string, minigameType: MinigameType): void {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        this.sequenceRepetition.cleanup(playerId);
        break;
      case MinigameType.WORD_MATH:
        this.wordMath.cleanup(playerId);
        break;
      case MinigameType.SLIDING_TILE:
        this.slidingTile.cleanup(playerId);
        break;
      case MinigameType.BATTLESHIP:
        this.battleship.cleanup(playerId);
        break;
      case MinigameType.HOT_COLD:
        this.hotCold.cleanup(playerId);
        break;
      case MinigameType.HOLD_BUTTON:
        this.holdButton.cleanup(playerId);
        break;
      case MinigameType.CODE_BREAKER:
        this.codeBreaker.cleanup(playerId);
        break;
      case MinigameType.TRANSFER_FUEL:
        this.transferFuel.cleanup(playerId);
        break;
    }
  }

  tick(playerId: string, minigameType: MinigameType): void {
    // Currently only hold-button uses tick
    if (minigameType === MinigameType.HOLD_BUTTON) {
      this.holdButton.tick(playerId);
    }
  }

  getDifficulty(minigameType: MinigameType): number {
    switch (minigameType) {
      case MinigameType.SEQUENCE_REPETITION:
        return this.sequenceRepetition.getDifficulty();
      case MinigameType.WORD_MATH:
        return this.wordMath.getDifficulty();
      case MinigameType.SLIDING_TILE:
        return this.slidingTile.getDifficulty();
      case MinigameType.BATTLESHIP:
        return this.battleship.getDifficulty();
      case MinigameType.HOT_COLD:
        return this.hotCold.getDifficulty();
      case MinigameType.HOLD_BUTTON:
        return this.holdButton.getDifficulty();
      case MinigameType.CODE_BREAKER:
        return this.codeBreaker.getDifficulty();
      case MinigameType.TRANSFER_FUEL:
        return this.transferFuel.getDifficulty();
      default:
        return 5; // Default difficulty
    }
  }
}
