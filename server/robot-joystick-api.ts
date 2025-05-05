import { Express, Request, Response } from 'express';
import fetch from 'node-fetch';

const ROBOT_API_URL = 'http://47.180.91.99:8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET || '';
const ROBOT_HEADERS = {
  'Content-Type': 'application/json',
  'Secret': ROBOT_SECRET 
};

// Interface for robot position data
interface RobotPosition {
  pos: number[];
  ori: number;
  cov?: number[][];
}

// Helper function to cancel all active moves
async function cancelAllMoves(
  apiUrl: string, 
  headers: Record<string, string>, 
  serialNumber: string, 
  res: Response
): Promise<Response> {
  try {
    console.log(`Cancelling all moves for robot ${serialNumber}`);
    
    // 1. First try to get all active moves
    const movesResponse = await fetch(`${apiUrl}/chassis/moves`, {
      headers
    });
    
    if (movesResponse.ok) {
      const moves = await movesResponse.json();
      const activeMoves = Array.isArray(moves) 
        ? moves.filter((move: any) => move.state === 'moving') 
        : [];
      
      console.log(`Found ${activeMoves.length} active moves`);
      
      // 2. Cancel each active move
      if (activeMoves.length > 0) {
        const cancelPromises = activeMoves.map(async (move: any) => {
          console.log(`Cancelling move ${move.id}`);
          return fetch(`${apiUrl}/chassis/moves/${move.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ state: "cancelled" })
          });
        });
        
        await Promise.all(cancelPromises);
        return res.status(200).json({ 
          message: `Cancelled ${activeMoves.length} active moves for robot ${serialNumber}`
        });
      }
    }
    
    // 3. If no active moves found or couldn't get moves list, try the /current endpoint
    const currentResponse = await fetch(`${apiUrl}/chassis/moves/current`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: "cancelled" })
    });
    
    if (currentResponse.ok) {
      return res.status(200).json({ 
        message: `Cancelled current move for robot ${serialNumber}`
      });
    }
    
    // 4. If all else fails, return a generic success (robot might already be stopped)
    return res.status(200).json({
      message: `Robot ${serialNumber} stop command processed. No active moves found.`
    });
    
  } catch (error: any) {
    console.error('Error cancelling robot moves:', error);
    return res.status(500).json({ 
      error: `Failed to cancel robot moves: ${error.message || 'Unknown error'}`
    });
  }
}

// This API includes joystick control for direct robot velocity commands
// which are more reliable for forward movement than standard movement API
export function registerRobotJoystickApiRoutes(app: Express) {
  
  // Joystick control endpoint for direct velocity commands
  app.post('/api/robots/joystick/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { linear, angular } = req.body;
      
      console.log(`Joystick control for robot ${serialNumber}: linear=${linear}, angular=${angular}`);
      
      // Validate parameters
      if (linear === undefined || angular === undefined) {
        return res.status(400).json({ error: 'Missing linear or angular velocity parameter' });
      }
      
      // Get the current robot position to calculate a very small relative move
      const positionResponse = await fetch(`${ROBOT_API_URL}/chassis/tracked_pose`, {
        headers: ROBOT_HEADERS
      });
      
      if (!positionResponse.ok) {
        console.error('Error fetching robot position:', positionResponse.status, positionResponse.statusText);
        return res.status(500).json({ error: 'Failed to fetch robot position' });
      }
      
      const positionData = await positionResponse.json() as RobotPosition;
      console.log('Current robot position:', positionData);
      
      // Get position and orientation from robot
      const currentX = positionData.pos?.[0] || 0;
      const currentY = positionData.pos?.[1] || 0;
      const currentOri = positionData.ori || 0;
      
      // Calculate new targets based on joystick input
      // For small incremental movements in the direction of joystick
      const distance = linear * 0.5; // 0.5 meter per joystick command
      const turnAngle = angular * 0.5; // 0.5 radians per joystick command
      
      // Whether we're moving or turning
      const isMoving = Math.abs(linear) > 0.05;
      const isTurning = Math.abs(angular) > 0.05;
      
      // Calculate new position and orientation
      let targetX = currentX;
      let targetY = currentY;
      let targetOri = currentOri;
      
      if (isMoving) {
        // Move in the direction the robot is currently facing
        targetX = currentX + distance * Math.cos(currentOri);
        targetY = currentY + distance * Math.sin(currentOri);
      }
      
      if (isTurning) {
        // Adjust orientation
        targetOri = currentOri + turnAngle;
      }
      
      // Use standard move type with immediate movement
      const joystickCommand = {
        type: "standard",
        creator: "web_interface",
        target_x: targetX,
        target_y: targetY,
        target_ori: targetOri,
        target_accuracy: 0.2, // More lenient accuracy for joystick control
        properties: {
          auto_hold: false, // Don't pause at the destination
          max_speed: Math.abs(linear) * 0.8,  // Set speed based on joystick input
          max_angular_speed: Math.abs(angular) * 0.78  // Set angular speed based on joystick input
        }
      };
      
      // Send joystick command to robot
      // Use the chassis/moves endpoint with differential drive type
      const joystickUrl = `${ROBOT_API_URL}/chassis/moves`;
      console.log(`Sending joystick command to ${joystickUrl}:`, JSON.stringify(joystickCommand));
      
      const response = await fetch(joystickUrl, {
        method: 'POST',
        headers: ROBOT_HEADERS,
        body: JSON.stringify(joystickCommand)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send joystick command: ${response.status} ${response.statusText}`, errorText);
        return res.status(response.status).json({ 
          error: `Failed to send joystick command: ${response.statusText}`,
          details: errorText
        });
      }
      
      // Successful response
      return res.status(200).json({ 
        message: `Joystick command sent successfully to robot ${serialNumber}`,
        command: joystickCommand
      });
      
    } catch (error: any) {
      console.error('Error in joystick control:', error);
      return res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown error'}` });
    }
  });

  // Joystick stop endpoint
  app.post('/api/robots/joystick/:serialNumber/stop', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      console.log(`Stopping robot ${serialNumber} via joystick command`);
      
      // First get current robot position to send a stop command
      const positionResponse = await fetch(`${ROBOT_API_URL}/chassis/tracked_pose`, {
        headers: ROBOT_HEADERS
      });
      
      let stopCommand;
      
      if (positionResponse.ok) {
        const positionData = await positionResponse.json() as RobotPosition;
        console.log('Current robot position for stop command:', positionData);
        
        // Send stop command by setting a target at current position
        stopCommand = {
          type: "standard",
          creator: "web_interface",
          target_x: positionData.pos?.[0] || 0,
          target_y: positionData.pos?.[1] || 0,
          target_ori: positionData.ori || 0,
          target_accuracy: 0.05,  // High accuracy for stopping in place
          properties: {
            auto_hold: true  // Hold position once stopped
          }
        };
      } else {
        console.error('Error fetching robot position for stop command:', positionResponse.status);
        
        // Fallback to canceling all active moves
        return await cancelAllMoves(ROBOT_API_URL, ROBOT_HEADERS, serialNumber, res);
      }
      
      // Send stop command to robot
      // Use the chassis/moves endpoint with differential drive type
      const joystickUrl = `${ROBOT_API_URL}/chassis/moves`;
      const response = await fetch(joystickUrl, {
        method: 'POST',
        headers: ROBOT_HEADERS,
        body: JSON.stringify(stopCommand)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send stop command: ${response.status} ${response.statusText}`, errorText);
        return res.status(response.status).json({ 
          error: `Failed to send stop command: ${response.statusText}`,
          details: errorText
        });
      }
      
      // Successful response
      return res.status(200).json({ 
        message: `Stop command sent successfully to robot ${serialNumber}`,
        command: stopCommand
      });
      
    } catch (error: any) {
      console.error('Error in joystick stop:', error);
      return res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown error'}` });
    }
  });
}