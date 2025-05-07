// server/robot-points-api.ts
import { Express, Request, Response } from 'express';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  description?: string;
}

/**
 * Fetch map points from the robot
 * @returns Array of map points
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  try {
    // First try to get the current map ID
    console.log(`Fetching current map from robot at ${ROBOT_API_URL}/maps/current_map`);
    
    const currentMapResponse = await axios.get(`${ROBOT_API_URL}/maps/current_map`, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    if (!currentMapResponse.data || !currentMapResponse.data.id) {
      throw new Error('Could not determine current map ID');
    }
    
    const currentMapId = currentMapResponse.data.id;
    console.log(`Current map ID: ${currentMapId}`);
    
    // Now fetch the points for this map ID
    const pointsUrl = `${ROBOT_API_URL}/maps/${currentMapId}/points`;
    console.log(`Fetching map points from ${pointsUrl}`);
    
    const response = await axios.get(pointsUrl, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format: expected array of points');
    }
    
    console.log(`Successfully fetched ${response.data.length} map points`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching robot map points:', error.message || error);
    throw new Error(`Failed to fetch map points: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Register API routes for robot points
 */
export function registerRobotPointsApiRoutes(app: Express) {
  /**
   * GET /api/robots/points
   * Get all map points from the robot's current map
   */
  app.get('/api/robots/points', async (req: Request, res: Response) => {
    try {
      const points = await fetchRobotMapPoints();
      res.json(points);
    } catch (error: any) {
      console.error('Error fetching map points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch map points', 
        details: error.message 
      });
    }
  });
  
  /**
   * GET /api/robots/points/shelves
   * Get only shelf points from the robot's current map
   * (any point that doesn't have pickup, dropoff, or standby in its ID)
   */
  app.get('/api/robots/points/shelves', async (req: Request, res: Response) => {
    try {
      const allPoints = await fetchRobotMapPoints();
      
      // Filter to only include shelf points
      const shelfPoints = allPoints.filter(point => {
        const id = point.id.toLowerCase();
        return !id.includes('pick') && !id.includes('drop') && !id.includes('desk') && !id.includes('standby');
      });
      
      res.json(shelfPoints);
    } catch (error: any) {
      console.error('Error fetching shelf points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch shelf points', 
        details: error.message 
      });
    }
  });
  
  /**
   * GET /api/fetch-points
   * Alternative endpoint for fetching points (from simplified server)
   */
  app.get('/api/fetch-points', async (req: Request, res: Response) => {
    try {
      const points = await fetchRobotMapPoints();
      res.json({ points });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      res.status(500).json({ error: 'Could not fetch points.' });
    }
  });
}