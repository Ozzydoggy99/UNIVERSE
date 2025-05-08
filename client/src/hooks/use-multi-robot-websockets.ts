import { useEffect, useState } from "react";

// Define the main WebSocket channels to monitor
const channels = [
  { label: "Robot API", url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/robot-ws` },
  { label: "Position Relay", url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/pose` },
  { label: "Camera Feed", url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/camera` },
];

// Type for the state of each WebSocket channel
type ChannelState = {
  status: string;
  lastMessage: string;
  connectionAttempts: number;
  lastError?: string;
};

export function useMultiRobotWebSockets() {
  const [state, setState] = useState<Record<string, ChannelState>>({});

  useEffect(() => {
    const sockets: Record<string, WebSocket> = {};
    const reconnectTimers: Record<string, NodeJS.Timeout> = {};

    // Initialize the state for all channels
    const initialState: Record<string, ChannelState> = {};
    channels.forEach(({ label }) => {
      initialState[label] = { 
        status: "connecting", 
        lastMessage: "", 
        connectionAttempts: 0 
      };
    });
    setState(initialState);

    // Function to connect a WebSocket with proper error handling and reconnection
    const connectWebSocket = (label: string, url: string, attempt: number = 0) => {
      try {
        // Update state to show connecting status
        setState((prev) => ({
          ...prev,
          [label]: { 
            ...prev[label], 
            status: "connecting",
            connectionAttempts: attempt
          },
        }));

        // Create the actual WebSocket connection
        const ws = new WebSocket(url);
        sockets[label] = ws;

        // Set up WebSocket event handlers
        ws.onopen = () => {
          setState((prev) => ({
            ...prev,
            [label]: { 
              ...prev[label], 
              status: "connected",
              lastError: undefined
            },
          }));
          
          // Send initial subscription command for position relay
          if (label === "Position Relay") {
            ws.send(JSON.stringify({ 
              type: "subscribe", 
              topics: ["position", "status"]
            }));
          }
        };

        ws.onclose = (event) => {
          setState((prev) => ({
            ...prev,
            [label]: { 
              ...prev[label], 
              status: "disconnected",
              lastError: `Connection closed: ${event.code}`
            },
          }));

          // Schedule reconnection with exponential backoff
          const timeout = Math.min(1000 * Math.pow(1.5, attempt), 30000);
          reconnectTimers[label] = setTimeout(() => {
            connectWebSocket(label, url, attempt + 1);
          }, timeout);
        };

        ws.onerror = (event) => {
          setState((prev) => ({
            ...prev,
            [label]: { 
              ...prev[label], 
              status: "error",
              lastError: "Connection error" 
            },
          }));
        };

        ws.onmessage = (msg) => {
          let messageDisplay = msg.data;
          
          // Try to format JSON messages for better readability
          try {
            const jsonData = JSON.parse(msg.data);
            messageDisplay = JSON.stringify(jsonData, null, 2);
          } catch (e) {
            // Not JSON, use as-is
          }

          setState((prev) => ({
            ...prev,
            [label]: { 
              ...prev[label], 
              lastMessage: messageDisplay,
            },
          }));
        };
      } catch (err) {
        setState((prev) => ({
          ...prev,
          [label]: { 
            ...prev[label], 
            status: "error",
            lastError: err instanceof Error ? err.message : String(err)
          },
        }));

        // Schedule reconnection
        const timeout = Math.min(1000 * Math.pow(1.5, attempt), 30000);
        reconnectTimers[label] = setTimeout(() => {
          connectWebSocket(label, url, attempt + 1);
        }, timeout);
      }
    };

    // Connect all channels
    channels.forEach(({ label, url }) => {
      connectWebSocket(label, url);
    });

    // Cleanup function to close all sockets and clear timers
    return () => {
      Object.values(sockets).forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
      
      Object.values(reconnectTimers).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return state;
}