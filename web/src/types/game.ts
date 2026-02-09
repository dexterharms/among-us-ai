/**
 * Minimal types for web app - subset of server types
 */

export const PlayerRole = {
  CREWMATE: 'Crewmate',
  IMPOSTER: 'Imposter',
} as const;

export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export const PlayerStatus = {
  ALIVE: 'Alive',
  DEAD: 'Dead',
  EJECTED: 'Ejected',
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

export interface PlayerLocation {
  roomId: string;
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  status: PlayerStatus;
  location: PlayerLocation;
  taskProgress?: number;
  killCooldown?: number;
  tasks?: string[];
}

export interface DeadBody {
  playerId: string;
  role?: PlayerRole;
  location: PlayerLocation;
  reported?: boolean;
  roomId?: string;
}

export const GamePhase = {
  LOBBY: 'Lobby',
  ROUND: 'Round',
  VOTING: 'Voting',
  GAME_OVER: 'GameOver',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export interface GameState {
  id?: string;
  phase: GamePhase;
  roundNumber: number;
  imposterCount: number;
  roundTimer: number;
  deadBodies: DeadBody[];
  players: Player[] | Map<string, Player>;
  rooms: any[] | Map<string, any>;
}
