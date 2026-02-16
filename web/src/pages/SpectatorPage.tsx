import { useParams, useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { LogViewer } from '@/components/LogViewer';
import { GameStateVisualization } from '@/components/GameStateVisualization';
import { useEventStream } from '@/hooks/useEventStream';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #0a0e17;
`;

const StatusBar = styled.header`
  height: 60px;
  background: #111827;
  border-bottom: 1px solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
`;

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const BackButton = styled.button`
  background: transparent;
  border: 1px solid #374151;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 0.875rem;
  transition: all 0.2s;

  &:hover {
    border-color: #64748b;
    color: #e2e8f0;
  }
`;

const GameTitle = styled.h1`
  font-family: monospace;
  font-size: 1rem;
  color: #e2e8f0;
  margin: 0;
`;

const ConnectionIndicator = styled.span<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: ${props => props.connected ? '#4ade80' : '#f87171'};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.connected ? '#4ade80' : '#f87171'};
    animation: ${props => props.connected ? 'none' : 'pulse 1.5s infinite'};
  }
`;

const MainContent = styled.main`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const GameCanvas = styled.section`
  flex: 7;
  border-right: 1px solid #1f2937;
  overflow: auto;
  padding: 1rem;
`;

const LogPanel = styled.aside`
  flex: 3;
  min-width: 300px;
  max-width: 400px;
  background: #0f172a;
  display: flex;
  flex-direction: column;
`;

const LogHeader = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #1f2937;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LogTitle = styled.h2`
  font-family: monospace;
  font-size: 0.875rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
`;

const ClearButton = styled.button`
  background: transparent;
  border: 1px solid #374151;
  color: #64748b;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 0.75rem;

  &:hover {
    border-color: #64748b;
    color: #94a3b8;
  }
`;

const LogContent = styled.div`
  flex: 1;
  overflow: auto;
`;

export function SpectatorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const { actions, connected, error, clearActions } = useEventStream({
    url: 'http://localhost:3000/api/stream/actions',
  });

  return (
    <Container>
      <StatusBar>
        <StatusLeft>
          <BackButton onClick={() => navigate('/games')}>
            ← Games
          </BackButton>
          <GameTitle>📡 {gameId}</GameTitle>
        </StatusLeft>
        <ConnectionIndicator connected={connected}>
          {connected ? 'LIVE' : error || 'CONNECTING...'}
        </ConnectionIndicator>
      </StatusBar>

      <MainContent>
        <GameCanvas>
          <GameStateVisualization actions={actions} />
        </GameCanvas>

        <LogPanel>
          <LogHeader>
            <LogTitle>Theater Log</LogTitle>
            {actions.length > 0 && (
              <ClearButton onClick={clearActions}>Clear</ClearButton>
            )}
          </LogHeader>
          <LogContent>
            <LogViewer actions={actions} maxVisible={100} />
          </LogContent>
        </LogPanel>
      </MainContent>
    </Container>
  );
}
