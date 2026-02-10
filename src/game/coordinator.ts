import { Player, PlayerRole, EventType, GameEvent, GamePhase } from '@/types/game';
import { GameState } from './state';
import { LobbyManager } from '@/lobby/manager';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

/**
 * GameCoordinator manages the full game flow from lobby to game over.
 * It orchestrates transitions between LobbyManager, GameState, and handles game over events.
 */
export class GameCoordinator {
  private lobbyManager: LobbyManager;
  private gameState: GameState;
  private sseManager: SSEManager;

  constructor(lobbyManager: LobbyManager, gameState: GameState, sseManager: SSEManager) {
    this.lobbyManager = lobbyManager;
    this.gameState = gameState;
    this.sseManager = sseManager;
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

    if (players.length < 3) {
      logger.warn('Cannot start game: not enough players', {
        playerCount: players.length,
        minPlayers: 3,
      });
      return;
    }

    // Assign roles (imposters vs crewmates)
    const { imposters, crewmates } = this.lobbyManager.assignRoles();

    // Reveal roles to players
    imposters.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const event: GameEvent = {
          timestamp: Date.now(),
          type: EventType.ROLE_REVEALED,
          payload: {
            playerId: player.id,
            role: player.role,
          },
        };
        this.sseManager.sendTo(player.id, event);
      }
    });

    crewmates.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const event: GameEvent = {
          timestamp: Date.now(),
          type: EventType.ROLE_REVEALED,
          payload: {
            playerId: player.id,
            role: player.role,
          },
        };
        this.sseManager.sendTo(player.id, event);
      }
    });

    // Transfer players to GameState
    players.forEach((player) => {
      this.gameState.addPlayer(player);
    });

    // Start the first round
    this.gameState.startRound();

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.GAME_STARTED,
      payload: {
        playerCount: players.length,
        imposterCount: imposters.length,
      },
    };
    this.sseManager.broadcast(event);

    logger.info('Game started', {
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
    logger.info('Restarting game');

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
    if (this.gameState.getPhase() !== GamePhase.GAME_OVER) {
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_ENDED,
        payload: {
          winner: 'Crewmates',
          reason: 'Game ended',
        },
      };
      this.sseManager.broadcast(event);
      this.gameState.setPhase(GamePhase.GAME_OVER);
    }

    // Reset state for next game
    this.gameState.reset();
  }

  /**
   * Check if game is over and handle accordingly
   */
  checkGameEnd(): boolean {
    if (this.gameState.getPhase() === 'GameOver') {
      // Broadcast summary
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_OVER_SUMMARY,
        payload: {
          phase: 'GameOver',
          message: 'Game completed. Ready for next game?',
        },
      };
      this.sseManager.broadcast(event);
      return true;
    }
    return false;
  }

  /**
   * Get the lobby manager
   */
  getLobbyManager(): LobbyManager {
    return this.lobbyManager;
  }

  /**
   * Get the game state
   */
  getGameState(): GameState {
    return this.gameState;
  }
}
