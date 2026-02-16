import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';

const STORAGE_KEY = 'double-agent:watchlist';

interface WatchlistItem {
  gameId: string;
  addedAt: string;
  status: 'active' | 'completed' | 'archived';
  lastSeenAt: string;
  favorite: boolean;
}

interface GameData {
  gameId: string;
  status: 'lobby' | 'playing' | 'voting' | 'gameover';
  playerCount: number;
  maxPlayers: number;
  mapName: string;
  roundNumber?: number;
}

const Container = styled.div`
  min-height: 100vh;
  background: #0a0e17;
  padding: 2rem;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #1e293b;
`;

const BackButton = styled.button`
  background: transparent;
  border: 1px solid #334155;
  color: #94a3b8;
  font-family: monospace;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #64748b;
    color: #e2e8f0;
  }
`;

const Title = styled.h1`
  font-family: monospace;
  font-size: 1.5rem;
  color: #e2e8f0;
  margin: 0;
  letter-spacing: 0.1em;
`;

const Section = styled.section`
  margin-bottom: 3rem;
`;

const SectionTitle = styled.h2`
  font-family: monospace;
  font-size: 0.875rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #1e293b;
`;

const GamesGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const GameCard = styled.div`
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: border-color 0.2s;

  &:hover {
    border-color: #374151;
  }
`;

const GameInfoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const GameIcon = styled.span`
  font-size: 1.5rem;
`;

const GameDetails = styled.div``;

const GameId = styled.div`
  font-family: monospace;
  font-size: 1rem;
  color: #e2e8f0;
  margin-bottom: 0.25rem;
`;

const GameMeta = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${props => {
    switch (props.status) {
      case 'lobby':
        return `background: rgba(34, 197, 94, 0.2); color: #4ade80;`;
      case 'playing':
      case 'voting':
        return `background: rgba(239, 68, 68, 0.2); color: #f87171;`;
      case 'gameover':
        return `background: rgba(100, 116, 139, 0.2); color: #94a3b8;`;
      default:
        return `background: rgba(100, 116, 139, 0.2); color: #94a3b8;`;
    }
  }}
`;

const PlayerCount = styled.span`
  color: #64748b;
  font-family: monospace;
`;

const GameActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background: ${props => props.variant === 'primary'
    ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
    : 'transparent'};
  border: ${props => props.variant === 'primary' ? 'none' : '1px solid #374151'};
  color: ${props => props.variant === 'primary' ? 'white' : '#94a3b8'};
  font-family: monospace;
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    ${props => props.variant === 'primary'
      ? 'box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);'
      : 'border-color: #64748b; color: #e2e8f0;'}
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #475569;
  font-family: monospace;
`;

// Mock games data - in production this would come from an API
const mockGames: GameData[] = [
  { gameId: 'game-a1b2c3d4', status: 'lobby', playerCount: 3, maxPlayers: 10, mapName: 'The Manor' },
  { gameId: 'game-e5f6g7h8', status: 'playing', playerCount: 8, maxPlayers: 10, mapName: 'The Manor', roundNumber: 2 },
  { gameId: 'dead-man-ff22', status: 'gameover', playerCount: 0, maxPlayers: 10, mapName: 'The Manor' },
];

// Status text mapping for accessibility
const getStatusText = (status: string): string => {
  switch (status) {
    case 'lobby': return 'In Lobby';
    case 'playing': return 'Currently Playing';
    case 'voting': return 'Voting Phase';
    case 'gameover': return 'Game Over';
    default: return 'Unknown Status';
  }
};

export function GamesListPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Memoize watchlist IDs for O(1) lookup
  const watchedGameIds = useMemo(
    () => new Set(watchlist.map(item => item.gameId)),
    [watchlist]
  );

  // Memoize games lookup map for watchlist section
  const gamesMap = useMemo(
    () => new Map(mockGames.map(g => [g.gameId, g])),
    []
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const saveWatchlist = (list: WatchlistItem[]) => {
    setWatchlist(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const addToWatchlist = (gameId: string) => {
    if (!watchedGameIds.has(gameId)) {
      saveWatchlist([...watchlist, {
        gameId,
        addedAt: new Date().toISOString(),
        status: 'active',
        lastSeenAt: new Date().toISOString(),
        favorite: false,
      }]);
    }
  };

  const removeFromWatchlist = (gameId: string) => {
    saveWatchlist(watchlist.filter(item => item.gameId !== gameId));
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate('/')}>
          ← Back to Landing
        </BackButton>
        <Title>
          <span role="presentation" aria-hidden="true">📡</span> WATCH ROOM
        </Title>
        <div style={{ width: '120px' }} />
      </Header>

      <Section>
        <SectionTitle>Active Games</SectionTitle>
        <GamesGrid>
          {mockGames.map(game => (
            <GameCard key={game.gameId}>
              <GameInfoWrapper>
                <GameIcon role="presentation" aria-hidden="true">📡</GameIcon>
                <GameDetails>
                  <GameId>{game.gameId}</GameId>
                  <GameMeta>
                    <StatusBadge
                      status={game.status}
                      aria-label={getStatusText(game.status)}
                    >
                      <span role="presentation" aria-hidden="true">
                        {game.status === 'lobby' ? '🟢' : game.status === 'playing' || game.status === 'voting' ? '🔴' : '⬛'}
                      </span>
                      {' '}{game.status}
                    </StatusBadge>
                    <PlayerCount>{game.playerCount}/{game.maxPlayers}</PlayerCount>
                    {game.roundNumber && (
                      <PlayerCount>Round {game.roundNumber}</PlayerCount>
                    )}
                  </GameMeta>
                </GameDetails>
              </GameInfoWrapper>
              <GameActions>
                {watchedGameIds.has(game.gameId) ? (
                  <ActionButton onClick={() => removeFromWatchlist(game.gameId)}>
                    Added ✓
                  </ActionButton>
                ) : (
                  <ActionButton onClick={() => addToWatchlist(game.gameId)}>
                    + Watchlist
                  </ActionButton>
                )}
                <ActionButton
                  variant="primary"
                  onClick={() => navigate(`/games/${game.gameId}`)}
                >
                  Enter Spectator Mode →
                </ActionButton>
              </GameActions>
            </GameCard>
          ))}
        </GamesGrid>
      </Section>

      <Section>
        <SectionTitle>Your Watchlist</SectionTitle>
        {watchlist.length === 0 ? (
          <EmptyState>
            No games in your watchlist yet.<br />
            Add games above to track them here.
          </EmptyState>
        ) : (
          <GamesGrid>
            {watchlist.map(item => {
              const game = gamesMap.get(item.gameId);
              const status = game?.status ?? 'unknown';
              return (
                <GameCard key={item.gameId}>
                  <GameInfoWrapper>
                    <GameIcon role="presentation" aria-hidden="true">📌</GameIcon>
                    <GameDetails>
                      <GameId>{item.gameId}</GameId>
                      <GameMeta>
                        <StatusBadge
                          status={status}
                          aria-label={getStatusText(status)}
                        >
                          <span role="presentation" aria-hidden="true">
                            {status === 'lobby' ? '🟢' : status === 'playing' || status === 'voting' ? '🔴' : '⬛'}
                          </span>
                          {' '}{status}
                        </StatusBadge>
                      </GameMeta>
                    </GameDetails>
                  </GameInfoWrapper>
                  <GameActions>
                    <ActionButton
                      variant="primary"
                      onClick={() => navigate(`/games/${item.gameId}`)}
                    >
                      View
                    </ActionButton>
                    <ActionButton onClick={() => removeFromWatchlist(item.gameId)}>
                      Remove
                    </ActionButton>
                  </GameActions>
                </GameCard>
              );
            })}
          </GamesGrid>
        )}
      </Section>
    </Container>
  );
}
