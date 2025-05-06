import { useEffect, useState, useRef } from "react";

interface Position {
  x: number;
  y: number;
  theta: number;
  orientation?: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  z?: number;
  timestamp?: number;
}

export function useRobotPoseWebSocket(robotSerial: string): Position | null {
  const [position, setPosition] = useState<Position | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!robotSerial) return;

    // Track if the component is still mounted
    let isMounted = true;
    
    // Create a custom WebSocket server connection on our Express server 
    // that relays messages from the robot's WebSocket
    const setupWebSocketConnection = () => {
      try {
        // Use the current server's host and just change the path
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/ws/camera`;
        
        console.log(`Connecting to robot position WebSocket at: ${wsUrl}`);
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("Position tracking WebSocket connected");
          
          // Request to enable position tracking topics specifically /tracked_pose
          socket.send(JSON.stringify({
            type: "start_mapping_streams",
            topics: ["/tracked_pose"],
            serialNumber: robotSerial
          }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle different types of messages
            if (message.type === "connected") {
              console.log("WebSocket connection confirmed:", message.message);
            } 
            else if (message.type === "mapping_streams_started") {
              console.log("Position tracking started:", message.topics);
            }
            else if (message.type === "robot_data" && message.data && message.data.topic === "/tracked_pose") {
              // Parse the robot position data based on the format observed in the logs
              const data = message.data;
              
              if (data && data.pos && Array.isArray(data.pos) && data.pos.length >= 2) {
                const [x, y] = data.pos;
                const theta = data.ori || 0;
                
                console.log("Received robot position update:", { x, y, theta });
                
                // Update the position if the component is still mounted
                if (isMounted) {
                  setPosition({
                    x,
                    y, 
                    theta,
                    timestamp: Date.now()
                  });
                }
              }
            }
            else if (message.type === "error") {
              console.error("WebSocket error message:", message.message);
            }
          } catch (err) {
            console.error("Position message parse error:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket error:", err);
        };

        socket.onclose = () => {
          console.log("Robot position WebSocket closed, reconnecting in 5 seconds...");
          // Try to reconnect after a delay if still mounted
          if (isMounted) {
            reconnectTimeoutRef.current = setTimeout(setupWebSocketConnection, 5000);
          }
        };
      } catch (err) {
        console.error("Error connecting to WebSocket:", err);
        // Try to reconnect after a delay if still mounted
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(setupWebSocketConnection, 5000);
        }
      }
    };

    // Start the connection
    setupWebSocketConnection();

    // Cleanup function
    return () => {
      isMounted = false;
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close the WebSocket connection
      if (socketRef.current) {
        // First disable the tracking topics
        try {
          socketRef.current.send(JSON.stringify({
            type: "stop_mapping_streams",
            topics: ["/tracked_pose"],
            serialNumber: robotSerial
          }));
        } catch (err) {
          console.error("Error disabling position tracking:", err);
        }
        
        // Then close the connection
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [robotSerial]);

  return position;
}