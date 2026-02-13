import { GameState, GameEvent, EventType, Player, PlayerStatus } from '@/types/game';
import { SSEManager } from '@/sse/manager';
import { MinigameManager, MinigameType } from '@/tasks';
import { logger } from '@/utils/logger';

export enum SabotageType {
  LIGHTS_OUT = 'lights-out',
  DOORS = 'doors',
  SELF_DESTRUCT = 'self-destruct',
}

export interface SabotageState {
  type: SabotageType;
  active: boolean;
  startedAt: number;
  target?: string; // Room-specific for doors
  timeRemaining?: number; // For self-destruct
}

export interface SabotageAction {
  type: SabotageType;
  target?: string;
}

/**
 * SabotageSystem handles imposter sabotage abilities
 * - Lights out: Global visibility loss, 4 switches to flip
 * - Doors: Room exits locked, requires code entry
 * - Self-destruct: Global timer, requires stop button press
 */
export class SabotageSystem {
  private gameState: GameState;
  private sseManager: SSEManager;
  private minigameManager: MinigameManager;
  private currentSabotage: SabotageState | null = null;
  private readonly SABOTAGE_COOLDOWN_MS = 60000; // 60 seconds
  private lastSabotageTime: number = 0;
  private sabotageTimer: Timer | null = null;

  constructor(gameState: GameState, sseManager: SSEManager, minigameManager: MinigameManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
    this.minigameManager = minigameManager;
  }

  /**
   * Trigger a sabotage
   * Imposter-only action
   */
  triggerSabotage(playerId: string, action: SabotageAction): { success: boolean; reason?: string } {
    const player = this.gameState.players.get(playerId);

    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.role !== 'Imposter') {
      return { success: false, reason: 'Only imposters can trigger sabotage' };
    }

    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead imposters cannot sabotage' };
    }

    if (this.currentSabotage && this.currentSabotage.active) {
      return { success: false, reason: 'Sabotage already in progress' };
    }

    // Check cooldown
    const now = Date.now();
    const timeSinceLastSabotage = now - this.lastSabotageTime;
    if (timeSinceLastSabotage < this.SABOTAGE_COOLDOWN_MS) {
      const remainingTime = Math.ceil((this.SABOTAGE_COOLDOWN_MS - timeSinceLastSabotage) / 1000);
      return { success: false, reason: `Sabotage on cooldown: ${remainingTime}s remaining` };
    }

    // Trigger sabotage
    this.currentSabotage = {
      type: action.type,
      active: true,
      startedAt: now,
      target: action.target,
    };

    this.lastSabotageTime = now;

    // Force all crewmates on tasks to quit
    this.forceTaskInterruption();

    // Broadcast sabotage event
    const event: GameEvent = {
      timestamp: now,
      type: EventType.SABOTAGE_TRIGGERED,
      payload: {
        type: action.type,
        target: action.target,
        imposterId: playerId,
      },
    };
    this.sseManager.broadcast(event);

    logger.logGameEvent(EventType.SABOTAGE_TRIGGERED, {
      imposterId: playerId,
      sabotageType: action.type,
      target: action.target,
    });

    // Start timer for self-destruct
    if (action.type === SabotageType.SELF_DESTRUCT) {
      this.startSelfDestructTimer();
    }

    return { success: true };
  }

  /**
   * Force crewmates on tasks to quit due to sabotage
   * Tasks reset progress depending on type (hold button resets, others don't)
   */
  private forceTaskInterruption(): void {
    const interruptedPlayers: string[] = [];

    this.gameState.players.forEach((player, playerId) => {
      // Only affect living crewmates
      if (player.status !== PlayerStatus.ALIVE || player.role !== 'Crewmate') {
        return;
      }

      // Check if player is interacting (on a task)
      const playerState = this.gameState.tickProcessor?.getStateMachine().getPlayerState(playerId);
      if (playerState !== 'Interacting') {
        return;
      }

      // Check if player has active minigame
      let hasActiveMinigame = false;
      let activeMinigameType: MinigameType | null = null;

      for (const minigameType of Object.values(MinigameType)) {
        const state = this.minigameManager.getMinigameState(playerId, minigameType);
        if (state && !this.minigameManager.isMinigameComplete(playerId, minigameType)) {
          hasActiveMinigame = true;
          activeMinigameType = minigameType;
          break;
        }
      }

      if (!hasActiveMinigame || !activeMinigameType) {
        return;
      }

      interruptedPlayers.push(playerId);

      // Handle task interruption based on minigame type
      if (activeMinigameType === MinigameType.HOLD_BUTTON) {
        // Hold button resets progress on quit
        logger.debug('Resetting hold-button progress due to sabotage', { playerId });
        this.minigameManager.cleanupMinigame(playerId, activeMinigameType);
      } else {
        // Other tasks do not reset progress, just interrupt
        logger.debug('Interrupting task due to sabotage (progress preserved)', {
          playerId,
          minigameType: activeMinigameType,
        });
        // State is preserved, just transition back to roaming
        this.gameState.tickProcessor?.getStateMachine().transition(playerId, 'Roaming');
      }

      // Send interruption notification to player
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.SABOTAGE_INTERRUPTED,
        payload: {
          playerId,
          sabotageType: this.currentSabotage?.type,
          progressReset: activeMinigameType === MinigameType.HOLD_BUTTON,
        },
      };
      this.sseManager.sendTo(playerId, event);
    });

    logger.info('Sabotage interrupted players on tasks', {
      playerCount: interruptedPlayers.length,
      playerIds: interruptedPlayers,
    });
  }

  /**
   * Fix a sabotage
   * Called by crewmates using interactables
   */
  fixSabotage(playerId: string, fixType: string, fixData?: any): { success: boolean; reason?: string } {
    if (!this.currentSabotage || !this.currentSabotage.active) {
      return { success: false, reason: 'No active sabotage' };
    }

    const player = this.gameState.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead players cannot fix sabotage' };
    }

    // Handle different sabotage fix types
    switch (this.currentSabotage.type) {
      case SabotageType.LIGHTS_OUT:
        return this.fixLightsOut(playerId, fixType);
      case SabotageType.DOORS:
        return this.fixDoors(playerId, fixData);
      case SabotageType.SELF_DESTRUCT:
        return this.fixSelfDestruct(playerId);
      default:
        return { success: false, reason: 'Unknown sabotage type' };
    }
  }

  /**
   * Fix lights out sabotage
   * All 4 switches must be flipped
   */
  private fixLightsOut(playerId: string, switchId: string): { success: boolean; reason?: string } {
    // Track which switches have been flipped
    const flippedSwitches = this.currentSabotage?.flippedSwitches || new Set<string>();

    if (flippedSwitches.has(switchId)) {
      return { success: false, reason: 'Switch already flipped' };
    }

    flippedSwitches.add(switchId);
    (this.currentSabotage as any).flippedSwitches = flippedSwitches;

    logger.debug('Lights sabotage switch flipped', { playerId, switchId, flipped: flippedSwitches.size });

    // Check if all 4 switches are flipped
    if (flippedSwitches.size >= 4) {
      return this.endSabotage();
    }

    // Broadcast progress
    this.sseManager.broadcast({
      timestamp: Date.now(),
      type: EventType.SABOTAGE_PROGRESS,
      payload: {
        type: SabotageType.LIGHTS_OUT,
        progress: flippedSwitches.size,
        total: 4,
        playerId,
      },
    });

    return { success: true };
  }

  /**
   * Fix doors sabotage
   * Correct code must be entered
   */
  private fixDoors(playerId: string, codeData: any): { success: boolean; reason?: string } {
    if (!codeData || !codeData.code) {
      return { success: false, reason: 'Code required' };
    }

    // Simple validation: code must match expected format
    // In a real implementation, the code would be generated and stored when sabotage starts
    const expectedCode = '1234'; // Placeholder
    if (codeData.code !== expectedCode) {
      return { success: false, reason: 'Incorrect code' };
    }

    return this.endSabotage();
  }

  /**
   * Fix self-destruct sabotage
   * Stop button must be pressed
   */
  private fixSelfDestruct(playerId: string): { success: boolean; reason?: string } {
    // Stop button pressed
    if (this.sabotageTimer) {
      clearTimeout(this.sabotageTimer);
      this.sabotageTimer = null;
    }

    return this.endSabotage();
  }

  /**
   * End active sabotage
   */
  private endSabotage(): { success: boolean; reason?: string } {
    if (!this.currentSabotage) {
      return { success: false, reason: 'No active sabotage' };
    }

    const sabotageType = this.currentSabotage.type;
    const duration = Date.now() - this.currentSabotage.startedAt;

    this.currentSabotage = null;

    // Broadcast sabotage fixed event
    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.SABOTAGE_FIXED,
      payload: {
        type: sabotageType,
        duration,
      },
    };
    this.sseManager.broadcast(event);

    logger.logGameEvent(EventType.SABOTAGE_FIXED, {
      sabotageType,
      duration,
    });

    return { success: true };
  }

  /**
   * Start self-destruct timer
   */
  private startSelfDestructTimer(): void {
    const TIMER_DURATION_MS = 30000; // 30 seconds
    let timeRemaining = TIMER_DURATION_MS;

    this.sabotageTimer = setInterval(() => {
      timeRemaining -= 1000;
      (this.currentSabotage as any).timeRemaining = timeRemaining;

      // Broadcast timer update
      this.sseManager.broadcast({
        timestamp: Date.now(),
        type: EventType.SABOTAGE_PROGRESS,
        payload: {
          type: SabotageType.SELF_DESTRUCT,
          timeRemaining,
          total: TIMER_DURATION_MS,
        },
      });

      if (timeRemaining <= 0) {
        // Self-destruct complete - imposters win
        this.clearSabotageTimer();
        this.triggerImpostersWin('Self-destruct timer expired');
      }
    }, 1000);
  }

  /**
   * Clear sabotage timer
   */
  private clearSabotageTimer(): void {
    if (this.sabotageTimer) {
      clearTimeout(this.sabotageTimer);
      this.sabotageTimer = null;
    }
  }

  /**
   * Trigger imposters win condition
   */
  private triggerImpostersWin(reason: string): void {
    logger.logGameEvent(EventType.GAME_ENDED, {
      winner: 'Imposters',
      reason,
    });

    this.sseManager.broadcast({
      timestamp: Date.now(),
      type: EventType.GAME_ENDED,
      payload: {
        winner: 'Imposters',
        reason,
      },
    });

    this.gameState.phase = 'GameOver';
  }

  /**
   * Get current sabotage state
   */
  getCurrentSabotage(): SabotageState | null {
    return this.currentSabotage;
  }

  /**
   * Check if sabotage is active
   */
  isSabotageActive(): boolean {
    return this.currentSabotage?.active || false;
  }

  /**
   * Get sabotage cooldown remaining (in seconds)
   */
  getCooldownRemaining(): number {
    const now = Date.now();
    const timeSinceLastSabotage = now - this.lastSabotageTime;
    const remaining = Math.max(0, this.SABOTAGE_COOLDOWN_MS - timeSinceLastSabotage);
    return Math.ceil(remaining / 1000);
  }

  /**
   * Reset sabotage system (for new games)
   */
  reset(): void {
    this.clearSabotageTimer();
    this.currentSabotage = null;
    this.lastSabotageTime = 0;
  }

  /**
   * Cleanup sabotage system (for game cleanup)
   */
  cleanup(): void {
    this.reset();
  }
}
