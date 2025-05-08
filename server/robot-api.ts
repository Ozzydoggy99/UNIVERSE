import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "./robot-constants";
import { Express, Request, Response } from 'express';

const headers = { "x-api-key": ROBOT_SECRET };

/**
 * Register all robot-related API routes
 * @param app Express application
 */
export function registerRobotApiRoutes(app: Express) {
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
    
    // Check if the latest chassis state indicates charging
    try {
      // First try the chassis state endpoint
      const stateResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
      const stateData = stateResponse.data;
      
      if (stateData && stateData.charging === true) {
        console.log('Robot is charging according to chassis state');
        return true;
      }
    } catch (chassisError) {
      console.log('Could not get chassis state to check charging status');
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
    } catch (batteryError) {
      console.log('Could not get battery state to check charging status');
    }
    
    // If we've checked all endpoints and found no indication of charging
    return false;
  } catch (error) {
    console.error('Error checking robot charging status:', error);
    // Default to false if we can't determine the charging status
    return false;
  }
}