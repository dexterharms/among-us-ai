import { describe, expect, test } from 'bun:test';
import {
  PlayerRole,
  PlayerStatus,
  GamePhase,
  EventType,
  PlayerSchema,
  RoomSchema,
  GameStateSchema,
  GameEventSchema,
  type Player,
  type Room,
  type GameState,
  type GameEvent,
} from '@/types/game';
import {
  createMockPlayer,
  createMockRoom,
  createMockGameState,
  validateSchema,
  expectSchemaFailure,
  MOCK_PLAYER_ID,
  MOCK_ROOM_ID,
} from '../framework/test_base';

describe('Phase 2: Core Type Definitions', () => {
  describe('Test 1: Player type validation', () => {
    test('Create valid player object with all required fields', () => {
      const player = createMockPlayer();
      validateSchema(PlayerSchema, player);

      expect(player.id).toBe(MOCK_PLAYER_ID);
      expect(player.role).toBe(PlayerRole.LOYALIST);
      expect(player.status).toBe(PlayerStatus.ALIVE);
      expect(player.location).toBeDefined();
    });

    test('Test player can be created with role Loyalist', () => {
      const player = createMockPlayer({ role: PlayerRole.LOYALIST });
      validateSchema(PlayerSchema, player);
      expect(player.role).toBe(PlayerRole.LOYALIST);
      expect(player.taskProgress).toBeDefined(); // Loyalists should track task progress
    });

    test('Test player can be created with role Mole', () => {
      const player = createMockPlayer({
        role: PlayerRole.MOLE,
        killCooldown: 30, // Mole specific
        taskProgress: undefined, // Moles might fake tasks but don't contribute to progress
      });
      validateSchema(PlayerSchema, player);
      expect(player.role).toBe(PlayerRole.MOLE);
      expect(player.killCooldown).toBe(30);
    });

    test('Test player status validation (Alive/Dead/Ejected)', () => {
      const alivePlayer = createMockPlayer({ status: PlayerStatus.ALIVE });
      const deadPlayer = createMockPlayer({ status: PlayerStatus.DEAD });
      const ejectedPlayer = createMockPlayer({ status: PlayerStatus.EJECTED });

      validateSchema(PlayerSchema, alivePlayer);
      validateSchema(PlayerSchema, deadPlayer);
      validateSchema(PlayerSchema, ejectedPlayer);

      expect(alivePlayer.status).toBe(PlayerStatus.ALIVE);
      expect(deadPlayer.status).toBe(PlayerStatus.DEAD);
      expect(ejectedPlayer.status).toBe(PlayerStatus.EJECTED);

      // Invalid status should fail schema validation
      expectSchemaFailure(PlayerSchema, { ...createMockPlayer(), status: 'INVALID_STATUS' });
    });

    test('Test location tracking (roomId, x, y coordinates)', () => {
      const player = createMockPlayer({
        location: {
          roomId: 'admin',
          x: 50.5,
          y: 75.2,
        },
      });
      validateSchema(PlayerSchema, player);

      expect(player.location.roomId).toBe('admin');
      expect(player.location.x).toBe(50.5);
      expect(player.location.y).toBe(75.2);
    });

    test('Test kill cooldown for moles', () => {
      const mole = createMockPlayer({
        role: PlayerRole.MOLE,
        killCooldown: 10,
      });
      validateSchema(PlayerSchema, mole);
      expect(mole.killCooldown).toBe(10);

      // Loyalists shouldn't have killCooldown (or schema should handle it)
      // Depending on implementation, schema might be strict or loose.
      // Assuming strict:
      // expectSchemaFailure(PlayerSchema, { ...createMockPlayer({ role: PlayerRole.LOYALIST }), killCooldown: 10 });
    });

    test('Test taskProgress for loyalists', () => {
      const loyalist = createMockPlayer({
        role: PlayerRole.LOYALIST,
        taskProgress: 50,
      });
      validateSchema(PlayerSchema, loyalist);
      expect(loyalist.taskProgress).toBe(50);
    });
  });

  describe('Test 2: Room type validation', () => {
    test('Create valid room object with all required fields', () => {
      const room = createMockRoom();
      validateSchema(RoomSchema, room);

      expect(room.id).toBe(MOCK_ROOM_ID);
      expect(room.name).toBeDefined();
      expect(room.exits).toBeArray();
      expect(room.position).toBeDefined();
    });

    test('Test room exits (array of room IDs)', () => {
      const room = createMockRoom({
        exits: ['hallway_a', 'hallway_b'],
      });
      validateSchema(RoomSchema, room);
      expect(room.exits).toHaveLength(2);
      expect(room.exits).toContain('hallway_a');
    });

    test('Test interactables array', () => {
      const room = createMockRoom({
        interactables: [
          { id: 'task1', type: 'download', x: 10, y: 10 },
          { id: 'vent1', type: 'vent', x: 50, y: 50 },
        ],
      });
      validateSchema(RoomSchema, room);
      expect(room.interactables).toHaveLength(2);
      expect(room.interactables[0].type).toBe('download');
    });

    test('Test room position (x, y coordinates)', () => {
      const room = createMockRoom({
        position: { x: 100, y: 200 },
      });
      validateSchema(RoomSchema, room);
      expect(room.position.x).toBe(100);
      expect(room.position.y).toBe(200);
    });
  });

  describe('Test 3: GameState type validation', () => {
    test('Create valid game state object', () => {
      const game = createMockGameState();
      validateSchema(GameStateSchema, game);

      expect(game.phase).toBe(GamePhase.LOBBY);
      expect(game.roundNumber).toBe(1);
    });

    test('Test phase transitions (Lobby/Round/Voting/GameOver)', () => {
      const lobby = createMockGameState({ phase: GamePhase.LOBBY });
      const round = createMockGameState({ phase: GamePhase.ROUND });
      const voting = createMockGameState({ phase: GamePhase.VOTING });
      const gameOver = createMockGameState({ phase: GamePhase.GAME_OVER });

      validateSchema(GameStateSchema, lobby);
      validateSchema(GameStateSchema, round);
      validateSchema(GameStateSchema, voting);
      validateSchema(GameStateSchema, gameOver);
    });

    test('Test round number tracking', () => {
      const game = createMockGameState({ roundNumber: 5 });
      validateSchema(GameStateSchema, game);
      expect(game.roundNumber).toBe(5);
    });

    test('Test mole remaining count', () => {
      const game = createMockGameState({ moleCount: 2 });
      validateSchema(GameStateSchema, game);
      expect(game.moleCount).toBe(2);
    });

    test('Test round timer', () => {
      const game = createMockGameState({ roundTimer: 60 });
      validateSchema(GameStateSchema, game);
      expect(game.roundTimer).toBe(60);
    });

    test('Test dead bodies array', () => {
      const game = createMockGameState({
        deadBodies: [
          {
            playerId: 'dead-player-1',
            role: PlayerRole.LOYALIST,
            location: { roomId: 'electrical', x: 10, y: 10 },
            reported: false,
          },
        ],
      });
      validateSchema(GameStateSchema, game);
      expect(game.deadBodies).toHaveLength(1);
      expect(game.deadBodies[0].playerId).toBe('dead-player-1');
    });
  });

  describe('Test 4: GameEvent type system', () => {
    const validateEvent = (event: any) => {
      validateSchema(GameEventSchema, event);
    };

    test('Test PlayerJoined event structure', () => {
      const event = {
        type: EventType.PLAYER_JOINED,
        payload: {
          player: createMockPlayer(),
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test PlayerLeft event structure', () => {
      const event = {
        type: EventType.PLAYER_LEFT,
        payload: {
          playerId: MOCK_PLAYER_ID,
          reason: 'disconnect',
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test PlayerMoved event structure', () => {
      const event = {
        type: EventType.PLAYER_MOVED,
        payload: {
          playerId: MOCK_PLAYER_ID,
          newLocation: { roomId: 'medbay', x: 20, y: 20 },
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test InteractedWithButton event structure', () => {
      const event = {
        type: EventType.INTERACTED_WITH_BUTTON,
        payload: {
          playerId: MOCK_PLAYER_ID,
          buttonId: 'emergency_button',
          roomId: 'cafeteria',
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test InteractedWithLog event structure', () => {
      const event = {
        type: EventType.INTERACTED_WITH_LOG,
        payload: {
          playerId: MOCK_PLAYER_ID,
          logId: 'admin_log',
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test BodyFound event structure', () => {
      const event = {
        type: EventType.BODY_FOUND,
        payload: {
          reporterId: MOCK_PLAYER_ID,
          deadBodyId: 'dead-body-1',
          location: { roomId: 'electrical', x: 10, y: 10 },
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test CouncilCalled event structure', () => {
      const event = {
        type: EventType.COUNCIL_CALLED,
        payload: {
          callerId: MOCK_PLAYER_ID,
          reason: 'button', // or "body_found"
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test VoteCast event structure', () => {
      const event = {
        type: EventType.VOTE_CAST,
        payload: {
          voterId: MOCK_PLAYER_ID,
          targetId: 'sus-player-id', // or null for skip
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test PlayerEjected event structure', () => {
      const event = {
        type: EventType.PLAYER_EJECTED,
        payload: {
          playerId: 'ejected-player-id',
          role: PlayerRole.MOLE,
          tie: false,
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test RoundStarted event structure', () => {
      const event = {
        type: EventType.ROUND_STARTED,
        payload: {
          roundNumber: 2,
          moleCount: 1,
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test RoundEnded event structure', () => {
      const event = {
        type: EventType.ROUND_ENDED,
        payload: {
          reason: 'moles_win',
          roundNumber: 1,
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test GameEnded event structure', () => {
      const event = {
        type: EventType.GAME_ENDED,
        payload: {
          winner: PlayerRole.MOLE, // or "moles"
          reason: 'sabotage_success',
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });

    test('Test RoleRevealed event structure', () => {
      // This might happen at game end or during special phases
      const event = {
        type: EventType.ROLE_REVEALED,
        payload: {
          playerId: MOCK_PLAYER_ID,
          role: PlayerRole.MOLE,
        },
        timestamp: Date.now(),
      };
      validateEvent(event);
    });
  });
});
