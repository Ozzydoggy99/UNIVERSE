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
      
      // Set direct velocity command - the most reliable way to move forward
      const joystickCommand = {
        components: [
          {
            name: "vel_x",
            value: linear  // Linear velocity in m/s (positive for forward)
          },
          {
            name: "vel_y",
            value: 0       // No lateral movement
          },
          {
            name: "ang_z", 
            value: angular // Angular velocity in rad/s
          }
        ]
      };
      
      // Send joystick command to robot
      const joystickUrl = `${ROBOT_API_URL}/joystick`;
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
      const stopCommand = {
        components: [
          { name: "vel_x", value: 0 },
          { name: "vel_y", value: 0 },
          { name: "ang_z", value: 0 }
        ]
      };
      
      // Send stop command to robot
      const joystickUrl = `${ROBOT_API_URL}/joystick`;
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