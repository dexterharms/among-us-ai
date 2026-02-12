import { Player, PlayerRole, PlayerStatus, GamePhase, EventType, GameEvent } from '@/types/game';
import { GameState } from './state';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

/**
 * Sabotage types supported in the game
 */
export enum SabotageType {
  LIGHTS = 'lights',
  DOORS = 'doors',
  SELF_DESTRUCT = 'self-destruct',
}

/**
 * Sabotage state interface
 */
interface Sabotage {
  id: string;
  type: SabotageType;
  imposterId: string;
  target?: string; // Room ID for doors
  startedAt: number;
  timer?: number; // Countdown in milliseconds
  active: boolean;
  fixedBy: Set<string>; // Track which players have helped fix
}

/**
 * SabotageSystem manages all sabotage mechanics in the game
 * - Tracks active sabotages with timers
 * - Handles sabotage activation (imposter only)
 * - Handles sabotage resolution (crewmates fixing)
 * - Broadcasts sabotage events via SSE
 */
export class SabotageSystem {
  private activeSabotages: Map<string, Sabotage> = new Map();
  private sabotageCooldowns: Map<string, number> = new Map(); // imposterId -> cooldownEnd timestamp

  // Configuration constants
  private readonly SABOTAGE_COOLDOWN_MS = 60000; // 60 seconds
  private readonly LIGHTS_FIX_TIME_MS = 60000; // 60 seconds
  private readonly DOORS_LOCK_TIME_MS = 30000; // 30 seconds
  private readonly SELF_DESTRUCT_TIME_MS = 60000; // 60 seconds
  private readonly SELF_DESTRUCT_FIXES_REQUIRED = 2; // Two panels to fix

  private gameState: GameState;
  private sseManager: SSEManager;
  private sabotageTimerInterval: Timer | null = null;

  constructor(gameState: GameState, sseManager: SSEManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
    this.startSabotageTimer();
  }

  /**
   * Start the sabotage timer loop
   * Updates countdown timers for active sabotages every second
   */
  private startSabotageTimer(): void {
    if (this.sabotageTimerInterval) {
      return;
    }

    this.sabotageTimerInterval = setInterval(() => {
      this.updateSabotageTimers();
    }, 1000);
  }

  /**
   * Stop the sabotage timer loop
   */
  private stopSabotageTimer(): void {
    if (this.sabotageTimerInterval) {
      clearInterval(this.sabotageTimerInterval);
      this.sabotageTimerInterval = null;
    }
  }

  /**
   * Update timers for all active sabotages
   * Called every second
   */
  private updateSabotageTimers(): void {
    const now = Date.now();

    this.activeSabotages.forEach((sabotage) => {
      if (!sabotage.active || sabotage.timer === undefined) {
        return;
      }

      sabotage.timer -= 1000;

      // Broadcast countdown update for self-destruct
      if (sabotage.type === SabotageType.SELF_DESTRUCT) {
        const remainingSeconds = Math.ceil(sabotage.timer / 1000);

        const event: GameEvent = {
          timestamp: now,
          type: EventType.SABOTAGE_UPDATED,
          payload: {
            sabotageId: sabotage.id,
            type: sabotage.type,
            timer: sabotage.timer,
            remainingSeconds,
            message: `Self-destruct in ${remainingSeconds} seconds`,
          },
        };
        this.sseManager.broadcast(event);
      }

      // Check if timer expired
      if (sabotage.timer <= 0) {
        this.handleSabotageTimeout(sabotage);
      }
    });
  }

  /**
   * Handle sabotage timer expiration
   */
  private handleSabotageTimeout(sabotage: Sabotage): void {
    const now = Date.now();

    switch (sabotage.type) {
      case SabotageType.LIGHTS:
      case SabotageType.DOORS:
        // Auto-resolve after fix timeout
        this.resolveSabotage(sabotage.id, 'Auto-resolved (timeout)', true);
        break;

      case SabotageType.SELF_DESTRUCT:
        // Self-destruct timer expired - imposters win
        this.endGameForImposters('Self-destruct timer expired');
        break;
    }
  }

  /**
   * Attempt to activate a sabotage
   * @param imposterId - Player ID attempting the sabotage
   * @param type - Sabotage type
   * @param target - Optional target (room ID for doors)
   * @returns Success result
   */
  attemptSabotage(imposterId: string, type: SabotageType, target?: string): {
    success: boolean;
    reason?: string;
  } {
    const imposter = this.gameState.players.get(imposterId);

    // Validation 1: Player exists
    if (!imposter) {
      return { success: false, reason: 'Player not found' };
    }

    // Validation 2: Imposter only
    if (imposter.role !== PlayerRole.IMPOSTER) {
      return { success: false, reason: 'Only imposters can sabotage' };
    }

    // Validation 3: Alive only
    if (imposter.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead imposters cannot sabotage' };
    }

    // Validation 4: Correct phase
    if (this.gameState.phase !== GamePhase.ROUND) {
      return { success: false, reason: 'Can only sabotage during round phase' };
    }

    // Validation 5: Cooldown check
    const cooldownEnd = this.sabotageCooldowns.get(imposterId) || 0;
    if (Date.now() < cooldownEnd) {
      const remainingSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000);
      return {
        success: false,
        reason: `Sabotage on cooldown. Wait ${remainingSeconds} seconds`,
      };
    }

    // Validation 6: Target validation for doors
    if (type === SabotageType.DOORS && !target) {
      return { success: false, reason: 'Doors sabotage requires target room ID' };
    }

    // Validation 7: Target room exists
    if (type === SabotageType.DOORS && target) {
      const room = this.gameState.rooms.get(target);
      if (!room) {
        return { success: false, reason: `Target room '${target}' not found` };
      }
    }

    // Validation 8: No duplicate active sabotage of same type
    const existingSabotage = Array.from(this.activeSabotages.values()).find(
      (s) => s.type === type && s.active
    );
    if (existingSabotage) {
      return { success: false, reason: `A ${type} sabotage is already active` };
    }

    // Activate sabotage
    return this.activateSabotage(imposterId, type, target);
  }

  /**
   * Activate a sabotage after validation
   */
  private activateSabotage(imposterId: string, type: SabotageType, target?: string): {
    success: boolean;
    reason?: string;
  } {
    const now = Date.now();
    const sabotageId = `${type}-${now}-${imposterId}`;

    let sabotage: Sabotage;

    switch (type) {
      case SabotageType.LIGHTS:
        sabotage = {
          id: sabotageId,
          type: SabotageType.LIGHTS,
          imposterId,
          startedAt: now,
          timer: this.LIGHTS_FIX_TIME_MS,
          active: true,
          fixedBy: new Set(),
        };
        break;

      case SabotageType.DOORS:
        sabotage = {
          id: sabotageId,
          type: SabotageType.DOORS,
          imposterId,
          target,
          startedAt: now,
          timer: this.DOORS_LOCK_TIME_MS,
          active: true,
          fixedBy: new Set(),
        };
        break;

      case SabotageType.SELF_DESTRUCT:
        sabotage = {
          id: sabotageId,
          type: SabotageType.SELF_DESTRUCT,
          imposterId,
          startedAt: now,
          timer: this.SELF_DESTRUCT_TIME_MS,
          active: true,
          fixedBy: new Set(),
        };
        break;

      default:
        return { success: false, reason: `Unknown sabotage type: ${type}` };
    }

    // Store sabotage
    this.activeSabotages.set(sabotageId, sabotage);

    // Set cooldown for imposter
    this.sabotageCooldowns.set(imposterId, now + this.SABOTAGE_COOLDOWN_MS);

    // Force crewmates on tasks to quit
    this.forceCrewmatesToQuitTasks();

    // Broadcast sabotage activation
    this.broadcastSabotageEvent(sabotage, 'activated');

    logger.logGameEvent('SabotageActivated', {
      sabotageId,
      type,
      imposterId,
      target,
    });

    return { success: true };
  }

  /**
   * Force all crewmates currently on tasks to quit
   * Called when sabotage is activated
   */
  private forceCrewmatesToQuitTasks(): void {
    this.gameState.players.forEach((player) => {
      if (player.role === PlayerRole.CREWMATE && player.status === PlayerStatus.ALIVE) {
        if (player.tasks && player.tasks.length > 0) {
          // Send notification to player
          const event: GameEvent = {
            timestamp: Date.now(),
            type: EventType.SABOTAGE_ACTIVATED,
            payload: {
              message: 'Sabotage! You must stop your task.',
            },
          };
          this.sseManager.sendTo(player.id, event);
        }
      }
    });
  }

  /**
   * Attempt to fix a sabotage
   * @param playerId - Player attempting the fix
   * @param sabotageId - Sabotage ID to fix
   * @returns Success result
   */
  attemptFix(playerId: string, sabotageId: string): {
    success: boolean;
    reason?: string;
  } {
    const player = this.gameState.players.get(playerId);
    const sabotage = this.activeSabotages.get(sabotageId);

    // Validation 1: Player exists
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    // Validation 2: Crewmates can only fix (imposters can't)
    if (player.role !== PlayerRole.CREWMATE) {
      return { success: false, reason: 'Only crewmates can fix sabotages' };
    }

    // Validation 3: Sabotage exists and active
    if (!sabotage || !sabotage.active) {
      return { success: false, reason: 'Sabotage not found or not active' };
    }

    // Validation 4: Alive only
    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Dead players cannot fix sabotages' };
    }

    // Validation 5: Crewmates can only fix each sabotage once
    if (sabotage.fixedBy.has(playerId)) {
      return { success: false, reason: 'You have already contributed to fixing this sabotage' };
    }

    // Validation 6: Check if sabotage is fixable in current room
    if (sabotage.type === SabotageType.DOORS && sabotage.target) {
      // For doors sabotage, player must be in the affected room
      if (player.location.roomId !== sabotage.target) {
        return { success: false, reason: 'You must be in the affected room to fix this' };
      }
    }

    // Apply fix
    return this.applyFix(playerId, sabotage);
  }

  /**
   * Apply a fix contribution
   */
  private applyFix(playerId: string, sabotage: Sabotage): {
    success: boolean;
    reason?: string;
  } {
    const now = Date.now();

    sabotage.fixedBy.add(playerId);

    logger.logGameEvent('SabotageFixAttempt', {
      sabotageId: sabotage.id,
      type: sabotage.type,
      playerId,
      totalFixes: sabotage.fixedBy.size,
    });

    // Check if sabotage is resolved
    let resolved = false;
    let reason = '';

    switch (sabotage.type) {
      case SabotageType.LIGHTS:
        // Lights: Any crewmate can fix
        resolved = true;
        reason = 'Lights fixed';
        break;

      case SabotageType.DOORS:
        // Doors: Any crewmate in the room can fix
        resolved = true;
        reason = 'Doors unlocked';
        break;

      case SabotageType.SELF_DESTRUCT:
        // Self-destruct: Need 2 separate players
        if (sabotage.fixedBy.size >= this.SELF_DESTRUCT_FIXES_REQUIRED) {
          resolved = true;
          reason = 'Self-destruct averted';
        }
        break;
    }

    if (resolved) {
      this.resolveSabotage(sabotage.id, reason, true);
      return { success: true, reason: 'Sabotage fixed!' };
    } else {
      // Broadcast progress update
      const event: GameEvent = {
        timestamp: now,
        type: EventType.SABOTAGE_UPDATED,
        payload: {
          sabotageId: sabotage.id,
          type: sabotage.type,
          message: `Fix progress: ${sabotage.fixedBy.size}/${this.SELF_DESTRUCT_FIXES_REQUIRED} crewmates`,
        },
      };
      this.sseManager.broadcast(event);

      return { success: true, reason: 'Fix contribution recorded' };
    }
  }

  /**
   * Resolve a sabotage (fixed or timed out)
   * @param sabotageId - Sabotage ID
   * @param reason - Resolution reason
   * @param success - Whether sabotage was fixed (true) or timed out (false)
   */
  private resolveSabotage(sabotageId: string, reason: string, success: boolean): void {
    const sabotage = this.activeSabotages.get(sabotageId);
    if (!sabotage) {
      return;
    }

    sabotage.active = false;

    logger.logGameEvent('SabotageResolved', {
      sabotageId,
      type: sabotage.type,
      reason,
      success,
    });

    // Broadcast resolution
    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.SABOTAGE_RESOLVED,
      payload: {
        sabotageId,
        type: sabotage.type,
        reason,
        success,
      },
    };
    this.sseManager.broadcast(event);

    // Remove from active sabotages
    this.activeSabotages.delete(sabotageId);
  }

  /**
   * End the game with imposters winning
   */
  private endGameForImposters(reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;

    logger.logGameEvent(EventType.GAME_ENDED, {
      winner: 'Imposters',
      reason,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.GAME_ENDED,
      payload: {
        winner: 'Imposters',
        reason,
      },
    };
    this.sseManager.broadcast(event);
  }

  /**
   * Check if movement is blocked due to doors sabotage
   * @param roomId - Room ID player is trying to exit
   * @returns true if movement is blocked
   */
  isMovementBlocked(roomId: string): boolean {
    return Array.from(this.activeSabotages.values()).some(
      (s) => s.active && s.type === SabotageType.DOORS && s.target === roomId
    );
  }

  /**
   * Get active sabotages for game state serialization
   */
  getActiveSabotages(): Array<{
    id: string;
    type: string;
    target?: string;
    timer?: number;
    active: boolean;
  }> {
    return Array.from(this.activeSabotages.values()).map((s) => ({
      id: s.id,
      type: s.type,
      target: s.target,
      timer: s.timer,
      active: s.active,
    }));
  }

  /**
   * Get remaining cooldown for an imposter
   * @param imposterId - Imposter player ID
   * @returns Remaining cooldown in milliseconds
   */
  getCooldownRemaining(imposterId: string): number {
    const cooldownEnd = this.sabotageCooldowns.get(imposterId) || 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  /**
   * Cleanup method to prevent memory leaks
   */
  cleanup(): void {
    this.stopSabotageTimer();
    this.activeSabotages.clear();
    this.sabotageCooldowns.clear();
  }

  /**
   * Reset for new game
   */
  reset(): void {
    this.activeSabotages.clear();
    this.sabotageCooldowns.clear();
  }

  /**
   * Broadcast sabotage event
   */
  private broadcastSabotageEvent(sabotage: Sabotage, action: 'activated'): void {
    let message = '';

    switch (sabotage.type) {
      case SabotageType.LIGHTS:
        message = 'The lights flicker and die. Emergency lights cast a dim red glow.';
        break;

      case SabotageType.DOORS:
        message = `Doors in ${sabotage.target} have been locked!`;
        break;

      case SabotageType.SELF_DESTRUCT:
        message = `Self-destruct sequence initiated! ${this.SELF_DESTRUCT_TIME_MS / 1000} seconds until critical failure.`;
        break;
    }

    const event: GameEvent = {
      timestamp: sabotage.startedAt,
      type: EventType.SABOTAGE_ACTIVATED,
      payload: {
        sabotageId: sabotage.id,
        type: sabotage.type,
        target: sabotage.target,
        message,
        timer: sabotage.timer,
      },
    };
    this.sseManager.broadcast(event);
  }
}
