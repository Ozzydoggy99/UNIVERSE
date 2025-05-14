/**
 * Robot Template Discovery Service
 * 
 * This module provides functionality to automatically discover a robot's capabilities
 * and configure templates based on available maps and points.
 */

import axios from 'axios';
import { storage } from './storage';
import { ROBOT_API_URL, ROBOT_SERIAL, ROBOT_SECRET } from './robot-constants';

// Simple logger
const logger = {
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message)
};

// Helper function to get display name for points
function getPointDisplayName(pointId: string): string {
  // Extract display name (e.g., "104" from "104_load")
  const match = pointId.match(/^(\d+)_/);
  if (match) {
    return match[1];
  }
  return pointId;
}

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
  displayName?: string; // Alternate display name
  floorNumber: number; // Numeric floor number
  shelfPoints: ShelfPoint[]; // Available shelf points on this map
  points?: any[]; // Raw points data from the robot API
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
 * Determines if a point ID represents a shelf point
 */
function isShelfPoint(pointId: string): boolean {
  // Shelf points follow the convention: <number>_load
  // For example: 104_load, 112_load, etc.
  return /^\d+_load$/.test(pointId);
}

/**
 * Get all maps from the robot
 */
async function getMaps(): Promise<any[]> {
  try {
    logger.info(`Fetching maps from robot API: ${ROBOT_API_URL}/maps with robot ID: ${ROBOT_SERIAL}`);
    const response = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: {
        'X-Robot-Serial': ROBOT_SERIAL,
        'X-Robot-Secret': ROBOT_SECRET
      }
    });
    
    // Handle two different response formats:
    // 1. Array directly in response.data 
    // 2. Array in response.data.maps
    let maps = [];
    
    if (response.data) {
      if (Array.isArray(response.data)) {
        maps = response.data;
      } else if (Array.isArray(response.data.maps)) {
        maps = response.data.maps;
      } else if (response.data.id) {
        // Single map returned as an object
        maps = [response.data];
      }
    }
    
    if (maps.length > 0) {
      logger.info(`Successfully retrieved ${maps.length} maps from robot`);
      logger.info(`Map IDs: ${JSON.stringify(maps.map((m: any) => m.id || m.map_name || m.name))}`);
      return maps;
    }
    
    logger.warn(`No maps found in robot response: ${JSON.stringify(response.data)}`);
    return [];
  } catch (error) {
    logger.error(`Error fetching maps: ${error}`);
    return [];
  }
}

/**
 * Get all points for a specific map
 */
async function getMapPoints(mapId: string | number): Promise<any[]> {
  try {
    logger.info(`Fetching points for map ${mapId} from robot API: ${ROBOT_API_URL}/maps/${mapId}/points`);
    const response = await axios.get(`${ROBOT_API_URL}/maps/${mapId}/points`, {
      headers: {
        'X-Robot-Serial': ROBOT_SERIAL,
        'X-Robot-Secret': ROBOT_SECRET
      }
    });
    
    // Handle different response formats
    let points = [];
    
    // Log the full response for debugging
    logger.info(`Raw points response for map ${mapId}: ${JSON.stringify(response.data)}`);
    
    if (response.data) {
      if (Array.isArray(response.data)) {
        // Direct array response
        points = response.data;
      } else if (response.data.points && Array.isArray(response.data.points)) {
        // Objects with points array
        points = response.data.points;
      } else if (response.data.id || response.data.name) {
        // Single point returned as object
        points = [response.data];
      }
    }
    
    if (points.length > 0) {
      logger.info(`Retrieved ${points.length} points for map ${mapId}`);
      // Map the point IDs, handling different property names
      const pointIds = points.map((p: any) => p.id || p.point_id || p.name || 'unknown');
      logger.info(`Point IDs for map ${mapId}: ${JSON.stringify(pointIds)}`);
      
      // Full details for debugging
      logger.info(`First point full data: ${JSON.stringify(points[0])}`);
      
      return points;
    }
    logger.warn(`No points found in robot response for map ${mapId}: ${JSON.stringify(response.data)}`);
    return [];
  } catch (error) {
    logger.error(`Error fetching points for map ${mapId}: ${error}`);
    return [];
  }
}

/**
 * Discovers robot capabilities by querying the robot's API
 * and analyzing its maps and points
 */
export async function discoverRobotCapabilities(robotId: string): Promise<RobotCapabilities> {
  try {
    // Check if we have cached capabilities
    const cachedCapabilities = await storage.getRobotCapabilities(robotId);
    
    // If we have cached capabilities that are less than 5 minutes old, return them
    if (cachedCapabilities && 
        cachedCapabilities.lastUpdated && 
        (new Date().getTime() - new Date(cachedCapabilities.lastUpdated).getTime() < 5 * 60 * 1000)) {
      logger.info(`Using cached robot capabilities for robot ${robotId}`);
      return cachedCapabilities;
    }
    
    logger.info(`Discovering robot capabilities for robot ${robotId}`);
    const maps = await getMaps();
    
    // Process each map to extract its data and points
    const mapDataPromises = maps.map(async (map: any) => {
      // Make sure mapId is a string for string operations
      const mapId = String(map.id || map.map_id || '');
      
      // Handle map name - check various properties since the API format varies
      const mapName = map.name || map.map_name || `Map ${mapId}`;
      
      // Debug log full map object
      logger.info(`Processing map: ${JSON.stringify(map)}`);
      
      let floorNumber = 1;
      
      // Try to extract floor number from map name or ID (e.g., "Floor1" -> 1)
      const nameToCheck = mapName || mapId;
      const floorMatch = String(nameToCheck).match(/Floor(\d+)/);
      if (floorMatch) {
        floorNumber = parseInt(floorMatch[1], 10);
      } else if (String(nameToCheck).includes('Basement')) {
        floorNumber = 0; // Basement is floor 0
      }
      
      // Get all points for this map
      const points = await getMapPoints(mapId);
      
      // Debug log to show all actual point IDs from the robot
      logger.info(`MAP POINTS DEBUG - Map ${mapId} has ${points.length} points: ${JSON.stringify(points.map(p => p.id || p.name))}`);
      
      // Filter for shelf points and format them
      const shelfPoints = points
        .filter((point: any) => isShelfPoint(point.id))
        .map((point: any) => {
          // Check if there's a corresponding docking point
          const dockingPointId = `${point.id}_docking`;
          const hasDockingPoint = points.some((p: any) => p.id === dockingPointId);
          
          return {
            id: point.id,
            displayName: getPointDisplayName(point.id),
            x: point.pose?.position?.x || 0,
            y: point.pose?.position?.y || 0,
            orientation: point.pose?.orientation?.z || 0,
            hasDockingPoint
          };
        });
      
      return {
        id: mapId,
        name: mapName,
        displayName: mapName,  // Set displayName to be the same as name initially
        floorNumber,
        shelfPoints,
        points: points  // Store the raw points data
      };
    });
    
    const mapData = await Promise.all(mapDataPromises);
    
    // Check for central pickup/dropoff points and charger across all maps
    let hasCharger = false;
    let hasCentralPickup = false;
    let hasCentralDropoff = false;
    
    for (const map of mapData) {
      const allPoints = await getMapPoints(map.id);
      
      // Check for special points
      for (const point of allPoints) {
        // Convert point ID to lowercase for case-insensitive comparison
        const pointId = point.id.toLowerCase();
        
        // Check for charger
        if (pointId === 'charger') {
          hasCharger = true;
          logger.info(`Found charger point: ${point.id}`);
        } 
        // Check for pickup points - support various naming conventions
        else if (
          pointId === 'pick-up_load' || 
          pointId === 'pickup_load' || 
          pointId === 'pickup' || 
          pointId === 'central_pickup' || 
          pointId === 'central-pickup' ||
          pointId === 'pick-up' ||
          pointId.includes('pickup_load') ||
          pointId.includes('pick-up_load')
        ) {
          hasCentralPickup = true;
          logger.info(`Found central pickup point: ${point.id}`);
        } 
        // Check for dropoff points - support various naming conventions
        else if (
          pointId === 'drop-off_load' || 
          pointId === 'dropoff_load' || 
          pointId === 'dropoff' || 
          pointId === 'central_dropoff' || 
          pointId === 'central-dropoff' ||
          pointId === 'drop-off' ||
          pointId.includes('dropoff_load') ||
          pointId.includes('drop-off_load')
        ) {
          hasCentralDropoff = true;
          logger.info(`Found central dropoff point: ${point.id}`);
        }
      }
      
      // Debug log for all points to help diagnose naming issues
      logger.info(`Map ${map.id} has ${allPoints.length} points: ${allPoints.map(p => p.id).join(', ')}`);
    }
    
    // Define service types based on available capabilities
    const serviceTypes = [];
    
    // Define a single universal "robot" service type when we have pickup or dropoff capabilities
    // This removes the hardcoded service types (laundry, trash) and uses a unified approach
    // Also consider if we have any shelf points available
    const hasShelfPoints = maps.some(map => map.shelfPoints.length > 0);
    if (hasCentralPickup || hasCentralDropoff || hasShelfPoints) {
      serviceTypes.push({
        id: 'robot',
        displayName: 'Robot Service',
        icon: 'robot',
        enabled: true
      });
    }
    
    logger.info(`Discovered ${serviceTypes.length} service types based on robot capabilities`);
    
    // Create the capabilities object
    const capabilities = {
      maps: mapData,
      serviceTypes,
      hasCharger,
      hasCentralPickup,
      hasCentralDropoff
    };
    
    // Store the capabilities in the cache
    await storage.storeRobotCapabilities(robotId, capabilities);
    
    return capabilities;
  } catch (error) {
    logger.error(`Error discovering robot capabilities: ${error}`);
    
    // No fallbacks - simply return empty capabilities and let the UI handle it
    throw new Error(`Failed to discover robot capabilities: ${error}`);
  }
}

/**
 * Updates template configuration based on robot capabilities
 */
export async function updateTemplateWithRobotCapabilities(
  templateId: number, 
  robotId: string
): Promise<void> {
  try {
    logger.info(`[TEMPLATE-DISCOVERY] Updating template ${templateId} with robot ${robotId} capabilities`);
    
    // Get the robot's capabilities
    const capabilities = await discoverRobotCapabilities(robotId);
    
    // Get the template
    const template = await storage.getTemplate(templateId);
    if (!template) {
      logger.error(`Template ${templateId} not found`);
      return;
    }
    
    // Update template with capabilities
    const updatedTemplate = {
      ...template,
      robotCapabilities: capabilities
    };
    
    // Save the updated template
    await storage.updateTemplate(templateId, updatedTemplate);
    
    logger.info(`[TEMPLATE-DISCOVERY] Template ${templateId} updated successfully`);
  } catch (error) {
    logger.error(`Error updating template with robot capabilities: ${error}`);
  }
}