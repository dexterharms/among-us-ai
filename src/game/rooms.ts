import { Room, MovementDirection, MapDefinition } from '@/types/game';
import { logger } from '@/utils/logger';

export class RoomManager {
  private rooms: Map<string, Room>;
  private mapId: string;

  constructor(map: MapDefinition) {
    this.mapId = map.id;
    // Create deep copies of rooms to prevent shared mutable state across tests
    this.rooms = new Map(
      map.rooms.map((room) => [
        room.id,
        {
          ...room,
          interactables: [...room.interactables],
        },
      ]),
    );
  }

  getMapId(): string {
    return this.mapId;
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
