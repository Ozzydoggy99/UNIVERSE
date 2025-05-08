import { useState, useEffect } from 'react';
import { useMultiRobotWebSockets } from './use-multi-robot-websockets';

export interface RobotPosition {
  x: number;
  y: number;
  theta: number;
  timestamp: number;
  orientation?: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

/**
 * Hook to get real-time robot position data from the WebSocket
 */
export function useRobotPosition(): RobotPosition | null {
  const [position, setPosition] = useState<RobotPosition | null>(null);
  const wsState = useMultiRobotWebSockets();
  
  useEffect(() => {
    // Get the Robot Position messages
    const positionData = wsState['Robot Position']?.lastMessage;
    
    if (positionData) {
      try {
        const parsedData = JSON.parse(positionData);
        
        // Extract position information
        let newPosition: RobotPosition | null = null;
        
        // If it's already in our expected format
        if (typeof parsedData.x === 'number' && typeof parsedData.y === 'number') {
          newPosition = {
            x: parsedData.x,
            y: parsedData.y,
            theta: parsedData.theta || parsedData.ori || 0,
            timestamp: parsedData.timestamp || Date.now()
          };
        } 
        // If it's in the tracked_pose format
        else if (parsedData.topic === '/tracked_pose' && Array.isArray(parsedData.pos) && parsedData.pos.length >= 2) {
          newPosition = {
            x: parsedData.pos[0],
            y: parsedData.pos[1],
            theta: parsedData.ori || 0,
            timestamp: Date.now()
          };
        }
        
        // Update state if we have valid position
        if (newPosition) {
          setPosition(newPosition);
        }
      } catch (error) {
        console.error('Error parsing robot position data:', error);
      }
    }
  }, [wsState]);
  
  return position;
}