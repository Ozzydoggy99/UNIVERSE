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
      // Direct connection to the robot's WebSocket endpoint using PUBLIC IP
      const wsUrl = `ws://47.180.91.99/websocket/robot/${robotSerial}/pose`;

      try {
        console.log(`[WebSocket] Connecting directly to robot at public IP: ${wsUrl}`);
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