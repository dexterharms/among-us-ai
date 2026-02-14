import {
  GamePhase,
  Player,
  Room,
  DeadBody,
  PlayerRole,
  PlayerStatus,
  EventType,
  GameEvent,
  MovementDirection,
} from '@/types/game';
import { RoomManager } from './rooms';
import { logger } from '@/utils/logger';
import { ActionLogger } from '@/actions/logger';
import { SSEManager } from '@/sse/manager';
import { VotingSystem } from './voting';
import { TickProcessor } from '@/tick';
import { PlayerState } from '@/tick/state-machine';
import { TaskManager } from './tasks';
import { SabotageSystem } from './sabotage';
import { MinigameManager } from '@/tasks';
import { EmergencyButtonSystem } from './emergency-button';
import { ImposterAbilities } from './imposter';
import { PendingRevealQueue } from './pending-reveal-queue';

export class GameState {
  private phase: GamePhase = GamePhase.LOBBY;
  private roundNumber: number = 0;
  private roundTimer: number = 0;

  // Private backing fields for readonly public access
  private _players: Map<string, Player> = new Map();
  private _rooms: Map<string, Room> = new Map();
  private _deadBodies: Array<DeadBody> = [];

  // Readonly public access to critical state
  get players(): Map<string, Player> {
    return this._players;
  }

  get rooms(): Map<string, Room> {
    return this._rooms;
  }

  get deadBodies(): Array<DeadBody> {
    return this._deadBodies;
  }

  private readonly ROUND_DURATION_SECONDS = 300; // 5 minutes per round per HAR-110
  private roomManager: RoomManager;
  private gameLoopInterval: Timer | null = null;
  private actionLogger: ActionLogger;
  private sseManager: SSEManager;
  private votingSystem: VotingSystem;
  private tickProcessor: TickProcessor;
  private taskManager: TaskManager;
  private sabotageSystem: SabotageSystem;
  private minigameManager: MinigameManager;
  private roundStartTime: number = 0;
  private emergencyButtonSystem: EmergencyButtonSystem;
  private imposterAbilities?: ImposterAbilities;
  private pendingRevealQueue: PendingRevealQueue;

  constructor() {
    this.roomManager = new RoomManager();
    this.actionLogger = new ActionLogger();
    this.sseManager = new SSEManager();
    this.taskManager = new TaskManager(this, this.sseManager);
    this.minigameManager = this.taskManager.getMinigameManager();
    this.votingSystem = new VotingSystem(this, this.sseManager);
    this.tickProcessor = new TickProcessor(this, this.sseManager);
    this.sabotageSystem = new SabotageSystem(this, this.sseManager, this.minigameManager);
    this.emergencyButtonSystem = new EmergencyButtonSystem(this);
    this.pendingRevealQueue = new PendingRevealQueue();

    // Initialize rooms from RoomManager
    this.roomManager.getRooms().forEach((room) => {
      this._rooms.set(room.id, room);
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
    if (typeof time !== 'number' || isNaN(time)) {
      logger.error('Invalid round timer value', { time });
      return;
    }
    this.roundTimer = time;
  }

  // Core Methods

  /**
   * Log and broadcast a game event
   */
  private logAndBroadcast(event: GameEvent): void {
    // Log action with game state
    this.actionLogger.logAction(event, this);

    // Broadcast via SSE
    this.sseManager.broadcast(event);

    // Log to console
    logger.logGameEvent(event.type, event.payload);
  }

  startRound(): void {
    const previousPhase = this.phase;
    this.phase = GamePhase.ROUND;
    this.roundNumber += 1;
    this.roundTimer = this.ROUND_DURATION_SECONDS;
    this.roundStartTime = Date.now();
    // Clear dead bodies at the start of each round
    this._deadBodies = [];

    logger.logStateTransition(previousPhase, GamePhase.ROUND, {
      roundNumber: this.roundNumber,
      playerCount: this._players.size,
      imposterCount: this.imposterCount,
    });

    this.spawnPlayersInRandomRooms();

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.ROUND_STARTED,
      payload: {
        roundNumber: this.roundNumber,
        imposterCount: this.imposterCount,
      },
    };
    this.logAndBroadcast(event);

    // Start the tick processor for action-based gameplay
    this.tickProcessor.start();
  }

  spawnPlayersInRandomRooms(): void {
    try {
      const rooms = this.roomManager.getRooms();

      // Guard against empty rooms array
      if (!rooms || rooms.length === 0) {
        logger.error('No rooms available for spawning players', {
          roomCount: rooms?.length || 0,
          playerCount: this._players.size,
        });
        return;
      }

      let spawnedCount = 0;

      this._players.forEach((player, playerId) => {
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
        if (this.roundTimer % 5 === 0 || this.roundTimer === this.ROUND_DURATION_SECONDS) {
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

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.ACTION_PROMPT,
        payload: {
          phase: this.phase,
          roundTimer: this.roundTimer,
          promptType: 'move',
        },
      };
      this.logAndBroadcast(event);
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
    this.tickProcessor.stop();
    this.votingSystem.cleanup();
    this.sabotageSystem.cleanup();
  }

  /**
   * Get the voting system for casting votes
   */
  getVotingSystem(): VotingSystem {
    return this.votingSystem;
  }

  /**
   * Get the sabotage system
   */
  getSabotageSystem(): SabotageSystem {
    return this.sabotageSystem;
  }

  shouldStartCouncil(): boolean {
    try {
      // Guard against invalid timer values
      if (typeof this.roundTimer !== 'number' || isNaN(this.roundTimer)) {
        logger.warn('Invalid roundTimer in shouldStartCouncil:', this.roundTimer);
        return false;
      }

      if (this.roundTimer <= 0) return true;

      // Guard against undefined or null deadBodies array
      if (!this._deadBodies || !Array.isArray(this._deadBodies)) {
        logger.warn('Invalid deadBodies array in shouldStartCouncil');
        return false;
      }

      // Check if any dead bodies have been reported with null checks
      return this._deadBodies.some((body) => {
        if (!body) return false;
        return body.reported === true;
      });
    } catch (error) {
      logger.error('Error in shouldStartCouncil:', error);
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
      if (!this._deadBodies || !Array.isArray(this._deadBodies)) {
        logger.error('Invalid deadBodies array in discoverBody', {
          deadBodies: this._deadBodies,
          playerId,
          bodyId,
        });
        return;
      }

      if (bodyId < 0 || bodyId >= this._deadBodies.length) {
        logger.warn('Invalid body ID', { playerId, bodyId, totalBodies: this._deadBodies.length });
        return;
      }

      const body = this._deadBodies[bodyId];
      if (!body || body.reported) {
        logger.warn('Body already reported or not found', { playerId, bodyId });
        return;
      }

      // Mark body as reported
      body.reported = true;

      const reporter = this._players.get(playerId);

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

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.BODY_FOUND,
        payload: {
          reporterId: playerId,
          deadBodyId: bodyId.toString(),
          location: body.location,
        },
      };
      this.logAndBroadcast(event);

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
    // Stop the game loop and tick processor during council
    this.stopGameLoop();
    this.tickProcessor.stop();

    // Delegate to VotingSystem
    this.votingSystem.startCouncil(this._deadBodies);
  }

  /**
   * Get the count of alive imposters
   * Property getter for computed read-only value
   */
  get imposterCount(): number {
    let count = 0;
    try {
      this._players.forEach((p, playerId) => {
        // Guard against null/undefined player
        if (!p) {
          logger.warn(`Null/undefined player in imposterCount getter: ${playerId}`);
          return;
        }

        if (p.role === PlayerRole.IMPOSTER && p.status === PlayerStatus.ALIVE) {
          count++;
        }
      });
    } catch (error) {
      logger.error('Error in imposterCount getter', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return count;
  }

  /**
   * Move a player to a new room
   * @param playerId - Player to move
   * @param targetRoomId - Destination room ID
   * @returns true if move was successful, false otherwise
   */
  movePlayer(playerId: string, targetRoomId: string): boolean {
    const player = this._players.get(playerId);
    if (!player) {
      logger.warn('Cannot move: player not found', { playerId });
      return false;
    }

    if (player.status !== PlayerStatus.ALIVE) {
      logger.warn('Cannot move: player not alive', {
        playerId,
        status: player.status,
      });
      return false;
    }

    const currentRoomId = player.location.roomId;

    // Check if movement is blocked by doors sabotage
    if (this.sabotageSystem.isMovementBlocked(targetRoomId)) {
      logger.warn('Movement blocked by doors sabotage', {
        playerId,
        currentRoomId,
        targetRoomId,
      });
      return false;
    }

    // Validate the movement (check if rooms are connected)
    if (!this.roomManager.validateMovement(currentRoomId, targetRoomId)) {
      logger.warn('Invalid movement: rooms not connected', {
        playerId,
        currentRoomId,
        targetRoomId,
      });
      return false;
    }

    const targetRoom = this.roomManager.getRoom(targetRoomId);
    if (!targetRoom) {
      logger.warn('Cannot move: target room not found', { targetRoomId });
      return false;
    }

    // Update player location
    player.location = {
      roomId: targetRoomId,
      x: targetRoom.position.x,
      y: targetRoom.position.y,
    };

    // Queue pending reveals for source and destination rooms
    // For source room: queue a leave event with opposite direction
    const direction = this.roomManager.getDirection(currentRoomId, targetRoomId);
    if (direction) {
      const oppositeDirection = this.getOppositeDirection(direction);
      this.pendingRevealQueue.queueReveal(
        playerId,
        currentRoomId,
        oppositeDirection,
        'leave',
      );
    }

    // For destination room: queue an enter event with the movement direction
    if (direction) {
      this.pendingRevealQueue.queueReveal(
        playerId,
        targetRoomId,
        direction,
        'enter',
      );
    }

    logger.logGameEvent(EventType.PLAYER_MOVED, {
      playerId,
      playerName: player.name,
      fromRoom: currentRoomId,
      toRoom: targetRoomId,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.PLAYER_MOVED,
      payload: {
        playerId,
        newLocation: player.location,
      },
    };
    this.logAndBroadcast(event);

    return true;
  }

  // Add player helper for testing/usage
  addPlayer(player: Player): void {
    this._players.set(player.id, player);
    logger.debug('Player added to game state', {
      playerId: player.id,
      playerName: player.name,
      role: player.role,
    });
  }

  /**
   * Get the action logger for querying logged actions
   */
  getActionLogger(): ActionLogger {
    return this.actionLogger;
  }

  /**
   * Get the SSE manager for event broadcasting
   */
  getSSEManager(): SSEManager {
    return this.sseManager;
  }

  /**
   * Get tick processor for action queue and player state machine
   */
  getTickProcessor(): TickProcessor {
    return this.tickProcessor;
  }

  /**
   * Get task manager for task assignment and completion
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }

  /**
   * Get sabotage system for imposter abilities
   */
  getSabotageSystem(): SabotageSystem {
    return this.sabotageSystem;
  }

  /**
   * Get the round start time (for emergency button warm-up)
   */
  getRoundStartTime(): number {
    return this.roundStartTime;
  }

  /**
   * Get the emergency button system
   */
  getEmergencyButtonSystem(): EmergencyButtonSystem {
    return this.emergencyButtonSystem;
  }

  getImposterAbilities(): ImposterAbilities {
    if (!this.imposterAbilities) {
      this.imposterAbilities = new ImposterAbilities(this, this.getSSEManager());
    }
    return this.imposterAbilities;
  }

  getPendingRevealQueue(): PendingRevealQueue {
    return this.pendingRevealQueue;
  }

  /**
   * Get the opposite direction for a given movement direction
   * Used for generating leave events when a player exits a room
   */
  getOppositeDirection(direction: MovementDirection): string {
    const opposites: Record<MovementDirection, string> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    return opposites[direction];
  }

  /**
   * Get players who are visible in a room (excluding those with pending enter reveals)
   * @param roomId - Room ID to get visible players for
   * @returns Array of players visible in the room
   */
  getPlayersVisibleInRoom(roomId: string): Player[] {
    const pendingReveals = this.pendingRevealQueue.getPendingRevealsForRoom(roomId);
    const hiddenPlayerIds = new Set(
      pendingReveals.filter((r) => r.type === 'enter').map((r) => r.playerId),
    );

    return Array.from(this._players.values()).filter(
      (p) => p.location.roomId === roomId && !hiddenPlayerIds.has(p.id),
    );
  }

  /**
   * Call an emergency meeting
   */
  callEmergency(playerId: string): { success: boolean; reason?: string } {
    const player = this._players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }
    return this.emergencyButtonSystem.callEmergency(
      playerId,
      player.location.roomId,
      this.roundStartTime,
    );
  }

  // Reset game state for starting a fresh game
  reset(): void {
    logger.info('Resetting game state', {
      previousPhase: this.phase,
      roundNumber: this.roundNumber,
      playerCount: this._players.size,
    });

    this.phase = GamePhase.LOBBY;
    this.roundNumber = 0;
    this.roundTimer = 0;
    this.roundStartTime = 0;
    this._deadBodies = [];
    this.stopGameLoop();
    this.tickProcessor.reset();
    this.sabotageSystem.reset();
    this.emergencyButtonSystem.reset();
    this.pendingRevealQueue.clear();
  }
}
