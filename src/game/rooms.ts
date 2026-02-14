import { Room, MovementDirection } from '@/types/game';
import { logger } from '@/utils/logger';

export const ROOMS: Room[] = [
  {
    id: 'center',
    name: 'Central Hall',
    exits: ['hallway-west', 'hallway-north', 'electrical-room'],
    interactables: [],
    position: { x: 0, y: 0 },
  },
  {
    id: 'hallway-west',
    name: 'West Hallway',
    exits: ['center', 'council-room'],
    interactables: [],
    position: { x: -1, y: 0 },
  },
  {
    id: 'council-room',
    name: 'Council Room',
    exits: ['hallway-west'],
    interactables: [
      {
        id: 'emergency-button',
        type: 'Button',
        name: 'Emergency Button',
        action: 'Call Council',
      },
    ],
    position: { x: -2, y: 0 },
  },
  {
    id: 'hallway-north',
    name: 'North Hallway',
    exits: ['center', 'logs-room'],
    interactables: [],
    position: { x: 0, y: 1 },
  },
  {
    id: 'logs-room',
    name: 'Logs Room',
    exits: ['hallway-north'],
    interactables: [
      {
        id: 'ship-logs',
        type: 'Log',
        name: 'Ship Logs',
        action: 'View Logs',
      },
    ],
    position: { x: 0, y: 2 },
  },
  {
    id: 'electrical-room',
    name: 'Electrical',
    exits: ['center'],
    interactables: [
      {
        id: 'rewire-task',
        type: 'Task',
        name: 'Rewire',
        action: 'Fix Wiring',
      },
    ],
    position: { x: 1, y: 0 },
  },
];

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    // Create deep copies of rooms to prevent shared mutable state across tests
    this.rooms = new Map(
      ROOMS.map((room) => [
        room.id,
        {
          ...room,
          interactables: [...room.interactables], // Copy interactables array
        },
      ]),
    );
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  validateMovement(from: string, to: string): boolean {
    const fromRoom = this.getRoom(from);
    if (!fromRoom) return false;
    return fromRoom.exits.includes(to);
  }

  getDirection(fromRoomId: string, toRoomId: string): MovementDirection | null {
    const fromRoom = this.getRoom(fromRoomId);
    const toRoom = this.getRoom(toRoomId);

    // Handle null/undefined room lookup gracefully
    if (!fromRoom || !toRoom) {
      logger.debug('Direction calculation: room not found', {
        fromRoomId,
        toRoomId,
        fromRoomExists: !!fromRoom,
        toRoomExists: !!toRoom,
      });
      return null;
    }

    // Calculate position differences
    const dx = toRoom.position.x - fromRoom.position.x;
    const dy = toRoom.position.y - fromRoom.position.y;

    // Check if rooms are at same position
    if (dx === 0 && dy === 0) {
      logger.debug('Direction calculation: rooms at same position', {
        fromRoomId,
        toRoomId,
        position: fromRoom.position,
      });
      return null;
    }

    // Determine direction based on position differences
    let direction: MovementDirection | null = null;
    if (dx > 0) {
      direction = 'east';
    } else if (dx < 0) {
      direction = 'west';
    } else if (dy > 0) {
      direction = 'north';
    } else if (dy < 0) {
      direction = 'south';
    }

    logger.debug('Direction calculated', {
      fromRoomId,
      toRoomId,
      dx,
      dy,
      direction,
    });

    return direction;
  }
}
