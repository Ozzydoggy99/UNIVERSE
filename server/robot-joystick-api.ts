import { Express, Request, Response } from 'express';
import fetch from 'node-fetch';

const ROBOT_API_URL = 'http://47.180.91.99:8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET || '';
const ROBOT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Secret ${ROBOT_SECRET}`
};

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
      
      // Set direct velocity command using the "differential" type move
      // This uses the 'chassis/moves' endpoint with a special type
      const joystickCommand = {
        type: "differential",
        creator: "web_interface",
        linear_velocity: linear,   // Linear velocity in m/s (positive for forward)
        angular_velocity: angular, // Angular velocity in rad/s
        properties: {
          acc_smoother_level: "normal"
        }
      };
      
      // Send joystick command to robot
      // Use /api/command endpoint which supports direct velocity commands
      const joystickUrl = `${ROBOT_API_URL}/api/command`;
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
      
      // Stop command with zero velocities
      // Format for the /api/command endpoint using the same format as move commands
      const stopCommand = {
        name: "joystick_control",
        vel_x: 0,  // Zero linear velocity
        vel_y: 0,  // Zero lateral velocity 
        ang_z: 0   // Zero angular velocity
      };
      
      // Send stop command to robot
      // Use /api/command endpoint which supports direct velocity commands
      const joystickUrl = `${ROBOT_API_URL}/api/command`;
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