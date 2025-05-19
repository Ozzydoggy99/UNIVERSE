/**
 * Dynamic Points API
 * 
 * This API provides endpoints to detect and retrieve robot map points dynamically,
 * allowing the system to automatically incorporate new points without code changes.
 */

import express from 'express';
import { getPointById, fetchRobotPoints, clearCache } from './robot-live-points';

// Create a router to handle dynamic point API endpoints
const router = express.Router();

// GET /api/dynamic-points - Get all robot map points
router.get('/', async (req, res) => {
  try {
    console.log('[DYNAMIC-POINTS-API] Fetching all robot map points');
    const points = await fetchRobotPoints();
    
    res.json({
      success: true,
      count: points.length,
      points
    });
  } catch (error) {
    console.error('[DYNAMIC-POINTS-API] Error fetching points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch robot map points'
    });
  }
});

// GET /api/dynamic-points/:pointId - Get a specific point by ID
router.get('/:pointId', async (req, res) => {
  try {
    const { pointId } = req.params;
    console.log(`[DYNAMIC-POINTS-API] Looking up point: ${pointId}`);
    
    const point = await getPointById(pointId);
    
    if (point) {
      console.log(`[DYNAMIC-POINTS-API] Found point: ${pointId}`, point);
      res.json({
        success: true,
        found: true,
        point
      });
    } else {
      console.log(`[DYNAMIC-POINTS-API] Point not found: ${pointId}`);
      res.json({
        success: true,
        found: false
      });
    }
  } catch (error) {
    console.error('[DYNAMIC-POINTS-API] Error fetching point:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch robot map point'
    });
  }
});

// POST /api/dynamic-points/clear-cache - Clear the points cache
router.post('/clear-cache', (req, res) => {
  try {
    console.log('[DYNAMIC-POINTS-API] Clearing points cache');
    clearCache();
    
    res.json({
      success: true,
      message: 'Points cache cleared successfully'
    });
  } catch (error) {
    console.error('[DYNAMIC-POINTS-API] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear points cache'
    });
  }
});

export default router;