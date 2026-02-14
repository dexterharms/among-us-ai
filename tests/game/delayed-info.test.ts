import { describe, expect, test, beforeEach } from 'bun:test';
import { PendingRevealQueue } from '@/game/pending-reveal-queue';
import { RoomManager } from '@/game/rooms';
import { PendingReveal, REVEAL_DELAY_TICKS } from '@/types/game';

describe('PendingRevealQueue', () => {
  let queue: PendingRevealQueue;

  beforeEach(() => {
    queue = new PendingRevealQueue();
  });

  test('queueReveal adds a reveal with correct ticks', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending).toHaveLength(1);
    expect(pending[0].ticksRemaining).toBe(REVEAL_DELAY_TICKS);
  });

  test('getPendingRevealsForRoom returns only reveals for that room', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'enter');

    const centerReveals = queue.getPendingRevealsForRoom('center');
    expect(centerReveals).toHaveLength(1);
    expect(centerReveals[0].playerId).toBe('player-1');
  });

  test('decrementAll reduces ticksRemaining for all reveals', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending[0].ticksRemaining).toBe(1);
  });

  test('getReadyReveals returns reveals with ticksRemaining === 0', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    queue.decrementAll();

    const ready = queue.getReadyReveals();
    expect(ready).toHaveLength(1);
    expect(ready[0].playerId).toBe('player-1');
  });

  test('removeReveal removes specific reveal', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    const reveal = queue.getPendingRevealsForRoom('center')[0];
    queue.removeReveal(reveal);

    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending).toHaveLength(0);
  });

  test('clear removes all reveals', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    queue.clear();

    expect(queue.getReadyReveals()).toHaveLength(0);
  });

  test('size returns total count of pending reveals', () => {
    expect(queue.size()).toBe(0);

    queue.queueReveal('player-1', 'center', 'east', 'enter');
    expect(queue.size()).toBe(1);

    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    expect(queue.size()).toBe(2);
  });

  test('clear resets nextId counter', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    queue.clear();

    // After clear, new reveals should start from id 0 again
    queue.queueReveal('player-3', 'hallway-north', 'south', 'enter');
    expect(queue.size()).toBe(1);
  });

  test('getPendingRevealsForRoom excludes reveals with ticksRemaining === 0', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    queue.decrementAll();

    const pending = queue.getPendingRevealsForRoom('center');
    expect(pending).toHaveLength(0);
  });

  test('decrementAll does not go below zero', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.decrementAll();
    queue.decrementAll();
    queue.decrementAll(); // Extra decrement

    // After extra decrement, ticksRemaining should still be 0, not negative
    const ready = queue.getReadyReveals();
    expect(ready).toHaveLength(1);
    expect(ready[0].ticksRemaining).toBe(0);
  });
});

describe('RoomManager.getDirection', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('cardinal directions', () => {
    test('returns east for movement to positive x direction', () => {
      // center (0, 0) -> electrical-room (1, 0)
      const direction = roomManager.getDirection('center', 'electrical-room');
      expect(direction).toBe('east');
    });

    test('returns west for movement to negative x direction', () => {
      // center (0, 0) -> hallway-west (-1, 0)
      const direction = roomManager.getDirection('center', 'hallway-west');
      expect(direction).toBe('west');
    });

    test('returns north for movement to positive y direction', () => {
      // center (0, 0) -> hallway-north (0, 1)
      const direction = roomManager.getDirection('center', 'hallway-north');
      expect(direction).toBe('north');
    });

    test('returns south for movement to negative y direction', () => {
      // hallway-north (0, 1) -> center (0, 0)
      const direction = roomManager.getDirection('hallway-north', 'center');
      expect(direction).toBe('south');
    });
  });

  describe('edge cases', () => {
    test('returns null when rooms have same position', () => {
      // Same room lookup
      const direction = roomManager.getDirection('center', 'center');
      expect(direction).toBeNull();
    });

    test('returns null when from room does not exist', () => {
      const direction = roomManager.getDirection('nonexistent-room', 'center');
      expect(direction).toBeNull();
    });

    test('returns null when to room does not exist', () => {
      const direction = roomManager.getDirection('center', 'nonexistent-room');
      expect(direction).toBeNull();
    });

    test('returns null when both rooms do not exist', () => {
      const direction = roomManager.getDirection('foo', 'bar');
      expect(direction).toBeNull();
    });
  });

  describe('complex movements', () => {
    test('returns correct direction for multi-hop movements', () => {
      // center -> council-room via hallway-west
      // center (0, 0) -> council-room (-2, 0) should be 'west'
      const direction = roomManager.getDirection('center', 'council-room');
      expect(direction).toBe('west');
    });

    test('returns correct direction for deeper room navigation', () => {
      // center (0, 0) -> logs-room (0, 2) should be 'north'
      const direction = roomManager.getDirection('center', 'logs-room');
      expect(direction).toBe('north');
    });
  });
});
