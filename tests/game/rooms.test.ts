import { describe, test, expect, beforeEach } from 'bun:test';
import { RoomManager } from '@/game/rooms';
import { TEST_MAP } from '@/game/maps';
import type { Room } from '@/types/game';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager(TEST_MAP);
  });

  describe('Initialization', () => {
    test('should initialize with all map rooms', () => {
      const rooms = roomManager.getRooms();
      expect(rooms.length).toBe(TEST_MAP.rooms.length);
    });

    test('should store map ID', () => {
      expect(roomManager.getMapId()).toBe('test-map');
    });

    test('should have all expected rooms', () => {
      const rooms = roomManager.getRooms();
      const roomIds = rooms.map((r) => r.id);

      expect(roomIds).toContain('center');
      expect(roomIds).toContain('hallway-west');
      expect(roomIds).toContain('council-room');
      expect(roomIds).toContain('hallway-north');
      expect(roomIds).toContain('logs-room');
      expect(roomIds).toContain('electrical-room');
    });
  });

  describe('getRoom', () => {
    test('should return room by valid ID', () => {
      const room = roomManager.getRoom('center');
      expect(room).toBeDefined();
      expect(room?.id).toBe('center');
      expect(room?.name).toBe('Central Hall');
    });

    test('should return undefined for invalid room ID', () => {
      const room = roomManager.getRoom('non-existent-room');
      expect(room).toBeUndefined();
    });

    test('should return room with all properties', () => {
      const room = roomManager.getRoom('center') as Room;

      expect(room.id).toBe('center');
      expect(room.name).toBe('Central Hall');
      expect(room.exits).toBeArray();
      expect(room.interactables).toBeArray();
      expect(room.position).toBeDefined();
      expect(room.position.x).toBeNumber();
      expect(room.position.y).toBeNumber();
    });

    test('should return room with correct exits', () => {
      const room = roomManager.getRoom('center') as Room;

      expect(room.exits).toContain('hallway-west');
      expect(room.exits).toContain('hallway-north');
      expect(room.exits).toContain('electrical-room');
    });

    test('should return room with interactables', () => {
      const room = roomManager.getRoom('council-room') as Room;

      expect(room.interactables.length).toBeGreaterThan(0);
      expect(room.interactables[0].id).toBe('emergency-button');
      expect(room.interactables[0].type).toBe('Button');
    });

    test('should return room with correct position', () => {
      const room = roomManager.getRoom('center') as Room;

      expect(room.position.x).toBe(0);
      expect(room.position.y).toBe(0);
    });
  });

  describe('getRooms', () => {
    test('should return array of all rooms', () => {
      const rooms = roomManager.getRooms();

      expect(rooms).toBeArray();
      expect(rooms.length).toBeGreaterThan(0);
    });

    test('should return mutable array copy', () => {
      const rooms1 = roomManager.getRooms();
      const rooms2 = roomManager.getRooms();

      expect(rooms1).toEqual(rooms2);
      expect(rooms1 === rooms2).toBe(false); // Different array references
    });

    test('should have all required room properties', () => {
      const rooms = roomManager.getRooms();

      rooms.forEach((room) => {
        expect(room.id).toBeString();
        expect(room.name).toBeString();
        expect(room.exits).toBeArray();
        expect(room.interactables).toBeArray();
        expect(room.position).toBeDefined();
        expect(room.position.x).toBeNumber();
        expect(room.position.y).toBeNumber();
      });
    });

    test('should have unique room IDs', () => {
      const rooms = roomManager.getRooms();
      const roomIds = rooms.map((r) => r.id);
      const uniqueIds = new Set(roomIds);

      expect(uniqueIds.size).toBe(roomIds.length);
    });
  });

  describe('validateMovement', () => {
    test('should allow movement to valid exit', () => {
      const isValid = roomManager.validateMovement('center', 'hallway-west');
      expect(isValid).toBe(true);
    });

    test('should allow movement to all valid exits from center', () => {
      expect(roomManager.validateMovement('center', 'hallway-west')).toBe(true);
      expect(roomManager.validateMovement('center', 'hallway-north')).toBe(true);
      expect(roomManager.validateMovement('center', 'electrical-room')).toBe(true);
    });

    test('should deny movement to non-existent exit', () => {
      const isValid = roomManager.validateMovement('center', 'non-existent');
      expect(isValid).toBe(false);
    });

    test('should deny movement from invalid source room', () => {
      const isValid = roomManager.validateMovement('non-existent', 'center');
      expect(isValid).toBe(false);
    });

    test('should deny movement between unconnected rooms', () => {
      const isValid = roomManager.validateMovement('council-room', 'logs-room');
      expect(isValid).toBe(false);
    });

    test('should allow movement from hallway-west to council-room', () => {
      const isValid = roomManager.validateMovement('hallway-west', 'council-room');
      expect(isValid).toBe(true);
    });

    test('should allow bidirectional movement between connected rooms', () => {
      expect(roomManager.validateMovement('center', 'hallway-west')).toBe(true);
      expect(roomManager.validateMovement('hallway-west', 'center')).toBe(true);

      expect(roomManager.validateMovement('center', 'hallway-north')).toBe(true);
      expect(roomManager.validateMovement('hallway-north', 'center')).toBe(true);
    });

    test('should allow movement from hallway-north to logs-room', () => {
      const isValid = roomManager.validateMovement('hallway-north', 'logs-room');
      expect(isValid).toBe(true);
    });

    test('should allow movement from center to electrical-room', () => {
      const isValid = roomManager.validateMovement('center', 'electrical-room');
      expect(isValid).toBe(true);
    });
  });

  describe('Room Layout Consistency', () => {
    test('should have consistent exit relationships', () => {
      // If room A has room B in exits, room B should have room A in exits
      const rooms = roomManager.getRooms();

      rooms.forEach((room) => {
        room.exits.forEach((exitId) => {
          const exitRoom = roomManager.getRoom(exitId);
          if (exitRoom) {
            expect(exitRoom.exits).toContain(room.id);
          }
        });
      });
    });

    test('should have logical position relationships', () => {
      const center = roomManager.getRoom('center');
      const hallwayWest = roomManager.getRoom('hallway-west');
      const councilRoom = roomManager.getRoom('council-room');

      // Rooms should be positioned logically based on connections
      expect(center?.position.x).toBe(0);
      expect(center?.position.y).toBe(0);
      expect(hallwayWest?.position.x).toBe(-1);
      expect(councilRoom?.position.x).toBe(-2);
    });
  });

  describe('Room Interactables', () => {
    test('should have emergency button in council-room', () => {
      const room = roomManager.getRoom('council-room') as Room;
      const button = room.interactables.find((i) => i.id === 'emergency-button');

      expect(button).toBeDefined();
      expect(button?.type).toBe('Button');
      expect(button?.name).toBe('Emergency Button');
    });

    test('center room should not have emergency button', () => {
      const room = roomManager.getRoom('center') as Room;
      const button = room.interactables.find((i) => i.id === 'emergency-button');

      expect(button).toBeUndefined();
    });

    test('should have logs in logs-room', () => {
      const room = roomManager.getRoom('logs-room') as Room;
      const logs = room.interactables.find((i) => i.id === 'ship-logs');

      expect(logs).toBeDefined();
      expect(logs?.type).toBe('Log');
      expect(logs?.name).toBe('Ship Logs');
    });

    test('should have task in electrical-room', () => {
      const room = roomManager.getRoom('electrical-room') as Room;
      const task = room.interactables.find((i) => i.id === 'rewire-task');

      expect(task).toBeDefined();
      expect(task?.type).toBe('Task');
      expect(task?.name).toBe('Rewire');
    });

    test('should have hallways without interactables', () => {
      const hallwayWest = roomManager.getRoom('hallway-west') as Room;
      const hallwayNorth = roomManager.getRoom('hallway-north') as Room;

      expect(hallwayWest.interactables).toHaveLength(0);
      expect(hallwayNorth.interactables).toHaveLength(0);
    });
  });
});
