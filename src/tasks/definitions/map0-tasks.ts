import { TaskDefinition, TaskDefinitions, TaskType, MinigameType } from '../types';

export const MAP0_TASKS: TaskDefinitions = {
  mapId: 'map0',
  mapName: 'The Skeld',
  tasks: [
    // Sequence Repetition (Memory) - Cafeteria
    {
      id: 'sequence-repetition-cafeteria',
      name: 'Data Upload',
      description: 'Repeat the data sequence shown on the screen.',
      taskType: TaskType.MEDIUM,
      roomId: 'cafeteria',
      minigameType: MinigameType.SEQUENCE_REPETITION,
      isVisual: false,
    },
    // Word Math (Logic) - Electrical
    {
      id: 'word-math-electrical',
      name: 'Reactor Calibration',
      description: 'Solve the math problem to calibrate the reactor.',
      taskType: TaskType.MEDIUM,
      roomId: 'electrical',
      minigameType: MinigameType.WORD_MATH,
      isVisual: false,
    },
    // Sliding Tile (Spatial/Logic) - Security
    {
      id: 'sliding-tile-security',
      name: 'Unlock Security Panel',
      description: 'Arrange the tiles to unlock the security panel.',
      taskType: TaskType.MEDIUM,
      roomId: 'security',
      minigameType: MinigameType.SLIDING_TILE,
      isVisual: false,
    },
    // Battleship (Deduction) - Weapons
    {
      id: 'battleship-weapons',
      name: 'Target Practice',
      description: 'Sink the hidden targets to practice weapons.',
      taskType: TaskType.LONG,
      roomId: 'weapons',
      minigameType: MinigameType.BATTLESHIP,
      isVisual: false,
    },
    // Hot-n-Cold (Deduction) - Navigation
    {
      id: 'hot-cold-navigation',
      name: 'Navigation Fix',
      description: 'Adjust the frequency to find the target signal.',
      taskType: TaskType.MEDIUM,
      roomId: 'navigation',
      minigameType: MinigameType.HOT_COLD,
      isVisual: false,
    },
    // Hold Button (Nerve/Tension) - O2
    {
      id: 'hold-button-o2',
      name: 'O2 Filtration',
      description: 'Hold the button to filter the oxygen system.',
      taskType: TaskType.SHORT,
      roomId: 'o2',
      minigameType: MinigameType.HOLD_BUTTON,
      isVisual: false,
    },
    // Code Breaker (Deduction) - Admin
    {
      id: 'code-breaker-admin',
      name: 'Admin Access',
      description: 'Crack the 4-digit code to access admin panel.',
      taskType: TaskType.LONG,
      roomId: 'admin',
      minigameType: MinigameType.CODE_BREAKER,
      isVisual: false,
    },
    // Transfer Fuel (Logic) - Engine
    {
      id: 'transfer-fuel-engine',
      name: 'Fuel Transfer',
      description: 'Transfer fuel between containers to reach the target amount.',
      taskType: TaskType.MEDIUM,
      roomId: 'engine',
      minigameType: MinigameType.TRANSFER_FUEL,
      isVisual: false,
    },
  ],
};

export function getTasksByRoom(roomId: string): TaskDefinition[] {
  return MAP0_TASKS.tasks.filter((task) => task.roomId === roomId);
}

export function getVisualTasks(): TaskDefinition[] {
  return MAP0_TASKS.tasks.filter((task) => task.isVisual);
}

export function getTasksByType(taskType: TaskType): TaskDefinition[] {
  return MAP0_TASKS.tasks.filter((task) => task.taskType === taskType);
}
