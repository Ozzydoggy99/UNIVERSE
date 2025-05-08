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
    // First get the latest move information
    const moveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { headers });
    const moveData = moveResponse.data;
    
    // If is_charging is explicitly set to true, the robot is charging
    if (moveData.is_charging === true) {
      console.log('Robot is charging according to move data');
      return true;
    }
    
    // Check if the latest system diagnostic or status indicates charging
    try {
      const statusResponse = await axios.get(`${ROBOT_API_URL}/device/info`, { headers });
      const statusData = statusResponse.data;
      
      // Check any available charging status in device info
      // This can vary depending on the robot model and API version
      if (statusData.power && 
          (statusData.power.charging === true || 
           statusData.power.status === 'charging' || 
           statusData.battery_status === 'charging')) {
        console.log('Robot is charging according to device info');
        return true;
      }
    } catch (error) {
      console.log('Could not get device info to check charging status, using move data only');
    }
    
    return false;
  } catch (error) {
    console.error('Error checking robot charging status:', error);
    // Default to false if we can't determine the charging status
    return false;
  }
}