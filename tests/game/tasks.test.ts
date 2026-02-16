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
import { TEST_MAP } from '@/game/maps';

describe('TaskManager', () => {
  let gameState: GameState;
  let taskManager: TaskManager;
  let loyalists: Player[];
  let mole: Player;
  // Use real task IDs from MAP0_TASKS
  const TASK_IDS = [
    'sequence-repetition-cafeteria',
    'word-math-electrical',
    'sliding-tile-security',
  ];

  beforeEach(() => {
    gameState = new GameState();
    gameState.loadMap(TEST_MAP);

    // Clear existing task interactables from all rooms, then add test tasks
    // This ensures TaskManager calculates totalTasks correctly
    // Use actual room IDs from ROOMS array: center, electrical-room, logs-room
    // In Double Agent, each loyalist has their own tasks to complete. For testing,
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

    // Create players: 1 mole, 3 loyalists
    mole = createMockPlayer({
      id: 'mole-1',
      name: 'The Mole',
      role: PlayerRole.MOLE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'center', x: 0, y: 0 },
    });

    loyalists = [
      createMockPlayer({
        id: 'loyalist-1',
        name: 'Loyalist 1',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'center', x: 10, y: 10 },
        tasks: [],
        taskProgress: 0,
      }),
      createMockPlayer({
        id: 'loyalist-2',
        name: 'Loyalist 2',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'electrical-room', x: 20, y: 20 },
        tasks: [],
        taskProgress: 0,
      }),
      createMockPlayer({
        id: 'loyalist-3',
        name: 'Loyalist 3',
        role: PlayerRole.LOYALIST,
        status: PlayerStatus.ALIVE,
        location: { roomId: 'logs-room', x: 30, y: 30 },
        tasks: [],
        taskProgress: 0,
      }),
    ];

    // Add players to game state
    gameState.addPlayer(mole);
    loyalists.forEach((player) => gameState.addPlayer(player));

    // Set game to ROUND phase
    gameState.setPhase(GamePhase.ROUND);

    // Create TaskManager AFTER adding tasks to rooms
    // This ensures calculateTotalTasks() sees the test tasks
    taskManager = new TaskManager(gameState, gameState.getSSEManager());
  });

  describe('attemptTask', () => {
    test('should successfully complete a task for a living loyalist', () => {
      // Pass empty action to simulate successful minigame completion
      // The minigame manager will handle the completion logic
      const result: TaskResult = taskManager.attemptTask('loyalist-1', 'task-1', true);

      expect(result.success).toBe(true);
      expect(loyalists[0].tasks).toContain('task-1');
    });

    test('should not allow mole to complete tasks', () => {
      const result: TaskResult = taskManager.attemptTask('mole-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Only loyalists can complete tasks');
    });

    test('should not allow dead loyalist to complete tasks', () => {
      loyalists[0].status = PlayerStatus.DEAD;

      const result: TaskResult = taskManager.attemptTask('loyalist-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player is not alive');
    });

    test('should not complete same task twice for same player', () => {
      taskManager.attemptTask('loyalist-1', 'task-1', true);

      const result: TaskResult = taskManager.attemptTask('loyalist-1', 'task-1', true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Task already completed by this player');
    });

    test('should allow different players to complete same task', () => {
      const result1: TaskResult = taskManager.attemptTask('loyalist-1', 'task-1', true);
      const result2: TaskResult = taskManager.attemptTask('loyalist-2', 'task-1', true);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(loyalists[0].tasks).toContain('task-1');
      expect(loyalists[1].tasks).toContain('task-1');
    });
  });

  describe('getCompletedTaskCount - Living Loyalists Only', () => {
    test('should count tasks from living loyalists only', () => {
      // Complete 2 tasks for loyalist-1
      taskManager.attemptTask('loyalist-1', 'task-1', true);
      taskManager.attemptTask('loyalist-1', 'task-2', true);

      // Complete 1 task for loyalist-2
      taskManager.attemptTask('loyalist-2', 'task-1', true);

      // Kill loyalist-3 (no tasks completed anyway)
      loyalists[2].status = PlayerStatus.DEAD;

      const count = taskManager.getCompletedTaskCount();

      // Only living loyalists' tasks should count
      expect(count).toBe(3);
    });

    test('should not count tasks from dead loyalists', () => {
      // Complete 3 tasks for loyalist-1
      taskManager.attemptTask('loyalist-1', 'task-1', true);
      taskManager.attemptTask('loyalist-1', 'task-2', true);
      taskManager.attemptTask('loyalist-1', 'task-3', true);

      // Complete 2 tasks for loyalist-2
      taskManager.attemptTask('loyalist-2', 'task-1', true);
      taskManager.attemptTask('loyalist-2', 'task-2', true);

      // Now kill loyalist-2 - their tasks shouldn't count
      loyalists[1].status = PlayerStatus.DEAD;

      const count = taskManager.getCompletedTaskCount();

      // Only loyalist-1's tasks count (they're alive)
      expect(count).toBe(3);
    });
  });

  describe('checkTaskWinCondition - Loyalist Win', () => {
    test('should trigger loyalist win when all living loyalists complete all tasks', () => {
      // All 3 living loyalists complete all 3 tasks
      loyalists.forEach((loyalist) => {
        taskManager.attemptTask(loyalist.id, 'task-1', true);
        taskManager.attemptTask(loyalist.id, 'task-2', true);
        taskManager.attemptTask(loyalist.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should trigger loyalist win even if some loyalists are dead', () => {
      // Kill loyalist-3
      loyalists[2].status = PlayerStatus.DEAD;

      // Remaining 2 living loyalists complete all tasks
      loyalists.slice(0, 2).forEach((loyalist) => {
        taskManager.attemptTask(loyalist.id, 'task-1', true);
        taskManager.attemptTask(loyalist.id, 'task-2', true);
        taskManager.attemptTask(loyalist.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should NOT trigger win if dead loyalist had completed tasks but living have not', () => {
      // Loyalist-3 completes all tasks
      taskManager.attemptTask('loyalist-3', 'task-1', true);
      taskManager.attemptTask('loyalist-3', 'task-2', true);
      taskManager.attemptTask('loyalist-3', 'task-3', true);

      // Now kill loyalist-3
      loyalists[2].status = PlayerStatus.DEAD;

      // Living loyalists have not completed all tasks
      // Win should NOT trigger
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });

    test('should trigger win when living loyalists complete tasks after death of another', () => {
      // Kill loyalist-3 first (no tasks)
      loyalists[2].status = PlayerStatus.DEAD;

      // Remaining 2 living loyalists complete all tasks
      loyalists.slice(0, 2).forEach((loyalist) => {
        taskManager.attemptTask(loyalist.id, 'task-1', true);
        taskManager.attemptTask(loyalist.id, 'task-2', true);
        taskManager.attemptTask(loyalist.id, 'task-3', true);
      });

      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should adjust total tasks when loyalist dies mid-progress', () => {
      // 2 loyalists complete 2/3 tasks each
      taskManager.attemptTask('loyalist-1', 'task-1', true);
      taskManager.attemptTask('loyalist-1', 'task-2', true);
      taskManager.attemptTask('loyalist-2', 'task-1', true);
      taskManager.attemptTask('loyalist-2', 'task-2', true);

      // No win yet
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);

      // Kill loyalist-3 (they hadn't done any tasks)
      loyalists[2].status = PlayerStatus.DEAD;

      // Still no win - 2 living loyalists need to complete all 3 tasks
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);

      // Complete last task for both living loyalists
      taskManager.attemptTask('loyalist-1', 'task-3', true);
      taskManager.attemptTask('loyalist-2', 'task-3', true);

      // Now win should trigger
      expect(gameState.getPhase()).toBe(GamePhase.GAME_OVER);
    });

    test('should not trigger win when only some living loyalists have completed tasks', () => {
      // Only loyalist-1 completes all tasks
      taskManager.attemptTask('loyalist-1', 'task-1', true);
      taskManager.attemptTask('loyalist-1', 'task-2', true);
      taskManager.attemptTask('loyalist-1', 'task-3', true);

      // Other 2 loyalists haven't - no win
      expect(gameState.getPhase()).toBe(GamePhase.ROUND);
    });
  });
});
