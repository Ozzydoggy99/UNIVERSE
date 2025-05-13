/**
 * Robot Template Discovery Service
 * 
 * This module provides functionality to automatically discover a robot's capabilities
 * and configure templates based on available maps and points.
 */

import axios from 'axios';
import { logger } from './logger';
import { robotPointsMap, getPointDisplayName } from './robot-points-map';
import { IStorage } from './storage';
import { ROBOT_API_BASE_URL } from './config';

// Types for discovered robot capabilities
export interface RobotCapabilities {
  maps: MapData[];
  serviceTypes: ServiceType[];
  hasCharger: boolean;
  hasCentralPickup: boolean;
  hasCentralDropoff: boolean;
}

export interface MapData {
  id: string;  // Map ID (e.g., "Floor1")
  name: string; // Display name (e.g., "Floor 1")
  floorNumber: number; // Numeric floor number
  shelfPoints: ShelfPoint[]; // Available shelf points on this map
}

export interface ShelfPoint {
  id: string;  // Point ID (e.g., "104_load")
  displayName: string; // Display name (e.g., "104")
  x: number;
  y: number;
  orientation: number;
  hasDockingPoint: boolean;
}

export interface ServiceType {
  id: string;  // Service type ID (e.g., "laundry")
  displayName: string; // Display name (e.g., "Laundry")
  icon: string; // Icon name or path
  enabled: boolean;
}

/**
 * Discovers robot capabilities by querying the robot's API
 * and analyzing its maps and points
 */
export async function discoverRobotCapabilities(robotId: string): Promise<RobotCapabilities> {
  logger.info(`[TEMPLATE-DISCOVERY] Discovering capabilities for robot ${robotId}`);
  
  try {
    // First, fetch maps from the robot using our existing points map function
    const points = await robotPointsMap.fetchRobotMapPoints();
    
    if (!points || Object.keys(points).length === 0) {
      logger.error(`[TEMPLATE-DISCOVERY] No maps or points found for robot ${robotId}`);
      throw new Error('No maps or points found on robot');
    }
    
    logger.info(`[TEMPLATE-DISCOVERY] Successfully retrieved ${Object.keys(points).length} map points`);
    
    // Now we'll organize these points into maps and analyze what's available
    const mapsData: MapData[] = [];
    const pointsArray = Object.entries(points);
    
    // Find maps and organize points by map
    const mapIds = new Set<string>();
    pointsArray.forEach(([pointId, pointData]) => {
      // Extract map name from point metadata if available
      if (pointData.mapName) {
        mapIds.add(pointData.mapName);
      }
    });
    
    // If no map names found, use default "Floor1"
    if (mapIds.size === 0) {
      mapIds.add('Floor1');
    }
    
    // Process each map
    mapIds.forEach(mapId => {
      // Extract floor number from map name (e.g., "Floor1" -> 1)
      const floorMatch = mapId.match(/Floor(\d+)/);
      const floorNumber = floorMatch ? parseInt(floorMatch[1]) : 1;
      
      // Find all shelf points for this map
      const shelfPoints: ShelfPoint[] = [];
      pointsArray.forEach(([pointId, pointData]) => {
        // Skip points that aren't on this map or aren't shelf points
        if (
          (pointData.mapName && pointData.mapName !== mapId) || 
          !isShelfPoint(pointId)
        ) {
          return;
        }
        
        // Check if this is a valid shelf point
        if (isShelfPoint(pointId)) {
          const basePointId = pointId.endsWith('_docking') 
            ? pointId.substring(0, pointId.length - 8) 
            : pointId;
          
          // Skip docking points as we'll process them with their main points
          if (pointId.endsWith('_docking')) {
            return;
          }
          
          // Check if this point has a corresponding docking point
          const hasDockingPoint = pointsArray.some(
            ([id, _]) => id === `${basePointId}_docking`
          );
          
          // Get a display name for the UI (e.g., "104_load" -> "104")
          const displayName = getPointDisplayName(basePointId);
          
          shelfPoints.push({
            id: basePointId,
            displayName,
            x: pointData.x,
            y: pointData.y,
            orientation: pointData.orientation,
            hasDockingPoint
          });
        }
      });
      
      // Sort shelf points by ID
      shelfPoints.sort((a, b) => {
        // Extract numeric values from display names if possible
        const numA = parseInt(a.displayName);
        const numB = parseInt(b.displayName);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        
        return a.displayName.localeCompare(b.displayName);
      });
      
      // Create the map data object
      mapsData.push({
        id: mapId,
        name: mapId.replace(/([A-Z])/g, ' $1').trim(), // Format "Floor1" as "Floor 1"
        floorNumber,
        shelfPoints
      });
    });
    
    // Sort maps by floor number
    mapsData.sort((a, b) => a.floorNumber - b.floorNumber);
    
    // Detect if we have central pickup and dropoff points
    const hasCentralPickup = pointsArray.some(([id, _]) => id.includes('pick-up_load'));
    const hasCentralDropoff = pointsArray.some(([id, _]) => id.includes('drop-off_load'));
    
    // Detect if we have a charger
    const hasCharger = pointsArray.some(([id, _]) => 
      id.toLowerCase().includes('charger') || id.toLowerCase().includes('charging')
    );
    
    // Define service types
    // For now, we'll enable both laundry and trash if we have both pickup and dropoff
    const serviceTypes: ServiceType[] = [
      {
        id: 'laundry',
        displayName: 'Laundry',
        icon: 'ShowerHead',
        enabled: hasCentralPickup && hasCentralDropoff
      },
      {
        id: 'trash',
        displayName: 'Trash',
        icon: 'Trash2',
        enabled: hasCentralPickup && hasCentralDropoff
      }
    ];
    
    // Return the complete capabilities
    return {
      maps: mapsData,
      serviceTypes,
      hasCharger,
      hasCentralPickup,
      hasCentralDropoff
    };
    
  } catch (error) {
    logger.error(`[TEMPLATE-DISCOVERY] Error discovering robot capabilities: ${error}`);
    throw error;
  }
}

/**
 * Updates template configuration based on robot capabilities
 */
export async function updateTemplateWithRobotCapabilities(
  storage: IStorage, 
  templateId: number, 
  robotId: string
): Promise<void> {
  try {
    logger.info(`[TEMPLATE-DISCOVERY] Updating template ${templateId} with robot ${robotId} capabilities`);
    
    // Get the robot's capabilities
    const capabilities = await discoverRobotCapabilities(robotId);
    
    // Get the current template
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Update the template configuration
    const updatedConfig = {
      ...template.config,
      robotCapabilities: capabilities
    };
    
    // Save the updated template
    await storage.updateTemplate(templateId, {
      ...template,
      config: updatedConfig
    });
    
    logger.info(`[TEMPLATE-DISCOVERY] Template ${templateId} updated successfully with robot capabilities`);
  } catch (error) {
    logger.error(`[TEMPLATE-DISCOVERY] Failed to update template with robot capabilities: ${error}`);
    throw error;
  }
}

/**
 * Determines if a point ID represents a shelf point
 */
function isShelfPoint(pointId: string): boolean {
  // Skip central pickup/dropoff points
  if (pointId.includes('pick-up') || pointId.includes('drop-off')) {
    return false;
  }
  
  // Skip charger points
  if (pointId.toLowerCase().includes('charger') || pointId.toLowerCase().includes('charging')) {
    return false;
  }
  
  // Consider points with load in the name as shelf points
  return pointId.includes('_load');
}