import { useEffect, useState } from "react";

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
}

export function useRobotPoseWebSocket(robotSerial: string): Position | null {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!robotSerial) return;

    // Get robot IP from the server
    const fetchRobotIp = async () => {
      try {
        const response = await fetch(`/api/robots/ip/${robotSerial}`);
        if (!response.ok) {
          throw new Error(`Failed to get robot IP: ${response.status}`);
        }
        const data = await response.json();
        return data.ip || "47.180.91.99"; // Use the default IP if not found
      } catch (err) {
        console.error("Error fetching robot IP:", err);
        return "47.180.91.99"; // Fallback to default IP
      }
    };

    let socket: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        const robotIp = await fetchRobotIp();
        const wsUrl = `ws://${robotIp}/websocket/robot/${robotSerial}/pose`;
        
        console.log(`Connecting to robot pose WebSocket at: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log("Robot pose WebSocket connected");
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if data has the expected structure
            if (data?.x !== undefined && data?.y !== undefined) {
              console.log("Received pose update via WebSocket:", data);
              
              // The data format might vary, so we normalize it
              const normalizedPosition: Position = {
                x: data.x,
                y: data.y,
                theta: data.theta || data.ori || data.orientation || 0,
                z: data.z || 0
              };
              
              setPosition(normalizedPosition);
            }
          } catch (err) {
            console.error("Pose message parse error:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket error:", err);
        };

        socket.onclose = () => {
          console.log("Robot pose WebSocket closed, reconnecting in 5 seconds...");
          // Try to reconnect after a delay
          setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.error("Error connecting to WebSocket:", err);
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
      }
    };

    // Start the connection
    connectWebSocket();

    return () => {
      // Clean up on unmount
      if (socket) {
        socket.close();
      }
    };
  }, [robotSerial]);

  return position;
}