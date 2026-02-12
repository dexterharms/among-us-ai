import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { GameState } from '@/game/state';
import { SSEManager } from '@/sse/manager';
import { SabotageSystem, SabotageType } from '@/game/sabotage';
import { PlayerRole, PlayerStatus, GamePhase } from '@/types/game';

describe('SabotageSystem', () => {
  let gameState: GameState;
  let sseManager: SSEManager;
  let sabotageSystem: SabotageSystem;
  let imposter: any;
  let crewmate: any;
  let crewmate2: any;

  beforeEach(() => {
    gameState = new GameState();
    sseManager = new SSEManager();

    // Mock the broadcast method
    vi.spyOn(sseManager, 'broadcast');
    vi.spyOn(sseManager, 'sendTo');

    sabotageSystem = new SabotageSystem(gameState, sseManager);

    // Create test players
    imposter = {
      id: 'imposter-1',
      name: 'Imposter One',
      role: PlayerRole.IMPOSTER,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'room-0', x: 0, y: 0 },
      tasks: [],
    };

    crewmate = {
      id: 'crewmate-1',
      name: 'Crewmate One',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'room-0', x: 0, y: 0 },
      tasks: [],
    };

    crewmate2 = {
      id: 'crewmate-2',
      name: 'Crewmate Two',
      role: PlayerRole.CREWMATE,
      status: PlayerStatus.ALIVE,
      location: { roomId: 'room-1', x: 0, y: 0 },
      tasks: [],
    };

    gameState.addPlayer(imposter);
    gameState.addPlayer(crewmate);
    gameState.addPlayer(crewmate2);
  });

  afterEach(() => {
    gameState.cleanup();
    sabotageSystem.cleanup();
  });

  describe('attemptSabotage - Validation', () => {
    it('should reject sabotage from non-existent player', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const result = freshSystem.attemptSabotage(
        'non-existent',
        SabotageType.LIGHTS
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not found');

      freshSystem.cleanup();
    });

    it('should enforce sabotage cooldown', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      // First sabotage should succeed
      const result1 = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );
      expect(result1.success).toBe(true);

      // Immediate second sabotage should fail due to cooldown
      const result2 = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );
      expect(result2.success).toBe(false);
      expect(result2.reason).toContain('Sabotage on cooldown');

      freshSystem.cleanup();
    });

    it('should reject sabotage from crewmate', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const result = freshSystem.attemptSabotage(
        'crewmate-1',
        SabotageType.LIGHTS
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Only imposters can sabotage');

      freshSystem.cleanup();
    });

    it('should reject sabotage from dead imposter', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      imposter.status = PlayerStatus.DEAD;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Dead imposters cannot sabotage');

      // Reset status
      imposter.status = PlayerStatus.ALIVE;
      freshSystem.cleanup();
    });

    it('should reject sabotage during non-round phase', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.LOBBY;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Can only sabotage during round phase');
      gameState.phase = GamePhase.ROUND;
      freshSystem.cleanup();
    });

    it('should allow sabotage after cooldown expires', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      // First sabotage
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      // Set cooldown to a past time (simulating time passing)
      const cooldowns = (freshSystem as any).sabotageCooldowns;
      cooldowns.set('imposter-1', Date.now() - 1000);

      // Should succeed now
      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );
      expect(result.success).toBe(true);

      freshSystem.cleanup();
    });

    it('should reject doors sabotage without target room', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Doors sabotage requires target room ID');

      freshSystem.cleanup();
    });

    it('should reject duplicate active sabotage of same type', () => {
      // Create fresh sabotageSystem for this test
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      // First sabotage
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      // Clear cooldown so we can test duplicate detection
      (freshSystem as any).sabotageCooldowns.delete('imposter-1');

      // Second sabotage of same type should fail
      const result2 = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );
      expect(result2.success).toBe(false);
      expect(result2.reason).toContain('already active');

      freshSystem.cleanup();
    });

    it('should allow different sabotage types simultaneously', () => {
      // Create fresh sabotageSystem for this test
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      // First sabotage
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      // Clear cooldown
      (freshSystem as any).sabotageCooldowns.delete('imposter-1');

      // Second sabotage of different type should succeed
      const result2 = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-0'
      );
      expect(result2.success).toBe(true);

      freshSystem.cleanup();
    });
  });

  describe('attemptSabotage - Success', () => {
    it('should activate lights sabotage', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.LIGHTS
      );

      expect(result.success).toBe(true);
      expect(sseManager.broadcast).toHaveBeenCalled();

      freshSystem.cleanup();
    });

    it('should activate doors sabotage', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-0'
      );

      expect(result.success).toBe(true);
      expect(sseManager.broadcast).toHaveBeenCalled();

      freshSystem.cleanup();
    });

    it('should activate self-destruct sabotage', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;

      const result = freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.SELF_DESTRUCT
      );

      expect(result.success).toBe(true);
      expect(sseManager.broadcast).toHaveBeenCalled();

      freshSystem.cleanup();
    });

    it('should broadcast sabotage activation event', () => {
      gameState.phase = GamePhase.ROUND;

      sabotageSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      expect(sseManager.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SabotageActivated',
          payload: expect.objectContaining({
            type: 'lights',
            message: expect.stringContaining('lights'),
          }),
        })
      );
    });

    it('should send notification to crewmates on tasks', () => {
      gameState.phase = GamePhase.ROUND;
      crewmate.tasks = ['task-1'];

      sabotageSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      expect(sseManager.sendTo).toHaveBeenCalledWith(
        'crewmate-1',
        expect.objectContaining({
          type: 'SabotageActivated',
          payload: expect.objectContaining({
            message: 'Sabotage! You must stop your task.',
          }),
        })
      );
    });
  });

  describe('attemptFix', () => {
    it('should reject fix from non-existent player', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const result = freshSystem.attemptFix('non-existent', 'sabotage-id');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not found');

      freshSystem.cleanup();
    });

    it('should reject fix from imposter', () => {
      // First, create a sabotage
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      // Try to fix as imposter
      const result = freshSystem.attemptFix('imposter-1', sabotageId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Only crewmates can fix sabotages');

      freshSystem.cleanup();
    });

    it('should reject fix for non-existent sabotage', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const result = freshSystem.attemptFix('crewmate-1', 'non-existent');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Sabotage not found or not active');

      freshSystem.cleanup();
    });

    it('should reject fix from dead crewmate', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      // Create sabotage
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      crewmate.status = PlayerStatus.DEAD;

      const result = freshSystem.attemptFix('crewmate-1', sabotageId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Dead players cannot fix sabotages');

      // Reset status
      crewmate.status = PlayerStatus.ALIVE;
      freshSystem.cleanup();
    });

    it('should reject duplicate fix from same player', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      // First fix
      const result1 = freshSystem.attemptFix('crewmate-1', sabotageId);
      expect(result1.success).toBe(true);

      // Second fix from same player should fail
      const result2 = freshSystem.attemptFix('crewmate-1', sabotageId);
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('You have already contributed to fixing this sabotage');

      freshSystem.cleanup();
    });

    it('should require player to be in affected room for doors sabotage', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-1'
      );
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages.find(s => s.type === 'doors')?.id;

      // Crewmate is in room-0, but sabotage is in room-1
      const result = freshSystem.attemptFix('crewmate-1', sabotageId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('You must be in the affected room to fix this');

      freshSystem.cleanup();
    });

    it('should allow fix when player is in affected room', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-0'
      );
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages.find(s => s.type === 'doors')?.id;

      // Crewmate is in room-0, sabotage is in room-0
      const result = freshSystem.attemptFix('crewmate-1', sabotageId);

      expect(result.success).toBe(true);

      freshSystem.cleanup();
    });

    it('should fix lights sabotage with any crewmate', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      const result = freshSystem.attemptFix('crewmate-1', sabotageId);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('Sabotage fixed!');

      freshSystem.cleanup();
    });

    it('should require 2 crewmates to fix self-destruct', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.SELF_DESTRUCT);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      // First fix
      const result1 = freshSystem.attemptFix('crewmate-1', sabotageId);
      expect(result1.success).toBe(true);
      expect(result1.reason).toBe('Fix contribution recorded');

      // Second fix from different crewmate
      const result2 = freshSystem.attemptFix('crewmate-2', sabotageId);
      expect(result2.success).toBe(true);
      expect(result2.reason).toBe('Sabotage fixed!');

      freshSystem.cleanup();
    });

    it('should broadcast sabotage resolved event on fix', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);
      const activeSabotages = freshSystem.getActiveSabotages();
      const sabotageId = activeSabotages[0]?.id;

      freshSystem.attemptFix('crewmate-1', sabotageId);

      expect(sseManager.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SabotageResolved',
          payload: expect.objectContaining({
            success: true,
          }),
        })
      );

      freshSystem.cleanup();
    });
  });

  describe('isMovementBlocked', () => {
    it('should return true when doors sabotage is active for room', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-1'
      );

      const blocked = freshSystem.isMovementBlocked('room-1');

      expect(blocked).toBe(true);

      freshSystem.cleanup();
    });

    it('should return false when no doors sabotage is active', () => {
      const blocked = sabotageSystem.isMovementBlocked('room-1');

      expect(blocked).toBe(false);
    });

    it('should return false for different room', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage(
        'imposter-1',
        SabotageType.DOORS,
        'room-1'
      );

      const blocked = freshSystem.isMovementBlocked('room-0');

      expect(blocked).toBe(false);

      freshSystem.cleanup();
    });
  });

  describe('getCooldownRemaining', () => {
    it('should return remaining cooldown time', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      const remaining = freshSystem.getCooldownRemaining('imposter-1');

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);

      freshSystem.cleanup();
    });

    it('should return 0 when no cooldown', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const remaining = freshSystem.getCooldownRemaining('imposter-1');

      expect(remaining).toBe(0);

      freshSystem.cleanup();
    });
  });

  describe('getActiveSabotages', () => {
    it('should return empty array when no sabotages are active', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      const active = freshSystem.getActiveSabotages();

      expect(active).toEqual([]);

      freshSystem.cleanup();
    });

    it('should return active sabotages', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      const active = freshSystem.getActiveSabotages();

      expect(active).toHaveLength(1);
      expect(active[0]?.type).toBe('lights');
      expect(active[0]?.active).toBe(true);

      freshSystem.cleanup();
    });
  });

  describe('cleanup', () => {
    it('should clear all sabotages and cooldowns', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      freshSystem.cleanup();

      const active = freshSystem.getActiveSabotages();
      expect(active).toEqual([]);

      const cooldown = freshSystem.getCooldownRemaining('imposter-1');
      expect(cooldown).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all sabotages and cooldowns', () => {
      const freshSystem = new SabotageSystem(gameState, sseManager);
      gameState.phase = GamePhase.ROUND;
      freshSystem.attemptSabotage('imposter-1', SabotageType.LIGHTS);

      freshSystem.reset();

      const active = freshSystem.getActiveSabotages();
      expect(active).toEqual([]);

      const cooldown = freshSystem.getCooldownRemaining('imposter-1');
      expect(cooldown).toBe(0);
    });
  });
});
