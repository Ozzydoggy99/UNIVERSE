import { Request, Response, Express } from 'express';
import fetch from 'node-fetch';

/**
 * Register robot movement API routes
 */
export function registerRobotMoveApiRoutes(app: Express) {
  // Base robot API URL (will be replaced with environment variable or config)
  const ROBOT_API_BASE_URL = 'http://47.180.91.99:8090';

  /**
   * POST /api/robots/move/:serialNumber
   * Send a move command to the robot
   */
  app.post('/api/robots/move/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      if (!serialNumber) {
        return res.status(400).json({ error: 'Serial number is required' });
      }

      const moveData = req.body;
      
      if (!moveData || typeof moveData !== 'object') {
        return res.status(400).json({ error: 'Invalid move data' });
      }

      // Ensure required fields are present
      if (moveData.type !== 'standard') {
        return res.status(400).json({ error: 'Only standard movement type is supported' });
      }

      console.log(`Sending move command to robot ${serialNumber}:`, moveData);

      // Forward the request to the robot API
      const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });

      if (!robotResponse.ok) {
        const errorText = await robotResponse.text();
        console.error(`Robot API error: ${robotResponse.status} - ${errorText}`);
        return res.status(robotResponse.status).json({ 
          error: `Robot API error: ${robotResponse.status}`,
          details: errorText
        });
      }

      const data = await robotResponse.json();
      res.status(200).json(data);
    } catch (error) {
      console.error('Error sending move command to robot:', error);
      res.status(500).json({ error: 'Failed to send move command to robot' });
    }
  });

  /**
   * POST /api/robots/move/:serialNumber/cancel
   * Cancel the current robot movement
   */
  app.post('/api/robots/move/:serialNumber/cancel', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      if (!serialNumber) {
        return res.status(400).json({ error: 'Serial number is required' });
      }

      console.log(`Cancelling movement for robot ${serialNumber}`);

      // Forward the cancel request to the robot API
      const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/move/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!robotResponse.ok) {
        const errorText = await robotResponse.text();
        console.error(`Robot API error: ${robotResponse.status} - ${errorText}`);
        return res.status(robotResponse.status).json({ 
          error: `Robot API error: ${robotResponse.status}`,
          details: errorText
        });
      }

      const data = await robotResponse.json();
      res.status(200).json(data);
    } catch (error) {
      console.error('Error cancelling robot movement:', error);
      res.status(500).json({ error: 'Failed to cancel robot movement' });
    }
  });
}