import { z } from 'zod';

// --- Enums ---

export enum PlayerRole {
  CREWMATE = 'Crewmate',
  IMPOSTER = 'Imposter',
}

export enum PlayerStatus {
  ALIVE = 'Alive',
  DEAD = 'Dead',
  EJECTED = 'Ejected',
}

export enum InteractableType {
  BUTTON = 'Button',
  LOG = 'Log',
  DOOR = 'Door',
  TASK = 'Task',
}

export enum GamePhase {
  LOBBY = 'Lobby',
  ROUND = 'Round',
  VOTING = 'Voting',
  GAME_OVER = 'GameOver',
}

export enum EventType {
  // Lobby events
  PLAYER_JOINED_LOBBY = 'PlayerJoinedLobby',
  PLAYER_LEFT_LOBBY = 'PlayerLeftLobby',
  PLAYER_READY = 'PlayerReady',
  COUNTDOWN_STARTED = 'CountdownStarted',
  COUNTDOWN_CANCELLED = 'CountdownCancelled',
  LOBBY_STATE = 'LobbyState',

  // Game events
  PLAYER_JOINED = 'PlayerJoined',
  PLAYER_LEFT = 'PlayerLeft',
  PLAYER_MOVED = 'PlayerMoved',
  INTERACTED_WITH_BUTTON = 'InteractedWithButton',
  INTERACTED_WITH_LOG = 'InteractedWithLog',
  BODY_FOUND = 'BodyFound',
  ACTION_PROMPT = 'ActionPrompt', // Prompt AI agents to take actions during round
  COUNCIL_CALLED = 'CouncilCalled',
  VOTE_CAST = 'VoteCast',
  PLAYER_EJECTED = 'PlayerEjected',
  PLAYER_KILLED = 'PlayerKilled', // Broadcast when a player is killed
  YOU_DIED = 'YouDied', // Private event sent to victim
  TASK_COMPLETED = 'TaskCompleted',
  TASK_FAILED = 'TaskFailed',
  ROUND_STARTED = 'RoundStarted',
  ROUND_ENDED = 'RoundEnded',
  GAME_STARTED = 'GameStarted',
  GAME_ENDED = 'GameEnded',
  GAME_OVER_SUMMARY = 'GameOverSummary',
  ROLE_REVEALED = 'RoleRevealed',
  SABOTAGE_ACTIVATED = 'SabotageActivated', // Broadcast when sabotage is triggered
  SABOTAGE_UPDATED = 'SabotageUpdated', // Countdown/progress updates
  SABOTAGE_RESOLVED = 'SabotageResolved', // Fixed or timed out
}

// --- Schemas & Types ---

// 1. Player
export const PlayerRoleSchema = z.nativeEnum(PlayerRole);
export const PlayerStatusSchema = z.nativeEnum(PlayerStatus);

export const PlayerLocationSchema = z.object({
  roomId: z.string(),
  x: z.number(),
  y: z.number(),
});

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: PlayerRoleSchema,
  status: PlayerStatusSchema,
  location: PlayerLocationSchema,
  taskProgress: z.number().min(0).max(100).optional(), // Optional for imposters
  killCooldown: z.number().min(0).optional(),
  tasks: z.array(z.string()).optional(), // Placeholder for tasks
});
export type Player = z.infer<typeof PlayerSchema>;

// 2. Room
export const InteractableTypeSchema = z.nativeEnum(InteractableType);

export const InteractableSchema = z.object({
  id: z.string(),
  type: z.string(), // Allowing string to match test 'download', 'vent' etc or use enum if strictly enforced
  name: z.string().optional(),
  action: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type Interactable = z.infer<typeof InteractableSchema>;

export const RoomPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  exits: z.array(z.string()),
  interactables: z.array(InteractableSchema),
  position: RoomPositionSchema,
});
export type Room = z.infer<typeof RoomSchema>;

// 3. GameState
export const GamePhaseSchema = z.nativeEnum(GamePhase);

export const DeadBodySchema = z.object({
  playerId: z.string(),
  role: PlayerRoleSchema.optional(),
  location: PlayerLocationSchema,
  reported: z.boolean().optional(),
  roomId: z.string().optional(), // For backward compatibility if needed, but location.roomId is better
});
export type DeadBody = z.infer<typeof DeadBodySchema>;

export const GameStateSchema = z.object({
  id: z.string().optional(),
  phase: GamePhaseSchema,
  roundNumber: z.number().int().min(1),
  imposterCount: z.number().int().min(0), // Changed from impostersRemaining
  roundTimer: z.number().min(0),
  deadBodies: z.array(DeadBodySchema),
  players: z.map(z.string(), PlayerSchema).or(z.array(PlayerSchema)), // Handle both Map and Array for flexibility
  rooms: z.map(z.string(), RoomSchema).or(z.array(RoomSchema)),
});
export type GameState = z.infer<typeof GameStateSchema>;

// 4. GameEvent
const BaseEventSchema = z.object({
  timestamp: z.number(),
  gameId: z.string().optional(),
});

// Event Payloads
export const PlayerJoinedPayload = z.object({ player: PlayerSchema });
export const PlayerLeftPayload = z.object({ playerId: z.string(), reason: z.string().optional() });
export const PlayerMovedPayload = z.object({
  playerId: z.string(),
  newLocation: PlayerLocationSchema,
});
export const InteractedWithButtonPayload = z.object({
  playerId: z.string(),
  buttonId: z.string(),
  roomId: z.string(),
});
export const InteractedWithLogPayload = z.object({ playerId: z.string(), logId: z.string() });
export const BodyFoundPayload = z.object({
  reporterId: z.string(),
  deadBodyId: z.string(),
  location: PlayerLocationSchema,
});
export const ActionPromptPayload = z.object({
  phase: z.nativeEnum(GamePhase),
  roundTimer: z.number(),
  promptType: z.enum(['move', 'kill', 'task', 'report']),
});
export const CouncilCalledPayload = z.object({
  callerId: z.string(),
  reason: z.string().optional(),
});
export const VoteCastPayload = z.object({ voterId: z.string(), targetId: z.string().nullable() });
export const PlayerEjectedPayload = z.object({
  playerId: z.string().nullable(), // null for no ejection (tie/skip)
  role: PlayerRoleSchema.nullable().optional(), // optional when no ejection
  tie: z.boolean().optional(),
});
export const RoundStartedPayload = z.object({ roundNumber: z.number(), imposterCount: z.number() });
export const RoundEndedPayload = z.object({ reason: z.string(), roundNumber: z.number() });
export const GameEndedPayload = z.object({
  winner: z.union([z.literal('Crewmates'), z.literal('Imposters'), PlayerRoleSchema]),
  reason: z.string(),
});
export const RoleRevealedPayload = z.object({ playerId: z.string(), role: PlayerRoleSchema });

// Lobby Event Payloads
export const PlayerJoinedLobbyPayload = z.object({ player: PlayerSchema });
export const PlayerLeftLobbyPayload = z.object({ playerId: z.string() });
export const PlayerReadyPayload = z.object({ playerId: z.string(), ready: z.boolean() });
export const CountdownStartedPayload = z.object({ duration: z.number() });
export const CountdownCancelledPayload = z.object({});
export const LobbyStatePayload = z.object({
  players: z.array(PlayerSchema),
  readyPlayers: z.array(z.string()),
  isCountdownActive: z.boolean(),
});

// Game Flow Payloads
export const GameStartedPayload = z.object({
  playerCount: z.number(),
  imposterCount: z.number(),
});
export const GameOverSummaryPayload = z.object({
  phase: z.string(),
  message: z.string(),
});

// Kill Event Payloads
export const PlayerKilledPayload = z.object({
  killerId: z.string(),
  victimId: z.string(),
  location: PlayerLocationSchema,
});
export const YouDiedPayload = z.object({ killerId: z.string() });

export const TaskCompletedPayload = z.object({
  playerId: z.string(),
  taskId: z.string(),
  location: PlayerLocationSchema,
});
export const TaskFailedPayload = z.object({
  playerId: z.string(),
  taskId: z.string(),
  reason: z.string(),
});

// Sabotage Event Payloads
export const SabotageActivatedPayload = z.object({
  sabotageId: z.string(),
  type: z.enum(['lights', 'doors', 'self-destruct']),
  target: z.string().optional(),
  message: z.string(),
  timer: z.number().optional(),
});
export const SabotageUpdatedPayload = z.object({
  sabotageId: z.string(),
  type: z.enum(['lights', 'doors', 'self-destruct']),
  message: z.string(),
  timer: z.number().optional(),
  remainingSeconds: z.number().optional(),
});
export const SabotageResolvedPayload = z.object({
  sabotageId: z.string(),
  type: z.enum(['lights', 'doors', 'self-destruct']),
  reason: z.string(),
  success: z.boolean(),
});

// Event Schemas
export const PlayerJoinedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_JOINED),
  payload: PlayerJoinedPayload,
});
export const PlayerLeftEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_LEFT),
  payload: PlayerLeftPayload,
});
export const PlayerMovedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_MOVED),
  payload: PlayerMovedPayload,
});
export const InteractedWithButtonEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.INTERACTED_WITH_BUTTON),
  payload: InteractedWithButtonPayload,
});
export const InteractedWithLogEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.INTERACTED_WITH_LOG),
  payload: InteractedWithLogPayload,
});
export const BodyFoundEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.BODY_FOUND),
  payload: BodyFoundPayload,
});
export const ActionPromptEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.ACTION_PROMPT),
  payload: ActionPromptPayload,
});
export const CouncilCalledEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.COUNCIL_CALLED),
  payload: CouncilCalledPayload,
});
export const VoteCastEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.VOTE_CAST),
  payload: VoteCastPayload,
});
export const PlayerEjectedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_EJECTED),
  payload: PlayerEjectedPayload,
});
export const RoundStartedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.ROUND_STARTED),
  payload: RoundStartedPayload,
});
export const RoundEndedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.ROUND_ENDED),
  payload: RoundEndedPayload,
});
export const GameEndedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.GAME_ENDED),
  payload: GameEndedPayload,
});
export const RoleRevealedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.ROLE_REVEALED),
  payload: RoleRevealedPayload,
});
export const GameStartedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.GAME_STARTED),
  payload: GameStartedPayload,
});
export const GameOverSummaryEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.GAME_OVER_SUMMARY),
  payload: GameOverSummaryPayload,
});
export const PlayerKilledEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_KILLED),
  payload: PlayerKilledPayload,
});
export const YouDiedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.YOU_DIED),
  payload: YouDiedPayload,
});
export const TaskCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.TASK_COMPLETED),
  payload: TaskCompletedPayload,
});
export const TaskFailedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.TASK_FAILED),
  payload: TaskFailedPayload,
});
export const SabotageActivatedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.SABOTAGE_ACTIVATED),
  payload: SabotageActivatedPayload,
});
export const SabotageUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.SABOTAGE_UPDATED),
  payload: SabotageUpdatedPayload,
});
export const SabotageResolvedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.SABOTAGE_RESOLVED),
  payload: SabotageResolvedPayload,
});

// Lobby Event Schemas
export const PlayerJoinedLobbyEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_JOINED_LOBBY),
  payload: PlayerJoinedLobbyPayload,
});
export const PlayerLeftLobbyEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_LEFT_LOBBY),
  payload: PlayerLeftLobbyPayload,
});
export const PlayerReadyEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.PLAYER_READY),
  payload: PlayerReadyPayload,
});
export const CountdownStartedEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.COUNTDOWN_STARTED),
  payload: CountdownStartedPayload,
});
export const CountdownCancelledEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.COUNTDOWN_CANCELLED),
  payload: CountdownCancelledPayload,
});
export const LobbyStateEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.LOBBY_STATE),
  payload: LobbyStatePayload,
});

export const GameEventSchema = z.discriminatedUnion('type', [
  // Lobby events
  PlayerJoinedLobbyEventSchema,
  PlayerLeftLobbyEventSchema,
  PlayerReadyEventSchema,
  CountdownStartedEventSchema,
  CountdownCancelledEventSchema,
  LobbyStateEventSchema,
  // Game events
  PlayerJoinedEventSchema,
  PlayerLeftEventSchema,
  PlayerMovedEventSchema,
  InteractedWithButtonEventSchema,
  InteractedWithLogEventSchema,
  BodyFoundEventSchema,
  ActionPromptEventSchema,
  CouncilCalledEventSchema,
  VoteCastEventSchema,
  PlayerEjectedEventSchema,
  RoundStartedEventSchema,
  RoundEndedEventSchema,
  GameStartedEventSchema,
  GameEndedEventSchema,
  GameOverSummaryEventSchema,
  RoleRevealedEventSchema,
  PlayerKilledEventSchema,
  YouDiedEventSchema,
  TaskCompletedEventSchema,
  TaskFailedEventSchema,
  SabotageActivatedEventSchema,
  SabotageUpdatedEventSchema,
  SabotageResolvedEventSchema,
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
