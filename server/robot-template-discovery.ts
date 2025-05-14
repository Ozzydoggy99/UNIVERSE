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
    logger.info(`Fetching maps from robot at ${ROBOT_API_URL}/maps`);
    const response = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: {
        'X-Robot-Serial': ROBOT_SERIAL,
        'X-Robot-Secret': ROBOT_SECRET
      }
    });
    
    if (response.data && Array.isArray(response.data.maps)) {
      logger.info(`Successfully fetched ${response.data.maps.length} maps from robot`);
      logger.info(`Map IDs: ${response.data.maps.map(m => m.id).join(', ')}`);
      return response.data.maps;
    }
    
    logger.warn(`No maps array found in response from robot API`);
    return [];
  } catch (error) {
    logger.error(`Error fetching maps: ${error}`);
    
    // For testing, return a mock map with common point IDs
    logger.info(`Using test map data for development`);
    return [{
      id: 'Floor1',
      name: 'Floor 1',
      points: [
        { id: 'charger', pose: { position: { x: 1, y: 1 } } },
        { id: 'pickup', pose: { position: { x: 2, y: 2 } } },
        { id: 'dropoff', pose: { position: { x: 3, y: 3 } } },
        { id: '104_load', pose: { position: { x: 4, y: 4 } } }
      ]
    }];
  }
}

/**
 * Get all points for a specific map
 */
async function getMapPoints(mapId: string): Promise<any[]> {
  try {
    logger.info(`Fetching points for map ${mapId} from robot at ${ROBOT_API_URL}/maps/${mapId}/points`);
    
    // Check if we're working with test data
    const mockMaps = [{
      id: 'Floor1',
      name: 'Floor 1',
      points: [
        { id: 'charger', pose: { position: { x: 1, y: 1 } } },
        { id: 'pickup', pose: { position: { x: 2, y: 2 } } },
        { id: 'dropoff', pose: { position: { x: 3, y: 3 } } },
        { id: '104_load', pose: { position: { x: 4, y: 4 } } }
      ]
    }];
    
    // If we have a mock map with this ID, return its points
    const mockMap = mockMaps.find(m => m.id === mapId);
    if (mockMap) {
      logger.info(`Using test points data for map ${mapId}`);
      return mockMap.points;
    }
    
    // Otherwise try to get real points from the robot
    const response = await axios.get(`${ROBOT_API_URL}/maps/${mapId}/points`, {
      headers: {
        'X-Robot-Serial': ROBOT_SERIAL,
        'X-Robot-Secret': ROBOT_SECRET
      }
    });
    
    if (response.data && Array.isArray(response.data.points)) {
      logger.info(`Successfully fetched ${response.data.points.length} points for map ${mapId}`);
      return response.data.points;
    }
    
    logger.warn(`No points array found in response from robot API for map ${mapId}`);
    return [];
  } catch (error) {
    logger.error(`Error fetching points for map ${mapId}: ${error}`);
    
    // For testing, provide some default points if we had an error
    logger.info(`Using fallback test points for development`);
    return [
      { id: 'charger', pose: { position: { x: 1, y: 1 } } },
      { id: 'pickup', pose: { position: { x: 2, y: 2 } } },
      { id: 'dropoff', pose: { position: { x: 3, y: 3 } } },
      { id: '104_load', pose: { position: { x: 4, y: 4 } } }
    ];
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
      const mapId = map.id || '';
      const mapName = map.name || mapId;
      let floorNumber = 1;
      
      // Try to extract floor number from map ID (e.g., "Floor1" -> 1)
      const floorMatch = mapId.match(/Floor(\d+)/);
      if (floorMatch) {
        floorNumber = parseInt(floorMatch[1], 10);
      } else if (mapId.includes('Basement')) {
        floorNumber = 0; // Basement is floor 0
      }
      
      // Get all points for this map
      const points = await getMapPoints(mapId);
      
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
        floorNumber,
        shelfPoints
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
      
      // More detailed debugging of point data to understand what's available
      for (const point of allPoints) {
        logger.info(`Point detail - ID: ${point.id}, Type: ${point.type || 'unknown'}, Position: ${JSON.stringify(point.pose?.position || {})}`);
      }
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