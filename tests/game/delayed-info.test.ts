import { describe, expect, test, beforeEach } from 'bun:test';
import { PendingRevealQueue } from '@/game/pending-reveal-queue';
import { RoomManager } from '@/game/rooms';
import { GameState } from '@/game/state';
import { PendingReveal, REVEAL_DELAY_TICKS, MovementDirection, PlayerStatus, PlayerRole } from '@/types/game';
import { createMockPlayer } from '../framework/test_base';

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
    expect(queue.getPendingRevealsForRoom('center')).toHaveLength(0);
    expect(queue.getPendingRevealsForRoom('electrical-room')).toHaveLength(0);
    expect(queue.size()).toBe(0);
  });

  test('size returns total count of pending reveals', () => {
    expect(queue.size()).toBe(0);

    queue.queueReveal('player-1', 'center', 'east', 'enter');
    expect(queue.size()).toBe(1);

    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    expect(queue.size()).toBe(2);
  });

  test('clear resets queue state for reuse', () => {
    queue.queueReveal('player-1', 'center', 'east', 'enter');
    queue.queueReveal('player-2', 'electrical-room', 'west', 'leave');
    queue.clear();

    // After clear, queue should be ready for new reveals
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

describe('GameState.getOppositeDirection', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  test('returns south for north', () => {
    expect(gameState.getOppositeDirection('north')).toBe('south');
  });

  test('returns north for south', () => {
    expect(gameState.getOppositeDirection('south')).toBe('north');
  });

  test('returns west for east', () => {
    expect(gameState.getOppositeDirection('east')).toBe('west');
  });

  test('returns east for west', () => {
    expect(gameState.getOppositeDirection('west')).toBe('east');
  });
});

describe('GameState movement reveal integration', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    gameState.setPhase('ROUND' as any);
  });

  test('movePlayer queues leave reveal in source room with opposite direction', () => {
    const player = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player);

    // Move from center (0,0) to electrical-room (1,0) - east direction
    gameState.movePlayer('player-1', 'electrical-room');

    // Check source room (center) has leave reveal with west (opposite of east)
    const sourceReveals = gameState.getPendingRevealQueue().getPendingRevealsForRoom('center');
    expect(sourceReveals).toHaveLength(1);
    expect(sourceReveals[0].type).toBe('leave');
    expect(sourceReveals[0].direction).toBe('west');
    expect(sourceReveals[0].playerId).toBe('player-1');
  });

  test('movePlayer queues enter reveal in destination room with movement direction', () => {
    const player = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player);

    // Move from center (0,0) to electrical-room (1,0) - east direction
    gameState.movePlayer('player-1', 'electrical-room');

    // Check destination room has enter reveal with east direction
    const destReveals = gameState.getPendingRevealQueue().getPendingRevealsForRoom('electrical-room');
    expect(destReveals).toHaveLength(1);
    expect(destReveals[0].type).toBe('enter');
    expect(destReveals[0].direction).toBe('east');
    expect(destReveals[0].playerId).toBe('player-1');
  });

  test('movePlayer queues reveals in both source and destination rooms', () => {
    const player = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player);

    // Move from center to electrical-room
    gameState.movePlayer('player-1', 'electrical-room');

    // Both rooms should have pending reveals
    const queue = gameState.getPendingRevealQueue();
    expect(queue.size()).toBe(2);
  });

  test('movePlayer north queues correct directions', () => {
    const player = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player);

    // Move from center (0,0) to hallway-north (0,1) - north direction
    gameState.movePlayer('player-1', 'hallway-north');

    const sourceReveals = gameState.getPendingRevealQueue().getPendingRevealsForRoom('center');
    expect(sourceReveals[0].direction).toBe('south'); // opposite of north

    const destReveals = gameState.getPendingRevealQueue().getPendingRevealsForRoom('hallway-north');
    expect(destReveals[0].direction).toBe('north');
  });
});

describe('GameState.getPlayersVisibleInRoom', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  test('player with pending enter reveal is not visible', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player1);

    // Queue an enter reveal for player1
    gameState.getPendingRevealQueue().queueReveal('player-1', 'center', 'east', 'enter');

    // Player should not be visible
    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible).toHaveLength(0);
  });

  test('player with pending leave reveal is still visible', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player1);

    // Queue a leave reveal for player1
    gameState.getPendingRevealQueue().queueReveal('player-1', 'center', 'west', 'leave');

    // Player should still be visible (only enter reveals hide players)
    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('player-1');
  });

  test('player without pending reveals is visible', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player1);

    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('player-1');
  });

  test('multiple players with mixed reveal states', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    const player2 = createMockPlayer({ id: 'player-2', location: { roomId: 'center', x: 0, y: 0 } });
    const player3 = createMockPlayer({ id: 'player-3', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player1);
    gameState.addPlayer(player2);
    gameState.addPlayer(player3);

    // player1: pending enter (hidden)
    gameState.getPendingRevealQueue().queueReveal('player-1', 'center', 'east', 'enter');
    // player2: pending leave (visible)
    gameState.getPendingRevealQueue().queueReveal('player-2', 'center', 'west', 'leave');
    // player3: no reveal (visible)

    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible).toHaveLength(2);
    const visibleIds = visible.map(p => p.id);
    expect(visibleIds).toContain('player-2');
    expect(visibleIds).toContain('player-3');
    expect(visibleIds).not.toContain('player-1');
  });

  test('player in different room is not visible', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'electrical-room', x: 1, y: 0 } });
    gameState.addPlayer(player1);

    const visible = gameState.getPlayersVisibleInRoom('center');
    expect(visible).toHaveLength(0);
  });

  test('player becomes visible after reveal countdown completes', () => {
    const player1 = createMockPlayer({ id: 'player-1', location: { roomId: 'center', x: 0, y: 0 } });
    gameState.addPlayer(player1);

    // Queue an enter reveal
    gameState.getPendingRevealQueue().queueReveal('player-1', 'center', 'east', 'enter');

    // Player should be hidden
    expect(gameState.getPlayersVisibleInRoom('center')).toHaveLength(0);

    // Decrement until ready
    gameState.getPendingRevealQueue().decrementAll();
    gameState.getPendingRevealQueue().decrementAll();

    // Now the reveal is ready (ticksRemaining === 0), but getPendingRevealsForRoom filters to > 0
    // So the player should now be visible
    expect(gameState.getPlayersVisibleInRoom('center')).toHaveLength(1);
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

  describe('horizontal priority (dx over dy)', () => {
    // These tests verify that horizontal (dx) direction is prioritized over vertical (dy)
    // when both are non-zero. The current room layout has no diagonal paths,
    // but this documents the dx-priority behavior in the implementation:
    // if (dx > 0) return 'east'; else if (dx < 0) return 'west';
    // else if (dy > 0) return 'north'; else if (dy < 0) return 'south';

    test('horizontal east movement is detected correctly', () => {
      const direction = roomManager.getDirection('center', 'electrical-room');
      expect(direction).toBe('east');
    });

    test('horizontal west movement is detected correctly', () => {
      const direction = roomManager.getDirection('center', 'hallway-west');
      expect(direction).toBe('west');
    });
  });
});
