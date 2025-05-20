/**
 * API for refreshing robot points and dynamically adding new points to the system
 * 
 * This API provides endpoints to:
 * 1. Refresh all points from the robot's map
 * 2. Add a specific point to the system
 * 
 * These endpoints allow the system to dynamically detect and incorporate
 * new points (like shelf 110) into workflows without requiring a restart.
 */

import express, { Request, Response } from 'express';
import robotPointsMap from './robot-points-map';

const refreshPointsRouter = express.Router();

/**
 * GET /api/robot-points/refresh
 * 
 * Refreshes all point data from the robot
 */
refreshPointsRouter.get('/refresh', async (req: Request, res: Response) => {
  try {
    console.log('Manually refreshing robot points map...');
    await robotPointsMap.refreshPointsFromRobot();
    
    // Return the updated list of shelf points
    const floorIds = robotPointsMap.getFloorIds();
    const shelfPoints: Record<string, string[]> = {};
    
    for (const floorId of floorIds) {
      shelfPoints[`floor${floorId}`] = robotPointsMap.getShelfPointNames(floorId);
    }
    
    res.json({
      success: true,
      message: 'Robot points refreshed successfully',
      shelfPoints
    });
  } catch (error) {
    console.error('Error refreshing robot points:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh robot points',
      error: String(error)
    });
  }
});

/**
 * POST /api/robot-points/add
 * 
 * Manually add a new point to the system
 * Body: {
 *   floorId: number,
 *   pointName: string,
 *   x: number,
 *   y: number,
 *   theta: number
 * }
 */
refreshPointsRouter.post('/add', (req: Request, res: Response) => {
  try {
    const { floorId, pointName, x, y, theta } = req.body;
    
    // Validate input
    if (!floorId || !pointName || x === undefined || y === undefined || theta === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Determine if we need to also add a docking point
    let dockingPointName;
    if (pointName.endsWith('_load') && !pointName.includes('_docking')) {
      dockingPointName = `${pointName}_docking`;
      
      // For this demo, we'll place the docking point 1 meter in front of the load point
      // In a real system, this would be calculated based on the orientation and rack specifications
      const dockingX = x + Math.cos(theta * (Math.PI / 180));
      const dockingY = y + Math.sin(theta * (Math.PI / 180));
      
      // Add the docking point
      robotPointsMap.addPoint(floorId, dockingPointName, {
        x: dockingX,
        y: dockingY,
        theta
      });
    }
    
    // Add the main point
    robotPointsMap.addPoint(floorId, pointName, {
      x,
      y,
      theta
    });
    
    res.json({
      success: true,
      message: 'Point added successfully',
      pointName,
      dockingPointName
    });
  } catch (error) {
    console.error('Error adding point:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add point',
      error: String(error)
    });
  }
});

export default refreshPointsRouter;

export function registerRefreshPointsRoutes(app: express.Express) {
  app.use('/api/robot-points', refreshPointsRouter);
}