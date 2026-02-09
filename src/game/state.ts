import {
  GamePhase,
  Player,
  Room,
  DeadBody,
  PlayerRole,
  PlayerStatus,
  EventType,
} from '@/types/game';
import { RoomManager } from './rooms';
import { logger } from '@/utils/logger';

export class GameState {
  phase: GamePhase = GamePhase.LOBBY;
  roundNumber: number = 0;
  roundTimer: number = 0;
  players: Map<string, Player> = new Map();
  rooms: Map<string, Room> = new Map();
  deadBodies: Array<DeadBody> = [];

  private roomManager: RoomManager;
  private gameLoopInterval: Timer | null = null;

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

  constructor() {
    this.roomManager = new RoomManager();
    // Initialize rooms from RoomManager
    this.roomManager.getRooms().forEach((room) => {
      this.rooms.set(room.id, room);
    });
  }

  // Setters/Getters
  getPhase(): GamePhase {
    return this.phase;
  }

  setPhase(phase: GamePhase): void {
    this.phase = phase;
  }

  getRoundNumber(): number {
    return this.roundNumber;
  }

  getRoundTimer(): number {
    return this.roundTimer;
  }

  setRoundTimer(time: number): void {
    this.roundTimer = time;
  }

  // Core Methods
  startRound(): void {
    const previousPhase = this.phase;
    this.phase = GamePhase.ROUND;
    this.roundNumber += 1;
    this.roundTimer = 30; // 30 seconds per round? Or implied from prompt '30s interval'
    this.deadBodies = []; // Clear bodies? Or do they persist? Usually cleared or this is a new round.
    // If it's a new round, usually bodies are cleaned up in Among Us.

    logger.logStateTransition(previousPhase, GamePhase.ROUND, {
      roundNumber: this.roundNumber,
      playerCount: this.players.size,
      imposterCount: this.getImposterCount(),
    });

    this.spawnPlayersInRandomRooms();

    this.sseManager.broadcast(EventType.ROUND_STARTED, {
      roundNumber: this.roundNumber,
      imposterCount: this.getImposterCount(),
    });

    this.startRoundLoop();
  }

  spawnPlayersInRandomRooms(): void {
    try {
      const rooms = this.roomManager.getRooms();

      // Guard against empty rooms array
      if (!rooms || rooms.length === 0) {
        logger.error('No rooms available for spawning players', {
          roomCount: rooms?.length || 0,
          playerCount: this.players.size,
        });
        return;
      }

      let spawnedCount = 0;

      this.players.forEach((player, playerId) => {
        try {
          // Guard against null/undefined player
          if (!player) {
            logger.error(`Null/undefined player with ID: ${playerId}`);
            return;
          }

          if (player.status === PlayerStatus.ALIVE) {
            const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];

            // Guard against undefined room or room properties
            if (!randomRoom || !randomRoom.id || !randomRoom.position) {
              logger.error('Invalid room for player spawn', {
                playerId,
                roomId: randomRoom?.id,
                roomName: randomRoom?.name,
              });
              return;
            }

            player.location = {
              roomId: randomRoom.id,
              x: randomRoom.position.x,
              y: randomRoom.position.y,
            };
            spawnedCount++;
            // Update player in map? It's a reference, so yes.
          }
        } catch (error) {
          logger.error(`Error spawning player ${playerId}`, {
            playerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other players
        }
      });

      logger.debug(`Spawned ${spawnedCount} players in random rooms`);
    } catch (error) {
      logger.error('Error in spawnPlayersInRandomRooms', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  startRoundLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }

    logger.debug('Starting game loop', {
      roundNumber: this.roundNumber,
      roundTimer: this.roundTimer,
    });

    // Loop every second
    this.gameLoopInterval = setInterval(() => {
      try {
        // Phase null check - guard against undefined phase
        if (!this.phase || this.phase !== GamePhase.ROUND) {
          this.stopGameLoop();
          return;
        }

        // Safe timer decrement - guard against NaN or undefined
        if (typeof this.roundTimer !== 'number' || isNaN(this.roundTimer)) {
          logger.error('Invalid roundTimer value', {
            roundTimer: this.roundTimer,
            roundNumber: this.roundNumber,
          });
          this.stopGameLoop();
          return;
        }

        this.roundTimer -= 1;

        // Prompt AI agents for actions every 5 seconds
        if (this.roundTimer % 5 === 0 || this.roundTimer === 30) {
          this.promptAgents();
        }

        // Check if council should start with error handling
        if (this.shouldStartCouncil()) {
          this.startCouncilPhase();
        }
      } catch (error) {
        logger.error('Error in game loop tick', {
          error: error instanceof Error ? error.message : String(error),
          roundTimer: this.roundTimer,
          roundNumber: this.roundNumber,
        });
        // Don't stop the loop on recoverable errors, but log them
        // Could implement a max error count if needed
      }
    }, 1000);
  }

  private promptAgents(): void {
    try {
      // Guard against undefined phase or invalid timer
      if (!this.phase || typeof this.roundTimer !== 'number' || isNaN(this.roundTimer)) {
        logger.warn('Invalid state in promptAgents', {
          phase: this.phase,
          roundTimer: this.roundTimer,
        });
        return;
      }

      logger.debug('Prompting agents for actions', {
        roundNumber: this.roundNumber,
        roundTimer: this.roundTimer,
      });

      this.sseManager.broadcast(EventType.ACTION_PROMPT, {
        phase: this.phase,
        roundTimer: this.roundTimer,
        promptType: 'move',
      });
    } catch (error) {
      logger.error('Error in promptAgents', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail silently - agents just won't be prompted this tick
    }
  }

  stopGameLoop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      logger.debug('Game loop stopped', {
        roundNumber: this.roundNumber,
        phase: this.phase,
      });
    }
  }

  /**
   * Cleanup method to prevent memory leaks when game ends
   * Stops the game loop interval
   * Clears all references
   */
  cleanup(): void {
    this.stopGameLoop();
    // Clear any other references or timers here
    // Future: add VotingSystem cleanup when integrated
  }

  shouldStartCouncil(): boolean {
    try {
      // Guard against invalid timer values
      if (typeof this.roundTimer !== 'number' || isNaN(this.roundTimer)) {
        console.warn('[GameState] Invalid roundTimer in shouldStartCouncil:', this.roundTimer);
        return false;
      }

      if (this.roundTimer <= 0) return true;

      // Guard against undefined or null deadBodies array
      if (!this.deadBodies || !Array.isArray(this.deadBodies)) {
        console.warn('[GameState] Invalid deadBodies array in shouldStartCouncil');
        return false;
      }

      // Check if any dead bodies have been reported with null checks
      return this.deadBodies.some((body) => {
        if (!body) return false;
        return body.reported === true;
      });
    } catch (error) {
      console.error('[GameState] Error in shouldStartCouncil:', error);
      return false; // Default to not starting council on error
    }
  }

  /**
   * Report a dead body and trigger council if applicable
   * @param playerId - Player ID who discovered the body
   * @param bodyId - Index of body in deadBodies array
   */
  discoverBody(playerId: string, bodyId: number): void {
    try {
      // Guard against invalid deadBodies array
      if (!this.deadBodies || !Array.isArray(this.deadBodies)) {
        logger.error('Invalid deadBodies array in discoverBody', {
          deadBodies: this.deadBodies,
          playerId,
          bodyId,
        });
        return;
      }

      if (bodyId < 0 || bodyId >= this.deadBodies.length) {
        logger.warn('Invalid body ID', { playerId, bodyId, totalBodies: this.deadBodies.length });
        return;
      }

      const body = this.deadBodies[bodyId];
      if (!body || body.reported) {
        logger.warn('Body already reported or not found', { playerId, bodyId });
        return;
      }

      // Mark body as reported
      body.reported = true;

      const reporter = this.players.get(playerId);

      // Broadcast body found event - guard against missing location
      if (!body.location) {
        logger.error('Body has no location', { bodyId, playerId });
        return;
      }

      logger.logGameEvent(EventType.BODY_FOUND, {
        reporterId: playerId,
        reporterName: reporter?.name,
        deadBodyId: bodyId,
        victimId: body.playerId,
        location: body.location.roomId,
      });

      this.sseManager.broadcast(EventType.BODY_FOUND, {
        reporterId: playerId,
        deadBodyId: bodyId.toString(),
        location: body.location,
      });

      // Check if council should start
      if (this.shouldStartCouncil()) {
        this.startCouncilPhase();
      }
    } catch (error) {
      logger.error('Error in discoverBody', {
        error: error instanceof Error ? error.message : String(error),
        playerId,
        bodyId,
      });
    }
  }

  startCouncilPhase(): void {
    try {
      const previousPhase = this.phase;
      this.phase = GamePhase.VOTING;
      this.stopGameLoop();

      // Guard against invalid roundTimer when determining reason
      const reason = (typeof this.roundTimer === 'number' && !isNaN(this.roundTimer) && this.roundTimer <= 0)
        ? 'Timer Expired'
        : 'Body Found';

      logger.logStateTransition(previousPhase, GamePhase.VOTING, {
        reason,
        roundNumber: this.roundNumber,
        roundTimer: this.roundTimer,
      });

      this.sseManager.broadcast(EventType.COUNCIL_CALLED, {
        callerId: 'system',
        reason,
      });

      // In a real implementation, we would delegate to VotingSystem here.
      // But VotingSystem is a separate class/file.
      // The GameState might be used *by* the main Game class which coordinates these.
      // Or GameState might instantiate VotingSystem?
      // The prompt separates them into phases/files.
      // I'll keep the logic contained here for state transitions.
    } catch (error) {
      logger.error('Error in startCouncilPhase', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Attempt to set phase even if broadcast fails
      try {
        this.phase = GamePhase.VOTING;
        this.stopGameLoop();
      } catch (innerError) {
        logger.error('Critical error setting council phase', {
          error: innerError instanceof Error ? innerError.message : String(innerError),
        });
      }
    }
  }

  // Helper
  getImposterCount(): number {
    let count = 0;
    try {
      this.players.forEach((p, playerId) => {
        // Guard against null/undefined player
        if (!p) {
          logger.warn(`Null/undefined player in getImposterCount: ${playerId}`);
          return;
        }

        if (p.role === PlayerRole.IMPOSTER && p.status === PlayerStatus.ALIVE) {
          count++;
        }
      });
    } catch (error) {
      logger.error('Error in getImposterCount', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return count;
  }

  // Add player helper for testing/usage
  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    logger.debug('Player added to game state', {
      playerId: player.id,
      playerName: player.name,
      role: player.role,
    });
  }

  // Reset game state for starting a fresh game
  reset(): void {
    logger.info('Resetting game state', {
      previousPhase: this.phase,
      roundNumber: this.roundNumber,
      playerCount: this.players.size,
    });

    this.phase = GamePhase.LOBBY;
    this.roundNumber = 0;
    this.roundTimer = 0;
    this.deadBodies = [];
    this.stopGameLoop();
  }
}
