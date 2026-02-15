import { describe, test, expect } from 'bun:test';
import { PlayerSchema } from '@/types/game';

describe('PlayerSchema', () => {
  test('should accept emergencyMeetingsUsed field', () => {
    const player = {
      id: 'p1',
      name: 'Test',
      role: 'Loyalist',
      status: 'Alive',
      location: { roomId: 'room1', x: 0, y: 0 },
      emergencyMeetingsUsed: 1,
    };
    const result = PlayerSchema.safeParse(player);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emergencyMeetingsUsed).toBe(1);
    }
  });

  test('should default emergencyMeetingsUsed to 0 when not provided', () => {
    const player = {
      id: 'p1',
      name: 'Test',
      role: 'Loyalist',
      status: 'Alive',
      location: { roomId: 'room1', x: 0, y: 0 },
    };
    const result = PlayerSchema.safeParse(player);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emergencyMeetingsUsed).toBe(0);
    }
  });

  test('should reject negative emergencyMeetingsUsed', () => {
    const player = {
      id: 'p1',
      name: 'Test',
      role: 'Loyalist',
      status: 'Alive',
      location: { roomId: 'room1', x: 0, y: 0 },
      emergencyMeetingsUsed: -1,
    };
    const result = PlayerSchema.safeParse(player);
    expect(result.success).toBe(false);
  });
});
