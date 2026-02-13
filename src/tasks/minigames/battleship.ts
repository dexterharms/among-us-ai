export interface BattleshipState {
  grid: ('hit' | 'miss' | null)[][];
  ships: { positions: [number, number][]; sunk: boolean }[];
  gridSize: { rows: number; cols: number };
  guesses: number;
  hits: number;
  shipsToSink: number;
  targetShipsSunk: number;
}

export class BattleshipMinigame {
  private playerStates: Map<string, BattleshipState> = new Map();

  initialize(playerId: string): BattleshipState {
    const gridSize = this.randomGridSize();
    const grid: ('hit' | 'miss' | null)[][] = Array.from(
      { length: gridSize.rows },
      () => Array(gridSize.cols).fill(null),
    );

    const { ships, shipsToSink, targetShipsSunk } = this.placeShips(gridSize);

    const state: BattleshipState = {
      grid,
      ships,
      gridSize,
      guesses: 0,
      hits: 0,
      shipsToSink,
      targetShipsSunk,
    };

    this.playerStates.set(playerId, state);
    return state;
  }

  handleAction(playerId: string, action: { coordinate: string }): {
    success: boolean;
    message: string;
    isComplete: boolean;
    state: BattleshipState;
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

    const { row, col } = this.parseCoordinate(action.coordinate, state.gridSize.cols);
    if (row === null || col === null) {
      return {
        success: false,
        message: `Invalid coordinate format. Use format like "A5", "G8", etc. (A-L for rows, 1-12 for cols)`,
        isComplete: false,
        state,
      };
    }

    if (state.grid[row][col] !== null) {
      return {
        success: false,
        message: 'Already guessed this coordinate!',
        isComplete: false,
        state,
      };
    }

    state.guesses++;

    // Check if hit
    let hit = false;
    for (const ship of state.ships) {
      if (!ship.sunk && ship.positions.some(([r, c]) => r === row && c === col)) {
        state.grid[row][col] = 'hit';
        state.hits++;
        hit = true;

        // Check if ship sunk
        const allHit = ship.positions.every(
          ([r, c]) => state.grid[r][c] === 'hit',
        );
        if (allHit) {
          ship.sunk = true;
          const sunkShips = state.ships.filter((s) => s.sunk).length;
          if (sunkShips >= state.targetShipsSunk) {
            return {
              success: true,
              message: `Ship sunk! All ${state.targetShipsSunk} ships sunk in ${state.guesses} guesses!`,
              isComplete: true,
              state,
            };
          }
          return {
            success: true,
            message: `Hit! Ship sunk! (${sunkShips}/${state.targetShipsSunk} ships sunk)`,
            isComplete: false,
            state,
          };
        }

        return {
          success: true,
          message: 'Hit!',
          isComplete: false,
          state,
        };
      }
    }

    // Miss
    state.grid[row][col] = 'miss';
    return {
      success: true,
      message: 'Miss!',
      isComplete: false,
      state,
    };
  }

  getState(playerId: string): BattleshipState | null {
    return this.playerStates.get(playerId) || null;
  }

  isComplete(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;
    const sunkShips = state.ships.filter((s) => s.sunk).length;
    return sunkShips >= state.targetShipsSunk;
  }

  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  private randomGridSize(): { rows: number; cols: number } {
    const sizes = [
      { rows: 12, cols: 12 },
      { rows: 10, cols: 10 },
      { rows: 8, cols: 8 },
    ];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }

  private placeShips(gridSize: { rows: number; cols: number }): {
    ships: { positions: [number, number][]; sunk: boolean }[];
    shipsToSink: number;
    targetShipsSunk: number;
  } {
    // Ship configurations: [size, count]
    const shipConfigs = [
      [5, 1], // 1 ship of size 5
      [4, 2], // 2 ships of size 4
      [3, 3], // 3 ships of size 3
    ];

    const ships: { positions: [number, number][]; sunk: boolean }[] = [];
    const placed = new Set<string>();

    for (const [size, count] of shipConfigs) {
      for (let i = 0; i < count; i++) {
        let placedSuccessfully = false;
        let attempts = 0;

        while (!placedSuccessfully && attempts < 100) {
          attempts++;
          const positions = this.randomShipPosition(gridSize, size, placed);
          if (positions) {
            ships.push({ positions, sunk: false });
            positions.forEach(([r, c]) => placed.add(`${r},${c}`));
            placedSuccessfully = true;
          }
        }
      }
    }

    // Target: sink 1-3 ships
    const targetShipsSunk = this.randomBetween(1, Math.min(3, ships.length));
    const shipsToSink = ships.length;

    return { ships, shipsToSink, targetShipsSunk };
  }

  private randomShipPosition(
    gridSize: { rows: number; cols: number },
    size: number,
    placed: Set<string>,
  ): [number, number][] | null {
    const horizontal = Math.random() < 0.5;

    if (horizontal) {
      // Horizontal placement
      const maxRow = gridSize.rows;
      const maxCol = gridSize.cols - size;

      for (let attempt = 0; attempt < 50; attempt++) {
        const row = this.randomBetween(0, maxRow - 1);
        const startCol = this.randomBetween(0, maxCol);

        const positions: [number, number][] = [];
        let valid = true;

        for (let i = 0; i < size; i++) {
          const key = `${row},${startCol + i}`;
          if (placed.has(key)) {
            valid = false;
            break;
          }
          positions.push([row, startCol + i]);
        }

        if (valid) return positions;
      }
    } else {
      // Vertical placement
      const maxRow = gridSize.rows - size;
      const maxCol = gridSize.cols;

      for (let attempt = 0; attempt < 50; attempt++) {
        const startRow = this.randomBetween(0, maxRow);
        const col = this.randomBetween(0, maxCol - 1);

        const positions: [number, number][] = [];
        let valid = true;

        for (let i = 0; i < size; i++) {
          const key = `${startRow + i},${col}`;
          if (placed.has(key)) {
            valid = false;
            break;
          }
          positions.push([startRow + i, col]);
        }

        if (valid) return positions;
      }
    }

    return null;
  }

  private parseCoordinate(
    coordinate: string,
    cols: number,
  ): { row: number | null; col: number | null } {
    const letter = coordinate.toUpperCase().charAt(0);
    const numberStr = coordinate.slice(1);

    const row = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    const col = parseInt(numberStr, 10) - 1;

    if (row < 0 || row >= 12 || col < 0 || col >= cols) {
      return { row: null, col: null };
    }

    return { row, col };
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDifficulty(): number {
    // 5-15 guesses typically
    return this.randomBetween(6, 10);
  }
}
