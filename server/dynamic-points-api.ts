/**
 * Dynamic Points API
 * 
 * This API provides endpoints to detect and retrieve robot map points dynamically,
 * allowing the system to automatically incorporate new points without code changes.
 */

import express, { Request, Response } from 'express';
import { fetchRobotPoints, getPointById, clearCache } from './robot-live-points';

const router = express.Router();

/**
 * GET /api/dynamic-points
 * Get all available points from the robot map
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('[DYNAMIC-POINTS-API] Fetching all robot map points');
    const points = await fetchRobotPoints();
    
    // Return the full list of points
    res.json({
      success: true,
      points
    });
  } catch (error: any) {
    console.error('[DYNAMIC-POINTS-API] Error fetching points:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch points: ${error.message}`
    });
  }
});

/**
 * GET /api/dynamic-points/:pointId
 * Get a specific point by ID from the robot map
 */
router.get('/:pointId', async (req: Request, res: Response) => {
  const { pointId } = req.params;
  
  if (!pointId) {
    return res.status(400).json({
      success: false,
      error: 'Point ID is required'
    });
  }
  
  try {
    console.log(`[DYNAMIC-POINTS-API] Looking up point: ${pointId}`);
    
    // Use the getPointById function to find the point
    const point = await getPointById(pointId);
    
    if (!point) {
      console.log(`[DYNAMIC-POINTS-API] Point not found: ${pointId}`);
      return res.json({
        success: true,
        found: false,
        message: `Point '${pointId}' not found on robot map`
      });
    }
    
    console.log(`[DYNAMIC-POINTS-API] Found point ${pointId}: (${point.x}, ${point.y})`);
    
    // Return the point data
    res.json({
      success: true,
      found: true,
      point
    });
  } catch (error: any) {
    console.error(`[DYNAMIC-POINTS-API] Error getting point ${pointId}:`, error.message);
    res.status(500).json({
      success: false,
      error: `Failed to get point: ${error.message}`
    });
  }
});

/**
 * POST /api/dynamic-points/refresh
 * Force refresh of the points cache
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    console.log('[DYNAMIC-POINTS-API] Refreshing points cache');
    
    // Clear the cache
    clearCache();
    
    // Fetch fresh points
    const points = await fetchRobotPoints();
    
    res.json({
      success: true,
      message: 'Points cache refreshed',
      count: points.length
    });
  } catch (error: any) {
    console.error('[DYNAMIC-POINTS-API] Error refreshing cache:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to refresh cache: ${error.message}`
    });
  }
});

/**
 * POST /api/dynamic-points/test
 * Test point lookup with multiple formats
 */
router.post('/test', async (req: Request, res: Response) => {
  const { pointId } = req.body;
  
  if (!pointId) {
    return res.status(400).json({
      success: false,
      error: 'Point ID is required'
    });
  }
  
  try {
    console.log(`[DYNAMIC-POINTS-API] Testing lookup for point: ${pointId}`);
    
    // Clear cache to ensure fresh data
    clearCache();
    
    // Test the primary ID
    const point = await getPointById(pointId);
    
    // Generate variants to test
    const variants = [
      pointId,
      pointId.endsWith('_load') ? pointId.replace('_load', '') : `${pointId}_load`,
      pointId.endsWith('_docking') ? pointId.replace('_docking', '') : `${pointId}_docking`,
      pointId.endsWith('_load_docking') ? pointId.replace('_load_docking', '') : `${pointId}_load_docking`
    ];
    
    // Try each variant
    const results = [];
    for (const variant of variants) {
      const variantPoint = await getPointById(variant);
      results.push({
        id: variant,
        found: !!variantPoint,
        point: variantPoint
      });
    }
    
    res.json({
      success: true,
      primary: {
        id: pointId,
        found: !!point,
        point
      },
      variants: results
    });
  } catch (error: any) {
    console.error(`[DYNAMIC-POINTS-API] Error testing point ${pointId}:`, error.message);
    res.status(500).json({
      success: false,
      error: `Failed to test point: ${error.message}`
    });
  }
});

export default router;