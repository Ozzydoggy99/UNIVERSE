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
      const pointSets = enrichPointSets(robotPointsMap.getPointSets());
      
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
      const pointSets = enrichPointSets(robotPointsMap.getPointSets());
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
 * Helper function to enrich point sets with display names and types
 * Takes the basic point sets from the robotPointsMap.getPointSets() function
 * and adds display names and point types based on mappings
 */
function enrichPointSets(rawPointSets: Array<{id: string, loadPoint: string, dockingPoint: string}>): Array<{
  id: string;
  displayName: string;
  loadPoint: string;
  dockingPoint: string;
  pointType: string;
}> {
  return rawPointSets.map(pointSet => {
    // Get display name from mappings or use the ID as fallback
    let displayName = pointSet.id;
    let pointType = 'shelf';
    
    // Find display mapping for the load point
    const mapping = pointDisplayMappings.find(m => m.technicalId === pointSet.loadPoint);
    if (mapping) {
      displayName = mapping.displayName;
      pointType = mapping.pointType;
    } else if (pointSet.id === 'pick-up') {
      displayName = 'Pickup';
      pointType = 'pickup';
    } else if (pointSet.id === 'drop-off') {
      displayName = 'Dropoff';
      pointType = 'dropoff';
    }
    
    // Add the display information to the point set
    return {
      id: pointSet.id,
      displayName,
      loadPoint: pointSet.loadPoint,
      dockingPoint: pointSet.dockingPoint,
      pointType
    };
  });
}