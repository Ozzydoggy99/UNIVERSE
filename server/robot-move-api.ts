import { Express, Request, Response } from 'express';
import fetch from 'node-fetch';
import { PHYSICAL_ROBOT_SERIAL, ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

/**
 * Register robot movement API routes
 */
export function registerRobotMoveApiRoutes(app: Express) {
  // Send move command to the robot
  app.post('/api/robots/move/:serialNumber', async (req: Request, res: Response) => {
    const { serialNumber } = req.params;
    const moveData = req.body;
    
    try {
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      if (!ROBOT_API_URL) {
        throw new Error('Robot API URL not configured');
      }
      
      console.log(`Sending move command to robot ${serialNumber}:`, moveData);
      
      // Forward the move command to the robot's API
      const response = await fetch(`${ROBOT_API_URL}/chassis/moves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET
        },
        body: JSON.stringify(moveData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Robot API returned ${response.status}: ${errorText}`);
      }
      
      const result = await response.json() as { id: string };
      console.log(`Move command sent to robot ${serialNumber}, result:`, result);
      
      res.json({
        success: true,
        moveId: result.id,
        message: 'Move command sent successfully'
      });
    } catch (error) {
      console.error(`Error sending move command to robot ${serialNumber}:`, error);
      res.status(500).json({ 
        error: 'Failed to send move command to robot',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Cancel the current move action
  app.post('/api/robots/move/:serialNumber/cancel', async (req: Request, res: Response) => {
    const { serialNumber } = req.params;
    
    try {
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      if (!ROBOT_API_URL) {
        throw new Error('Robot API URL not configured');
      }
      
      console.log(`Cancelling current move for robot ${serialNumber}`);
      
      // Forward the cancel command to the robot's API
      const response = await fetch(`${ROBOT_API_URL}/chassis/moves/current`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET
        },
        body: JSON.stringify({ state: "cancelled" })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Robot API returned ${response.status}: ${errorText}`);
      }
      
      const result = await response.json() as { state: string };
      console.log(`Move cancelled for robot ${serialNumber}, result:`, result);
      
      res.json({
        success: true,
        status: result.state,
        message: 'Move cancelled successfully'
      });
    } catch (error) {
      console.error(`Error cancelling move for robot ${serialNumber}:`, error);
      res.status(500).json({ 
        error: 'Failed to cancel robot movement',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}