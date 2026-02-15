import type { ActionWithState } from '@/hooks/useEventStream';
import { PlayerStatus, PlayerRole } from '@/types/game';

interface GameStateVisualizationProps {
  actions: ActionWithState[];
}

/**
 * GameStateVisualization - Visual representation of game state
 *
 * Shows player status (dead/alive) with locations, and game status.
 */
export function GameStateVisualization({ actions }: GameStateVisualizationProps) {
  // Get the most recent action with game state
  const latestAction = actions[actions.length - 1];
  const gameState = latestAction?.gameState;

  if (!gameState) {
    return (
      <div className="game-state">
        <div className="game-state-empty">No game state available yet...</div>
      </div>
    );
  }

  // Handle both Map and Array for players
  const players = Array.from(
    gameState.players instanceof Map ? gameState.players.values() : gameState.players
  );

  const getStatusColor = (status: PlayerStatus) => {
    switch (status) {
      case PlayerStatus.ALIVE:
        return '#4caf50'; // Green
      case PlayerStatus.DEAD:
        return '#f44336'; // Red
      case PlayerStatus.EJECTED:
        return '#ff9800'; // Orange
      default:
        return '#9e9e9e'; // Grey
    }
  };

  const getRoleColor = (role: PlayerRole) => {
    switch (role) {
      case PlayerRole.MOLE:
        return '#e91e63'; // Pink
      case PlayerRole.LOYALIST:
        return '#2196f3'; // Blue
      default:
        return '#9e9e9e'; // Grey
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-state">
      <div className="game-header">
        <h3>Game State</h3>
        <div className="game-status">
          <span className="phase-badge">{gameState.phase}</span>
          {gameState.roundNumber > 0 && (
            <span className="round-badge">Round {gameState.roundNumber}</span>
          )}
        </div>
      </div>

      <div className="game-info">
        <div className="info-item">
          <span className="info-label">Timer:</span>
          <span className="info-value">{formatTimer(gameState.roundTimer || 0)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Players:</span>
          <span className="info-value">{players.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Moles:</span>
          <span className="info-value">{gameState.moleCount}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Dead Bodies:</span>
          <span className="info-value">{gameState.deadBodies?.length || 0}</span>
        </div>
      </div>

      <div className="players-list">
        <h4>Players</h4>
        <div className="players-grid">
          {players.map((player: any) => (
            <div
              key={player.id}
              className="player-card"
              style={{
                borderColor: getStatusColor(player.status),
                backgroundColor: `${getRoleColor(player.role)}20`,
              }}
            >
              <div className="player-name">{player.name}</div>
              <div className="player-role" style={{ color: getRoleColor(player.role) }}>
                {player.role}
              </div>
              <div className="player-status" style={{ color: getStatusColor(player.status) }}>
                {player.status}
              </div>
              <div className="player-location">
                📍 {player.location?.roomId || 'Unknown'}
              </div>
              {player.taskProgress !== undefined && player.role === PlayerRole.LOYALIST && (
                <div className="player-task-progress">
                  Tasks: {player.taskProgress}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {gameState.deadBodies && gameState.deadBodies.length > 0 && (
        <div className="bodies-list">
          <h4>Dead Bodies</h4>
          <div className="bodies-grid">
            {gameState.deadBodies.map((body: any, index: number) => (
              <div key={`${body.playerId}-${index}`} className="body-card">
                <div className="body-player">Player {body.playerId}</div>
                <div className="body-location">
                  📍 {body.location?.roomId || 'Unknown'}
                </div>
                {body.reported && (
                  <div className="body-reported">✓ Reported</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
