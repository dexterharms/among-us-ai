// src/game/maps/types.ts
import { z } from 'zod';
import { RoomSchema } from '@/types/game';

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
 */
export const MapDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rooms: z.array(RoomSchema),
  vents: z.record(z.string(), VentConnectionSchema).optional(),
  sabotageLocations: z.array(SabotageLocationSchema),
  emergencyButtonRoom: z.string(),
  logsRoom: z.string(),
});

export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
