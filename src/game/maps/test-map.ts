import type { MapDefinition } from './types';

/**
 * The Manor - the first map for Double Agent
 * A sprawling estate with hidden passages and dark corners
 */
export const TEST_MAP: MapDefinition = {
  id: 'the-manor',
  name: 'The Manor',
  description: 'A sprawling estate with hidden passages and dark corners',

  rooms: [
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
  ],

  // No vents on test map
  vents: {},

  // Sabotage locations
  sabotageLocations: [
    { type: 'lights', roomId: 'electrical-room' },
    { type: 'doors', roomId: 'council-room', targetRoomId: 'hallway-west' },
    { type: 'self-destruct', roomId: 'electrical-room' },
  ],

  // Special rooms
  emergencyButtonRoom: 'council-room',
  logsRoom: 'logs-room',
};
