import { Player, PlayerStatus, PlayerRole, GamePhase, EventType, GameEvent } from '@/types/game';
import { GameState } from './state';
import { SSEManager } from '@/sse/manager';
import { logger } from '@/utils/logger';

export interface TaskResult {
  success: boolean;
  reason?: string;
  taskProgress?: number;
}

export class TaskManager {
  private gameState: GameState;
  private sseManager: SSEManager;
  private totalTasks: number = 0;

  constructor(gameState: GameState, sseManager: SSEManager) {
    this.gameState = gameState;
    this.sseManager = sseManager;
    this.calculateTotalTasks();
  }

  private calculateTotalTasks(): void {
    let count = 0;
    this.gameState.rooms.forEach((room) => {
      const taskInteractables = room.interactables.filter((i) => i.type === 'Task');
      count += taskInteractables.length;
    });
    this.totalTasks = count || 1;
  }

  attemptTask(playerId: string, taskId: string, minigameResult?: boolean): TaskResult {
    const player = this.gameState.players.get(playerId);

    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.status !== PlayerStatus.ALIVE) {
      return { success: false, reason: 'Player is not alive' };
    }

    if (player.role !== PlayerRole.CREWMATE) {
      return { success: false, reason: 'Only crewmates can complete tasks' };
    }

    if (this.gameState.phase !== GamePhase.ROUND) {
      return { success: false, reason: 'Tasks can only be completed during rounds' };
    }

    const room = this.gameState.rooms.get(player.location.roomId);
    if (!room) {
      return { success: false, reason: 'Player room not found' };
    }

    const taskInteractable = room.interactables.find((i) => i.id === taskId && i.type === 'Task');
    if (!taskInteractable) {
      return { success: false, reason: 'Task not found in current room' };
    }

    if (!player.tasks) {
      player.tasks = [];
    }

    if (player.tasks.includes(taskId)) {
      return { success: false, reason: 'Task already completed by this player' };
    }

    if (minigameResult !== true) {
      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.TASK_FAILED,
        payload: {
          playerId,
          taskId,
          reason: minigameResult === false ? 'Minigame failed' : 'No minigame result provided',
        },
      };
      this.sseManager.broadcast(event);
      logger.logGameEvent(EventType.TASK_FAILED, { playerId, taskId });
      return { success: false, reason: 'Minigame not completed successfully' };
    }

    player.tasks.push(taskId);

    const crewmateCount = Array.from(this.gameState.players.values()).filter(
      (p) => p.role === PlayerRole.CREWMATE,
    ).length;

    const totalPossibleTasks = this.totalTasks * crewmateCount;
    const completedTasks = this.getCompletedTaskCount();
    const overallProgress =
      totalPossibleTasks > 0 ? Math.round((completedTasks / totalPossibleTasks) * 100) : 0;

    const playerTaskCount = player.tasks.length;
    const playerProgress =
      this.totalTasks > 0 ? Math.round((playerTaskCount / this.totalTasks) * 100) : 0;
    player.taskProgress = playerProgress;

    const event: GameEvent = {
      timestamp: Date.now(),
      type: EventType.TASK_COMPLETED,
      payload: {
        playerId,
        taskId,
        location: { ...player.location },
      },
    };
    this.sseManager.broadcast(event);
    logger.logGameEvent(EventType.TASK_COMPLETED, {
      playerId,
      taskId,
      room: player.location.roomId,
      playerProgress,
      overallProgress,
    });

    this.checkTaskWinCondition(overallProgress);

    return {
      success: true,
      taskProgress: playerProgress,
    };
  }

  getCompletedTaskCount(): number {
    let count = 0;
    this.gameState.players.forEach((player) => {
      if (player.tasks) {
        count += player.tasks.length;
      }
    });
    return count;
  }

  checkTaskWinCondition(overallProgress: number): void {
    if (overallProgress >= 100) {
      this.gameState.phase = GamePhase.GAME_OVER;

      logger.logGameEvent(EventType.GAME_ENDED, {
        winner: 'Crewmates',
        reason: 'All tasks completed',
        overallProgress,
      });

      const event: GameEvent = {
        timestamp: Date.now(),
        type: EventType.GAME_ENDED,
        payload: {
          winner: 'Crewmates',
          reason: 'All tasks completed',
        },
      };
      this.sseManager.broadcast(event);
    }
  }

  getTasksInRoom(roomId: string): string[] {
    const room = this.gameState.rooms.get(roomId);
    if (!room) return [];

    return room.interactables.filter((i) => i.type === 'Task').map((i) => i.id);
  }
}
