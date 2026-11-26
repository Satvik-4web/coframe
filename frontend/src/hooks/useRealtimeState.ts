import { useState, useEffect, useCallback, useRef } from 'react';
import { FullProjectState, HumanIdentity } from '../types';
import { fetchProjectState } from '../lib/api';

const PROJECT_ID = 'demo-ledgerflow';

export function useRealtimeState() {
  const [identity, setIdentity] = useState<HumanIdentity>(() => {
    return (localStorage.getItem('coframe_identity') as HumanIdentity) || null;
  });
  const [state, setState] = useState<FullProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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
    if (!identity) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const rawWsUrl = (import.meta as any).env?.VITE_WS_URL;
    const wsUrl = rawWsUrl
      ? `${String(rawWsUrl).replace(/\/+$/, '')}/ws/${PROJECT_ID}/${identity}`
      : `${protocol}//${window.location.host}/ws/${PROJECT_ID}/${identity}`;

    let ws: WebSocket;
    let pingInterval: any;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
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
        setIsConnected(false);
        clearInterval(pingInterval);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      clearInterval(pingInterval);
      if (ws) ws.close();
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
