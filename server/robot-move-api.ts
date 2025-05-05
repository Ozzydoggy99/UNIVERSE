import { Request, Response, Express } from 'express';
import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { getRobotCalibrator } from './robot-position-calibration';

// Cache for robot parameters
let robotParamsCache: any = null;
let lastParamsFetchTime = 0;
const PARAMS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch robot parameters
 * @returns Robot parameters
 */
async function fetchRobotParams() {
  try {
    // Check cache first
    const now = Date.now();
    if (robotParamsCache && (now - lastParamsFetchTime) < PARAMS_CACHE_TTL) {
      return robotParamsCache;
    }

    console.log('Fetching robot parameters...');
    const response = await fetch(`${ROBOT_API_URL}/robot-params`, {
      headers: {
        'Secret': ROBOT_SECRET || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch robot parameters: ${response.status} ${response.statusText}`);
    }
    
    const params = await response.json();
    console.log('Robot parameters:', params);
    
    // Update cache
    robotParamsCache = params;
    lastParamsFetchTime = now;
    
    return params;
  } catch (error) {
    console.error('Error fetching robot parameters:', error);
    // If we have a cached version, return that on error
    if (robotParamsCache) {
      return robotParamsCache;
    }
    
    // Return default parameters if we can't fetch
    return {
      "/wheel_control/max_forward_velocity": 0.8,
      "/wheel_control/max_backward_velocity": -0.2,
      "/wheel_control/max_forward_acc": 0.26,
      "/wheel_control/max_forward_decel": -2.0,
      "/wheel_control/max_angular_velocity": 0.78,
      "/wheel_control/acc_smoother/smooth_level": "normal",
      "/planning/auto_hold": true,
      "/control/bump_tolerance": 0.5,
      "/control/bump_based_speed_limit/enable": true
    };
  }
}

/**
 * Register robot movement API routes
 */
export function registerRobotMoveApiRoutes(app: Express) {
  // Get base robot API URL from constants
  const ROBOT_API_BASE_URL = ROBOT_API_URL;
  
  // Helper function to handle cancel logic in the background
  async function processCancelRequest(serialNumber: string, apiBaseUrl: string) {
    // Early return if empty serial number
    if (!serialNumber || serialNumber.trim() === '') {
      console.error('Cannot process cancel request: No serial number provided');
      return;
    }
    try {
      console.log(`Cancelling movement for robot ${serialNumber}`);

      // First check if there are any active moves
      const movesResponse = await fetch(`${apiBaseUrl}/chassis/moves`, {
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        }
      });
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
            'Secret': ROBOT_SECRET || ''
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
            'Secret': ROBOT_SECRET || ''
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
      
      // Get robot parameters for optimized movement
      const robotParams = await fetchRobotParams();
      
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
      
      // Apply robot parameter optimizations - adapt based on robot configuration
      if (!moveData.properties) {
        moveData.properties = {};
      }
      
      // Apply velocity limits from robot parameters
      if (moveData.type === 'differential') {
        // For direct differential drive control
        const maxForwardVel = robotParams['/wheel_control/max_forward_velocity'] || 0.8;
        const maxBackwardVel = robotParams['/wheel_control/max_backward_velocity'] || -0.2;
        const maxAngularVel = robotParams['/wheel_control/max_angular_velocity'] || 0.78;
        
        // Cap the velocities to the robot's limits
        if (moveData.linear_velocity > 0) {
          moveData.linear_velocity = Math.min(moveData.linear_velocity, maxForwardVel);
        } else {
          moveData.linear_velocity = Math.max(moveData.linear_velocity, maxBackwardVel);
        }
        
        // Cap angular velocity
        moveData.angular_velocity = Math.max(
          -maxAngularVel,
          Math.min(moveData.angular_velocity, maxAngularVel)
        );
        
        // Set acceleration smoother if not explicitly specified
        if (!moveData.properties.acc_smoother_level) {
          moveData.properties.acc_smoother_level = robotParams['/wheel_control/acc_smoother/smooth_level'] || 'normal';
        }
      } else if (moveData.type === 'inplace_rotate') {
        // For rotational movement, set appropriate parameters
        const maxAngularVel = robotParams['/wheel_control/max_angular_velocity'] || 0.78;
        
        // Ensure we don't exceed max angular velocity
        if (moveData.properties && typeof moveData.properties.angular_velocity === 'number') {
          moveData.properties.angular_velocity = Math.max(
            -maxAngularVel,
            Math.min(moveData.properties.angular_velocity, maxAngularVel)
          );
        } else if (!moveData.properties.angular_velocity) {
          // Default angular velocity if not specified
          moveData.properties.angular_velocity = maxAngularVel / 2;
        }
      } else if (moveData.type === 'standard') {
        // For standard movement - point to point navigation
        // Set auto_hold based on robot param but can be overridden
        if (moveData.properties.auto_hold === undefined) {
          moveData.properties.auto_hold = robotParams['/planning/auto_hold'] !== undefined 
            ? robotParams['/planning/auto_hold'] 
            : true;
        }
      }

      // Log detailed move command data for debugging
      console.log('Move command details:', {
        serialNumber,
        type: moveData.type,
        target: {
          x: moveData.target_x,
          y: moveData.target_y,
          orientation: moveData.target_ori
        },
        properties: moveData.properties
      });
      
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
            'Secret': ROBOT_SECRET || ''
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
      // Make sure serial number is never undefined
      const robotSerialNumber = serialNumber || 'L382502104987ir';
      processCancelRequest(robotSerialNumber, ROBOT_API_BASE_URL).catch(error => {
        console.error('Background cancel error:', error);
      });
    } catch (error) {
      console.error('Error cancelling robot movement:', error);
      res.status(500).json({ error: 'Failed to cancel robot movement' });
    }
  });
}