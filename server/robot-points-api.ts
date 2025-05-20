// server/robot-points-api.ts

import express, { Request, Response } from 'express';
import axios from 'axios';
import { Point } from './types';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';
import { 
  getShelfPoints, 
  fetchRobotMapPoints as fetchLiveMapPoints,
  getShelfPointsByFloor,
  getSpecialPoints,
  getAllFloors
} from './robot-map-data';

/**
 * Retrieve map points from the robot API - throws error if API is unavailable 
 * or returns invalid data
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  // First try to fetch points from the live API implementation
  console.log(`Fetching live map points from robot API at ${ROBOT_API_URL}...`);
  console.log(`Using auth secret starting with: ${ROBOT_SECRET.substring(0, 4)}...`);
  
  // First test if the robot API is accessible - try different endpoints
  try {
    // Try different endpoints to find one that works
    const testEndpoints = [
      '/status', 
      '/device/info', 
      '/state',
      '/maps',
      '/chassis/moves/latest'
    ];
    
    let connected = false;
    for (const endpoint of testEndpoints) {
      try {
        console.log(`Trying endpoint: ${ROBOT_API_URL}${endpoint}`);
        const testResponse = await axios.get(`${ROBOT_API_URL}${endpoint}`, {
          headers: getAuthHeaders()
        });
        console.log(`✅ Robot API connection test successful with endpoint ${endpoint}: ${JSON.stringify(testResponse.data).substring(0, 100)}...`);
        connected = true;
        break;
      } catch (err) {
        const endpointError = err as Error;
        console.log(`Endpoint ${endpoint} failed: ${endpointError.message}`);
      }
    }
    
    if (!connected) {
      throw new Error('All connection test endpoints failed');
    }
  } catch (err) {
    const testError = err as Error;
    console.error(`❌ Robot API connection test failed:`, testError.message);
    throw new Error(`Robot API connection failed: ${testError.message}`);
  }
  
  // Now fetch the actual map points
  const livePoints = await fetchLiveMapPoints();
  
  if (livePoints && livePoints.length > 0) {
    console.log(`✅ Successfully fetched ${livePoints.length} live map points`);
    return livePoints;
  }
  
  // If we get here with empty points, throw an error - no fallbacks
  throw new Error('No map points found from robot API');
}

/**
 * Register robot points API routes
 */
export function registerRobotPointRoutes(app: express.Express) {
  /**
   * GET /api/robots/points
   * Get all map points for the current robot
   */
  app.get('/api/robots/points', async (req: Request, res: Response) => {
    try {
      const points = await fetchRobotMapPoints();
      res.json(points);
    } catch (error: any) {
      console.error('❌ Failed to load map points:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * GET /api/robots/points/shelves
   * Get only numeric shelf points from current robot map
   */
  app.get('/api/robots/points/shelves', async (req: Request, res: Response) => {
    try {
      const allPoints = await fetchRobotMapPoints();
      const shelfPoints = getShelfPoints(allPoints);
      res.json(shelfPoints);
    } catch (error: any) {
      console.error('❌ Failed to load shelf points:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * GET /api/robots/points/full
   * Returns shelves grouped by floor, special points, and floor list
   */
  app.get('/api/robots/points/full', async (req: Request, res: Response) => {
    try {
      let points;
      try {
        points = await fetchRobotMapPoints();
      } catch (err) {
        console.error('❌ Failed to fetch live robot points, using fallback point data');
        // Use hardcoded point data from robot-points-map.ts
        const { getShelfPoint, getShelfDockingPoint } = await import('./robot-points-map');
        
        // Create minimal point data from our hardcoded data
        points = [
          { id: '050_load', x: -2.847, y: 2.311, theta: 0.0, floor: '1' },
          { id: '050_load_docking', x: -1.887, y: 2.311, theta: 0.0, floor: '1' },
          { id: '001_load', x: -2.861, y: 3.383, theta: 0.0, floor: '1' },
          { id: '001_load_docking', x: -1.850, y: 3.366, theta: 0.0, floor: '1' },
          { id: '104_load', x: 1.5, y: 3.2, theta: 0.0, floor: '1' },
          { id: '104_load_docking', x: 1.0, y: 3.2, theta: 0.0, floor: '1' },
        ];
      }
      
      const shelvesByFloor = getShelfPointsByFloor(points);
      const specialPoints = getSpecialPoints(points);
      const allFloors = getAllFloors(points);

      res.json({
        shelvesByFloor,
        specialPoints,
        allFloors
      });
    } catch (error: any) {
      console.error('❌ Failed to load full robot point data:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * GET /api/robots/points/:id
   * Get a specific map point by ID
   */
  app.get('/api/robots/points/:id', async (req: Request, res: Response) => {
    try {
      const pointId = req.params.id;
      const points = await fetchRobotMapPoints();
      const point = points.find(p => String(p.id).toLowerCase() === String(pointId).toLowerCase());
      
      if (!point) {
        return res.status(404).json({ error: `Point with ID ${pointId} not found` });
      }
      
      res.json(point);
    } catch (error: any) {
      console.error(`❌ Failed to load point ${req.params.id}:`, error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });
}