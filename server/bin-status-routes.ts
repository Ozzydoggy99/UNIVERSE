// server/bin-status-routes.ts
import express from 'express';
import { checkForBin } from './bin-detection';
import { fetchRobotMapPoints } from './robot-map-data';
import { Point } from './types';

// In-memory storage for temporarily overriding bin status
const binStatusOverrides: Record<string, boolean> = {};

/**
 * Register bin status management routes
 * This is used for testing and administrative purposes
 */
export function registerBinStatusRoutes(app: express.Express) {
  /**
   * GET /api/bins/status
   * Check if a bin is present at a specific location
   */
  app.get('/api/bins/status', async (req, res) => {
    try {
      const location = req.query.location as string;
      
      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Missing location parameter'
        });
      }
      
      // First check if this location has an override
      if (location in binStatusOverrides) {
        console.log(`Using bin status override for ${location}: ${binStatusOverrides[location]}`);
        return res.json({
          success: true,
          location,
          binPresent: binStatusOverrides[location],
          source: 'override'
        });
      }
      
      // If no override, get map points to find coordinates
      const mapPoints = await fetchRobotMapPoints();
      const point = mapPoints.find((p: Point) => p.id === location);
      
      if (!point) {
        return res.status(404).json({
          success: false,
          message: `Location "${location}" not found in map data`
        });
      }
      
      // Use bin detection logic to check
      const binPresent = await checkForBin(point.x, point.y, point.id);
      
      return res.json({
        success: true,
        location,
        pointId: point.id,
        coordinates: { x: point.x, y: point.y },
        binPresent,
        source: 'detection'
      });
    } catch (error: any) {
      console.error(`Error checking bin status: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/bins/clear
   * Clear a bin from a specific location (used for testing)
   */
  app.post('/api/bins/clear', async (req, res) => {
    try {
      const { location, clearAction } = req.body;
      
      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Missing location parameter'
        });
      }
      
      if (!clearAction || !['manual_removal', 'robot_pickup'].includes(clearAction)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid clearAction (must be "manual_removal" or "robot_pickup")'
        });
      }
      
      // Get map points to confirm location exists
      const mapPoints = await fetchRobotMapPoints();
      const point = mapPoints.find((p: Point) => p.id === location);
      
      if (!point) {
        return res.status(404).json({
          success: false,
          message: `Location "${location}" not found in map data`
        });
      }
      
      // Set override to indicate bin is not present
      binStatusOverrides[location] = false;
      console.log(`✅ Set override for ${location}: bin is now CLEAR (action: ${clearAction})`);
      
      return res.json({
        success: true,
        message: `Bin at ${location} has been cleared (${clearAction})`,
        location,
        binPresent: false
      });
    } catch (error: any) {
      console.error(`Error clearing bin status: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/bins/add
   * Add a bin to a specific location (used for testing)
   */
  app.post('/api/bins/add', async (req, res) => {
    try {
      const { location, addAction } = req.body;
      
      if (!location) {
        return res.status(400).json({
          success: false,
          message: 'Missing location parameter'
        });
      }
      
      if (!addAction || !['manual_placement', 'robot_dropoff'].includes(addAction)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid addAction (must be "manual_placement" or "robot_dropoff")'
        });
      }
      
      // Get map points to confirm location exists
      const mapPoints = await fetchRobotMapPoints();
      const point = mapPoints.find((p: Point) => p.id === location);
      
      if (!point) {
        return res.status(404).json({
          success: false,
          message: `Location "${location}" not found in map data`
        });
      }
      
      // Set override to indicate bin is present
      binStatusOverrides[location] = true;
      console.log(`✅ Set override for ${location}: bin is now PRESENT (action: ${addAction})`);
      
      return res.json({
        success: true,
        message: `Bin has been added to ${location} (${addAction})`,
        location,
        binPresent: true
      });
    } catch (error: any) {
      console.error(`Error adding bin status: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/bins/reset-overrides
   * Reset all bin status overrides
   */
  app.post('/api/bins/reset-overrides', (req, res) => {
    const overrideCount = Object.keys(binStatusOverrides).length;
    
    // Clear all overrides
    for (const key in binStatusOverrides) {
      delete binStatusOverrides[key];
    }
    
    console.log(`✅ Reset ${overrideCount} bin status overrides`);
    
    return res.json({
      success: true,
      message: `Reset ${overrideCount} bin status overrides`,
      overrideCount
    });
  });
  
  console.log('✅ Registered bin status API routes');
}