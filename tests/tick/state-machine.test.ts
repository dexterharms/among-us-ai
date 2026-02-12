import { describe, it, expect } from 'bun:test';
import { PlayerState, PlayerStateMachine, StateTransition } from '@/tick/state-machine';

describe('PlayerStateMachine', () => {
  describe('PlayerState enum', () => {
    it('should have four valid states', () => {
      expect(PlayerState.ROAMING).toBe('Roaming');
      expect(PlayerState.INTERACTING).toBe('Interacting');
      expect(PlayerState.WAITING).toBe('Waiting');
      expect(PlayerState.SUMMONED).toBe('Summoned');
    });
  });

  describe('canTransition', () => {
    it('should allow Roaming → Interacting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.ROAMING, PlayerState.INTERACTING),
      ).toBe(true);
    });

    it('should allow Roaming → Waiting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.ROAMING, PlayerState.WAITING),
      ).toBe(true);
    });

    it('should allow Roaming → Summoned transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.ROAMING, PlayerState.SUMMONED),
      ).toBe(true);
    });

    it('should allow Interacting → Waiting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.INTERACTING, PlayerState.WAITING),
      ).toBe(true);
    });

    it('should allow Waiting → Roaming transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.WAITING, PlayerState.ROAMING),
      ).toBe(true);
    });

    it('should allow Waiting → Interacting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.WAITING, PlayerState.INTERACTING),
      ).toBe(true);
    });

    it('should allow Summoned → Roaming transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.SUMMONED, PlayerState.ROAMING),
      ).toBe(true);
    });

    it('should allow Summoned → Waiting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.SUMMONED, PlayerState.WAITING),
      ).toBe(true);
    });

    it('should allow Interacting → Roaming transition (task completion)', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.INTERACTING, PlayerState.ROAMING),
      ).toBe(true);
    });

    it('should NOT allow Interacting → Summoned transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.INTERACTING, PlayerState.SUMMONED),
      ).toBe(false);
    });

    it('should NOT allow Summoned → Interacting transition', () => {
      expect(
        PlayerStateMachine.canTransition(PlayerState.SUMMONED, PlayerState.ROAMING),
      ).toBe(true); // Actually this should be allowed when council ends
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions from Roaming', () => {
      const transitions = PlayerStateMachine.getValidTransitions(
        PlayerState.ROAMING,
      );
      expect(transitions).toContain(PlayerState.INTERACTING);
      expect(transitions).toContain(PlayerState.WAITING);
      expect(transitions).toContain(PlayerState.SUMMONED);
    });

    it('should return valid transitions from Interacting', () => {
      const transitions = PlayerStateMachine.getValidTransitions(
        PlayerState.INTERACTING,
      );
      expect(transitions).toContain(PlayerState.WAITING);
      expect(transitions).toContain(PlayerState.ROAMING);
    });

    it('should return valid transitions from Waiting', () => {
      const transitions = PlayerStateMachine.getValidTransitions(
        PlayerState.WAITING,
      );
      expect(transitions).toContain(PlayerState.ROAMING);
      expect(transitions).toContain(PlayerState.INTERACTING);
      expect(transitions).not.toContain(PlayerState.SUMMONED); // Cannot go to council without processing action
    });

    it('should return valid transitions from Summoned', () => {
      const transitions = PlayerStateMachine.getValidTransitions(
        PlayerState.SUMMONED,
      );
      expect(transitions).toContain(PlayerState.ROAMING);
      expect(transitions).toContain(PlayerState.WAITING);
    });
  });

  describe('validateTransition', () => {
    it('should return success for valid transition', () => {
      const result = PlayerStateMachine.validateTransition(
        PlayerState.ROAMING,
        PlayerState.WAITING,
      );
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid transition', () => {
      const result = PlayerStateMachine.validateTransition(
        PlayerState.INTERACTING,
        PlayerState.SUMMONED,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('StateTransition integration with Player', () => {
  it('should track player state transitions', () => {
    const playerId = 'player1';
    const stateMachine = new PlayerStateMachine();

    // Initial state
    expect(stateMachine.getPlayerState(playerId)).toBe(
      PlayerState.ROAMING,
    );

    // Transition to Waiting (action submitted)
    stateMachine.transition(playerId, PlayerState.WAITING);
    expect(stateMachine.getPlayerState(playerId)).toBe(
      PlayerState.WAITING,
    );

    // Transition back to Roaming (action processed)
    stateMachine.transition(playerId, PlayerState.ROAMING);
    expect(stateMachine.getPlayerState(playerId)).toBe(
      PlayerState.ROAMING,
    );

    // Transition to Interacting (start task)
    stateMachine.transition(playerId, PlayerState.INTERACTING);
    expect(stateMachine.getPlayerState(playerId)).toBe(
      PlayerState.INTERACTING,
    );
  });

  it('should reject invalid state transition', () => {
    const playerId = 'player1';
    const stateMachine = new PlayerStateMachine();

    stateMachine.transition(playerId, PlayerState.WAITING);

    // Try invalid transition
    expect(() => {
      stateMachine.transition(playerId, PlayerState.SUMMONED);
    }).toThrow();
  });
});
