import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WSContext = createContext(null);

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://');

export function WSProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listeners = useRef({});

  const connect = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => { if (user) connect(); }, 3000);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const cbs = listeners.current[msg.type] || [];
        cbs.forEach(cb => cb(msg.payload));
      } catch {}
    };
  }, [user]);

  useEffect(() => {
    if (user) connect();
    return () => { wsRef.current?.close(); };
  }, [user, connect]);

  const send = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const on = useCallback((type, cb) => {
    if (!listeners.current[type]) listeners.current[type] = [];
    listeners.current[type].push(cb);
    return () => {
      listeners.current[type] = listeners.current[type].filter(f => f !== cb);
    };
  }, []);

  return (
    <WSContext.Provider value={{ send, on, connected }}>
      {children}
    </WSContext.Provider>
  );
}

export function useWS() {
  return useContext(WSContext);
}
