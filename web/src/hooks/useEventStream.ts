import { useEffect, useState, useCallback, useRef } from 'react';
import type { GameState } from '@/types/game';

export interface GameEvent {
  timestamp: number;
  type: string;
  payload: unknown;
}

export interface ActionWithState {
  event: GameEvent;
  gameState: GameState | null;
}

interface SSEOptions {
  url: string;
  reconnectInterval?: number;
  maxRetries?: number;
}

/**
 * Type guard to validate that parsed data has the expected structure
 */
function isValidActionWithState(data: unknown): data is ActionWithState {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.event !== null &&
    typeof obj.event === 'object' &&
    typeof (obj.event as Record<string, unknown>).timestamp === 'number' &&
    typeof (obj.event as Record<string, unknown>).type === 'string'
  );
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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (import.meta.env.DEV) {
      console.log(`[SSE] Connecting to ${url}...`);
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (import.meta.env.DEV) {
        console.log('[SSE] Connected');
      }
      setConnected(true);
      setError(null);
      retryCountRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed: unknown = JSON.parse(event.data);

        // Validate the parsed data structure
        if (isValidActionWithState(parsed)) {
          setActions((prev) => [...prev, parsed]);
        } else {
          if (import.meta.env.DEV) {
            console.warn('[SSE] Received malformed message, skipping:', parsed);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[SSE] Failed to parse message:', err);
        }
      }
    };

    eventSource.onerror = () => {
      if (import.meta.env.DEV) {
        console.error('[SSE] Connection error');
      }
      eventSource.close();
      setConnected(false);

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setError(`Reconnecting... (${retryCountRef.current}/${maxRetries})`);
        if (import.meta.env.DEV) {
          console.log(`[SSE] Reconnecting in ${reconnectInterval}ms...`);
        }
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      } else {
        setError('Connection failed. Max retries reached.');
      }
    };
  }, [url, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      if (import.meta.env.DEV) {
        console.log('[SSE] Disconnecting');
      }
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
