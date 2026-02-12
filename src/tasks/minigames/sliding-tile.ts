export interface SlidingTileState {
  grid: number[];
  emptyIndex: number;
  moves: number;
  solved: boolean;
}

export class SlidingTileMinigame {
  private playerStates: Map<string, SlidingTileState> = new Map();
  private readonly GRID_SIZE = 12; // 4x3 grid
  private readonly NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  private readonly MIN_MOVES = 5;
  private readonly MAX_MOVES = 20;

  initialize(playerId: string): SlidingTileState {
    const solvedGrid = [...this.NUMBERS, -1]; // -1 is empty space
    const { shuffledGrid, emptyIndex } = this.shuffleByMoves(solvedGrid);

    const state: SlidingTileState = {
      grid: shuffledGrid,
      emptyIndex,
      moves: 0,
      solved: false,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { tile: number }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: SlidingTileState;
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

    if (state.solved) {
      return {
        success: true,
        message: 'Puzzle already solved!',
        isComplete: true,
        state,
      };
    }

    const tileIndex = state.grid.indexOf(action.tile);
    if (tileIndex === -1) {
      return {
        success: false,
        message: 'Tile not found',
        isComplete: false,
        state,
      };
    }

    // Check if tile can move (adjacent to empty space)
    if (!this.canMove(tileIndex, state.emptyIndex)) {
      return {
        success: false,
        message: 'Cannot move that tile. Not adjacent to empty space.',
        isComplete: false,
        state,
      };
    }

    // Move tile
    this.swap(state.grid, tileIndex, state.emptyIndex);
    state.emptyIndex = tileIndex;
    state.moves++;

    // Check if solved
    if (this.isSolved(state.grid)) {
      state.solved = true;
      return {
        success: true,
        message: `Puzzle solved in ${state.moves} moves!`,
        isComplete: true,
        state,
      };
    }

    return {
      success: true,
      message: `Move ${state.moves}/${this.MAX_MOVES}. Keep going...`,
      isComplete: false,
      state,
    };
  }

  getState(playerId: string): SlidingTileState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;
    return state.solved;
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  canMove(tileIndex: number, emptyIndex: number): boolean {
    const tileRow = Math.floor(tileIndex / 4);
    const tileCol = tileIndex % 4;
    const emptyRow = Math.floor(emptyIndex / 4);
    const emptyCol = emptyIndex % 4;

    // Adjacent if same row and columns differ by 1, or same column and rows differ by 1
    return (
      (tileRow === emptyRow && Math.abs(tileCol - emptyCol) === 1) ||
      (tileCol === emptyCol && Math.abs(tileRow - emptyRow) === 1)
    );
  }

  swap(grid: number[], index1: number, index2: number): void {
    const temp = grid[index1];
    grid[index1] = grid[index2];
    grid[index2] = temp;
  }

  isSolved(grid: number[]): boolean {
    for (let i = 0; i < this.NUMBERS.length; i++) {
      if (grid[i] !== this.NUMBERS[i]) return false;
    }
    return grid[this.NUMBERS.length] === -1; // Empty space at end
  }

  shuffleByMoves(solvedGrid: number[]): { shuffledGrid: number[]; emptyIndex: number } {
    const grid = [...solvedGrid];
    let emptyIndex = grid.indexOf(-1);
    const numMoves = this.randomBetween(this.MIN_MOVES, this.MAX_MOVES);

    // Make random valid moves
    for (let i = 0; i < numMoves; i++) {
      const validMoves = this.getValidMoves(emptyIndex);
      const moveIndex = validMoves[Math.floor(Math.random() * validMoves.length)];
      this.swap(grid, emptyIndex, moveIndex);
      emptyIndex = moveIndex;
    }

    return { shuffledGrid: grid, emptyIndex };
  }

  getValidMoves(emptyIndex: number): number[] {
    const moves: number[] = [];
    const row = Math.floor(emptyIndex / 4);
    const col = emptyIndex % 4;

    // Check all 4 directions
    if (row > 0) moves.push(emptyIndex - 4); // Up
    if (row < 2) moves.push(emptyIndex + 4); // Down
    if (col > 0) moves.push(emptyIndex - 1); // Left
    if (col < 3) moves.push(emptyIndex + 1); // Right

    return moves;
  }

  toASCII(grid: number[]): string {
    const emptyChar = '  ';
    return `
 _____ _____ _____ _____
|${this.pad(grid[0])}|${this.pad(grid[1])}|${this.pad(grid[2])}|${this.pad(grid[3])}|
|_____|_____|_____|_____|
|${this.pad(grid[4])}|${this.pad(grid[5])}|${this.pad(grid[6])}|${this.pad(grid[7])}|
|_____|_____|_____|_____|
|${this.pad(grid[8])}|${this.pad(grid[9])}|${this.pad(grid[10])}|${emptyChar}|
|_____|_____|_____|_____|
`;
  }

  pad(num: number | string): string {
    if (num === -1) return '  ';
    return num.toString().padStart(2);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDifficulty(): number {
    // 5-20 moves = 5-20 ticks
    return this.randomBetween(6, 10);
  }
}
