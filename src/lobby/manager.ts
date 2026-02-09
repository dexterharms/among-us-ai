import { Player, PlayerRole } from '@/types/game';
import { logger } from '@/utils/logger';

export class LobbyManager {
  private players: Map<string, Player> = new Map();
  private readyStatus: Set<string> = new Set();
  private isCountdownActive: boolean = false;
  private readonly MIN_PLAYERS = 3;

  private sseManager = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast: (event: string, data: any) => {
      // eslint-disable-next-line no-console
      console.log(`[SSE Broadcast] ${event}`, data);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendTo: (playerId: string, event: string, data: any) => {
      // eslint-disable-next-line no-console
      console.log(`[SSE to ${playerId}] ${event}`, data);
    },
  };

  join(player: Player): void {
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

    this.sseManager.broadcast('playerJoined', { player });
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

      this.sseManager.broadcast('playerLeft', { playerId });

      // Cancel countdown only if ready players falls below MIN_PLAYERS
      if (this.isCountdownActive && this.readyStatus.size < this.MIN_PLAYERS) {
        this.isCountdownActive = false;
        logger.info('Countdown cancelled due to insufficient players', {
          readyPlayers: this.readyStatus.size,
          minPlayers: this.MIN_PLAYERS,
        });
        this.sseManager.broadcast('countdownCancelled', {});
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

    this.sseManager.broadcast('playerReady', { playerId, ready });

    if (this.checkStartCondition()) {
      this.startCountdown();
    } else {
      // Cancel countdown only if ready players falls below MIN_PLAYERS
      if (this.isCountdownActive && this.readyStatus.size < this.MIN_PLAYERS) {
        this.isCountdownActive = false;
        logger.info('Countdown cancelled due to insufficient ready players', {
          readyPlayers: this.readyStatus.size,
          minPlayers: this.MIN_PLAYERS,
        });
        this.sseManager.broadcast('countdownCancelled', {});
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
      duration: 5,
    });

    this.sseManager.broadcast('countdownStarted', { duration: 5 });
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
    this.sseManager.broadcast('lobbyState', {
      players: this.getWaitingPlayers(),
      readyPlayers: Array.from(this.readyStatus),
      isCountdownActive: this.isCountdownActive,
    });
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
}
