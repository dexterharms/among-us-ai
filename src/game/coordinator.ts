import { Player, PlayerRole } from '@/types/game';
import { GameState } from './state';
import { LobbyManager } from '@/lobby/manager';
import { EventType } from '@/types/game';

/**
 * GameCoordinator manages the full game flow from lobby to game over.
 * It orchestrates transitions between LobbyManager, GameState, and handles game over events.
 */
export class GameCoordinator {
  private lobbyManager: LobbyManager;
  private gameState: GameState;

  private sseManager = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast: (event: string, data: any) => {
      // eslint-disable-next-line no-console
      console.log(`[SSE Broadcast] ${event}`, JSON.stringify(data));
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTo: (playerId: string, event: string, data: any) => {
      // eslint-disable-next-line no-console
      console.log(`[SSE to ${playerId}] ${event}`, JSON.stringify(data));
    },
  };

  constructor(lobbyManager: LobbyManager, gameState: GameState) {
    this.lobbyManager = lobbyManager;
    this.gameState = gameState;
  }

  /**
   * Start a new game:
   * 1. Assign roles via LobbyManager
   * 2. Transfer players to GameState
   * 3. Start the first round
   */
  startGame(): void {
    // Get players from lobby
    const players = this.lobbyManager.getWaitingPlayers();

    // Assign roles (imposters vs crewmates)
    const { imposters, crewmates } = this.lobbyManager.assignRoles();

    // Reveal roles to players (in a real game, only show imposters to imposters)
    imposters.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        this.sseManager.sendTo(player.id, EventType.ROLE_REVEALED, {
          playerId: player.id,
          role: player.role,
        });
      }
    });

    crewmates.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        this.sseManager.sendTo(player.id, EventType.ROLE_REVEALED, {
          playerId: player.id,
          role: player.role,
        });
      }
    });

    // Transfer players to GameState
    players.forEach((player) => {
      this.gameState.addPlayer(player);
    });

    // Start the first round
    this.gameState.startRound();

    this.sseManager.broadcast(EventType.GAME_STARTED, {
      playerCount: players.length,
      imposterCount: imposters.length,
    });
  }

  /**
   * Restart the game for a new session:
   * - Clears all game state
   * - Keeps lobby players intact
   */
  restartGame(): void {
    // Reset game state
    this.gameState.reset();

    // Start a new game with existing lobby players
    this.startGame();
  }

  /**
   * End the current game and return to lobby:
   * - Broadcasts game over event
   * - Keeps lobby players for next game
   */
  endGameAndReturnToLobby(): void {
    // Game over should already be set by GameState or VotingSystem
    if (this.gameState.getPhase() !== 'GameOver') {
      this.sseManager.broadcast(EventType.GAME_ENDED, {
        winner: 'none',
        reason: 'Game ended',
      });
      this.gameState.setPhase('GameOver');
    }

    // Reset state for next game
    this.gameState.reset();
  }

  /**
   * Check if game is over and handle accordingly
   */
  checkGameEnd(): boolean {
    if (this.gameState.getPhase() === 'GameOver') {
      // Broadcast summary and reset for next game
      this.sseManager.broadcast(EventType.GAME_OVER_SUMMARY, {
        phase: 'GameOver',
        message: 'Game completed. Ready for next game?',
      });
      return true;
    }
    return false;
  }
}
