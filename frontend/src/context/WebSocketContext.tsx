import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { TelemetryUpdateMessage } from '../types/types';

interface WebSocketContextType {
  isConnected: boolean;
  liveUpdates: Record<string, TelemetryUpdateMessage>;
  recentAlerts: string[];
  clearRecentAlerts: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState<Record<string, TelemetryUpdateMessage>>({});
  const [recentAlerts, setRecentAlerts] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const clearRecentAlerts = () => setRecentAlerts([]);

  useEffect(() => {
    // Dynamically resolve WebSocket URL based on protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    const connect = () => {
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected.');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY_UPDATE') {
            const message = data as TelemetryUpdateMessage;
            
            // 1. Update live nurse data state
            setLiveUpdates((prev) => ({
              ...prev,
              [message.nurse_id]: message,
            }));

            // 2. Trigger active notification for High or Critical fatigue
            if (message.fatigue_score > 75) {
              setRecentAlerts((prev) => {
                const messageText = `⚠️ CRITICAL: Nurse ${message.nurse_name} in ${message.department} has reached a fatigue score of ${message.fatigue_score}. Swap recommended immediately.`;
                // Prevent duplicate notifications in list
                if (prev.includes(messageText)) return prev;
                return [messageText, ...prev].slice(0, 5);
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting in 3 seconds...');
        setIsConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, liveUpdates, recentAlerts, clearRecentAlerts }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
