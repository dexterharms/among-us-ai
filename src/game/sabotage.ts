import { GameState, GameEvent, EventType, PlayerStatus, GamePhase } from '@/types/game';
import { SSEManager } from '@/sse/manager';
import { MinigameManager, MinigameType } from '@/tasks';
import { logger } from '@/utils/logger';

export enum SabotageType {
  LIGHTS = 'lights',
  LIGHTS_OUT = 'lights-out', // Alias for backward compatibility
  DOORS = 'doors',
  SELF_DESTRUCT = 'self-destruct',
}

export interface SabotageState {
  id: string;
  type: SabotageType;
  active: boolean;
  startedAt: number;
  target?: string; // Room-specific for doors
  timeRemaining?: number; // For self-destruct
  contributors?: Set<string>; // Players who have contributed to fix
  flippedSwitches?: Set<string>; // For lights
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
  private minigameManager: MinigameManager | null;
  private activeSabotages: Map<string, SabotageState> = new Map();
  private readonly SABOTAGE_COOLDOWN_MS = 60000; // 60 seconds
  private sabotageCooldowns: Map<string, number> = new Map(); // Per-player cooldowns
  private sabotageTimer: Timer | null = null;
  private sabotageIdCounter = 0;

  constructor(gameState: GameState, sseManager: SSEManager, minigameManager?: MinigameManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
    this.minigameManager = minigameManager || null;
  }

  /**
   * Generate unique sabotage ID
   */
  private generateSabotageId(): string {
    return `sabotage-${++this.sabotageIdCounter}`;
  }

  /**
   * Attempt to trigger a sabotage (test-compatible API)
   */
  attemptSabotage(
    playerId: string,
    sabotageType: SabotageType,
    targetRoomId?: string,
  ): { success: boolean; reason?: string } {
    const player = this.gameState.players.get(playerId);

    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.role !== 'Imposter') {
      return { success: false, reason: 'Only imposters can sabotage' };
    }

    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead imposters cannot sabotage' };
    }

    // Check game phase
    if (this.gameState.phase !== GamePhase.ROUND) {
      return { success: false, reason: 'Can only sabotage during round phase' };
    }

    // Check per-player cooldown
    const now = Date.now();
    const lastSabotageTime = this.sabotageCooldowns.get(playerId) || 0;
    const timeSinceLastSabotage = now - lastSabotageTime;
    if (timeSinceLastSabotage < this.SABOTAGE_COOLDOWN_MS) {
      const remainingTime = Math.ceil((this.SABOTAGE_COOLDOWN_MS - timeSinceLastSabotage) / 1000);
      return { success: false, reason: `Sabotage on cooldown: ${remainingTime}s remaining` };
    }

    // Check for doors sabotage without target
    if (sabotageType === SabotageType.DOORS && !targetRoomId) {
      return { success: false, reason: 'Doors sabotage requires target room ID' };
    }

    // Normalize type
    const normalizedType =
      sabotageType === SabotageType.LIGHTS_OUT ? SabotageType.LIGHTS : sabotageType;

    // Check if same type already active
    for (const sabotage of this.activeSabotages.values()) {
      if (sabotage.type === normalizedType && sabotage.active) {
        return { success: false, reason: `${normalizedType} sabotage already active` };
      }
    }

    // Create sabotage
    const sabotageId = this.generateSabotageId();
    const sabotage: SabotageState = {
      id: sabotageId,
      type: normalizedType,
      active: true,
      startedAt: now,
      target: targetRoomId,
      contributors: new Set(),
      flippedSwitches: new Set(),
    };

    this.activeSabotages.set(sabotageId, sabotage);
    this.sabotageCooldowns.set(playerId, now);

    // Force task interruption if minigameManager available
    if (this.minigameManager) {
      this.forceTaskInterruption();
    }

    // Broadcast sabotage activation
    const event: GameEvent = {
      timestamp: now,
      type: EventType.SABOTAGE_TRIGGERED,
      payload: {
        sabotageId,
        type: normalizedType as 'lights' | 'doors' | 'self-destruct',
        target: targetRoomId,
        message: `${normalizedType} sabotage triggered`,
      },
    };
    this.sseManager.broadcast(event);

    logger.logGameEvent(EventType.SABOTAGE_TRIGGERED, {
      imposterId: playerId,
      sabotageType: normalizedType,
      target: targetRoomId,
      sabotageId,
    });

    // Start timer for self-destruct
    if (normalizedType === SabotageType.SELF_DESTRUCT) {
      this.startSelfDestructTimer(sabotageId);
    }

    return { success: true };
  }

  /**
   * Trigger a sabotage (legacy API)
   */
  triggerSabotage(playerId: string, action: SabotageAction): { success: boolean; reason?: string } {
    const type = action.type === SabotageType.LIGHTS_OUT ? SabotageType.LIGHTS : action.type;
    return this.attemptSabotage(playerId, type, action.target);
  }

  /**
   * Force crewmates on tasks to quit due to sabotage
   */
  private forceTaskInterruption(): void {
    if (!this.minigameManager) return;

    const interruptedPlayers: string[] = [];

    this.gameState.players.forEach((player, playerId) => {
      if (player.status !== PlayerStatus.ALIVE || player.role !== 'Crewmate') {
        return;
      }

      const playerState = this.gameState.tickProcessor?.getStateMachine().getPlayerState(playerId);
      if (playerState !== 'Interacting') {
        return;
      }

      let hasActiveMinigame = false;
      let activeMinigameType: MinigameType | null = null;

      for (const minigameType of Object.values(MinigameType)) {
        const state = this.minigameManager!.getMinigameState(playerId, minigameType);
        if (state && !this.minigameManager!.isMinigameComplete(playerId, minigameType)) {
          hasActiveMinigame = true;
          activeMinigameType = minigameType;
          break;
        }
      }

      if (!hasActiveMinigame || !activeMinigameType) {
        return;
      }

      interruptedPlayers.push(playerId);

      if (activeMinigameType === MinigameType.HOLD_BUTTON) {
        logger.debug('Resetting hold-button progress due to sabotage', { playerId });
        this.minigameManager!.cleanupMinigame(playerId, activeMinigameType);
      } else {
        logger.debug('Interrupting task due to sabotage (progress preserved)', {
          playerId,
          minigameType: activeMinigameType,
        });
        this.gameState.tickProcessor?.getStateMachine().transition(playerId, 'Roaming');
      }

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.SABOTAGE_INTERRUPTED,
        payload: {
          playerId,
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
   * Attempt to fix a sabotage (test-compatible API)
   */
  attemptFix(playerId: string, sabotageId: string): { success: boolean; reason?: string } {
    const player = this.gameState.players.get(playerId);

    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.role === 'Imposter') {
      return { success: false, reason: 'Only crewmates can fix sabotages' };
    }

    const sabotage = this.activeSabotages.get(sabotageId);
    if (!sabotage || !sabotage.active) {
      return { success: false, reason: 'Sabotage not found or not active' };
    }

    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead players cannot fix sabotages' };
    }

    // Check if player already contributed
    if (sabotage.contributors?.has(playerId)) {
      return { success: false, reason: 'You have already contributed to fixing this sabotage' };
    }

    // For doors, check if player is in the affected room
    if (sabotage.type === SabotageType.DOORS && sabotage.target) {
      if (player.location.roomId !== sabotage.target) {
        return { success: false, reason: 'You must be in the affected room to fix this' };
      }
    }

    // Record contribution
    sabotage.contributors?.add(playerId);

    // Determine if sabotage is fixed based on type
    if (sabotage.type === SabotageType.SELF_DESTRUCT) {
      // Self-destruct requires 2 contributors
      if ((sabotage.contributors?.size || 0) >= 2) {
        this.endSabotage(sabotageId);
        return { success: true, reason: 'Sabotage fixed!' };
      }
      return { success: true, reason: 'Fix contribution recorded' };
    }

    // Other sabotage types are fixed by single crewmate
    this.endSabotage(sabotageId);
    return { success: true, reason: 'Sabotage fixed!' };
  }

  /**
   * Fix a sabotage (legacy API)
   */
  fixSabotage(
    playerId: string,
    fixType: string,
    fixData?: any,
  ): { success: boolean; reason?: string } {
    // Find active sabotage matching fix type
    const normalizedFixType =
      fixType === 'lights' || fixType === 'lights-out' ? SabotageType.LIGHTS : fixType;

    for (const [sabotageId, sabotage] of this.activeSabotages) {
      if (sabotage.active) {
        const sabotageTypeStr = sabotage.type.toString();
        if (sabotageTypeStr === normalizedFixType || sabotageTypeStr.includes(normalizedFixType)) {
          // For lights, handle multi-switch
          if (sabotage.type === SabotageType.LIGHTS && fixData?.switchId) {
            return this.fixLightsOut(playerId, sabotageId, fixData.switchId);
          }
          return this.attemptFix(playerId, sabotageId);
        }
      }
    }

    return { success: false, reason: 'No active sabotage' };
  }

  /**
   * Fix lights out sabotage with switch flipping
   */
  private fixLightsOut(
    playerId: string,
    sabotageId: string,
    switchId: string,
  ): { success: boolean; reason?: string } {
    const sabotage = this.activeSabotages.get(sabotageId);
    if (!sabotage || !sabotage.active) {
      return { success: false, reason: 'No active sabotage' };
    }

    const flippedSwitches = sabotage.flippedSwitches || new Set<string>();

    if (flippedSwitches.has(switchId)) {
      return { success: false, reason: 'Switch already flipped' };
    }

    flippedSwitches.add(switchId);
    sabotage.flippedSwitches = flippedSwitches;

    logger.debug('Lights sabotage switch flipped', {
      playerId,
      switchId,
      flipped: flippedSwitches.size,
    });

    if (flippedSwitches.size >= 4) {
      this.endSabotage(sabotageId);
      return { success: true };
    }

    this.sseManager.broadcast({
      timestamp: Date.now(),
      type: EventType.SABOTAGE_PROGRESS,
      payload: {
        sabotageId,
        type: SabotageType.LIGHTS as 'lights' | 'doors' | 'self-destruct',
        message: `${flippedSwitches.size}/4 switches flipped`,
        remainingSeconds: 4 - flippedSwitches.size,
      },
    });

    return { success: true };
  }

  /**
   * End active sabotage
   */
  private endSabotage(sabotageId: string): { success: boolean; reason?: string } {
    const sabotage = this.activeSabotages.get(sabotageId);
    if (!sabotage) {
      return { success: false, reason: 'No active sabotage' };
    }

    const sabotageType = sabotage.type;
    const duration = Date.now() - sabotage.startedAt;

    this.activeSabotages.delete(sabotageId);

    // Clear timer if self-destruct
    if (sabotageType === SabotageType.SELF_DESTRUCT) {
      this.clearSabotageTimer();
    }

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.SABOTAGE_FIXED,
      payload: {
        sabotageId,
        type: sabotageType as 'lights' | 'doors' | 'self-destruct',
        reason: 'Fixed by crewmates',
        success: true,
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
  private startSelfDestructTimer(sabotageId: string): void {
    const TIMER_DURATION_MS = 30000;
    let timeRemaining = TIMER_DURATION_MS;

    this.sabotageTimer = setInterval(() => {
      timeRemaining -= 1000;

      const sabotage = this.activeSabotages.get(sabotageId);
      if (sabotage) {
        sabotage.timeRemaining = timeRemaining;
      }

      this.sseManager.broadcast({
        timestamp: Date.now(),
        type: EventType.SABOTAGE_PROGRESS,
        payload: {
          sabotageId,
          type: SabotageType.SELF_DESTRUCT as 'lights' | 'doors' | 'self-destruct',
          message: `Self-destruct in ${Math.ceil(timeRemaining / 1000)} seconds`,
          remainingSeconds: Math.ceil(timeRemaining / 1000),
        },
      });

      if (timeRemaining <= 0) {
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
      clearInterval(this.sabotageTimer);
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

    this.gameState.phase = GamePhase.GAME_OVER;
  }

  /**
   * Get all active sabotages (test-compatible API)
   */
  getActiveSabotages(): SabotageState[] {
    return Array.from(this.activeSabotages.values()).filter((s) => s.active);
  }

  /**
   * Get current sabotage state (legacy API)
   */
  getCurrentSabotage(): SabotageState | null {
    const active = this.getActiveSabotages();
    return active.length > 0 ? active[0] : null;
  }

  /**
   * Check if sabotage is active
   */
  isSabotageActive(): boolean {
    return this.getActiveSabotages().length > 0;
  }

  /**
   * Check if movement is blocked for a room (doors sabotage)
   */
  isMovementBlocked(roomId: string): boolean {
    for (const sabotage of this.activeSabotages.values()) {
      if (sabotage.active && sabotage.type === SabotageType.DOORS && sabotage.target === roomId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get sabotage cooldown remaining for a player (in seconds)
   */
  getCooldownRemaining(playerId?: string): number {
    if (playerId) {
      const lastTime = this.sabotageCooldowns.get(playerId) || 0;
      const now = Date.now();
      const timeSince = now - lastTime;
      return Math.max(0, Math.ceil((this.SABOTAGE_COOLDOWN_MS - timeSince) / 1000));
    }
    // Legacy: return 0 if no playerId specified
    return 0;
  }

  /**
   * Reset sabotage system (for new games)
   */
  reset(): void {
    this.clearSabotageTimer();
    this.activeSabotages.clear();
    this.sabotageCooldowns.clear();
  }

  /**
   * Cleanup sabotage system (for game cleanup)
   */
  cleanup(): void {
    this.reset();
  }
}
