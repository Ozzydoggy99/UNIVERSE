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

// Helper function to extract theta from quaternion orientation
function getTheta(orientation: any): number {
  if (!orientation) return 0;
  
  // If orientation is a number, use it directly
  if (typeof orientation === 'number') return orientation;
  
  // If orientation is a quaternion (x,y,z,w), convert to Euler angle
  if (typeof orientation === 'object' && 
      typeof orientation.z === 'number' && 
      typeof orientation.w === 'number') {
    // Simplified quaternion to Euler conversion for 2D
    const z = orientation.z;
    const w = orientation.w;
    return Math.atan2(2.0 * (w * z), 1.0 - 2.0 * (z * z)) || 0;
  }
  
  return 0;
}

export function useRobotPoseWebSocket(robotSerial: string): Position | null {
  const [position, setPosition] = useState<Position | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!robotSerial) return;

    let isMounted = true;

    const connect = () => {
      // Connect via our secure WebSocket relay server instead of directly to the robot
      // This approach solves mixed content issues with HTTPS frontend connecting to WS backend
      // Determine if we're in development or production
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/pose`;

      try {
        console.log(`[WebSocket] Connecting to robot via relay server at: ${wsUrl}`);
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
          console.log("[WebSocket] Connected to robot pose stream at public IP");
        };

        socketRef.current.onmessage = (event) => {
          try {
            // Enhanced logging to troubleshoot
            console.log("[WebSocket] Received raw message:", typeof event.data === 'string' ? event.data.substring(0, 100) + '...' : '[binary data]');
            
            // Try to parse JSON data
            const data = JSON.parse(event.data);
            console.log("[WebSocket] Parsed position data:", data);
            
            // Check for different data formats that might contain position info
            if (data) {
              let positionData = null;
              
              // Direct position format we expect
              if (typeof data.x === "number" && typeof data.y === "number") {
                positionData = data;
                console.log("[WebSocket] Found direct position format:", { x: data.x, y: data.y, theta: data.theta });
              } 
              // Message may be a wrapper with type field (from our relay server)
              else if (data.type === 'connected') {
                console.log("[WebSocket] Connected to relay server");
                return;
              }
              // Check for pose.position format (common in ROS)
              else if (data.pose && typeof data.pose.position === 'object') {
                positionData = {
                  x: data.pose.position.x,
                  y: data.pose.position.y,
                  theta: getTheta(data.pose.orientation)
                };
                console.log("[WebSocket] Extracted position from pose:", positionData);
              }
              // Check for position object format
              else if (data.position && typeof data.position === 'object') {
                positionData = {
                  x: data.position.x,
                  y: data.position.y,
                  theta: data.theta || data.angle || getTheta(data.orientation) || 0
                };
                console.log("[WebSocket] Extracted position from position object:", positionData);
              }
              // Check for commonly named position fields
              else {
                for (const key of ['location', 'coordinates', 'pos', 'current_position']) {
                  if (data[key] && typeof data[key] === 'object' &&
                      typeof data[key].x === 'number' && 
                      typeof data[key].y === 'number') {
                    positionData = {
                      x: data[key].x,
                      y: data[key].y,
                      theta: data[key].theta || data[key].angle || 0
                    };
                    console.log(`[WebSocket] Extracted position from ${key}:`, positionData);
                    break;
                  }
                }
              }
              
              // If we found position data, update state
              if (positionData && isMounted) {
                console.log("[WebSocket] Setting position:", positionData);
                setPosition(positionData);
                return;
              }
              
              // If no position data found, log that
              console.log("[WebSocket] No position data found in message");
            }
          } catch (err) {
            console.error("[WebSocket] Parse error:", err);
            // Try to use the data directly if JSON parsing fails
            try {
              // Some WebSockets might send binary or formatted data
              console.log("[WebSocket] Attempting to process raw data");
            } catch (rawErr) {
              console.error("[WebSocket] Failed to process raw data:", rawErr);
            }
          }
        };

        socketRef.current.onerror = (err) => {
          console.error("WebSocket error:", err);
        };

        socketRef.current.onclose = () => {
          console.warn("[WebSocket] Connection closed. Reconnecting in 3s...");
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connect();
          }, 3000);
        };
      } catch (err) {
        console.error("WebSocket connection failed:", err);
        // Try to reconnect after a delay
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) connect();
        }, 3000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [robotSerial]);

  return position;
}