// src/game/maps/types.ts
import { z } from 'zod';
import type { Room } from '@/types/game';

/**
 * Sabotage location configuration for a map
 */
export const SabotageLocationSchema = z.object({
  type: z.enum(['lights', 'doors', 'self-destruct']),
  roomId: z.string(),
  targetRoomId: z.string().optional(),
});

export type SabotageLocation = z.infer<typeof SabotageLocationSchema>;

/**
 * Vent connection configuration for a room
 */
export const VentConnectionSchema = z.object({
  connectsTo: z.array(z.string()),
});

export type VentConnection = z.infer<typeof VentConnectionSchema>;

/**
 * Complete map definition including rooms, vents, sabotage locations, and special rooms
 * Note: We use z.any() for rooms to avoid circular dependency with RoomSchema in game.ts
 * Room validation is done separately when processing rooms.
 */
export const MapDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rooms: z.array(z.any()), // Avoid circular import - rooms are validated separately
  vents: z.record(z.string(), VentConnectionSchema).optional(),
  sabotageLocations: z.array(SabotageLocationSchema),
  emergencyButtonRoom: z.string(),
  logsRoom: z.string(),
});

export type MapDefinition = z.infer<typeof MapDefinitionSchema> & {
  rooms: Room[];
};
