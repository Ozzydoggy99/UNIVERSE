import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET, ROBOT_SERIAL } from "./robot-constants";
import { Express, Request, Response } from 'express';

const headers = { "x-api-key": ROBOT_SECRET };

/**
 * Register all robot-related API routes
 * @param app Express application
 */
export function registerRobotApiRoutes(app: Express) {
  // Check if the robot is currently charging
  app.get('/api/robot/charging-status', async (req: Request, res: Response) => {
    try {
      const isCharging = await isRobotCharging();
      res.json({ 
        charging: isCharging,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error checking robot charging status:', error);
      res.status(500).json({ 
        error: 'Failed to check robot charging status', 
        message: error.message 
      });
    }
  });

  // Get a list of all available maps
  app.get('/api/robot/maps', async (req: Request, res: Response) => {
    try {
      const response = await fetchMaps();
      res.json(response.data);
    } catch (error: any) {
      console.error('Error fetching maps:', error);
      res.status(500).json({ 
        error: 'Failed to fetch maps', 
        message: error.message 
      });
    }
  });

  // Get points for a specific map
  app.get('/api/robot/maps/:id/points', async (req: Request, res: Response) => {
    try {
      const response = await fetchMapPoints(req.params.id);
      res.json(response.data);
    } catch (error: any) {
      console.error(`Error fetching points for map ${req.params.id}:`, error);
      res.status(500).json({ 
        error: `Failed to fetch points for map ${req.params.id}`, 
        message: error.message 
      });
    }
  });

  // Move robot to a specific point
  app.post('/api/robot/move', async (req: Request, res: Response) => {
    try {
      const { x, y } = req.body;
      
      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({ error: 'Invalid coordinates. Both x and y must be numbers.' });
      }
      
      const response = await moveToPoint(x, y);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error moving robot:', error);
      res.status(500).json({ 
        error: 'Failed to move robot', 
        message: error.message 
      });
    }
  });

  // Get last move status
  app.get('/api/robot/move/latest', async (req: Request, res: Response) => {
    try {
      const response = await getLastMoveStatus();
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting last move status:', error);
      res.status(500).json({ 
        error: 'Failed to get last move status', 
        message: error.message 
      });
    }
  });
}

export async function fetchMaps() {
  return axios.get(`${ROBOT_API_URL}/maps`, { headers });
}

export async function fetchMapPoints(mapId: string) {
  return axios.get(`${ROBOT_API_URL}/maps/${mapId}/points`, { headers });
}

export async function moveToPoint(x: number, y: number) {
  return axios.post(`${ROBOT_API_URL}/chassis/moves`, {
    action: "move_to",
    target_x: x,
    target_y: y,
  }, { headers });
}

export async function getLastMoveStatus() {
  return axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { headers });
}

/**
 * Check if robot is currently charging
 * @returns Promise resolving to boolean indicating charging status
 */
export async function isRobotCharging(): Promise<boolean> {
  try {
    // Try to get the battery state information via WebSocket subscription
    // We will rely on the latest move data instead, which is more reliable for status
    try {
      const moveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { headers });
      const moveData = moveResponse.data;
      
      // Check if the robot's latest move status contains an error about charging
      if (moveData && moveData.error) {
        const errorMessage = moveData.error.toLowerCase();
        if (errorMessage.includes('charging') || 
            errorMessage.includes('jacking up is not allowed') ||
            errorMessage.includes('while charging')) {
          console.log('Robot is charging according to move error:', moveData.error);
          return true;
        }
      }
      
      // If the move response has an explicit is_charging field
      if (moveData && moveData.is_charging === true) {
        console.log('Robot is charging according to move data');
        return true;
      }
    } catch (moveError: any) {
      if (moveError.response && moveError.response.status === 404) {
        console.log('Robot API endpoint not found - cannot check move data for charging status');
        // Continue to next method instead of throwing
      }
      console.log('Error checking move data for charging status:', moveError.message);
    }
    
    // Check if the latest chassis state indicates charging
    try {
      // First try the chassis state endpoint
      const stateResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
      const stateData = stateResponse.data;
      
      if (stateData && stateData.charging === true) {
        console.log('Robot is charging according to chassis state');
        return true;
      }
    } catch (chassisError: any) {
      if (chassisError.response && chassisError.response.status === 404) {
        console.log('Robot API endpoint not found - cannot check chassis state for charging status');
        // Continue to next method instead of throwing
      }
      console.log('Could not get chassis state to check charging status:', chassisError.message);
    }
    
    // Finally, check battery state information as a fallback
    try {
      const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery-state`, { headers });
      const batteryData = batteryResponse.data;
      
      // Check if response contains HTML with charging status
      if (typeof batteryData === 'string' && 
          (batteryData.includes('"status": "charging"') || 
           batteryData.includes('"status":"charging"'))) {
        console.log('Robot is charging according to battery state');
        return true;
      }
    } catch (batteryError: any) {
      if (batteryError.response && batteryError.response.status === 404) {
        console.log('Robot API endpoint not found - cannot check battery state for charging status');
        // Continue instead of throwing
      }
      console.log('Could not get battery state to check charging status:', batteryError.message);
    }
    
    // If we've checked all endpoints and found no indication of charging
    // Return false - means the robot is not charging or we couldn't determine
    console.log('No charging indicators found, assuming robot is not charging');
    return false;
  } catch (error) {
    console.log('Error checking robot charging status:', error);
    // Instead of throwing, return false as default to allow operations to continue
    console.log('Defaulting to not charging to allow operations to continue');
    return false;
  }
}

/**
 * Check if robot's emergency stop button is pressed
 * @returns Promise resolving to boolean indicating emergency stop status
 */
export async function isEmergencyStopPressed(): Promise<boolean> {
  try {
    // Try to perform a quick jack-up test to check if emergency stop is pressed
    try {
      await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      
      // If we get here, the emergency stop is not pressed
      // Immediately jack down to reset
      try {
        await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
      } catch (jackDownError) {
        console.log('Error resetting jack after emergency stop test:', jackDownError);
      }
      
      return false;
    } catch (error: any) {
      // If we get a 500 error with emergency stop message, we know it's pressed
      if (error.response && error.response.status === 500) {
        if (error.response.data && error.response.data.detail && 
            error.response.data.detail.includes("Emergency stop button is pressed")) {
          console.log('Emergency stop button is pressed according to jack_up test');
          return true;
        }
      }
      
      // Any other error means we can't determine
      console.log('Error checking emergency stop status via jack_up:', error.message);
    }
    
    // If we've checked available endpoints and found no indication of emergency stop
    console.log('No emergency stop indicators found, assuming emergency stop is not pressed');
    return false;
  } catch (error) {
    console.log('Error checking robot emergency stop status:', error);
    // Instead of throwing, return false as default to allow operations to continue
    console.log('Defaulting to emergency stop not pressed to allow operations to continue');
    return false;
  }
}

/**
 * Send the robot back to its charging station
 * @returns Promise resolving to operation result
 */
export async function returnToCharger(): Promise<any> {
  try {
    console.log(`Sending robot ${ROBOT_SERIAL} back to charging station...`);
    
    // First try the dedicated return to charger endpoint if available
    try {
      const response = await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { headers });
      console.log('Return to charger command sent successfully via services endpoint');
      return {
        success: true,
        message: 'Return to charger command sent successfully',
        response: response.data
      };
    } catch (serviceError: any) {
      // If service endpoint fails, log the error but continue with fallback methods
      console.log('Error using services/return_to_charger endpoint:', serviceError.message);
      console.log('Trying alternative method...');
      
      if (serviceError.response && serviceError.response.status === 404) {
        // If endpoint doesn't exist, this is expected - try next method
      } else {
        // For unexpected errors, still try the next method but log the detailed error
        console.log('Unexpected error from return_to_charger service:', serviceError);
      }
    }
    
    // Try the task API method to create a charging task
    try {
      // Create a task with runType 25 (charging) as per documentation
      const chargingTask = {
        runType: 25, // Charging task type
        name: `Return to Charger (${new Date().toISOString()})`,
        robotSn: ROBOT_SERIAL,
        taskPriority: 10, // High priority for charging
        isLoop: false
      };
      
      const taskResponse = await axios.post(`${ROBOT_API_URL}/api/v2/task`, chargingTask, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ROBOT_SECRET
        }
      });
      
      console.log('Return to charger command sent successfully via task API');
      return {
        success: true,
        message: 'Created charging task via task API',
        taskId: taskResponse.data.id || taskResponse.data.taskId,
        response: taskResponse.data
      };
    } catch (taskError: any) {
      // If task API fails, log the error and try the last fallback method
      console.log('Error creating charging task:', taskError.message);
      
      if (taskError.response && taskError.response.data) {
        console.log('Task API error response:', taskError.response.data);
      }
      
      // Fall back to just finding the charger point and moving there
      try {
        const mapsResponse = await fetchMaps();
        const maps = mapsResponse.data;
        
        if (maps && maps.length > 0) {
          // Use the first map by default
          const mapId = maps[0].id || maps[0].uid;
          
          const pointsResponse = await fetchMapPoints(mapId);
          const points = pointsResponse.data;
          
          // Find the charger point
          const chargerPoint = points.find((p: any) => 
            p.id === 'charger' || 
            p.id === 'Charger' || 
            (p.id && p.id.toLowerCase().includes('charg'))
          );
          
          if (chargerPoint) {
            console.log(`Found charger point at (${chargerPoint.x}, ${chargerPoint.y})`);
            
            // Move to the charger point
            const moveResponse = await moveToPoint(chargerPoint.x, chargerPoint.y);
            
            return {
              success: true,
              message: 'Moving to charger point via move command (fallback method)',
              moveId: moveResponse.data.id,
              response: moveResponse.data
            };
          } else {
            throw new Error('Could not find charger point in map data');
          }
        } else {
          throw new Error('No maps found');
        }
      } catch (moveError: any) {
        console.log('All return to charger methods failed:', moveError.message);
        throw new Error(`Failed to return robot to charger: ${moveError.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error in returnToCharger function:', error);
    throw error;
  }
}