import { z } from 'zod';

export enum TaskType {
  SHORT = 'Short',
  MEDIUM = 'Medium',
  LONG = 'Long',
}

export enum MinigameType {
  SEQUENCE_REPETITION = 'sequence-repetition',
  WORD_MATH = 'word-math',
  SLIDING_TILE = 'sliding-tile',
  BATTLESHIP = 'battleship',
  HOT_COLD = 'hot-cold',
  HOLD_BUTTON = 'hold-button',
  CODE_BREAKER = 'code-breaker',
  TRANSFER_FUEL = 'transfer-fuel',
  COUNTER = 'counter', // Legacy, kept for compatibility
}

export const TaskTypeSchema = z.nativeEnum(TaskType);
export const MinigameTypeSchema = z.nativeEnum(MinigameType);

export const TaskDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  taskType: TaskTypeSchema,
  roomId: z.string(),
  minigameType: MinigameTypeSchema,
  isVisual: z.boolean(),
});
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;

export const TaskDefinitionsSchema = z.object({
  mapId: z.string(),
  mapName: z.string(),
  tasks: z.array(TaskDefinitionSchema),
});
export type TaskDefinitions = z.infer<typeof TaskDefinitionsSchema>;
