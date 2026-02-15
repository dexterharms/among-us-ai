import { describe, expect, test, beforeEach } from 'bun:test';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  type Player,
  type Room,
  type GameState,
  type GameEvent,
} from '@/types/game';

export const MOCK_PLAYER_ID = 'player-123';
export const MOCK_ROOM_ID = 'cafeteria';
export const MOCK_GAME_ID = 'game-xyz';

/**
 * Factory for creating valid Player objects for testing
 */
export const createMockPlayer = (overrides: Partial<Player> = {}): Player => {
  return {
    id: MOCK_PLAYER_ID,
    name: 'Test Player',
    role: PlayerRole.LOYALIST,
    status: PlayerStatus.ALIVE,
    location: {
      roomId: MOCK_ROOM_ID,
      x: 100,
      y: 100,
    },
    tasks: [],
    taskProgress: 0,
    ...overrides,
  };
};

/**
 * Factory for creating valid Room objects for testing
 */
export const createMockRoom = (overrides: Partial<Room> = {}): Room => {
  return {
    id: MOCK_ROOM_ID,
    name: 'Cafeteria',
    exits: ['admin', 'storage', 'medbay'],
    interactables: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
};

/**
 * Factory for creating valid GameState objects for testing
 */
export const createMockGameState = (overrides: Partial<GameState> = {}): GameState => {
  return {
    id: MOCK_GAME_ID,
    phase: GamePhase.LOBBY,
    roundNumber: 1,
    moleCount: 1,
    roundTimer: 0,
    players: new Map(),
    rooms: new Map(),
    deadBodies: [],
    ...overrides,
  };
};

/**
 * Helper to validate Zod schema parsing
 */
export const validateSchema = <T>(schema: any, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.format())}`);
  }
  return result.data;
};

/**
 * Helper to ensure Zod schema fails for invalid data
 */
export const expectSchemaFailure = (schema: any, data: unknown): void => {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
};
