import { PlayerStatus, PlayerRole, EventType, GamePhase, DeadBody, GameEvent } from '@/types/game';
import { GameState } from './state';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

export class VotingSystem {
  votes: Map<string, string> = new Map(); // voterId -> targetId
  councilStartedAt: number = 0;
  livingPlayers: string[] = [];

  private gameState: GameState;
  private sseManager: SSEManager;
  private votingTimeout: Timer | null = null;
  private readonly VOTING_TIMEOUT_MS = 120000; // 2 minutes

  constructor(gameState: GameState, sseManager: SSEManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
  }

  startCouncil(deadBodies: DeadBody[]): void {
    const previousPhase = this.gameState.phase;
    this.gameState.phase = GamePhase.VOTING;
    this.votes.clear();
    this.councilStartedAt = Date.now();
    this.livingPlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.status === PlayerStatus.ALIVE)
      .map((p) => p.id);

    // Clear any previous timeout
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
    }

    // Start voting timeout
    this.votingTimeout = setTimeout(() => {
      logger.warn('Voting timed out, finalizing with current votes');
      this.finalizeVoting();
    }, this.VOTING_TIMEOUT_MS);

    logger.logStateTransition(previousPhase, GamePhase.VOTING, {
      reason: deadBodies.length > 0 ? 'Dead Body Reported' : 'Emergency Meeting',
      deadBodyCount: deadBodies.length,
      livingPlayerCount: this.livingPlayers.length,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.COUNCIL_CALLED,
      payload: {
        callerId: 'system',
        reason: deadBodies.length > 0 ? 'Dead Body Reported' : 'Emergency Meeting',
      },
    };
    this.sseManager.broadcast(event);
  }

  castVote(voterId: string, targetId: string | null): void {
    const voter = this.gameState.players.get(voterId);
    if (!voter || voter.status !== PlayerStatus.ALIVE) {
      logger.warn(`Invalid vote attempt from ${voterId}`, {
        voterId,
        exists: !!voter,
        status: voter?.status,
      });
      return;
    }

    // Check if already voted
    if (this.votes.has(voterId)) {
      logger.warn(`Duplicate vote attempt from ${voterId}`, {
        voterId,
        previousVote: this.votes.get(voterId),
      });
      return;
    }

    // Check target validity
    if (targetId) {
      const target = this.gameState.players.get(targetId);
      if (!target || target.status !== PlayerStatus.ALIVE) {
        logger.warn(`Invalid vote target: ${targetId}`, {
          voterId,
          targetId,
          targetExists: !!target,
          targetStatus: target?.status,
        });
        return;
      }
    }

    this.votes.set(voterId, targetId || 'skip');

    logger.logGameEvent(EventType.VOTE_CAST, {
      voterId,
      targetId: targetId || 'skip',
      voterRole: voter.role,
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.VOTE_CAST,
      payload: { voterId, targetId },
    };
    this.sseManager.broadcast(event);

    // Check for majority or if everyone has voted
    this.checkVotingProgress();
  }

  private checkVotingProgress(): void {
    const livingCount = this.getLivingPlayerCount();
    const votesCast = this.votes.size;

    // Tally votes
    const voteCounts = new Map<string, number>();
    for (const target of this.votes.values()) {
      voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
    }

    // Check for 51% majority
    const majorityThreshold = this.getMajorityThreshold();
    let majorityTarget: string | null = null;

    for (const [target, count] of voteCounts) {
      if (count >= majorityThreshold) {
        majorityTarget = target;
        break;
      }
    }

    if (majorityTarget) {
      this.finalizeVoting(majorityTarget);
      return;
    }

    // If everyone voted but no majority
    if (votesCast === livingCount) {
      this.finalizeVoting('skip'); // Or tie logic
    }
  }

  finalizeVoting(decisionTargetId: string | null = null): void {
    // Clear timeout
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }

    // If called without decision (e.g. timeout), calculate result
    if (!decisionTargetId) {
      // Re-calculate tally for timeout case
      const voteCounts = new Map<string, number>();
      for (const target of this.votes.values()) {
        voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
      }

      // Sort to find winner
      const sorted = Array.from(voteCounts.entries()).sort((a, b) => b[1] - a[1]);

      if (sorted.length > 0) {
        const top = sorted[0];
        // Check for tie
        if (sorted.length > 1 && sorted[1][1] === top[1]) {
          decisionTargetId = 'skip'; // Tie = no ejection
          logger.debug('Vote resulted in tie', {
            voteCounts: Object.fromEntries(voteCounts),
            topVotes: top[1],
          });
        } else {
          decisionTargetId = top[0];
          const majorityThreshold = this.getMajorityThreshold();
          if (top[1] < majorityThreshold) {
            decisionTargetId = 'skip';
            logger.debug('Vote winner did not reach majority threshold', {
              winner: top[0],
              votes: top[1],
              threshold: majorityThreshold,
            });
          }
        }
      } else {
        decisionTargetId = 'skip';
        logger.warn('No votes cast during voting phase');
      }
    }

    if (decisionTargetId && decisionTargetId !== 'skip') {
      this.ejectPlayer(decisionTargetId);
    } else {
      logger.logGameEvent('VotingSkip', {
        votesCast: this.votes.size,
        livingPlayers: this.livingPlayers.length,
      });

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.PLAYER_EJECTED,
        payload: {
          playerId: null,
          tie: true,
        },
      };
      this.sseManager.broadcast(event);
    }

    this.checkWinCondition();

    // Reset phase if game not over
    if (this.gameState.phase !== GamePhase.GAME_OVER) {
      this.gameState.startRound();
    }
  }

  ejectPlayer(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      logger.error(`Attempted to eject non-existent player: ${playerId}`, { playerId });
      return;
    }

    player.status = PlayerStatus.EJECTED;

    logger.logGameEvent(EventType.PLAYER_EJECTED, {
      playerId,
      playerName: player.name,
      role: player.role,
      votesFor: this.votes.get(playerId) || 'unknown',
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.PLAYER_EJECTED,
      payload: {
        playerId,
        role: player.role,
        tie: false,
      },
    };
    this.sseManager.broadcast(event);
  }

  checkWinCondition(): void {
    const moles = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.MOLE && p.status === PlayerStatus.ALIVE,
    );
    const loyalists = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.LOYALIST && p.status === PlayerStatus.ALIVE,
    );

    logger.debug('Checking win condition', {
      livingMoles: moles.length,
      livingLoyalists: loyalists.length,
      totalPlayers: this.gameState.players.size,
    });

    // Loyalists win if all moles ejected
    if (moles.length === 0) {
      this.endGame('Loyalists', 'All moles ejected');
      return;
    }

    // Moles win if they outnumber or equal loyalists
    if (moles.length >= loyalists.length) {
      this.endGame('Moles', 'Moles outnumber Loyalists');
    }
  }

  private endGame(winner: 'Loyalists' | 'Moles', reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;

    logger.logGameEvent(EventType.GAME_ENDED, {
      winner,
      reason,
      roundNumber: this.gameState.getRoundNumber(),
      totalRounds: this.gameState.getRoundNumber(),
    });

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.GAME_ENDED,
      payload: {
        winner: winner as 'Loyalists' | 'Moles',
        reason,
      },
    };
    this.sseManager.broadcast(event);
  }

  getLivingPlayerCount(): number {
    return Array.from(this.gameState.players.values()).filter(
      (p) => p.status === PlayerStatus.ALIVE,
    ).length;
  }

  getMajorityThreshold(): number {
    const livingCount = this.getLivingPlayerCount();
    return Math.floor(livingCount / 2) + 1;
  }

  /**
   * Cleanup method to clear any pending timeouts
   */
  cleanup(): void {
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
  }
}
