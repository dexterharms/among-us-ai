import { Player, PlayerRole, EventType, GameEvent } from '@/types/game';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';
import { generateToken } from '@/utils/jwt';

export class LobbyManager {
  private players: Map<string, Player> = new Map();
  private readyStatus: Set<string> = new Set();
  private isCountdownActive: boolean = false;
  private readonly MIN_PLAYERS = 3;
  private readonly MAX_PLAYERS = 15; // Among Us max players
  private readonly COUNTDOWN_DURATION = 5000; // 5 seconds
  private sseManager: SSEManager;
  private onCountdownComplete: (() => void) | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sseManager: SSEManager) {
    this.sseManager = sseManager;
  }

  /**
   * Set a callback to be invoked when the countdown completes and game should start
   */
  setOnCountdownComplete(callback: () => void): void {
    this.onCountdownComplete = callback;
  }

  join(player: Player): void {
    // Prevent lobby overflow
    if (this.players.size >= this.MAX_PLAYERS && !this.players.has(player.id)) {
      throw new Error('Lobby is full');
    }

    // If player is already in lobby (rejoining), clear their ready status
    const isRejoining = this.players.has(player.id);
    if (isRejoining) {
      this.readyStatus.delete(player.id);
    }

    this.players.set(player.id, player);

    logger.logGameEvent('PlayerJoinedLobby', {
      playerId: player.id,
      playerName: player.name,
      isRejoining,
      totalPlayers: this.players.size,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.PLAYER_JOINED_LOBBY,
      payload: { player },
    };
    this.sseManager.broadcast(event);
    this.broadcastLobbyState();
  }

  leave(playerId: string): void {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      this.players.delete(playerId);
      this.readyStatus.delete(playerId);

      logger.logGameEvent('PlayerLeftLobby', {
        playerId,
        playerName: player?.name,
        remainingPlayers: this.players.size,
        readyPlayers: this.readyStatus.size,
      });

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.PLAYER_LEFT_LOBBY,
        payload: { playerId },
      };
      this.sseManager.broadcast(event);

      // Cancel countdown only if ready players falls below MIN_PLAYERS
      if (this.isCountdownActive && this.readyStatus.size < this.MIN_PLAYERS) {
        this.cancelCountdownWithBroadcast();
      }

      this.broadcastLobbyState();
    } else {
      logger.warn('Player not found when attempting to leave', {
        playerId,
        currentPlayers: Array.from(this.players.keys()),
      });
    }
  }

  setReady(playerId: string, ready: boolean): void {
    if (!this.players.has(playerId)) {
      logger.warn('Player not found when setting ready status', { playerId, ready });
      return;
    }

    const player = this.players.get(playerId);

    if (ready) {
      this.readyStatus.add(playerId);
      logger.debug('Player marked as ready', {
        playerId,
        playerName: player?.name,
        readyCount: this.readyStatus.size,
        totalPlayers: this.players.size,
      });
    } else {
      this.readyStatus.delete(playerId);
      logger.debug('Player marked as not ready', {
        playerId,
        playerName: player?.name,
        readyCount: this.readyStatus.size,
        totalPlayers: this.players.size,
      });
    }

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.PLAYER_READY,
      payload: { playerId, ready },
    };
    this.sseManager.broadcast(event);

    if (this.checkStartCondition()) {
      this.startCountdown();
    } else {
      // Cancel countdown only if ready players falls below MIN_PLAYERS
      if (this.isCountdownActive && this.readyStatus.size < this.MIN_PLAYERS) {
        this.cancelCountdownWithBroadcast();
      }
    }

    this.broadcastLobbyState();
  }

  checkStartCondition(): boolean {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length < this.MIN_PLAYERS) return false;
    return playerIds.every((id) => this.readyStatus.has(id));
  }

  startCountdown(): void {
    if (this.isCountdownActive) return;
    this.isCountdownActive = true;

    logger.logGameEvent('CountdownStarted', {
      readyPlayers: this.readyStatus.size,
      totalPlayers: this.players.size,
      duration: this.COUNTDOWN_DURATION / 1000,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.COUNTDOWN_STARTED,
      payload: { duration: this.COUNTDOWN_DURATION / 1000 },
    };
    this.sseManager.broadcast(event);

    // Start the actual countdown timer
    this.countdownTimer = setTimeout(() => {
      this.isCountdownActive = false;
      this.countdownTimer = null;
      logger.logGameEvent('CountdownComplete', {
        readyPlayers: this.readyStatus.size,
        totalPlayers: this.players.size,
      });

      // Trigger game start if callback is set
      if (this.onCountdownComplete) {
        this.onCountdownComplete();
      }
    }, this.COUNTDOWN_DURATION);
  }

  /**
   * Cancel any active countdown
   */
  cancelCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.isCountdownActive = false;
  }

  /**
   * Cancel countdown and broadcast cancellation event
   * Used when countdown is cancelled due to player leaving or unreadying
   */
  private cancelCountdownWithBroadcast(): void {
    this.cancelCountdown();
    logger.info('Countdown cancelled', {
      readyPlayers: this.readyStatus.size,
      minPlayers: this.MIN_PLAYERS,
    });
    const cancelEvent: GameEvent = {
      timestamp: Date.now(),
      type: EventType.COUNTDOWN_CANCELLED,
      payload: {},
    };
    this.sseManager.broadcast(cancelEvent);
  }

  assignRoles(): { crewmates: string[]; imposters: string[] } {
    const playerIds = Array.from(this.players.keys());
    const imposterCount = playerIds.length >= 7 ? 2 : 1;
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

    const imposters = shuffled.slice(0, imposterCount);
    const crewmates = shuffled.slice(imposterCount);

    const imposterNames: string[] = [];

    imposters.forEach((id) => {
      const p = this.players.get(id);
      if (p) {
        p.role = PlayerRole.IMPOSTER;
        imposterNames.push(p.name);
      }
    });

    crewmates.forEach((id) => {
      const p = this.players.get(id);
      if (p) p.role = PlayerRole.CREWMATE;
    });

    logger.logGameEvent('RolesAssigned', {
      totalPlayers: playerIds.length,
      imposterCount,
      imposterIds: imposters,
      imposterNames,
      crewmateCount: crewmates.length,
    });

    return { crewmates, imposters };
  }

  broadcastLobbyState(): void {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.LOBBY_STATE,
      payload: {
        players: this.getWaitingPlayers(),
        readyPlayers: Array.from(this.readyStatus),
        isCountdownActive: this.isCountdownActive,
      },
    };
    this.sseManager.broadcast(event);
  }

  getWaitingPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getReadyPlayers(): Set<string> {
    return this.readyStatus;
  }

  getCountdownStatus(): boolean {
    return this.isCountdownActive;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Generate an authentication token for a player
   * @param playerId - The player's unique identifier
   * @returns A JWT token string
   */
  async generatePlayerToken(playerId: string): Promise<string> {
    return await generateToken(playerId);
  }
}
