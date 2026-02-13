import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TaskManager, type TaskResult } from '@/game/tasks';
import { GameState } from '@/game/state';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  type Player,
  type Room,
} from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

describe('TaskManager', () => {
  let gameState: GameState;
  let taskManager: TaskManager;
  let crewmates: Player[];
  let imposter: Player;
  // Use real task IDs from MAP0_TASKS
  const TASK_IDS = [
    'sequence-repetition-cafeteria',
    'word-math-electrical',
    'sliding-tile-security',
  ];

  beforeEach(() => {
    gameState = new GameState();

    // Clear existing task interactables from all rooms, then add test tasks
    // This ensures TaskManager calculates totalTasks correctly
    // Use actual room IDs from ROOMS array: center, electrical-room, logs-room
    // In Among Us, each crewmate has their own tasks to complete. For testing,
    // we add all 3 tasks to each room so any player in any room can complete
    // their assigned tasks. This simulates the real game where tasks are
    // assigned to specific players, not locations.
    const rooms = ['center', 'electrical-room', 'logs-room'];

    // Clear existing tasks
    rooms.forEach(roomId => {
      const room = gameState.rooms.get(roomId);
      if (room) {
        room.interactables = room.interactables.filter((i) => i.type !== 'Task');
      }
    });

    // Add test tasks to each room
    const allTasks = [
      { id: 'task-1', type: 'Task', name: 'Test Task 1', action: 'Complete' },
      { id: 'task-2', type: 'Task', name: 'Test Task 2', action: 'Complete' },
      { id: 'task-3', type: 'Task', name: 'Test Task 3', action: 'Complete' },
    ];

    rooms.forEach(roomId => {
      const room = gameState.rooms.get(roomId);
      if (room) {
        allTasks.forEach(task => {
          room.interactables.push(task);
        });
      }
    });

    // Create players: 1 imposter, 3 crewmates
    imposter = createMockPlayer({
      id: 'imposter-1',
      name: 'The Imposter',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    crewmates = [
      createMockPlayer({
        id: 'crewmate-1',
        name: 'Crewmate 1',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 10, y: 10 },
        tasks: [],
        taskProgress: 0,
      }),
      createMockPlayer({
        id: 'crewmate-2',
        name: 'Crewmate 2',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'electrical-room', x: 20, y: 20 },
        tasks: [],
        taskProgress: 0,
      }),
      createMockPlayer({
        id: 'crewmate-3',
        name: 'Crewmate 3',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'logs-room', x: 30, y: 30 },
        tasks: [],
        taskProgress: 0,
      }),
    ];

    // Add players to game state
    gameState.addPlayer(imposter);
    crewmates.forEach((player) => gameState.addPlayer(player));

    // Set game to ROUND phase
    gameState.setPhase(GamePhase.ROUND);

    // Create TaskManager AFTER adding tasks to rooms
    // This ensures calculateTotalTasks() sees the test tasks
    taskManager = new TaskManager(gameState, gameState.getSSEManager());
  });

    // Create players: 1 imposter, 3 crewmates
    imposter = createMockPlayer({
      id: 'imposter-1',
      name: 'The Imposter',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'cafeteria', x: 0, y: 0 },
    });


  describe('attemptTask', () => {
    test('should successfully complete a task for a living crewmate', () => {
      // Pass empty action to simulate successful minigame completion
      // The minigame manager will handle the completion logic
      const result: TaskResult = taskManager.attemptTask('crewmate-1', 'task-1', true);

      expect(result.success).toBe(true);
      expect(crewmates[0].tasks).toContain('task-1');
    });

    test('should not allow imposter to complete tasks', () => {
      const result: TaskResult = taskManager.attemptTask('imposter-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Only crewmates can complete tasks');
    });

    test('should not allow dead crewmate to complete tasks', () => {
      crewmates[0].status = PlayerStatus.DEAD;

      const result: TaskResult = taskManager.attemptTask('crewmate-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player is not alive');
    });

    test('should not complete same task twice for same player', () => {
      taskManager.attemptTask('crewmate-1', 'task-1', true);

      const result: TaskResult = taskManager.attemptTask('crewmate-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Task already completed by this player');
    });

    test('should allow different players to complete same task', () => {
      const result1: TaskResult = taskManager.attemptTask('crewmate-1', 'task-1', true);
      const result2: TaskResult = taskManager.attemptTask('crewmate-2', 'task-1', true);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(crewmates[0].tasks).toContain('task-1');
      expect(crewmates[1].tasks).toContain('task-1');
    });
  });

  describe('getCompletedTaskCount - Living Crewmates Only', () => {
    test('should count tasks from living crewmates only', () => {
      // Complete 2 tasks for crewmate-1
      taskManager.attemptTask('crewmate-1', 'task-1', true);
      taskManager.attemptTask('crewmate-1', 'task-2', true);

      // Complete 1 task for crewmate-2
      taskManager.attemptTask('crewmate-2', 'task-1', true);

      // Kill crewmate-3 (no tasks completed anyway)
      crewmates[2].status = PlayerStatus.DEAD;

      const count = taskManager.getCompletedTaskCount();

      // Only living crewmates' tasks should count
      expect(count).toBe(3);
    });

    test('should not count tasks from dead crewmates', () => {
      // Complete 3 tasks for crewmate-1
      taskManager.attemptTask('crewmate-1', 'task-1', true);
      taskManager.attemptTask('crewmate-1', 'task-2', true);
      taskManager.attemptTask('crewmate-1', 'task-3', true);

      // Complete 2 tasks for crewmate-2
      taskManager.attemptTask('crewmate-2', 'task-1', true);
      taskManager.attemptTask('crewmate-2', 'task-2', true);

      // Now kill crewmate-2 - their tasks shouldn't count
      crewmates[1].status = PlayerStatus.DEAD;

      const count = taskManager.getCompletedTaskCount();

      // Only crewmate-1's tasks count (they're alive)
      expect(count).toBe(3);
    });
  });

  describe('checkTaskWinCondition - Crewmate Win', () => {
    test('should trigger crewmate win when all living crewmates complete all tasks', () => {
      // All 3 living crewmates complete all 3 tasks
      crewmates.forEach((crewmate) => {
        taskManager.attemptTask(crewmate.id, 'task-1', true);
        taskManager.attemptTask(crewmate.id, 'task-2', true);
        taskManager.attemptTask(crewmate.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should trigger crewmate win even if some crewmates are dead', () => {
      // Kill crewmate-3
      crewmates[2].status = PlayerStatus.DEAD;

      // Remaining 2 living crewmates complete all tasks
      crewmates.slice(0, 2).forEach((crewmate) => {
        taskManager.attemptTask(crewmate.id, 'task-1', true);
        taskManager.attemptTask(crewmate.id, 'task-2', true);
        taskManager.attemptTask(crewmate.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should NOT trigger win if dead crewmate had completed tasks but living have not', () => {
      // Crewmate-3 completes all tasks
      taskManager.attemptTask('crewmate-3', 'task-1', true);
      taskManager.attemptTask('crewmate-3', 'task-2', true);
      taskManager.attemptTask('crewmate-3', 'task-3', true);

      // Now kill crewmate-3
      crewmates[2].status = PlayerStatus.DEAD;

      // Living crewmates have not completed all tasks
      // Win should NOT trigger
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should trigger win when living crewmates complete tasks after death of another', () => {
      // Kill crewmate-3 first (no tasks)
      crewmates[2].status = PlayerStatus.DEAD;

      // Remaining 2 living crewmates complete all tasks
      crewmates.slice(0, 2).forEach((crewmate) => {
        taskManager.attemptTask(crewmate.id, 'task-1', true);
        taskManager.attemptTask(crewmate.id, 'task-2', true);
        taskManager.attemptTask(crewmate.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should adjust total tasks when crewmate dies mid-progress', () => {
      // 2 crewmates complete 2/3 tasks each
      taskManager.attemptTask('crewmate-1', 'task-1', true);
      taskManager.attemptTask('crewmate-1', 'task-2', true);
      taskManager.attemptTask('crewmate-2', 'task-1', true);
      taskManager.attemptTask('crewmate-2', 'task-2', true);

      // No win yet
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);

      // Kill crewmate-3 (they hadn't done any tasks)
      crewmates[2].status = PlayerStatus.DEAD;

      // Still no win - 2 living crewmates need to complete all 3 tasks
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);

      // Complete last task for both living crewmates
      taskManager.attemptTask('crewmate-1', 'task-3', true);
      taskManager.attemptTask('crewmate-2', 'task-3', true);

      // Now win should trigger
      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger win when only some living crewmates have completed tasks', () => {
      // Only crewmate-1 completes all tasks
      taskManager.attemptTask('crewmate-1', 'task-1', true);
      taskManager.attemptTask('crewmate-1', 'task-2', true);
      taskManager.attemptTask('crewmate-1', 'task-3', true);

      // Other 2 crewmates haven't - no win
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });
  });
});
