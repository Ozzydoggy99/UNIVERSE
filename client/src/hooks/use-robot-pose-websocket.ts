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
            const data = JSON.parse(event.data);
            console.log("POSE DATA RECEIVED:", data); // ✅ Confirm this prints
            
            if (data && typeof data.x === "number" && typeof data.y === "number") {
              if (isMounted) {
                setPosition(data);
              }
            }
          } catch (err) {
            console.error("WebSocket parse error:", err);
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