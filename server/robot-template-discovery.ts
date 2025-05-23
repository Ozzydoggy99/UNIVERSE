/**
 * Robot Template Discovery Service
 * 
 * This module provides functionality to automatically discover a robot's capabilities
 * and configure templates based on available maps and points.
 */

import axios from 'axios';
import { storage } from './storage';
import { getRobotApiUrl, getAuthHeaders } from './robot-constants';

const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

// Simple logger
const logger = {
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message)
};

// Helper function to get display name for points
function getPointDisplayName(pointId: any): string {
  // Safe handling for null, undefined, or non-string values
  if (!pointId) return '';
  
  // Always convert to string to handle numeric IDs
  const id = String(pointId);
  
  // Debug log
  logger.info(`Getting display name for point: ${id}`);
  
  // Special case for central pickup/dropoff points from AutoX robots
  if (id === 'pick-up_load' || id.toLowerCase() === 'pickup_load') {
    return 'Central Pickup';
  }
  if (id === 'drop-off_load' || id.toLowerCase() === 'dropoff_load') {
    return 'Central Dropoff';
  }
  
  // Special case for charging station
  if (id.toLowerCase().includes('charging') || id.toLowerCase().includes('charger')) {
    return 'Charger';
  }
  
  // Try multiple patterns to extract a clean display name
  
  // Pattern 1: Extract number from start of string followed by underscore (e.g., "104_load" → "104")
  let match = id.match(/^(\d+)_/);
  if (match) {
    return match[1];
  }
  
  // Pattern 2: Extract number from anywhere in string with "shelf" or "load" (e.g., "shelf_104" → "104")
  match = id.match(/(?:shelf|load)[_-]?(\d+)/i);
  if (match) {
    return match[1];
  }
  
  // Pattern 3: Extract number from string ending with "shelf" or "load" (e.g., "104_shelf" → "104")
  match = id.match(/(\d+)[_-]?(?:shelf|load)/i);
  if (match) {
    return match[1];
  }
  
  // Pattern 4: Just extract any number sequence as a last resort
  match = id.match(/(\d+)/);
  if (match) {
    return match[1];
  }
  
  // If no pattern matches, clean up the ID by removing common suffixes
  let cleanId = id
    .replace(/_load$/i, '')
    .replace(/_docking$/i, '')
    .replace(/_shelf$/i, '')
    .replace(/-load$/i, '')
    .replace(/-docking$/i, '')
    .replace(/-shelf$/i, '');
  
  // Make display names more user-friendly by adding spaces and capitalizing words
  cleanId = cleanId
    .replace(/([A-Z])/g, ' $1') // Add space before capitals in camelCase
    .replace(/[-_]/g, ' ')      // Replace dashes and underscores with spaces
    .trim();                    // Trim extra spaces
  
  // Capitalize first letter of each word
  cleanId = cleanId.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
    
  logger.info(`Cleaned point ID: ${cleanId}`);
  return cleanId;
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
function isShelfPoint(pointId: any): boolean {
  // Handle null, undefined, or non-string values
  if (!pointId) return false;
  
  // Ensure pointId is a string
  const pointIdStr = String(pointId);
  
  // Convert to lowercase for case-insensitive matching
  const id = pointIdStr.toLowerCase();
  
  logger.info(`Checking if point is shelf point: ${id}`);
  
  // Shelf points might follow various conventions:
  // - <number>_load (e.g., 104_load)
  // - shelf_<number> (e.g., shelf_104)
  // - <number>_shelf (e.g., 104_shelf)
  // - Just contain 'shelf' or 'load' along with a number
  // - Robot-specific convention (pick-up_load, drop-off_load)
  
  // Special handling for robot-specific naming (with dashes instead of underscores)
  if (id === 'pick-up_load' || id === 'drop-off_load') {
    logger.info(`✅ Detected special shelf point: ${id}`);
    return true;
  }
  
  // Skip points that are clearly not shelf points
  if (id.includes('docking') || id.includes('charger') || id.includes('station')) {
    return false;
  }
  
  // Check for standard naming patterns
  const isStandardPattern = /^\d+_load/.test(id) || 
                           /shelf_\d+/.test(id) || 
                           /\d+_shelf/.test(id) ||
                           (id.includes('shelf') && /\d+/.test(id)) ||
                           (id.includes('load') && /\d+/.test(id));
  
  // Additional patterns for AutoX robots
  const isAutoXPattern = /^([a-z0-9]+)_load$/i.test(id);
  
  return isStandardPattern || isAutoXPattern;
}

interface MapsResponse {
  maps?: any[];
  [key: string]: any;
}

/**
 * Get all maps from the robot
 */
async function getMaps(): Promise<any[]> {
  try {
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    logger.info(`Fetching maps from robot API: ${robotApiUrl}/maps with robot ID: ${DEFAULT_ROBOT_SERIAL}`);
    const response = await axios.get(`${robotApiUrl}/maps`, { headers });
    
    // Log the complete response for debugging
    logger.info(`Complete map API response: ${JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    }, null, 2)}`);
    
    // Log each map's properties
    if (response.data) {
      const maps = Array.isArray(response.data) ? response.data : 
                  response.data.maps ? response.data.maps :
                  [response.data];
      
      maps.forEach((map, index) => {
        logger.info(`Map ${index} properties: ${JSON.stringify({
          id: map.id,
          map_id: map.map_id,
          name: map.name,
          map_name: map.map_name,
          display_name: map.display_name,
          all_properties: Object.keys(map)
        }, null, 2)}`);
      });
    }
    
    // Handle various response formats with improved handling
    let maps = [];
    
    if (response.data) {
      const data = response.data as MapsResponse;
      // Format 1: Direct array
      if (Array.isArray(data)) {
        maps = data;
        logger.info(`Found maps in direct array format: ${maps.length}`);
      } 
      // Format 2: Array in maps property
      else if (data.maps && Array.isArray(data.maps)) {
        maps = data.maps;
        logger.info(`Found maps in 'maps' property: ${maps.length}`);
      } 
      // Format 3: Single map object
      else if ((data as any).id) {
        maps = [data];
        logger.info(`Found single map object`);
      }
      // Format 4: Try other common properties
      else {
        const propertiesToCheck = ['map', 'data', 'items', 'results'];
        for (const prop of propertiesToCheck) {
          if (data[prop]) {
            if (Array.isArray(data[prop])) {
              maps = data[prop];
              logger.info(`Found maps in '${prop}' property: ${maps.length}`);
              break;
            } else if (data[prop].id !== undefined) {
              maps = [data[prop]];
              logger.info(`Found single map in '${prop}' property`);
              break;
            }
          }
        }
      }
    }
    
    // Process maps to ensure consistent ID format (convert numeric to string)
    maps = maps.map((map: any) => {
      if (map && map.id !== undefined) {
        // Ensure map ID is a string
        map.id = String(map.id);
        logger.info(`Processed map ID: ${map.id}`);
      } else if (map && map.map_id !== undefined) {
        // Some APIs return map_id instead of id
        map.id = String(map.map_id);
        logger.info(`Mapped map_id to id: ${map.id}`);
      }
      return map;
    });
    
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
  let points: any[] = [];
  try {
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    logger.info(`Fetching map points for map ${mapId} from robot API: ${robotApiUrl}/maps/${mapId}/points`);
    const response = await axios.get(`${robotApiUrl}/maps/${mapId}/points`, { headers });

    if (response.data) {
      if (Array.isArray(response.data)) {
        points = response.data;
      } else if ((response.data as any)?.points && Array.isArray((response.data as any).points)) {
        points = (response.data as { points?: any[] }).points ?? [];
      } else if ((response.data as any)?.id || (response.data as any)?.name) {
        points = [response.data];
      }
    }

    if (points.length === 0) {
      logger.warn(`MAP POINTS DEBUG - Map ${mapId} has 0 points: ${JSON.stringify(points)}`);
    } else {
      logger.info(`Map ${mapId} has ${points.length} points: ${points.map((p: any) => p?.id || p?.name).join(', ')}`);
    }
    // Debug log to show all actual point IDs and names from the robot
    logger.info(`RAW MAP POINTS for map ${mapId}: ${JSON.stringify(points.map(p => ({id: p.id, name: p.name})))} `);
    return points;
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
    // Force refresh every time for testing
    logger.info(`Refreshing robot capabilities for robot ${robotId}`);
    
    // Uncomment this section when ready to use caching again
    /*
    // Check if we have cached capabilities
    const cachedCapabilities = await storage.getRobotCapabilities(robotId);
    
    // If we have cached capabilities that are less than 5 minutes old, return them
    if (cachedCapabilities && 
        cachedCapabilities.lastUpdated && 
        (new Date().getTime() - new Date(cachedCapabilities.lastUpdated).getTime() < 5 * 60 * 1000)) {
      logger.info(`Using cached robot capabilities for robot ${robotId}`);
      return cachedCapabilities;
    }
    */
    
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
      logger.info(`Attempting to extract floor number from: ${nameToCheck}`);
      
      // Try multiple patterns to extract floor number
      const patterns = [
        /Floor(\d+)/i,  // Floor1, floor1, etc.
        /Floor\s*(\d+)/i,  // Floor 1, floor 1, etc.
        /Level\s*(\d+)/i,  // Level 1, level 1, etc.
        /(\d+)(?:\s*st|\s*nd|\s*rd|\s*th)?\s*Floor/i,  // 1st Floor, 1 Floor, etc.
        /(\d+)/  // Just a number
      ];
      
      for (const pattern of patterns) {
        const match = String(nameToCheck).match(pattern);
        if (match) {
          floorNumber = parseInt(match[1], 10);
          logger.info(`Found floor number ${floorNumber} from match: ${match[0]} using pattern: ${pattern}`);
          break;
        }
      }
      
      if (String(nameToCheck).toLowerCase().includes('basement')) {
        floorNumber = 0; // Basement is floor 0
        logger.info('Found basement floor (floor 0)');
      }
      
      // Get all points for this map
      const mapPoints = await getMapPoints(mapId);
      
      // Debug log to show all actual point IDs from the robot
      logger.info(`MAP POINTS DEBUG - Map ${mapId} has ${mapPoints.length} points: ${JSON.stringify(mapPoints.map(p => p.id || p.name))}`);
      
      // Filter for shelf points and format them
      const shelfPoints = mapPoints
        .filter((point: any) => {
          if (!point) return false;
          const pointId = point.id || point.name || point.point_id || '';
          if (!pointId) {
            logger.warn(`Point missing ID: ${JSON.stringify(point)}`);
            return false;
          }
          return isShelfPoint(pointId);
        })
        .map((point: any) => {
          const pointId = point.id || point.name || point.point_id || '';
          const possibleDockingIds = [
            `${pointId}_docking`,
            `${pointId}-docking`,
            `${pointId} docking`,
            `${pointId.replace('_load', '')}_docking`,
            `${pointId}_dock`,
            `${pointId}-dock`
          ];
          
          const hasDockingPoint = mapPoints.some((p: any) => {
            if (!p || !p.id) return false;
            const pId = String(p.id).toLowerCase();
            return possibleDockingIds.some(id => pId === id.toLowerCase());
          });
          
          return {
            id: pointId,
            displayName: getPointDisplayName(pointId),
            x: point.pose?.position?.x || 0,
            y: point.pose?.position?.y || 0,
            orientation: point.pose?.orientation?.z || 0,
            hasDockingPoint
          };
        });
      
      // Create the map data object with proper display names
      const mapData: MapData = {
        id: mapId,
        name: mapName, // Use the actual map name from the API
        displayName: `Floor ${floorNumber}`, // Keep the floor number for display purposes
        floorNumber: floorNumber,
        shelfPoints: shelfPoints, // Assign the filtered and mapped shelf points
        points: mapPoints // Assign all points from the map
      };
      
      return mapData;
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
        // Skip invalid points
        if (!point) {
          logger.warn(`Skipping null point`);
          continue;
        }
        
        // Get point ID with fall backs
        const pointId = String(point.id || point.name || '').toLowerCase();
        
        // Get point properties directly or from the properties field
        const properties = point.properties || {};
        const propName = properties.name ? String(properties.name).toLowerCase() : '';
        const propType = properties.type ? String(properties.type) : '';
        
        logger.info(`Checking point: ${pointId}, name: ${propName}, type: ${propType}`);
        
        // Check for charger - handle the AutoX robot's charging station (type 9)
        if (pointId === 'charger' || 
            pointId.includes('charger') || 
            pointId.includes('charging') ||
            pointId === 'charge' ||
            propName.includes('charging') ||
            propName === 'charging station' ||
            propType === '9') {
          hasCharger = true;
          logger.info(`✅ Found charger point: ${propName || pointId}`);
        } 
        // Check for pickup points - handle AutoX robot's pick-up_load point
        else if (
          pointId === 'pick-up_load' || 
          pointId === 'pickup_load' || 
          pointId.includes('pickup') || 
          pointId.includes('pick-up') ||
          propName === 'pick-up_load' ||
          propName.includes('pick-up') ||
          propName.includes('pickup')
        ) {
          hasCentralPickup = true;
          logger.info(`✅ Found central pickup point: ${propName || pointId}`);
        } 
        // Check for dropoff points - handle AutoX robot's drop-off_load point
        else if (
          pointId === 'drop-off_load' || 
          pointId === 'dropoff_load' || 
          pointId.includes('dropoff') || 
          pointId.includes('drop-off') ||
          propName === 'drop-off_load' ||
          propName.includes('drop-off') ||
          propName.includes('dropoff')
        ) {
          hasCentralDropoff = true;
          logger.info(`✅ Found central dropoff point: ${propName || pointId}`);
        }
        
        // Also check for shelf points explicitly
        if (isShelfPoint(pointId) || isShelfPoint(propName)) {
          logger.info(`✅ Found shelf point: ${propName || pointId}`);
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
    const hasShelfPoints = maps.some(map => map.shelfPoints && map.shelfPoints.length > 0);
    // Always include the robot service type regardless of what capabilities are available
    // This ensures the UI works even when we're still discovering capabilities
    {
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
    return;
  } catch (error) {
    logger.error(`Error updating template with robot capabilities: ${error}`);
    return;
  }
}