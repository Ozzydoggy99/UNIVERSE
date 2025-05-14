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
function getPointDisplayName(pointId: any): string {
  // Safe handling for null, undefined, or non-string values
  if (!pointId) return '';
  
  // Always convert to string to handle numeric IDs
  const id = String(pointId);
  
  // Debug log
  logger.info(`Getting display name for point: ${id}`);
  
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
  return /^\d+_load/.test(id) || 
         /shelf_\d+/.test(id) || 
         /\d+_shelf/.test(id) ||
         (id.includes('shelf') && /\d+/.test(id)) ||
         (id.includes('load') && /\d+/.test(id));
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
    
    // Handle various response formats with improved handling
    let maps = [];
    
    if (response.data) {
      // Format 1: Direct array
      if (Array.isArray(response.data)) {
        maps = response.data;
        logger.info(`Found maps in direct array format: ${maps.length}`);
      } 
      // Format 2: Array in maps property
      else if (response.data.maps && Array.isArray(response.data.maps)) {
        maps = response.data.maps;
        logger.info(`Found maps in 'maps' property: ${maps.length}`);
      } 
      // Format 3: Single map object
      else if (response.data.id !== undefined) {
        maps = [response.data];
        logger.info(`Found single map object`);
      }
      // Format 4: Try other common properties
      else {
        const propertiesToCheck = ['map', 'data', 'items', 'results'];
        for (const prop of propertiesToCheck) {
          if (response.data[prop]) {
            if (Array.isArray(response.data[prop])) {
              maps = response.data[prop];
              logger.info(`Found maps in '${prop}' property: ${maps.length}`);
              break;
            } else if (response.data[prop].id !== undefined) {
              maps = [response.data[prop]];
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
  // Try several different endpoint patterns
  const endpoints = [
    `/maps/${mapId}/points`,
    `/maps/${mapId}/point`,
    `/maps/${mapId}`,
    `/points?map_id=${mapId}`,
    `/point?map_id=${mapId}`
  ];
  
  let points: any[] = [];
  
  for (const endpoint of endpoints) {
    try {
      logger.info(`Fetching points for map ${mapId} from robot API: ${ROBOT_API_URL}${endpoint}`);
      const response = await axios.get(`${ROBOT_API_URL}${endpoint}`, {
        headers: {
          'X-Robot-Serial': ROBOT_SERIAL,
          'X-Robot-Secret': ROBOT_SECRET
        }
      });
      
      // Handle different response formats
      if (response.data) {
        // Try to parse points from response based on different formats
        if (Array.isArray(response.data)) {
          // Direct array response
          points = response.data;
        } else if (response.data.points && Array.isArray(response.data.points)) {
          // Objects with points array
          points = response.data.points;
        } else if (response.data.id || response.data.name) {
          // Single point returned as object
          points = [response.data];
        } else if (typeof response.data === 'object') {
          // Maybe the data contains point information directly
          
          // CHECK FOR OVERLAYS - many robots store points in the overlays field as a GeoJSON string
          if (response.data.overlays && typeof response.data.overlays === 'string') {
            try {
              logger.info('Found overlays property containing JSON string, attempting to parse...');
              const overlaysData = JSON.parse(response.data.overlays);
              
              // Extract points from GeoJSON format in overlays
              if (overlaysData.features && Array.isArray(overlaysData.features)) {
                // Get all point features from the overlays
                const pointFeatures = overlaysData.features.filter((feature: any) => {
                  return feature.geometry && 
                         (feature.geometry.type === 'Point' || 
                          (feature.properties && feature.properties.name));
                });
                
                // Convert the features to point objects with our expected format
                points = pointFeatures.map((feature: any) => {
                  // Create a point object with data from the feature
                  const pointObject: any = {
                    id: feature.properties?.name || feature.id,
                    name: feature.properties?.name || feature.id
                  };
                  
                  // Add coordinates if available
                  if (feature.geometry && feature.geometry.coordinates) {
                    pointObject.pose = {
                      position: {
                        x: feature.geometry.coordinates[0],
                        y: feature.geometry.coordinates[1]
                      },
                      orientation: {
                        z: feature.properties?.yaw || 0
                      }
                    };
                  }
                  
                  return pointObject;
                });
                
                logger.info(`Extracted ${points.length} point features from overlays`);
                
                // Log some sample points to verify structure
                if (points.length > 0) {
                  logger.info(`Sample point from overlays: ${JSON.stringify(points[0])}`);
                  
                  // Check for shelf points specifically
                  const shelfPointsCount = points.filter(p => isShelfPoint(p.id || p.name)).length;
                  logger.info(`Found ${shelfPointsCount} shelf points in overlays`);
                }
              }
            } catch (overlaysError) {
              logger.error(`Error parsing overlays JSON: ${overlaysError}`);
            }
          }
          
          // FALLBACK: Check if there's a points_url to fetch points
          if (points.length === 0 && response.data.points_url) {
            // Try to get points from the points_url
            try {
              const pointsUrl = response.data.points_url;
              logger.info(`Found points_url: ${pointsUrl}`);
              
              // Make a separate API call to fetch points
              const pointsResponse = await axios.get(pointsUrl, {
                headers: {
                  'X-Robot-Serial': ROBOT_SERIAL,
                  'X-Robot-Secret': ROBOT_SECRET
                }
              });
              
              if (pointsResponse.data && Array.isArray(pointsResponse.data)) {
                points = pointsResponse.data;
              } else if (pointsResponse.data && pointsResponse.data.points && 
                         Array.isArray(pointsResponse.data.points)) {
                points = pointsResponse.data.points;
              }
            } catch (pointsError) {
              logger.warn(`Error fetching points from points_url: ${pointsError}`);
            }
          }
        }
        
        // If we found points, break out of the loop
        if (points.length > 0) {
          logger.info(`Retrieved ${points.length} points for map ${mapId} using endpoint ${endpoint}`);
          const pointIds = points.map((p: any) => p.id || p.point_id || p.name || 'unknown');
          logger.info(`Point IDs for map ${mapId}: ${JSON.stringify(pointIds)}`);
          logger.info(`First point full data: ${JSON.stringify(points[0])}`);
          break;
        }
      }
    } catch (error) {
      logger.error(`Error fetching points for map ${mapId} using endpoint ${endpoint}: ${error}`);
      // Continue trying other endpoints
    }
  }
  
  // Debug log whether we found points
  if (points.length === 0) {
    logger.warn(`MAP POINTS DEBUG - Map ${mapId} has 0 points: ${JSON.stringify(points)}`);
  } else {
    logger.info(`Map ${mapId} has ${points.length} points: ${points.map(p => p.id || p.name).join(', ')}`);
  }
  
  return points;
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
      
      // Filter for shelf points and format them - with robust checking
      const shelfPoints = points
        .filter((point: any) => {
          if (!point) return false;
          
          // Use id property or fallback to name if id is missing
          const pointId = point.id || point.name || point.point_id || '';
          
          // Skip if we can't determine a valid ID
          if (!pointId) {
            logger.warn(`Point missing ID: ${JSON.stringify(point)}`);
            return false;
          }
          
          // Check if this is a shelf point
          const isShelf = isShelfPoint(pointId);
          
          if (isShelf) {
            logger.info(`✅ Found shelf point: ${pointId}`);
          }
          
          return isShelf;
        })
        .map((point: any) => {
          // Get point ID with fallback
          const pointId = point.id || point.name || point.point_id || '';
          
          // Check if there's a corresponding docking point with various naming patterns
          const possibleDockingIds = [
            `${pointId}_docking`,
            `${pointId}-docking`,
            `${pointId} docking`,
            `${pointId.replace('_load', '')}_docking`,
            `${pointId}_dock`,
            `${pointId}-dock`
          ];
          
          // Check if any of the possible docking point IDs exist
          const hasDockingPoint = points.some((p: any) => {
            if (!p || !p.id) return false;
            const pId = String(p.id).toLowerCase();
            return possibleDockingIds.some(id => pId === id.toLowerCase());
          });
          
          if (hasDockingPoint) {
            logger.info(`✅ Found docking point for shelf: ${pointId}`);
          }
          
          return {
            id: pointId,
            displayName: getPointDisplayName(pointId),
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
        // Skip invalid points
        if (!point || !point.id) {
          logger.warn(`Skipping point with missing ID: ${JSON.stringify(point)}`);
          continue;
        }
        
        // Convert point ID to lowercase for case-insensitive comparison
        // Handle edge cases where ID is a number or other non-string
        const pointId = String(point.id || point.name || '').toLowerCase();
        logger.info(`Checking point ID: ${pointId}`);
        
        // Check for charger - broader pattern matching
        if (pointId === 'charger' || 
            pointId.includes('charger') || 
            pointId.includes('charging') ||
            pointId === 'charge') {
          hasCharger = true;
          logger.info(`✅ Found charger point: ${point.id}`);
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
          pointId.includes('pick-up_load') ||
          (pointId.includes('pick') && pointId.includes('up'))
        ) {
          hasCentralPickup = true;
          logger.info(`✅ Found central pickup point: ${point.id}`);
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
          pointId.includes('drop-off_load') ||
          (pointId.includes('drop') && pointId.includes('off'))
        ) {
          hasCentralDropoff = true;
          logger.info(`✅ Found central dropoff point: ${point.id}`);
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
  } catch (error) {
    logger.error(`Error updating template with robot capabilities: ${error}`);
  }
}