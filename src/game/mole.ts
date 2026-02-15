import { Player, PlayerStatus, PlayerRole, GamePhase, EventType, GameEvent, InteractableType } from '@/types/game';
import { GameState } from './state';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

export class MoleAbilities {
  private killCooldowns: Map<string, number> = new Map();
  private readonly KILL_COOLDOWN = 30000; // 30 seconds in ms
  private ventCooldowns: Map<string, number> = new Map();
  private readonly VENT_COOLDOWN = 30000; // 30 seconds in ms

  private gameState: GameState;
  private sseManager: SSEManager;

  constructor(gameState: GameState, sseManager: SSEManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
  }

  attemptKill(moleId: string, targetId: string): void {
    const mole = this.gameState.players.get(moleId);
    const target = this.gameState.players.get(targetId);

    if (!mole || !target) {
      logger.warn('Invalid kill attempt: Player not found', {
        moleId: moleId,
        targetId: targetId,
        moleExists: !!mole,
        targetExists: !!target,
      });
      return;
    }

    if (!this.canKill(mole, target)) {
      logger.warn('Kill failed: Conditions not met', {
        moleId,
        targetId,
        moleRole: mole.role,
        moleStatus: mole.status,
        targetRole: target.role,
        targetStatus: target.status,
        moleRoom: mole.location.roomId,
        targetRoom: target.location.roomId,
        phase: this.gameState.getPhase(),
        cooldownRemaining: this.killCooldowns.get(moleId) ? Math.max(0, this.killCooldowns.get(moleId)! - Date.now()) : 0,
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
    this.killCooldowns.set(moleId, Date.now() + this.KILL_COOLDOWN);

    logger.logGameEvent('KillPerformed', {
      moleId,
      moleName: mole.name,
      targetId,
      targetName: target.name,
      targetRole: target.role,
      location: target.location.roomId,
      roundNumber: this.gameState.getRoundNumber(),
    });

    // Notify the victim
    const youDiedEvent: GameEvent = {
      timestamp: Date.now(),
      type: EventType.YOU_DIED,
      payload: { killerId: moleId },
    };
    this.sseManager.sendTo(targetId, youDiedEvent);

    // Check Win Condition immediately
    this.checkWinCondition();
  }

  canKill(mole: Player, target: Player): boolean {
    // 1. Role check
    if (mole.role !== PlayerRole.MOLE) return false;
    if (target.role === PlayerRole.MOLE) return false; // Can't kill other moles

    // 2. Status check
    if (mole.status !== PlayerStatus.ALIVE) return false;
    if (target.status !== PlayerStatus.ALIVE) return false;

    // 3. Phase check
    if (this.gameState.phase !== GamePhase.ROUND) return false;

    // 4. Location check (Same room)
    if (mole.location.roomId !== target.location.roomId) return false;

    // 5. Cooldown check
    const cooldownEnd = this.killCooldowns.get(mole.id) || 0;
    if (Date.now() < cooldownEnd) return false;

    return true;
  }

  checkWinCondition(): void {
    const moles = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.MOLE && p.status === PlayerStatus.ALIVE,
    );
    const loyalists = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.LOYALIST && p.status === PlayerStatus.ALIVE,
    );

    logger.debug('Checking win condition (moles)', {
      livingMoles: moles.length,
      livingLoyalists: loyalists.length,
      totalPlayers: this.gameState.players.size,
      roundNumber: this.gameState.getRoundNumber(),
    });

    // Moles win if 1:1 or better (Moles >= Loyalists)
    if (moles.length >= loyalists.length) {
      this.gameState.phase = GamePhase.GAME_OVER;

      logger.logGameEvent(EventType.GAME_ENDED, {
        winner: 'Moles',
        reason: 'Moles outnumber Loyalists',
        livingMoles: moles.length,
        livingLoyalists: loyalists.length,
        roundNumber: this.gameState.getRoundNumber(),
      });

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_ENDED,
        payload: {
          winner: 'Moles',
          reason: 'Moles outnumber Loyalists',
        },
      };
      this.sseManager.broadcast(event);
    }

    // Loyalists win if 0 moles
    if (moles.length === 0) {
      this.gameState.phase = GamePhase.GAME_OVER;

      logger.logGameEvent(EventType.GAME_ENDED, {
        winner: 'Loyalists',
        reason: 'All moles eliminated',
        livingLoyalists: loyalists.length,
        roundNumber: this.gameState.getRoundNumber(),
      });

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_ENDED,
        payload: {
          winner: 'Loyalists',
          reason: 'All moles eliminated',
        },
      };
      this.sseManager.broadcast(event);
    }
  }

  /**
   * Get remaining cooldown for a mole
   */
  getCooldownRemaining(moleId: string): number {
    const cooldownEnd = this.killCooldowns.get(moleId) || 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  /**
   * Check if player can use vent
   */
  canVent(playerId: string, targetRoomId: string): boolean {
    const player = this.gameState.players.get(playerId);
    const targetRoom = this.gameState.rooms.get(targetRoomId);

    if (!player || !targetRoom) {
      return false;
    }

    // 1. Role check - only moles can use vents
    if (player.role !== PlayerRole.MOLE) {
      return false;
    }

    // 2. Status check - must be alive
    if (player.status !== PlayerStatus.ALIVE) {
      return false;
    }

    // 3. Phase check - only during ROUND phase
    if (this.gameState.phase !== GamePhase.ROUND) {
      return false;
    }

    // 4. Find vent in current room (player must be in a room with a vent)
    const currentRoom = this.gameState.rooms.get(player.location.roomId);
    const currentVent = currentRoom?.interactables.find(
      (i) => i.type === InteractableType.VENT
    );

    if (!currentVent) {
      return false;
    }

    // 5. Find vent in target room (destination must have a vent)
    const targetVent = targetRoom.interactables.find(
      (i) => i.type === InteractableType.VENT
    );

    if (!targetVent) {
      return false;
    }

    // 6. Cooldown check
    const cooldownEnd = this.ventCooldowns.get(playerId) || 0;
    if (Date.now() < cooldownEnd) {
      return false;
    }

    return true;
  }

  /**
   * Attempt to use vent to travel to another room
   */
  attemptVent(playerId: string, targetRoomId: string): void {
    const player = this.gameState.players.get(playerId);
    const targetRoom = this.gameState.rooms.get(targetRoomId);

    if (!player || !targetRoom) {
      logger.warn('Invalid vent attempt: Player or room not found', {
        playerId,
        targetRoomId,
        playerExists: !!player,
        roomExists: !!targetRoom,
      });
      return;
    }

    if (!this.canVent(playerId, targetRoomId)) {
      logger.warn('Vent failed: Conditions not met', {
        playerId,
        targetRoomId,
        role: player.role,
        status: player.status,
        phase: this.gameState.phase,
        currentRoom: player.location.roomId,
        targetRoom: targetRoomId,
        cooldownRemaining: this.getVentCooldownRemaining(playerId),
      });
      return;
    }

    // Store original room before updating location
    const fromRoomId = player.location.roomId;

    // Perform vent traveling
    player.location = {
      roomId: targetRoomId,
      x: targetRoom.position.x,
      y: targetRoom.position.y,
    };

    // Set vent cooldown
    this.ventCooldowns.set(playerId, Date.now() + this.VENT_COOLDOWN);

    logger.logGameEvent('VentUsed', {
      playerId,
      playerName: player.name,
      targetRoomId,
      fromRoomId,
      roundNumber: this.gameState.getRoundNumber(),
    });

    // Broadcast PLAYER_VENTED event
    const playerVenturedEvent: GameEvent = {
      timestamp: Date.now(),
      type: EventType.PLAYER_VENTED,
      payload: {
        playerId,
        roomId: targetRoomId,
      },
    };
    this.sseManager.sendTo(playerId, playerVenturedEvent);
  }

  /**
   * Get remaining vent cooldown for a player
   */
  getVentCooldownRemaining(playerId: string): number {
    const cooldownEnd = this.ventCooldowns.get(playerId) || 0;
    return Math.max(0, cooldownEnd - Date.now());
  }
}
