/**
 * Refresh Points API
 * 
 * This API provides endpoints to synchronize the points in our system with
 * the actual points defined in the robot's maps.
 * 
 * It handles:
 * 1. Detection of new point sets (e.g., 110_load and 110_load_docking)
 * 2. Removal of obsolete point sets no longer in the robot maps
 * 3. Updating display mappings to match available points
 */

import { Express, Request, Response } from 'express';
import robotPointsMap, { pointDisplayMappings, PointDisplayMapping } from './robot-points-map';

/**
 * Register refresh points API routes
 */
export function registerRefreshPointsRoutes(app: Express): void {
  // Endpoint to manually trigger refresh of points from robot map
  app.post('/api/refresh-robot-points', async (req: Request, res: Response) => {
    try {
      console.log('Manual refresh of robot points initiated');
      await robotPointsMap.refreshPointsFromRobot();
      
      // Get updated point sets for display in the UI
      const pointSets = extractPointSets();
      
      res.status(200).json({
        success: true, 
        message: 'Robot points refreshed successfully',
        pointSets
      });
    } catch (error) {
      console.error('Error refreshing robot points:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error refreshing robot points: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Endpoint to get available point sets
  app.get('/api/point-sets', (req: Request, res: Response) => {
    try {
      const pointSets = extractPointSets();
      res.status(200).json({ 
        success: true, 
        pointSets 
      });
    } catch (error) {
      console.error('Error getting point sets:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error getting point sets: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Endpoint to update display name for a technical point ID
  app.post('/api/update-display-mapping', (req: Request, res: Response) => {
    try {
      const { technicalId, displayName, pointType } = req.body;
      
      if (!technicalId || !displayName || !pointType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: technicalId, displayName, or pointType'
        });
      }
      
      // Check if the mapping already exists
      const existingIndex = pointDisplayMappings.findIndex(m => m.technicalId === technicalId);
      
      if (existingIndex >= 0) {
        // Update existing mapping
        pointDisplayMappings[existingIndex] = {
          technicalId,
          displayName,
          pointType: pointType as 'pickup' | 'dropoff' | 'shelf' | 'charger'
        };
      } else {
        // Add new mapping
        pointDisplayMappings.push({
          technicalId,
          displayName,
          pointType: pointType as 'pickup' | 'dropoff' | 'shelf' | 'charger'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Display mapping updated successfully'
      });
    } catch (error) {
      console.error('Error updating display mapping:', error);
      res.status(500).json({
        success: false,
        message: `Error updating display mapping: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}

/**
 * Helper function to extract point sets (load points with their corresponding docking points)
 * from the robot points map. Used to display available points in the UI.
 */
function extractPointSets(): Array<{
  id: string;
  displayName: string;
  loadPoint: string;
  dockingPoint: string;
  pointType: string;
}> {
  const pointSets: Array<{
    id: string;
    displayName: string;
    loadPoint: string;
    dockingPoint: string;
    pointType: string;
  }> = [];
  
  const floorIds = robotPointsMap.getFloorIds();
  for (const floorId of floorIds) {
    const points = robotPointsMap.floors[floorId]?.points || {};
    
    // First pass: find all _load points
    const loadPoints = Object.keys(points).filter(id => id.endsWith('_load'));
    
    // Second pass: for each load point, find its corresponding docking point
    for (const loadPoint of loadPoints) {
      // Generate expected docking point ID
      const dockingPoint = loadPoint + '_docking';
      
      // Skip if we don't have the docking point
      if (!points[dockingPoint]) {
        console.warn(`Load point ${loadPoint} exists, but corresponding docking point ${dockingPoint} not found`);
        continue;
      }
      
      // Extract logical ID from the point
      let id;
      if (loadPoint.startsWith('pick-up')) {
        id = 'pick-up';
      } else if (loadPoint.startsWith('drop-off')) {
        id = 'drop-off';
      } else {
        // For regular shelf points, extract the numerical ID
        const match = loadPoint.match(/^(\d+)_load$/);
        id = match ? match[1] : loadPoint;
      }
      
      // Get display name from mappings or use the ID as fallback
      let displayName = id;
      let pointType = 'shelf';
      
      // Find display mapping
      const mapping = pointDisplayMappings.find(m => m.technicalId === loadPoint);
      if (mapping) {
        displayName = mapping.displayName;
        pointType = mapping.pointType;
      } else if (id === 'pick-up') {
        displayName = 'Pickup';
        pointType = 'pickup';
      } else if (id === 'drop-off') {
        displayName = 'Dropoff';
        pointType = 'dropoff';
      }
      
      // Add the point set
      pointSets.push({
        id,
        displayName,
        loadPoint,
        dockingPoint,
        pointType
      });
    }
  }
  
  return pointSets;
}