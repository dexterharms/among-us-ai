import { describe, it, expect, beforeEach } from 'bun:test';
import { TickProcessor, TICK_INTERVAL_MS, ACTION_TIMEOUT_MS } from '@/tick/processor';
import { GameState } from '@/game/state';
import { SSEManager } from '@/sse/manager';
import { Player, PlayerStatus, PlayerRole } from '@/types/game';
import { QueuedAction } from '@/tick/queue';

describe('TickProcessor - Ghost Actions', () => {
  let gameState: GameState;
  let sseManager: SSEManager;
  let processor: TickProcessor;

  beforeEach(() => {
    gameState = new GameState();
    sseManager = new SSEManager();
    processor = new TickProcessor(gameState, sseManager);

    // Add some players
    const alivePlayer: Player = {
      id: 'alive-player',
      name: 'Alive Crewmate',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'cafeteria', x: 10, y: 10 },
    };

    const deadPlayer: Player = {
      id: 'dead-player',
      name: 'Dead Crewmate',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.DEAD,
      location: { roomId: 'cafeteria', x: 20, y: 20 },
    };

    const ejectedPlayer: Player = {
      id: 'ejected-player',
      name: 'Ejected Crewmate',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.EJECTED,
      location: { roomId: 'cafeteria', x: 30, y: 30 },
    };

    gameState.players.set('alive-player', alivePlayer);
    gameState.players.set('dead-player', deadPlayer);
    gameState.players.set('ejected-player', ejectedPlayer);
  });

  describe('queueAction - ghost validation', () => {
    it('should allow ghosts to queue move actions', () => {
      // Transition player to WAITING state (as if prompted)
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'move',
        timestamp: Date.now(),
        payload: { targetRoomId: 'medbay' },
      };

      // Queue the action
      processor['queueAction'](action);

      // Action should be in queue
      expect(processor['actionQueue'].size()).toBe(1);
    });

    it('should allow ghosts to queue task actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'task',
        timestamp: Date.now(),
        payload: { taskId: 'fix-wires' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(1);
    });

    it('should allow ghosts to queue vent actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'vent',
        timestamp: Date.now(),
        payload: { targetRoomId: 'security' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(1);
    });

    it('should allow ghosts to queue log actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'log',
        timestamp: Date.now(),
        payload: { logId: 'security-log-1' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(1);
    });

    it('should reject ghost attempts to queue kill actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'kill',
        timestamp: Date.now(),
        payload: { targetId: 'alive-player' },
      };

      processor['queueAction'](action);

      // Action should NOT be in queue
      expect(processor['actionQueue'].size()).toBe(0);
    });

    it('should reject ghost attempts to queue report actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'report',
        timestamp: Date.now(),
        payload: { bodyId: 'body-1' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(0);
    });

    it('should reject ghost attempts to queue vote actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'vote',
        timestamp: Date.now(),
        payload: { targetId: 'alive-player' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(0);
    });

    it('should reject ghost attempts to queue button actions', () => {
      processor['stateMachine'].transition('dead-player', 'Waiting' as any);

      const action: QueuedAction = {
        playerId: 'dead-player',
        action: 'button',
        timestamp: Date.now(),
        payload: { buttonId: 'self-destruct' },
      };

      processor['queueAction'](action);
      expect(processor['actionQueue'].size()).toBe(0);
    });

    it('should allow alive players to queue all actions', () => {
      processor['stateMachine'].transition('alive-player', 'Waiting' as any);

      const actions: QueuedAction[] = [
        { playerId: 'alive-player', action: 'move', timestamp: Date.now(), payload: { targetRoomId: 'medbay' } },
        { playerId: 'alive-player', action: 'task', timestamp: Date.now(), payload: { taskId: 'fix-wires' } },
        { playerId: 'alive-player', action: 'report', timestamp: Date.now(), payload: { bodyId: 'body-1' } },
      ];

      actions.forEach(action => processor['queueAction'](action));

      expect(processor['actionQueue'].size()).toBe(3);
    });

    it('should treat ejected players same as dead for action validation', () => {
      processor['stateMachine'].transition('ejected-player', 'Waiting' as any);

      const validAction: QueuedAction = {
        playerId: 'ejected-player',
        action: 'task',
        timestamp: Date.now(),
        payload: { taskId: 'fix-wires' },
      };

      const invalidAction: QueuedAction = {
        playerId: 'ejected-player',
        action: 'kill',
        timestamp: Date.now(),
        payload: { targetId: 'alive-player' },
      };

      processor['queueAction'](validAction);
      processor['queueAction'](invalidAction);

      // Only the valid action should be queued
      expect(processor['actionQueue'].size()).toBe(1);
    });
  });
});
