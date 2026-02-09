import { Player, PlayerStatus, PlayerRole, GamePhase, EventType } from '@/types/game';
import { GameState } from './state';
import { logger } from '@/utils/logger';

export class ImposterAbilities {
  private killCooldowns: Map<string, number> = new Map();
  private readonly KILL_COOLDOWN = 30000; // 30 seconds in ms

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

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  attemptKill(imposterId: string, targetId: string): void {
    const imposter = this.gameState.players.get(imposterId);
    const target = this.gameState.players.get(targetId);

    if (!imposter || !target) {
      logger.warn('Invalid kill attempt: Player not found', {
        imposterId: imposterId,
        targetId: targetId,
        imposterExists: !!imposter,
        targetExists: !!target,
      });
      return;
    }

    if (!this.canKill(imposter, target)) {
      logger.warn('Kill failed: Conditions not met', {
        imposterId,
        targetId,
        imposterRole: imposter.role,
        imposterStatus: imposter.status,
        targetRole: target.role,
        targetStatus: target.status,
        imposterRoom: imposter.location.roomId,
        targetRoom: target.location.roomId,
        phase: this.gameState.getPhase(),
        cooldownRemaining: this.killCooldowns.get(imposterId) ? Math.max(0, this.killCooldowns.get(imposterId)! - Date.now()) : 0,
      });
      return;
    }

    // Perform Kill
    target.status = PlayerStatus.DEAD;

    // Create Dead Body
    this.gameState.deadBodies.push({
      playerId: targetId,
      role: target.role,
      location: { ...target.location },
      reported: false,
      roomId: target.location.roomId,
    });

    // Set Cooldown
    this.killCooldowns.set(imposterId, Date.now() + this.KILL_COOLDOWN);

    logger.logGameEvent('KillPerformed', {
      imposterId,
      imposterName: imposter.name,
      targetId,
      targetName: target.name,
      targetRole: target.role,
      location: target.location.roomId,
      roundNumber: this.gameState.getRoundNumber(),
    });

    // Notify (only to imposter usually, or just update state?)
    // Dead body created, but not necessarily discovered immediately.
    // Prompt says "deadBodies: Array<{playerId, roomId, discoveredAt}>" in Phase 4,
    // but here in Phase 7 implementation just says "attemptKill".
    // I'll assume standard Among Us logic: kill happens, body drops.

    // Broadcast? Usually kill is silent until body found.
    // But maybe notify the victim?
    this.sseManager.sendTo(targetId, 'YouDied', { killerId: imposterId }); // Debug event?

    // Check Win Condition immediately
    this.checkWinCondition();
  }

  canKill(imposter: Player, target: Player): boolean {
    // 1. Role check
    if (imposter.role !== PlayerRole.IMPOSTER) return false;
    if (target.role === PlayerRole.IMPOSTER) return false; // Can't kill other imposters usually

    // 2. Status check
    if (imposter.status !== PlayerStatus.ALIVE) return false;
    if (target.status !== PlayerStatus.ALIVE) return false;

    // 3. Phase check
    if (this.gameState.phase !== GamePhase.ROUND) return false;

    // 4. Location check (Same room)
    if (imposter.location.roomId !== target.location.roomId) return false;

    // 5. Cooldown check
    const cooldownEnd = this.killCooldowns.get(imposter.id) || 0;
    if (Date.now() < cooldownEnd) return false;

    return true;
  }

  checkWinCondition(): void {
    const imposters = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.IMPOSTER && p.status === PlayerStatus.ALIVE,
    );
    const crewmates = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.CREWMATE && p.status === PlayerStatus.ALIVE,
    );

    logger.debug('Checking win condition (imposters)', {
      livingImposters: imposters.length,
      livingCrewmates: crewmates.length,
      totalPlayers: this.gameState.players.size,
      roundNumber: this.gameState.getRoundNumber(),
    });

    // Imposters win if 1:1 or better (Imposters >= Crewmates)
    if (imposters.length >= crewmates.length) {
      this.gameState.phase = GamePhase.GAME_OVER;

      logger.logGameEvent(EventType.GAME_ENDED, {
        winner: 'Imposters',
        reason: 'Imposters outnumber Crewmates',
        livingImposters: imposters.length,
        livingCrewmates: crewmates.length,
        roundNumber: this.gameState.getRoundNumber(),
      });

      this.sseManager.broadcast(EventType.GAME_ENDED, {
        winner: 'Imposters',
        reason: 'Imposters outnumber Crewmates',
      });
    }

    // Crewmates win if 0 imposters? (Handled in Voting usually, but if imposter disconnects?)
    if (imposters.length === 0) {
      this.gameState.phase = GamePhase.GAME_OVER;

      logger.logGameEvent(EventType.GAME_ENDED, {
        winner: 'Crewmates',
        reason: 'All imposters eliminated',
        livingCrewmates: crewmates.length,
        roundNumber: this.gameState.getRoundNumber(),
      });

      this.sseManager.broadcast(EventType.GAME_ENDED, {
        winner: 'Crewmates',
        reason: 'All imposters eliminated',
      });
    }
  }
}
