import { describe, it, expect, beforeEach } from 'bun:test';
import { ActionQueue, QueuedAction } from '@/tick/queue';

describe('ActionQueue', () => {
  let queue: ActionQueue;

  beforeEach(() => {
    queue = new ActionQueue();
  });

  describe('enqueue', () => {
    it('should add an action to the queue', () => {
      const action: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: Date.now(),
        payload: { targetRoomId: 'room2' },
      };

      queue.enqueue(action);

      expect(queue.size()).toBe(1);
    });

    it('should maintain order of enqueued actions', () => {
      const action1: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: 1000,
        payload: { targetRoomId: 'room2' },
      };
      const action2: QueuedAction = {
        playerId: 'player2',
        action: 'move',
        timestamp: 2000,
        payload: { targetRoomId: 'room3' },
      };

      queue.enqueue(action1);
      queue.enqueue(action2);

      const actions = queue.dequeueAll();
      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual(action1);
      expect(actions[1]).toEqual(action2);
    });

    it('should handle multiple actions from same player', () => {
      const action1: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: 1000,
        payload: { targetRoomId: 'room2' },
      };
      const action2: QueuedAction = {
        playerId: 'player1',
        action: 'task',
        timestamp: 1500,
        payload: { taskId: 'task1' },
      };

      queue.enqueue(action1);
      queue.enqueue(action2);

      expect(queue.size()).toBe(2);
    });
  });

  describe('dequeueAll', () => {
    it('should remove all actions from queue', () => {
      const action1: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: 1000,
        payload: { targetRoomId: 'room2' },
      };
      const action2: QueuedAction = {
        playerId: 'player2',
        action: 'move',
        timestamp: 2000,
        payload: { targetRoomId: 'room3' },
      };

      queue.enqueue(action1);
      queue.enqueue(action2);

      const actions = queue.dequeueAll();

      expect(actions).toHaveLength(2);
      expect(queue.size()).toBe(0);
    });

    it('should return actions in order of submission', () => {
      const action1: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: 1000,
        payload: { targetRoomId: 'room2' },
      };
      const action2: QueuedAction = {
        playerId: 'player2',
        action: 'move',
        timestamp: 1500,
        payload: { targetRoomId: 'room3' },
      };
      const action3: QueuedAction = {
        playerId: 'player3',
        action: 'vote',
        timestamp: 2000,
        payload: { targetId: 'player1' },
      };

      queue.enqueue(action1);
      queue.enqueue(action2);
      queue.enqueue(action3);

      const actions = queue.dequeueAll();

      expect(actions[0].playerId).toBe('player1');
      expect(actions[1].playerId).toBe('player2');
      expect(actions[2].playerId).toBe('player3');
    });

    it('should return empty array when queue is empty', () => {
      const actions = queue.dequeueAll();

      expect(actions).toHaveLength(0);
      expect(actions).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return correct size after enqueuing', () => {
      const action: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: Date.now(),
        payload: { targetRoomId: 'room2' },
      };

      queue.enqueue(action);

      expect(queue.size()).toBe(1);
    });

    it('should return 0 after dequeuing all', () => {
      const action: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: Date.now(),
        payload: { targetRoomId: 'room2' },
      };

      queue.enqueue(action);
      queue.dequeueAll();

      expect(queue.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all actions from queue', () => {
      const action1: QueuedAction = {
        playerId: 'player1',
        action: 'move',
        timestamp: 1000,
        payload: { targetRoomId: 'room2' },
      };
      const action2: QueuedAction = {
        playerId: 'player2',
        action: 'move',
        timestamp: 2000,
        payload: { targetRoomId: 'room3' },
      };

      queue.enqueue(action1);
      queue.enqueue(action2);
      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.dequeueAll()).toEqual([]);
    });
  });
});
