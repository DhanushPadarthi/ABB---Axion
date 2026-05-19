import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { FactoryState } from '../types';

// VITE_API_URL is set to empty string in .env.production → no backend on Vercel
const _apiBase = import.meta.env.VITE_API_URL as string | undefined;
const WS_DISABLED = _apiBase === '' || _apiBase === undefined && import.meta.env.PROD;
const WS_URL = _apiBase
  ? _apiBase.replace(/^http/, 'ws') + '/ws'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:8000/ws`;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const setFactoryState = useAppStore((s) => s.setFactoryState);

  const connect = useCallback(() => {
    // No backend configured (Vercel / pure-frontend mode) — skip WS entirely.
    if (WS_DISABLED) return;
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setConnectionStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: FactoryState = JSON.parse(event.data as string);
        setFactoryState(data);
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      ws.close();
    };
  }, [setConnectionStatus, setFactoryState]);

  const scheduleReconnect = useCallback(() => {
    if (WS_DISABLED || retriesRef.current >= MAX_RETRIES) {
      setConnectionStatus('error');
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retriesRef.current), 30000);
    retriesRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [connect, setConnectionStatus]);

  useEffect(() => {
    // No backend configured — offline simulator handles data, nothing to do here.
    if (WS_DISABLED) {
      setConnectionStatus('disconnected');
      return;
    }
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
