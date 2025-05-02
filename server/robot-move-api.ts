import { Request, Response, Express } from 'express';
import fetch from 'node-fetch';

/**
 * Register robot movement API routes
 */
export function registerRobotMoveApiRoutes(app: Express) {
  // Base robot API URL (will be replaced with environment variable or config)
  const ROBOT_API_BASE_URL = 'http://47.180.91.99:8090';
  
  // Separate function to handle cancel logic in the background
  async function processCancelRequest(serialNumber: string, apiBaseUrl: string) {
    try {
      console.log(`Cancelling movement for robot ${serialNumber}`);

      // First check if there are any active moves
      const movesResponse = await fetch(`${apiBaseUrl}/chassis/moves`);
      const moves = await movesResponse.json();
      
      // Find any move in 'moving' state
      const activeMove = Array.isArray(moves) ? moves.find((move: any) => move.state === 'moving') : null;
      
      if (activeMove) {
        console.log(`Found active move with ID: ${activeMove.id}`);
        
        // Cancel the specific move by ID
        const robotResponse = await fetch(`${apiBaseUrl}/chassis/moves/${activeMove.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
        });

        if (!robotResponse.ok) {
          const errorText = await robotResponse.text();
          console.error(`Robot API error: ${robotResponse.status} - ${errorText}`);
          return;
        }

        const data = await robotResponse.json();
        console.log('Robot cancel response:', data);
      } else {
        // No active move found, try the /current endpoint as fallback
        console.log('No active move found, trying to cancel current move');
        const robotResponse = await fetch(`${apiBaseUrl}/chassis/moves/current`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
        });

        if (robotResponse.ok) {
          const message = await robotResponse.json();
          console.log('Robot cancel response:', message);
        } else {
          console.log('No active moves to cancel');
        }
      }
    } catch (error) {
      console.error('Error in background cancel request:', error);
    }
  }

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

      // Forward the move request to the robot API
      // Immediately respond to client to avoid delay
      // This makes the joystick commands nearly instant
      res.status(202).json({ status: 'accepted', message: 'Command sent to robot' });
      
      // Then actually execute the robot command after response is sent
      try {
        // Now send the actual command to the robot in the background
        const robotResponse = await fetch(`${ROBOT_API_BASE_URL}/chassis/moves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(moveData),
        });
  
        // Log results but don't wait for them
        let responseBody = await robotResponse.text();
        
        if (!robotResponse.ok) {
          console.error(`Robot API error: ${robotResponse.status} - ${responseBody}`);
        } else {
          try {
            const data = JSON.parse(responseBody);
            console.log('Robot move response:', data);
          } catch (e) {
            console.log('Raw robot response:', responseBody);
          }
        }
      } catch (sendError) {
        console.error('Background error sending command to robot:', sendError);
      }
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

      // Immediately respond to client for better responsiveness
      res.status(202).json({ status: 'accepted', message: 'Cancel command sent to robot' });
      
      // Process the cancellation in the background
      processCancelRequest(serialNumber, ROBOT_API_BASE_URL).catch(error => {
        console.error('Background cancel error:', error);
      });
    } catch (error) {
      console.error('Error cancelling robot movement:', error);
      res.status(500).json({ error: 'Failed to cancel robot movement' });
    }
  });
  
  // Separate function to handle cancel logic in the background
  async function processCancelRequest(serialNumber: string, apiBaseUrl: string) {
    try {
      console.log(`Cancelling movement for robot ${serialNumber}`);

      // First check if there are any active moves
      const movesResponse = await fetch(`${apiBaseUrl}/chassis/moves`);
      const moves = await movesResponse.json();
      
      // Find any move in 'moving' state
      const activeMove = Array.isArray(moves) ? moves.find((move: any) => move.state === 'moving') : null;
      
      if (activeMove) {
        console.log(`Found active move with ID: ${activeMove.id}`);
        
        // Cancel the specific move by ID
        const robotResponse = await fetch(`${apiBaseUrl}/chassis/moves/${activeMove.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
        });

        if (!robotResponse.ok) {
          const errorText = await robotResponse.text();
          console.error(`Robot API error: ${robotResponse.status} - ${errorText}`);
          return;
        }

        const data = await robotResponse.json();
        console.log('Robot cancel response:', data);
      } else {
        // No active move found, try the /current endpoint as fallback
        console.log('No active move found, trying to cancel current move');
        const robotResponse = await fetch(`${apiBaseUrl}/chassis/moves/current`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: "cancelled" }),
        });

        if (robotResponse.ok) {
          const message = await robotResponse.json();
          console.log('Robot cancel response:', message);
        } else {
          console.log('No active moves to cancel');
        }
      }
    } catch (error) {
      console.error('Error in background cancel request:', error);
    }
  }
}