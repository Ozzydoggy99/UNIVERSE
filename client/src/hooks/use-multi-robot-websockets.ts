import { useEffect, useState } from "react";

// Define the channels as categories of data from the single WebSocket
const baseUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// All data comes through a single WebSocket now but is categorized for display
const categories = [
  { 
    label: "Robot Position", 
    filter: (msg: any) => 
      msg.category === 'pose' || 
      (msg.data && msg.data.topic === '/tracked_pose')
  },
  { 
    label: "Robot Status", 
    filter: (msg: any) => 
      msg.category === 'status' || 
      (msg.data && (
        msg.data.topic === '/battery_state' || 
        msg.data.topic === '/wheel_state'
      ))
  },
  { 
    label: "Map Data", 
    filter: (msg: any) => 
      msg.category === 'map' || 
      (msg.data && (
        msg.data.topic === '/map' || 
        msg.data.topic === '/slam/state'
      ))
  },
  { 
    label: "System Messages", 
    filter: (msg: any) => 
      msg.type === 'error' || 
      msg.type === 'connection' || 
      msg.type === 'command_response'
  },
  {
    label: "All Messages",
    filter: null  // Null filter means include all messages
  }
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
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempt = 0;

    // Initialize the state for all categories
    const initialState: Record<string, ChannelState> = {};
    categories.forEach(({ label }) => {
      initialState[label] = { 
        status: "connecting", 
        lastMessage: "", 
        connectionAttempts: 0 
      };
    });
    setState(initialState);

    // Function to connect the WebSocket with proper error handling and reconnection
    const connectWebSocket = (attempt: number = 0) => {
      try {
        const wsUrl = `${baseUrl}/api/robot-ws`;
        console.log(`Connecting to Robot WebSocket at ${wsUrl} (attempt ${attempt})...`);
        
        // Update all categories to connecting status
        setState((prev) => {
          const updated = { ...prev };
          categories.forEach(({ label }) => {
            updated[label] = { 
              ...prev[label], 
              status: "connecting",
              connectionAttempts: attempt
            };
          });
          return updated;
        });

        // Create the WebSocket connection
        socket = new WebSocket(wsUrl);

        // Set up WebSocket event handlers
        socket.onopen = () => {
          console.log('Robot WebSocket connected');
          setWsConnected(true);
          reconnectAttempt = 0;
          
          // Update all categories to connected status
          setState((prev) => {
            const updated = { ...prev };
            categories.forEach(({ label }) => {
              updated[label] = { 
                ...prev[label], 
                status: "connected",
                lastError: undefined
              };
            });
            return updated;
          });
        };

        socket.onclose = (event) => {
          console.log(`Robot WebSocket closed: ${event.code}`);
          setWsConnected(false);
          
          // Update all categories to disconnected status
          setState((prev) => {
            const updated = { ...prev };
            categories.forEach(({ label }) => {
              updated[label] = { 
                ...prev[label], 
                status: "disconnected",
                lastError: `Connection closed: ${event.code}`
              };
            });
            return updated;
          });

          // Schedule reconnection with exponential backoff
          reconnectAttempt++;
          const timeout = Math.min(1000 * Math.pow(1.5, attempt), 30000);
          console.log(`Reconnecting in ${timeout}ms (attempt ${reconnectAttempt})`);
          
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            connectWebSocket(reconnectAttempt);
          }, timeout);
        };

        socket.onerror = (event) => {
          console.error('Robot WebSocket error:', event);
          
          // Update all categories to error status
          setState((prev) => {
            const updated = { ...prev };
            categories.forEach(({ label }) => {
              updated[label] = { 
                ...prev[label], 
                status: "error",
                lastError: "Connection error"
              };
            });
            return updated;
          });
        };

        socket.onmessage = (msg) => {
          try {
            // Parse the JSON message
            const data = JSON.parse(msg.data);
            
            // Format the message for display
            const messageDisplay = JSON.stringify(data, null, 2);
            
            // Update each category based on its filter
            setState((prev) => {
              const updated = { ...prev };
              
              categories.forEach(({ label, filter }) => {
                if (filter === null || filter(data)) {
                  updated[label] = {
                    ...prev[label],
                    lastMessage: messageDisplay
                  };
                }
              });
              
              return updated;
            });
          } catch (e) {
            console.error('Error processing WebSocket message:', e);
            
            // If it's not valid JSON, update only the "All Messages" category
            setState((prev) => ({
              ...prev,
              "All Messages": {
                ...prev["All Messages"],
                lastMessage: `[Non-JSON] ${msg.data}`
              }
            }));
          }
        };
      } catch (err) {
        console.error('Error connecting to WebSocket:', err);
        
        // Update all categories to error status
        setState((prev) => {
          const updated = { ...prev };
          categories.forEach(({ label }) => {
            updated[label] = { 
              ...prev[label], 
              status: "error",
              lastError: err instanceof Error ? err.message : String(err)
            };
          });
          return updated;
        });

        // Schedule reconnection with exponential backoff
        reconnectAttempt++;
        const timeout = Math.min(1000 * Math.pow(1.5, attempt), 30000);
        
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connectWebSocket(reconnectAttempt);
        }, timeout);
      }
    };

    // Initialize the connection
    connectWebSocket();

    // Cleanup function
    return () => {
      if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  return state;
}