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
    console.log(`Fetching map points from ${ROBOT_API_URL}/maps/current_map/points`);
    
    const response = await axios.get(`${ROBOT_API_URL}/maps/current_map/points`, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    if (!response.data.points || !Array.isArray(response.data.points)) {
      throw new Error('Invalid response format: missing points array');
    }
    
    console.log(`Successfully fetched ${response.data.points.length} map points`);
    return response.data.points;
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