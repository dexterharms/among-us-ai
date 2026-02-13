import { GameState } from './state';
import { PlayerStatus, EventType } from '@/types/game';
import { logger } from '@/utils/logger';

export class EmergencyButtonSystem {
  private readonly WARMUP_DURATION_MS = 20000; // 20 seconds
  private readonly MAX_EMERGENCY_MEETINGS_PER_PLAYER = 1;

  constructor(private gameState: GameState) {}

  /**
   * Check if a player can call an emergency meeting
   */
  canCallEmergency(
    playerId: string,
    roomId: string,
    roundStartTime: number,
  ): { valid: boolean; reason?: string } {
    const player = this.gameState.players.get(playerId);

    // Check player exists
    if (!player) {
      return { valid: false, reason: 'Player not found' };
    }

    // Check player is alive
    if (player.status !== PlayerStatus.ALIVE) {
      return { valid: false, reason: 'Player is not alive' };
    }

    // Check player is in council room (room with emergency button)
    if (roomId !== 'council-room') {
      return { valid: false, reason: 'Emergency button is only in the council room' };
    }

    // Check warm-up period has passed
    const elapsed = Date.now() - roundStartTime;
    if (elapsed < this.WARMUP_DURATION_MS) {
      const remaining = Math.ceil((this.WARMUP_DURATION_MS - elapsed) / 1000);
      return { valid: false, reason: `Emergency button is in warm-up (${remaining}s remaining)` };
    }

    // Check player hasn't used all their emergency meetings
    const usedMeetings = player.emergencyMeetingsUsed ?? 0;
    if (usedMeetings >= this.MAX_EMERGENCY_MEETINGS_PER_PLAYER) {
      return { valid: false, reason: 'You have already used your emergency meeting' };
    }

    // Check for active sabotage
    const sabotageSystem = this.gameState.getSabotageSystem();
    if (sabotageSystem.isSabotageActive()) {
      return { valid: false, reason: 'Cannot call emergency meeting during active sabotage' };
    }

    return { valid: true };
  }

  /**
   * Execute an emergency meeting call
   */
  callEmergency(
    playerId: string,
    roomId: string,
    roundStartTime: number,
  ): { success: boolean; reason?: string } {
    // Validate first
    const validation = this.canCallEmergency(playerId, roomId, roundStartTime);
    if (!validation.valid) {
      logger.warn('Emergency call rejected', { playerId, reason: validation.reason });
      return { success: false, reason: validation.reason };
    }

    const player = this.gameState.players.get(playerId)!;

    // Increment usage
    player.emergencyMeetingsUsed = (player.emergencyMeetingsUsed ?? 0) + 1;

    logger.logGameEvent(EventType.COUNCIL_CALLED, {
      callerId: playerId,
      callerName: player.name,
      reason: 'Emergency Meeting',
    });

    // Trigger council phase via game state
    this.gameState.startCouncilPhase();

    return { success: true };
  }

  /**
   * Reset system state (for new game)
   */
  reset(): void {
    // No internal state to reset currently
    logger.debug('EmergencyButtonSystem reset');
  }
}
