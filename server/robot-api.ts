// server/robot-api.ts
/**
 * Centralized Robot API Module
 * Contains all API calls to the robot to ensure consistent authentication and error handling
 */
import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET, ROBOT_SERIAL } from "./robot-constants";
import { Express, Request, Response } from 'express';

// Default headers with authentication
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

  // Get a specific map by ID
  app.get('/api/robot/maps/:id', async (req: Request, res: Response) => {
    try {
      const response = await fetchActiveMap(req.params.id);
      res.json(response.data);
    } catch (error: any) {
      console.error(`Error fetching map ${req.params.id}:`, error);
      res.status(500).json({ 
        error: `Failed to fetch map ${req.params.id}`, 
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

  // Get current chassis status
  app.get('/api/robot/status', async (req: Request, res: Response) => {
    try {
      const response = await getChassisStatus();
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting chassis status:', error);
      res.status(500).json({ 
        error: 'Failed to get chassis status', 
        message: error.message 
      });
    }
  });

  // Get current robot pose
  app.get('/api/robot/pose', async (req: Request, res: Response) => {
    try {
      const response = await getRobotPose();
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting robot pose:', error);
      res.status(500).json({ 
        error: 'Failed to get robot pose', 
        message: error.message 
      });
    }
  });

  // Get device information
  app.get('/api/robot/info', async (req: Request, res: Response) => {
    try {
      const response = await getDeviceInfo();
      res.json(response.data);
    } catch (error: any) {
      console.error('Error getting device info:', error);
      res.status(500).json({ 
        error: 'Failed to get device info', 
        message: error.message 
      });
    }
  });

  // Initialize robot pose
  app.post('/api/robot/pose', async (req: Request, res: Response) => {
    try {
      const { x, y, theta } = req.body;
      
      if (typeof x !== 'number' || typeof y !== 'number' || typeof theta !== 'number') {
        return res.status(400).json({ error: 'Invalid coordinates. x, y, and theta must be numbers.' });
      }
      
      const response = await initializePose(x, y, theta);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error initializing pose:', error);
      res.status(500).json({ 
        error: 'Failed to initialize pose', 
        message: error.message 
      });
    }
  });

  // Set current map
  app.post('/api/robot/maps/current', async (req: Request, res: Response) => {
    try {
      const { mapId } = req.body;
      
      if (typeof mapId !== 'string') {
        return res.status(400).json({ error: 'Invalid map ID. mapId must be a string.' });
      }
      
      const response = await setCurrentMap(mapId);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error setting current map:', error);
      res.status(500).json({ 
        error: 'Failed to set current map', 
        message: error.message 
      });
    }
  });
}

/**
 * Fetch list of available maps from the robot
 */
export async function fetchMaps() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/maps`, { headers });
    return response;
  } catch (error) {
    console.error("Error fetching maps:", error);
    throw error;
  }
}

/**
 * Fetch details for a specific map by ID
 */
export async function fetchActiveMap(mapId: string) {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, { headers });
    return response;
  } catch (error) {
    console.error(`Error fetching map ${mapId}:`, error);
    throw error;
  }
}

/**
 * Fetch map points for a specific map
 */
export async function fetchMapPoints(mapId: string) {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/maps/${mapId}/points`, { headers });
    return response;
  } catch (error) {
    console.error(`Error fetching points for map ${mapId}:`, error);
    throw error;
  }
}

/**
 * Move robot to a specific x,y coordinate
 */
export async function moveToPoint(x: number, y: number) {
  try {
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      action: "move_to",
      target_x: x,
      target_y: y,
    }, { headers });
    return response;
  } catch (error) {
    console.error(`Error moving to point (${x}, ${y}):`, error);
    throw error;
  }
}

/**
 * Get status of the last move command
 */
export async function getLastMoveStatus() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { headers });
    return response;
  } catch (error) {
    console.error("Error getting last move status:", error);
    throw error;
  }
}

/**
 * Get current chassis status
 */
export async function getChassisStatus() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/chassis/status`, { headers });
    return response;
  } catch (error) {
    console.error("Error getting chassis status:", error);
    throw error;
  }
}

/**
 * Get current robot pose (position and orientation)
 */
export async function getRobotPose() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers });
    return response;
  } catch (error) {
    console.error("Error getting robot pose:", error);
    throw error;
  }
}

/**
 * Get device information
 */
export async function getDeviceInfo() {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/device/info`, { headers });
    return response;
  } catch (error) {
    console.error("Error getting device info:", error);
    throw error;
  }
}

/**
 * Set the current map for the robot
 */
export async function setCurrentMap(mapId: string) {
  try {
    const response = await axios.post(`${ROBOT_API_URL}/maps/current`, { 
      map_id: mapId 
    }, { headers });
    return response;
  } catch (error) {
    console.error(`Error setting current map to ${mapId}:`, error);
    throw error;
  }
}

/**
 * Initialize pose - set the robot's current position and orientation
 */
export async function initializePose(x: number, y: number, theta: number) {
  try {
    const response = await axios.post(`${ROBOT_API_URL}/chassis/pose`, {
      x,
      y,
      theta
    }, { headers });
    return response;
  } catch (error) {
    console.error(`Error initializing pose at (${x}, ${y}, ${theta}):`, error);
    throw error;
  }
}