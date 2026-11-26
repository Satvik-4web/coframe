import { useState, useEffect, useCallback } from 'react';
import { FullProjectState, HumanIdentity } from '../types';
import { fetchProjectState } from '../lib/api';

const PROJECT_ID = 'demo-ledgerflow';

export function useRealtimeState() {
  const [identity, setIdentity] = useState<HumanIdentity>(() => {
    const saved = localStorage.getItem('coframe_identity');
    return saved === 'alex' || saved === 'maya' ? saved : null;
  });
  const [state, setState] = useState<FullProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchProjectState(PROJECT_ID);
      setState(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load state');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectIdentity = (newId: HumanIdentity) => {
    if (newId) {
      localStorage.setItem('coframe_identity', newId);
    } else {
      localStorage.removeItem('coframe_identity');
    }
    setIdentity(newId);
  };

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // WebSocket connection for real-time multiplayer updates & presence
  useEffect(() => {
    if (!identity) {
      setIsConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const rawWsUrl = (import.meta as any).env?.VITE_WS_URL;
    const wsUrl = rawWsUrl
      ? `${String(rawWsUrl).replace(/\/+$/, '')}/ws/${PROJECT_ID}/${identity}`
      : `${protocol}//${window.location.host}/ws/${PROJECT_ID}/${identity}`;

    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let retryCount = 0;

    const connect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleRetry();
        return;
      }

      ws.onopen = () => {
        if (disposed) return;
        setIsConnected(true);
        retryCount = 0;
        refresh();
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        if (event.data === 'pong') return;
        try {
          const msg = JSON.parse(event.data);
          // Broadcast to components via window custom event
          window.dispatchEvent(new CustomEvent('coframe:ws_message', { detail: msg }));
          // Any backend update triggers state reload
          refresh();
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        if (!disposed) {
          setIsConnected(false);
          scheduleRetry();
        }
      };

      ws.onerror = () => {
        if (!disposed) setIsConnected(false);
      };
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(1000 * 2 ** retryCount++, 15000);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, delay);
    };

    connect();

    return () => {
      disposed = true;
      clearInterval(pingInterval);
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [identity, refresh]);

  // Periodic polling fallback when WebSocket is inactive (e.g. serverless environments)
  useEffect(() => {
    if (isConnected || !identity) return;
    const pollTimer = setInterval(() => {
      refresh();
    }, 10000);
    return () => clearInterval(pollTimer);
  }, [isConnected, identity, refresh]);

  return {
    projectId: PROJECT_ID,
    identity,
    selectIdentity,
    state,
    loading,
    error,
    isConnected,
    refresh,
  };
}
