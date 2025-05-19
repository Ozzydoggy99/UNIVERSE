/**
 * Robot Points API
 * 
 * This API provides endpoints for working with robot map points,
 * including retrieving specific point data based on ID.
 */

import express, { Request, Response } from 'express';
import { getPoint, getRobotPointsMap } from './robot-map-data';

const router = express.Router();

/**
 * GET /api/robot-points
 * Returns the full robot points map
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const pointsMap = getRobotPointsMap();
    res.json({ success: true, pointsMap });
  } catch (error: any) {
    console.error('Error in robot-points API:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error retrieving robot points map'
    });
  }
});

/**
 * GET /api/robot-points/:pointId
 * Get coordinates for a specific point ID
 */
router.get('/:pointId', (req: Request, res: Response) => {
  try {
    const { pointId } = req.params;
    
    if (!pointId) {
      return res.status(400).json({
        success: false,
        error: 'Point ID is required'
      });
    }
    
    const point = getPoint(pointId);
    
    if (!point) {
      return res.json({
        success: true,
        found: false,
        message: `Point '${pointId}' not found`
      });
    }
    
    res.json({
      success: true,
      found: true,
      point
    });
  } catch (error: any) {
    console.error(`Error getting point ${req.params.pointId}:`, error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error retrieving point'
    });
  }
});

export default router;