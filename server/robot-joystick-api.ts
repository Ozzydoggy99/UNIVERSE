import { Express, Request, Response } from 'express';
import fetch from 'node-fetch';
import { getRobotPosition } from './robot-websocket';

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

// Interface for joystick commands (using standard move type)
interface JoystickCommand {
  type: string;          // Always "standard" for this robot
  creator: string;       // Source of the command
  target_x: number;      // Target X position
  target_y: number;      // Target Y position 
  target_ori: number;    // Target orientation in radians
  target_accuracy: number; // How close to get to target (meters)
  properties: {
    auto_hold: boolean;    // Whether to hold position at destination
    max_speed?: number;    // Maximum forward speed
    max_angular_speed?: number; // Maximum rotation speed
  }
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
      
      // Get the current robot position from WebSocket cache
      const websocketPosition = getRobotPosition(serialNumber);
      
      // Variables for position data
      let currentX = 0;
      let currentY = 0;
      let currentOri = 0;
      
      console.log("Actual robot WebSocket connection status:", websocketPosition ? 
        (websocketPosition.connectionStatus === 'connected' ? "Connected" : "Disconnected") : 
        "No data");
      
      // If we have a valid websocket position, use it
      if (websocketPosition && websocketPosition.connectionStatus === 'connected') {
        console.log('Using websocket position data:', websocketPosition);
        
        // The position data format is different from the tracked_pose endpoint
        // WebSocket position has x, y, orientation properties
        currentX = websocketPosition.x || 0;
        currentY = websocketPosition.y || 0;
        currentOri = websocketPosition.orientation || 0;
      } else {
        // Fallback to direct API call
        try {
          const positionResponse = await fetch(`${ROBOT_API_URL}/chassis/tracked_pose`, {
            headers: ROBOT_HEADERS
          });
          
          if (positionResponse.ok) {
            const positionData = await positionResponse.json() as RobotPosition;
            console.log('Current robot position from API:', positionData);
            
            // Get position and orientation from robot
            currentX = positionData.pos?.[0] || 0;
            currentY = positionData.pos?.[1] || 0;
            currentOri = positionData.ori || 0;
          } else {
            console.error('Error fetching robot position:', positionResponse.status);
            return res.status(500).json({ error: 'Failed to fetch robot position' });
          }
        } catch (error) {
          console.error('Failed to get robot position:', error);
          return res.status(500).json({ error: 'Failed to fetch robot position' });
        }
      }
      
      // Calculate new targets based on joystick input
      // For small incremental movements in the direction of joystick
      const distance = linear * 0.3; // 0.3 meter per joystick command
      const turnAngle = angular * 0.3; // 0.3 radians per joystick command
      
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
      
      // Create a standard move command with position-based parameters
      const joystickCommand: JoystickCommand = {
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
      
      // Send velocity-based joystick command to robot
      // Direct velocity control is more reliable than position-based movement
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
      
      // Simple velocity-based stop command - no need for position data
      const stopCommand: VelocityCommand = {
        vel_x: 0,        // Zero forward velocity
        vel_y: 0,        // Zero lateral velocity
        ang_z: 0,        // Zero angular velocity
        motion_name: "joystick_stop",
        duration: 0.2    // Short duration for immediate stop
      };
      
      // Send stop command to robot via velocity endpoint
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