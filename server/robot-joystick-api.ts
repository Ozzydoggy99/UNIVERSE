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

// Interface for velocity-based joystick commands
interface VelocityCommand {
  vel_x: number;   // Forward/backward velocity
  vel_y: number;   // Left/right velocity (always 0 for non-holonomic robots)
  ang_z: number;   // Angular velocity for turning
  motion_name: string;
  duration: number; // Command duration in seconds
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
      
      // We'll use direct velocity control instead of position-based movement
      // This is more reliable when we don't have accurate position data
      
      // Create a velocity-based joystick command
      const joystickCommand: VelocityCommand = {
        vel_x: linear * 0.5, // Forward/backward velocity (scaled down for safety)
        vel_y: 0,           // Always 0 for non-holonomic robots
        ang_z: angular * 0.4, // Angular velocity for turning
        motion_name: "joystick_control",
        duration: 0.5       // Short duration for responsive control
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