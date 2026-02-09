import { ThemeToggle, type Theme } from './components/ThemeToggle';
import { LogViewer } from './components/LogViewer';
import { GameStateVisualization } from './components/GameStateVisualization';
import { useEventStream } from './hooks/useEventStream';
import { useState } from 'react';

/**
 * App - Main application component
 *
 * Displays live game logs and game state visualization with dark/light mode.
 */
function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Connect to SSE stream
  const { actions, connected, error, clearActions } = useEventStream({
    url: 'http://localhost:3000/api/stream/actions',
  });

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div className={`app ${theme}`}>
      <header className="app-header">
        <div className="header-title">
          <h1>🧬 Among Us AI</h1>
          <span className="version">v1.0.0</span>
        </div>
        <div className="header-actions">
          <div className="connection-status">
            {connected ? (
              <span className="status-connected">● Live</span>
            ) : error ? (
              <span className="status-error">⚠️ {error}</span>
            ) : (
              <span className="status-disconnected">○ Connecting...</span>
            )}
          </div>
          <ThemeToggle onThemeChange={handleThemeChange} />
        </div>
      </header>

      <main className="app-main">
        <div className="grid-container">
          <section className="panel game-state-panel">
            <div className="panel-header">
              <h2>Game State</h2>
              {actions.length > 0 && (
                <button onClick={clearActions} className="btn-small">
                  Clear
                </button>
              )}
            </div>
            <GameStateVisualization actions={actions} />
          </section>

          <section className="panel logs-panel">
            <div className="panel-header">
              <h2>Live Logs</h2>
            </div>
            <LogViewer actions={actions} maxVisible={100} />
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          🧬 Dexter • {actions.length} actions logged • Real-time streaming
        </p>
      </footer>
    </div>
  );
}

export default App;
