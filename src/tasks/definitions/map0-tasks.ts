import { TaskDefinition, TaskDefinitions, TaskType, MinigameType } from '../types';

export const MAP0_TASKS: TaskDefinitions = {
  mapId: 'map0',
  mapName: 'Map 0',
  tasks: [
    {
      id: 'count-to-100',
      name: 'Count to 100',
      description: 'A simple test task. Count from 1 to 100.',
      taskType: TaskType.SHORT,
      roomId: 'room0',
      minigameType: MinigameType.COUNTER,
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
