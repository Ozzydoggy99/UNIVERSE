// server/robot-points-api.ts

import express, { Request, Response } from 'express';
import axios from 'axios';
import { Point } from './types';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { ROBOT_MAP_POINTS, getShelfPoints, fetchRobotMapPoints as fetchLiveMapPoints } from './robot-map-data';

/**
 * Retrieve map points from robot API or fallback to hardcoded points
 * This function is used to fetch current map points from the robot or our fallback data
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  try {
    // First try to fetch points from the live API implementation
    console.log('Fetching live map points from robot API...');
    const livePoints = await fetchLiveMapPoints();
    
    if (livePoints && livePoints.length > 0) {
      console.log(`✅ Successfully fetched ${livePoints.length} live map points`);
      return livePoints;
    }
    
    // If we get here with empty points, fall back to the hardcoded data
    console.log('No live points found, using fallback data');
    return [...ROBOT_MAP_POINTS];
  } catch (error) {
    console.error('Failed to fetch robot map points:', error);
    // Return hardcoded points as a fallback
    console.log('Error fetching live points, using fallback data');
    return [...ROBOT_MAP_POINTS];
  }
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