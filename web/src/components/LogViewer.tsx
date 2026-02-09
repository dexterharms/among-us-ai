import { useRef, useEffect } from 'react';
import type { ActionWithState } from '@/hooks/useEventStream';

interface LogViewerProps {
  actions: ActionWithState[];
  maxVisible?: number;
}

/**
 * LogViewer - Scrolling list of game actions
 *
 * Shows the most recent game actions with timestamps and event details.
 */
export function LogViewer({ actions, maxVisible = 100 }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new actions arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions]);

  // Show only the most recent actions
  const visibleActions = actions.slice(-maxVisible);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPayload = (payload: any) => {
    if (!payload) return '';
    return JSON.stringify(payload, null, 2);
  };

  return (
    <div className="log-viewer" ref={scrollRef}>
      <div className="log-header">
        <h3>Game Actions</h3>
        <span className="action-count">{actions.length} total</span>
      </div>

      <div className="log-list">
        {visibleActions.length === 0 ? (
          <div className="log-empty">No actions yet. Waiting for game events...</div>
        ) : (
          visibleActions.map((action, index) => (
            <div key={`${action.event.timestamp}-${index}`} className="log-entry">
              <div className="log-timestamp">{formatTimestamp(action.event.timestamp)}</div>
              <div className="log-type">{action.event.type}</div>
              {action.event.payload && (
                <pre className="log-payload">{formatPayload(action.event.payload)}</pre>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
