import { useEffect, useState, useCallback, useRef } from 'react';

export interface GameEvent {
  timestamp: number;
  type: string;
  payload: any;
}

export interface ActionWithState {
  event: GameEvent;
  gameState: any;
}

interface SSEOptions {
  url: string;
  reconnectInterval?: number;
  maxRetries?: number;
}

/**
 * useEventStream - Hook for connecting to SSE endpoint
 *
 * Connects to SSE endpoint and streams game events in real-time.
 */
export function useEventStream(options: SSEOptions) {
  const { url, reconnectInterval = 5000, maxRetries = 10 } = options;

  const [actions, setActions] = useState<ActionWithState[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log(`[SSE] Connecting to ${url}...`);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected');
      setConnected(true);
      setError(null);
      retryCountRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const action: ActionWithState = JSON.parse(event.data);
        setActions((prev) => [...prev, action]);
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('[SSE] Connection error');
      eventSource.close();
      setConnected(false);

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setError(`Reconnecting... (${retryCountRef.current}/${maxRetries})`);
        console.log(`[SSE] Reconnecting in ${reconnectInterval}ms...`);
        setTimeout(connect, reconnectInterval);
      } else {
        setError('Connection failed. Max retries reached.');
      }
    };
  }, [url, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('[SSE] Disconnecting');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  const clearActions = useCallback(() => {
    setActions([]);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    actions,
    connected,
    error,
    reconnect: connect,
    disconnect,
    clearActions,
  };
}
