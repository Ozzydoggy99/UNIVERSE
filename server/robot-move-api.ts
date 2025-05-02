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
      
      // Ensure all required fields are present for a standard move
      if (moveData.type === 'standard') {
        if (typeof moveData.target_x !== 'number' || typeof moveData.target_y !== 'number') {
          return res.status(400).json({ 
            error: 'Invalid move data: target_x and target_y must be numbers',
            received: { target_x: moveData.target_x, target_y: moveData.target_y } 
          });
        }
        
        // Add required fields if not present
        moveData.creator = moveData.creator || 'web_interface';
        moveData.target_accuracy = moveData.target_accuracy || 0.1;
      }

      console.log(`Sending move command to robot ${serialNumber}:`, JSON.stringify(moveData, null, 2));

      // Forward the request to the robot API according to documentation
      const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/chassis/moves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });

      let responseBody;
      try {
        responseBody = await robotResponse.text();
        console.log('Raw robot response:', responseBody);
      } catch (e) {
        console.error('Error getting response text:', e);
      }

      if (!robotResponse.ok) {
        console.error(`Robot API error: ${robotResponse.status} - ${responseBody}`);
        return res.status(robotResponse.status).json({ 
          error: `Robot API error: ${robotResponse.status}`,
          details: responseBody
        });
      }

      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        console.error('Failed to parse robot response as JSON:', e);
        data = { raw: responseBody };
      }
      
      console.log('Robot move response:', data);
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

      // First check if there are any active moves
      const movesResponse = await fetch(`${ROBOT_API_BASE_URL}/chassis/moves`);
      const moves = await movesResponse.json();
      console.log('Current moves:', moves);
      
      // Find any move in 'moving' state
      const activeMove = Array.isArray(moves) ? moves.find((move: any) => move.state === 'moving') : null;
      
      if (activeMove) {
        console.log(`Found active move with ID: ${activeMove.id}`);
        
        // Cancel the specific move by ID
        const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/chassis/moves/${activeMove.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
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
        console.log('Robot cancel response:', data);
        res.status(200).json(data);
      } else {
        // No active move found, try the /current endpoint as fallback
        console.log('No active move found, trying to cancel current move');
        const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/chassis/moves/current`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
        });

        // Even if this fails, we'll return success as there might not be any active move
        const responseStatus = robotResponse.ok ? 200 : 200;
        const message = robotResponse.ok ? 
          await robotResponse.json() : 
          { message: "No active move to cancel" };
        
        console.log('Robot cancel response:', message);
        res.status(responseStatus).json(message);
      }
    } catch (error) {
      console.error('Error cancelling robot movement:', error);
      res.status(500).json({ error: 'Failed to cancel robot movement' });
    }
  });
}