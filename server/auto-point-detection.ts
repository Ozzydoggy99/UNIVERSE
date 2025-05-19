// server/auto-point-detection.ts
import { Point } from './types';
import fs from 'fs';
import path from 'path';
import { fetchRobotMapPoints } from './robot-map-data';
import robotPointsMap from './robot-points-map';
import { pointDisplayMappings } from './robot-points-map';

// File path for storing dynamic points data
const POINTS_DATA_FILE = path.join(process.cwd(), 'dynamic-robot-points.json');

// Interface for dynamic point data
interface DynamicPointData {
  points: Record<string, {
    x: number;
    y: number;
    theta: number;
    floorId: string;
  }>;
  displayMappings: {
    technicalId: string;
    displayName: string;
    pointType: 'pickup' | 'dropoff' | 'shelf' | 'charger';
  }[];
  lastUpdated: string;
}

/**
 * Load existing dynamic points data from file
 */
function loadDynamicPointsData(): DynamicPointData {
  try {
    if (fs.existsSync(POINTS_DATA_FILE)) {
      const data = fs.readFileSync(POINTS_DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading dynamic points data:', err);
  }
  
  // Return empty data structure if file doesn't exist or is invalid
  return {
    points: {},
    displayMappings: [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Save dynamic points data to file
 */
function saveDynamicPointsData(data: DynamicPointData): void {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(POINTS_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Saved dynamic point data with ${Object.keys(data.points).length} points`);
  } catch (err) {
    console.error('Error saving dynamic points data:', err);
  }
}

/**
 * Generate a display name for a point
 */
function generateDisplayName(pointId: string): string {
  // For numeric shelf points (like 110), use "Zone X"
  const shelfMatch = pointId.match(/^(\d+)_load$/);
  if (shelfMatch) {
    return `Zone ${shelfMatch[1]}`;
  }
  
  // For docking points
  if (pointId.endsWith('_docking')) {
    const baseId = pointId.replace('_docking', '');
    return `${generateDisplayName(baseId)} Docking`;
  }
  
  // Default to the point ID itself
  return pointId;
}

/**
 * Determine the point type based on the point ID
 */
function determinePointType(pointId: string): 'pickup' | 'dropoff' | 'shelf' | 'charger' {
  const id = pointId.toLowerCase();
  
  if (id.includes('charger')) {
    return 'charger';
  }
  
  if (id.startsWith('050_') || id.includes('pick')) {
    return 'pickup';
  }
  
  if (id.startsWith('001_') || id.includes('drop')) {
    return 'dropoff';
  }
  
  // Default to shelf for numeric IDs and others
  return 'shelf';
}

/**
 * Update our point database with new points from the robot
 */
export async function updatePointDatabase(): Promise<void> {
  try {
    console.log('Starting point database update process...');
    
    // Load existing dynamic points data
    const dynamicData = loadDynamicPointsData();
    
    // Fetch current points from robot
    const robotPoints = await fetchRobotMapPoints();
    console.log(`Fetched ${robotPoints.length} points from robot`);
    
    // Track new points
    let newPointsCount = 0;
    let updatedPointsCount = 0;
    
    // Process each point from the robot
    for (const point of robotPoints) {
      const pointId = point.id;
      
      // Skip points without an ID
      if (!pointId) continue;
      
      // Check if this point is already in our dynamic data
      const existingPoint = dynamicData.points[pointId];
      
      // Check if this point is in our static data (robot-points-map.ts)
      const staticPointExists = isPointInStaticMap(pointId);
      
      if (!existingPoint && !staticPointExists) {
        // This is a new point - add it to our dynamic data
        dynamicData.points[pointId] = {
          x: point.x,
          y: point.y,
          theta: point.ori || 0,
          floorId: point.floorId || '1'
        };
        
        // Also add a display mapping for this point if it's meaningful
        // Skip system points that don't have a clear meaning
        if (pointId.length < 30 && !pointId.includes('uuid')) {
          // Generate a more user-friendly name and determine point type
          const displayName = generateDisplayName(pointId);
          const pointType = determinePointType(pointId);
          
          // Add a new display mapping if one doesn't already exist
          if (!dynamicData.displayMappings.some(dm => dm.technicalId === pointId)) {
            dynamicData.displayMappings.push({
              technicalId: pointId,
              displayName,
              pointType
            });
          }
        }
        
        newPointsCount++;
        console.log(`Added new point: ${pointId} (${point.x}, ${point.y})`);
      } else if (existingPoint) {
        // Check if coordinates have changed
        if (existingPoint.x !== point.x || 
            existingPoint.y !== point.y || 
            existingPoint.theta !== (point.ori || 0)) {
          
          // Update with new coordinates
          dynamicData.points[pointId] = {
            x: point.x,
            y: point.y,
            theta: point.ori || 0,
            floorId: point.floorId || existingPoint.floorId
          };
          
          updatedPointsCount++;
          console.log(`Updated point: ${pointId} (${point.x}, ${point.y})`);
        }
      }
    }
    
    // Save the updated dynamic data
    if (newPointsCount > 0 || updatedPointsCount > 0) {
      saveDynamicPointsData(dynamicData);
      console.log(`Point database updated: ${newPointsCount} new, ${updatedPointsCount} updated`);
    } else {
      console.log('No changes to point database needed');
    }
  } catch (err) {
    console.error('Error updating point database:', err);
  }
}

/**
 * Check if a point exists in our static map data
 */
function isPointInStaticMap(pointId: string): boolean {
  try {
    // Check all floors
    const floorIds = robotPointsMap.getFloorIds();
    for (const floorId of floorIds) {
      try {
        // This will throw an error if the point doesn't exist
        robotPointsMap.getPoint(floorId, pointId);
        return true;
      } catch {
        // Point not found on this floor, continue checking
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get a point from either static or dynamic data
 */
export function getPointCoordinates(pointId: string): { x: number, y: number, theta: number } | null {
  // First try to get the point from static data
  try {
    const floorIds = robotPointsMap.getFloorIds();
    for (const floorId of floorIds) {
      try {
        const point = robotPointsMap.getPoint(floorId, pointId);
        return { x: point.x, y: point.y, theta: point.theta };
      } catch {
        // Point not found on this floor, continue checking
      }
    }
  } catch {
    // Couldn't find in static data, continue to dynamic data
  }
  
  // Then try to get it from dynamic data
  try {
    const dynamicData = loadDynamicPointsData();
    const point = dynamicData.points[pointId];
    if (point) {
      return { x: point.x, y: point.y, theta: point.theta };
    }
  } catch {
    // Error loading dynamic data
  }
  
  // Point not found in either source
  return null;
}

/**
 * Get all dynamic points
 */
export function getAllDynamicPoints(): Record<string, { x: number, y: number, theta: number, floorId: string }> {
  try {
    const dynamicData = loadDynamicPointsData();
    return dynamicData.points;
  } catch {
    return {};
  }
}

/**
 * Get all point display mappings (combined static and dynamic)
 */
export function getAllPointDisplayMappings(): { technicalId: string, displayName: string, pointType: string }[] {
  const staticMappings = [...pointDisplayMappings];
  
  try {
    const dynamicData = loadDynamicPointsData();
    // Combine, but avoid duplicates
    const technicalIds = new Set(staticMappings.map(m => m.technicalId));
    
    // Add dynamic mappings that don't exist in static
    for (const mapping of dynamicData.displayMappings) {
      if (!technicalIds.has(mapping.technicalId)) {
        staticMappings.push(mapping);
        technicalIds.add(mapping.technicalId);
      }
    }
  } catch {
    // Error loading dynamic data, return just static mappings
  }
  
  return staticMappings;
}

/**
 * Get display name for a point
 */
export function getPointDisplayName(pointId: string): string {
  // First check static mappings
  for (const mapping of pointDisplayMappings) {
    if (mapping.technicalId === pointId) {
      return mapping.displayName;
    }
  }
  
  // Then check dynamic mappings
  try {
    const dynamicData = loadDynamicPointsData();
    const mapping = dynamicData.displayMappings.find(m => m.technicalId === pointId);
    if (mapping) {
      return mapping.displayName;
    }
  } catch {
    // Error loading dynamic data
  }
  
  // Fall back to the point ID itself
  return pointId;
}

/**
 * Schedule regular updates of the point database
 * Runs immediately on startup and then every 15 minutes
 */
export function schedulePointDatabaseUpdates(initialDelay = 0): void {
  // Run initial update after the specified delay
  setTimeout(async () => {
    console.log('Running initial point database update...');
    await updatePointDatabase();
    
    // Then schedule regular updates
    setInterval(async () => {
      console.log('Running scheduled point database update...');
      await updatePointDatabase();
    }, 15 * 60 * 1000); // 15 minutes
  }, initialDelay);
}

/**
 * Initialize automatic point detection system
 * This should be called at server startup
 */
export function initializeAutoPointDetection(): void {
  // Schedule updates with a short initial delay to give server time to start up
  schedulePointDatabaseUpdates(5000);
  
  console.log('✅ Initialized automatic point detection system');
}