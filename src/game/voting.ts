import { PlayerStatus, PlayerRole, EventType, GamePhase, DeadBody } from '@/types/game';
import { GameState } from './state';
import { logger } from '@/utils/logger';

export class VotingSystem {
  votes: Map<string, string> = new Map(); // voterId -> targetId
  councilStartedAt: number = 0;
  livingPlayers: string[] = [];

  private gameState: GameState;

  private sseManager = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast: (event: string, data: any) => {
      // Mock implementation
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

  startCouncil(deadBodies: DeadBody[]): void {
    const previousPhase = this.gameState.phase;
    this.gameState.phase = GamePhase.VOTING;
    this.votes.clear();
    this.councilStartedAt = Date.now();
    this.livingPlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.status === PlayerStatus.ALIVE)
      .map((p) => p.id);

    logger.logStateTransition(previousPhase, GamePhase.VOTING, {
      reason: deadBodies.length > 0 ? 'Dead Body Reported' : 'Emergency Meeting',
      deadBodyCount: deadBodies.length,
      livingPlayerCount: this.livingPlayers.length,
    });

    this.sseManager.broadcast(EventType.COUNCIL_CALLED, {
      callerId: 'system',
      reason: deadBodies.length > 0 ? 'Dead Body Reported' : 'Emergency Meeting',
    });
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

    this.sseManager.broadcast(EventType.VOTE_CAST, {
      voterId,
      targetId,
    });

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
          // Must be > 50%? Prompt says "eject if 51% majority".
          // If timeout and plural vote but not majority, usually strictly majority needed?
          // "Tie (e.g., 3-3) = NO EJECTION" implies partial logic.
          // Prompt says "Eject if 51% majority".
          // So if max votes < 51%, no ejection.
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

      this.sseManager.broadcast(EventType.PLAYER_EJECTED, {
        playerId: 'none',
        role: 'none', // Placeholder, creates type error if strictly typed?
        // Ejected payload expects role. I'll use a dummy role or handle differently.
        // Actually, for "Skipped", we might just not send PLAYER_EJECTED or send with null?
        // EventType.PLAYER_EJECTED expects a player.
        // I'll emit a "CouncilEnded" or similar if possible.
        // But prompt says "Tie = NO EJECTION".
        tie: true,
      });
      // Fix: Role is required in payload. I'll pick CREWMATE as dummy or fix type.
      // Or just not emit PLAYER_EJECTED if no one ejected?
      // Prompt says "Tie (e.g., 3-3) = NO EJECTION".
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

    this.sseManager.broadcast(EventType.PLAYER_EJECTED, {
      playerId,
      role: player.role,
      tie: false,
    });
  }

  checkWinCondition(): void {
    const imposters = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.IMPOSTER && p.status === PlayerStatus.ALIVE,
    );
    const crewmates = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.CREWMATE && p.status === PlayerStatus.ALIVE,
    );

    logger.debug('Checking win condition', {
      livingImposters: imposters.length,
      livingCrewmates: crewmates.length,
      totalPlayers: this.gameState.players.size,
    });

    // Crewmates win if 2 imposters ejected (assuming 2 total)
    // Or check total imposters vs ejected?
    // "2 imposters ejected" implies 0 remaining if total was 2.
    if (imposters.length === 0) {
      this.endGame('Crewmates', 'All imposters ejected');
      return;
    }

    // All tasks done? (Mock implementation)
    // this.gameState.players.every(p => p.role === CREWMATE && p.tasksCompleted)

    // Imposters win if only 2 players left (1 imposter, 1 crewmate usually, or 2 vs 2?)
    // "Imposters win if only 2 players left" -> implies 1 imposter, 1 crewmate.
    // Standard rule: Imposters >= Crewmates
    if (imposters.length >= crewmates.length) {
      this.endGame('Imposters', 'Imposters outnumber Crewmates');
    }
  }

  private endGame(winner: 'Crewmates' | 'Imposters', reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;

    logger.logGameEvent(EventType.GAME_ENDED, {
      winner,
      reason,
      roundNumber: this.gameState.getRoundNumber(),
      totalRounds: this.gameState.getRoundNumber(),
    });

    this.sseManager.broadcast(EventType.GAME_ENDED, {
      winner,
      reason,
    });
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
}
