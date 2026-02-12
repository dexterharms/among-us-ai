import { GameState, GameEvent, EventType } from '@/types/game';
import { ActionQueue, QueuedAction } from './queue';
import { PlayerStateMachine, PlayerState } from './state-machine';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

/**
 * Tick configuration constants
 */
export const TICK_INTERVAL_MS = 5000; // 5 seconds between ticks
export const ACTION_TIMEOUT_MS = 30000; // 30 seconds to respond to a tick

/**
 * TickProcessor handles the tick-based game loop.
 * Each tick:
 * 1. Sends ACTION_PROMPT to all non-waiting players
 * 2. Marks prompted players as "waiting"
 * 3. Processes all queued player actions in order
 * 4. Broadcasts events to all players (SSE)
 */
export class TickProcessor {
  private actionQueue: ActionQueue;
  private stateMachine: PlayerStateMachine;
  private gameState: GameState;
  private sseManager: SSEManager;
  private tickInterval: Timer | null = null;
  private currentTickNumber: number = 0;
  private playerActionTimestamps: Map<string, number> = new Map(); // Track when players were last prompted

  constructor(
    gameState: GameState,
    sseManager: SSEManager,
  ) {
    this.gameState = gameState;
    this.sseManager = sseManager;
    this.actionQueue = new ActionQueue();
    this.stateMachine = new PlayerStateMachine();
  }

  /**
   * Start the tick loop
   */
  start(): void {
    if (this.tickInterval) {
      logger.warn('Tick loop already started');
      return;
    }

    logger.debug('Starting tick loop', { interval: TICK_INTERVAL_MS });

    this.tickInterval = setInterval(() => {
      this.processTick();
    }, TICK_INTERVAL_MS);

    // Process first tick immediately
    this.processTick();
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      logger.debug('Tick loop stopped', { currentTick: this.currentTickNumber });
    }
  }

  /**
   * Process a single tick
   */
  private processTick(): void {
    try {
      this.currentTickNumber++;

      logger.debug(`Processing tick ${this.currentTickNumber}`, {
        queueSize: this.actionQueue.size(),
        activePlayers: this.gameState.players.size,
      });

      // Step 1: Check for action timeouts and mark idle players
      this.checkActionTimeouts();

      // Step 2: Send ACTION_PROMPT to all non-waiting, non-summoned players
      this.promptPlayers();

      // Step 3: Process all queued player actions in order
      this.processActions();

      // Step 4: Broadcast tick completion event
      this.broadcastTickEvent();

    } catch (error) {
      logger.error('Error in tick processing', {
        tickNumber: this.currentTickNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check for action timeouts
   * If a player has been waiting for > 30 seconds without action, mark them as idle (roaming)
   */
  private checkActionTimeouts(): void {
    const now = Date.now();
    const playersInWaitingState = this.stateMachine.getPlayersInState(PlayerState.WAITING);

    playersInWaitingState.forEach(playerId => {
      const lastPromptTime = this.playerActionTimestamps.get(playerId);
      if (!lastPromptTime) return;

      const timeSincePrompt = now - lastPromptTime;

      if (timeSincePrompt > ACTION_TIMEOUT_MS) {
        logger.debug(`Player ${playerId} timed out, marking as idle`, {
          timeSincePrompt,
          timeoutLimit: ACTION_TIMEOUT_MS,
        });

        // Transition back to Roaming (idle)
        try {
          this.stateMachine.transition(playerId, PlayerState.ROAMING);
          this.playerActionTimestamps.delete(playerId);

          // Optionally notify player they timed out
          this.sseManager.sendTo(playerId, {
            timestamp: now,
            type: 'ActionTimeout',
            payload: {
              message: 'You took too long to respond. You are now idle.',
            },
          });
        } catch (error) {
          logger.error('Error transitioning player to idle', {
            playerId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }

  /**
   * Send ACTION_PROMPT to all non-waiting, non-summoned players
   */
  private promptPlayers(): void {
    const now = Date.now();
    const promptedPlayers: string[] = [];

    this.gameState.players.forEach((player, playerId) => {
      // Skip dead/ejected players
      if (player.status !== 'Alive') return;

      // Get player's current state
      const playerState = this.stateMachine.getPlayerState(playerId);

      // Only prompt players who are NOT waiting or summoned
      if (playerState === PlayerState.WAITING || playerState === PlayerState.SUMMONED) {
        return;
      }

      // Mark player as waiting
      try {
        this.stateMachine.transition(playerId, PlayerState.WAITING);
        this.playerActionTimestamps.set(playerId, now);
        promptedPlayers.push(playerId);
      } catch (error) {
        logger.error('Error transitioning player to waiting', {
          playerId,
          currentState: playerState,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    if (promptedPlayers.length > 0) {
      logger.debug(`Prompted ${promptedPlayers.length} players for actions`);

      const event: GameEvent = {
        timestamp: now,
        type: EventType.ACTION_PROMPT,
        payload: {
          phase: this.gameState.phase,
          roundTimer: this.gameState.roundTimer,
          promptType: 'action',
          tickNumber: this.currentTickNumber,
        },
      };

      // Broadcast to all players (but only prompted players should respond)
      this.sseManager.broadcast(event);
    }
  }

  /**
   * Process all queued player actions in order
   */
  private processActions(): void {
    const actions = this.actionQueue.dequeueAll();

    if (actions.length === 0) {
      return;
    }

    logger.debug(`Processing ${actions.length} queued actions`);

    actions.forEach((queuedAction, index) => {
      try {
        this.processAction(queuedAction);

        // After processing, transition player back to appropriate state
        const playerState = this.stateMachine.getPlayerState(queuedAction.playerId);
        if (playerState === PlayerState.WAITING) {
          // Transition to appropriate next state based on action type
          // For now, default to ROAMING (this can be refined based on action type)
          this.stateMachine.transition(queuedAction.playerId, PlayerState.ROAMING);
        }

        // Clear the action timestamp
        this.playerActionTimestamps.delete(queuedAction.playerId);
      } catch (error) {
        logger.error(`Error processing action ${index + 1}`, {
          playerId: queuedAction.playerId,
          action: queuedAction.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Process a single queued action
   * This delegates to the appropriate handler based on action type
   */
  private processAction(queuedAction: QueuedAction): void {
    const { playerId, action, payload } = queuedAction;

    // Validate player exists
    const player = this.gameState.players.get(playerId);
    if (!player) {
      logger.warn('Cannot process action: player not found', { playerId });
      return;
    }

    // Delegate to appropriate handler based on action type
    switch (action) {
      case 'move':
        this.handleMove(playerId, payload);
        break;
      case 'task':
        this.handleTask(playerId, payload);
        break;
      case 'kill':
        this.handleKill(playerId, payload);
        break;
      case 'vent':
        this.handleVent(playerId, payload);
        break;
      case 'sabotage':
        this.handleSabotage(playerId, payload);
        break;
      case 'report':
        this.handleReport(playerId, payload);
        break;
      case 'vote':
        this.handleVote(playerId, payload);
        break;
      case 'button':
        this.handleButton(playerId, payload);
        break;
      default:
        logger.warn('Unknown action type', { action, playerId });
    }
  }

  /**
   * Queue a player action
   * Called by API endpoints when a player submits an action
   */
  queueAction(action: QueuedAction): void {
    // Validate player is in waiting state (can only submit action if prompted)
    const playerState = this.stateMachine.getPlayerState(action.playerId);
    if (playerState !== PlayerState.WAITING && playerState !== PlayerState.INTERACTING) {
      logger.warn('Player tried to submit action while not waiting', {
        playerId: action.playerId,
        currentState: playerState,
      });
      return;
    }

    this.actionQueue.enqueue(action);
  }

  /**
   * Broadcast tick completion event
   */
  private broadcastTickEvent(): void {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: 'TickCompleted',
      payload: {
        tickNumber: this.currentTickNumber,
        queueSize: this.actionQueue.size(),
      },
    };

    this.sseManager.broadcast(event);
  }

  // Action handlers (delegated to existing game systems)

  private handleMove(playerId: string, payload: any): void {
    // Delegate to GameState.movePlayer
    const success = this.gameState.movePlayer(playerId, payload.targetRoomId);
    if (!success) {
      logger.warn('Move action failed', { playerId, payload });
    }
  }

  private handleTask(playerId: string, payload: any): void {
    // Delegate to TaskManager
    // For now, just log
    logger.debug('Task action queued', { playerId, payload });
  }

  private handleKill(playerId: string, payload: any): void {
    // Delegate to ImposterAbilities (kill)
    logger.debug('Kill action queued', { playerId, payload });
  }

  private handleVent(playerId: string, payload: any): void {
    // Delegate to ImposterAbilities (vent)
    logger.debug('Vent action queued', { playerId, payload });
  }

  private handleSabotage(playerId: string, payload: any): void {
    // Delegate to ImposterAbilities (sabotage)
    logger.debug('Sabotage action queued', { playerId, payload });
  }

  private handleReport(playerId: string, payload: any): void {
    // Delegate to GameState.discoverBody
    this.gameState.discoverBody(playerId, payload.bodyId);
  }

  private handleVote(playerId: string, payload: any): void {
    // Delegate to VotingSystem
    this.gameState.getVotingSystem().castVote(playerId, payload.targetId ?? null);
  }

  private handleButton(playerId: string, payload: any): void {
    // Delegate to GameState (emergency button)
    logger.debug('Button action queued', { playerId, payload });
  }

  /**
   * Get the action queue (for testing/inspection)
   */
  getActionQueue(): ActionQueue {
    return this.actionQueue;
  }

  /**
   * Get the state machine (for testing/inspection)
   */
  getStateMachine(): PlayerStateMachine {
    return this.stateMachine;
  }

  /**
   * Reset the tick processor (for new games)
   */
  reset(): void {
    this.stop();
    this.actionQueue.clear();
    this.stateMachine.clear();
    this.playerActionTimestamps.clear();
    this.currentTickNumber = 0;
  }
}
