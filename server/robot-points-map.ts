/**
 * Standardized map of robot points based on our naming convention
 * 
 * This file is used by the workflow system to locate and interact with points
 * across the different maps in the robot.
 * 
 * It includes mapping between technical point IDs (001_load, 050_load) and 
 * user-friendly display names ("Pickup", "Dropoff") shown in the UI.
 */

// Point coordinates type
export interface Point {
  x: number;
  y: number;
  theta: number;
}

// Floor data type
export interface Floor {
  mapId: number;
  mapName: string;
  points: Record<string, Point>;
  charger: Point;
}

// Display name mapping for user interface
export interface PointDisplayMapping {
  technicalId: string;    // Internal ID used by system (e.g., "001_load")
  displayName: string;    // User-friendly name shown in UI (e.g., "Dropoff")
  pointType: 'pickup' | 'dropoff' | 'shelf' | 'charger'; // Type of point
}

// Robot points map type
export interface RobotPointsMap {
  floors: Record<number, Floor>;
  getPoint: (floorId: number, pointName: string) => Point;
  getCharger: (floorId: number) => Point;
  getMapId: (floorId: number) => number;
  getFloorIds: () => number[];
  getShelfPointNames: (floorId: number) => string[];
  getShelfNumber: (shelfPointName: string) => number;
  getDockingPointName: (loadPointName: string) => string;
  // New mapping functions for display names
  getDisplayName: (technicalId: string) => string;
  getTechnicalIdFromDisplay: (displayName: string) => string;
  // Dynamic point management
  addPoint: (floorId: number, pointName: string, point: Point) => void;
  hasPoint: (floorId: number, pointName: string) => boolean;
  refreshPointsFromRobot: () => Promise<void>;
}

// Display name mappings for the UI
export const pointDisplayMappings: PointDisplayMapping[] = [
  { technicalId: '050_load', displayName: 'Pickup', pointType: 'pickup' },
  { technicalId: '050_load_docking', displayName: 'Pickup Docking', pointType: 'pickup' },
  { technicalId: '001_load', displayName: 'Dropoff', pointType: 'dropoff' },
  { technicalId: '001_load_docking', displayName: 'Dropoff Docking', pointType: 'dropoff' },
  { technicalId: '104_load', displayName: 'Zone 104', pointType: 'shelf' },
  { technicalId: '104_load_docking', displayName: 'Zone 104 Docking', pointType: 'shelf' },
  { technicalId: 'charger', displayName: 'Charging Station', pointType: 'charger' },
];

// Contains data retrieved from analyze-robot-map.js
const robotPointsMap: RobotPointsMap = {
  floors: {
    // Floor1 is our main operational floor
    1: {
      mapId: 4,
      mapName: 'Floor1',
      points: {
        // Central pickup and dropoff points (updated nomenclature)
        '050_load': {
          x: -2.847, 
          y: 2.311, 
          theta: 0.0
        },
        '050_load_docking': {
          x: -1.887,
          y: 2.311,
          theta: 0.0
        },
        '001_load': {
          x: -2.861,
          y: 3.383,
          theta: 0.0
        },
        '001_unload': {
          x: -2.861,  // Same position as 001_load
          y: 3.383,
          theta: 0.0
        },
        '001_load_docking': {
          x: -1.850,
          y: 3.366,
          theta: 0.0
        },
        
        // Legacy points kept for backward compatibility
        'pick-up_load': {
          x: -2.847, 
          y: 2.311, 
          theta: 0.0
        },
        'pick-up_load_docking': {
          x: -1.887,
          y: 2.311,
          theta: 0.0
        },
        'drop-off_load': {
          x: -2.861,
          y: 3.383,
          theta: 0.0
        },
        'drop-off_load_docking': {
          x: -1.850,
          y: 3.366,
          theta: 0.0
        },
        
        // Shelf points on floor 1
        '104_load': {
          x: -15.880,
          y: 6.768,
          theta: 0.0
        },
        '104_load_docking': {
          x: -14.801,
          y: 6.768,
          theta: 0.0
        },
        '110_load': {
          x: -12.305,
          y: 7.123,
          theta: 0.0
        },
        '110_load_docking': {
          x: -11.252,
          y: 7.123,
          theta: 0.0
        },
        '112_load': {
          x: 1.406,
          y: 4.496,
          theta: 180.0
        },
        '112_load_docking': {
          x: 0.378,
          y: 4.529,
          theta: 0.0
        },
        '115_load': {
          x: -8.029,
          y: 6.704,
          theta: 0.0
        },
        '115_load_docking': {
          x: -6.917,
          y: 6.721,
          theta: 0.0
        }
      },
      // Charger location on this floor
      charger: {
        x: 0.034,
        y: 0.498,
        theta: 266.11
      }
    }
  },
  
  // Get point coordinates by floor ID and point name
  getPoint: function(floorId: number, pointName: string): Point {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    if (!this.floors[floorId].points[pointName]) {
      throw new Error(`Point ${pointName} not found on floor ${floorId}`);
    }
    
    return this.floors[floorId].points[pointName];
  },
  
  // Get charger coordinates for a specific floor
  getCharger: function(floorId: number): Point {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    if (!this.floors[floorId].charger) {
      throw new Error(`No charger found on floor ${floorId}`);
    }
    
    return this.floors[floorId].charger;
  },
  
  // Get map ID for a specific floor
  getMapId: function(floorId: number): number {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    return this.floors[floorId].mapId;
  },
  
  // Get all available floor IDs
  getFloorIds: function(): number[] {
    return Object.keys(this.floors).map(id => parseInt(id, 10));
  },
  
  // Get all shelf point names for a specific floor
  getShelfPointNames: function(floorId: number): string[] {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    return Object.keys(this.floors[floorId].points)
      .filter(pointName => /^\d+_load$/.test(pointName));
  },
  
  // Extract the shelf number from a shelf point name (e.g., "104_load" -> 104)
  getShelfNumber: function(shelfPointName: string): number {
    if (!shelfPointName.endsWith('_load')) {
      throw new Error(`${shelfPointName} is not a valid shelf point name`);
    }
    
    return parseInt(shelfPointName.replace('_load', ''), 10);
  },
  
  // Get the docking point name for a load point
  getDockingPointName: function(loadPointName: string): string {
    if (!loadPointName.endsWith('_load')) {
      throw new Error(`${loadPointName} is not a valid load point name`);
    }
    
    return `${loadPointName}_docking`;
  },
  
  // Get display name for technical point ID
  getDisplayName: function(technicalId: string): string {
    const mapping = pointDisplayMappings.find(m => m.technicalId === technicalId);
    if (mapping) {
      return mapping.displayName;
    }
    // If no mapping found, return the original ID (fallback)
    return technicalId;
  },
  
  // Get technical ID from display name
  getTechnicalIdFromDisplay: function(displayName: string): string {
    const mapping = pointDisplayMappings.find(m => m.displayName === displayName);
    if (mapping) {
      return mapping.technicalId;
    }
    // If no mapping found, return the original name (fallback)
    return displayName;
  },
  
  // Dynamically add a new point to the map
  addPoint: function(floorId: number, pointName: string, point: Point): void {
    if (!this.floors[floorId]) {
      console.error(`Floor ${floorId} not found, cannot add point ${pointName}`);
      return;
    }
    
    console.log(`Adding dynamic point ${pointName} to floor ${floorId}: (${point.x}, ${point.y}, ${point.theta})`);
    this.floors[floorId].points[pointName] = {
      x: point.x,
      y: point.y,
      theta: point.theta
    };
    
    // If this is a load point, add a corresponding display mapping
    if (pointName.endsWith('_load') && !pointName.includes('_docking')) {
      const shelfId = pointName.replace('_load', '');
      // Only add mapping if it doesn't already exist
      if (!pointDisplayMappings.some(m => m.technicalId === pointName)) {
        console.log(`Adding display mapping for ${pointName} as "Zone ${shelfId}"`);
        pointDisplayMappings.push({
          technicalId: pointName,
          displayName: `Zone ${shelfId}`,
          pointType: 'shelf'
        });
      }
    }
  },
  
  // Check if a point exists in the map
  hasPoint: function(floorId: number, pointName: string): boolean {
    if (!this.floors[floorId]) {
      return false;
    }
    return !!this.floors[floorId].points[pointName];
  },
  
  // Refresh points from the robot
  refreshPointsFromRobot: async function(): Promise<void> {
    try {
      console.log('Refreshing points from robot...');
      
      // Import necessary API functions
      const { fetchMapData, getRobotMaps } = await import('./robot-api');
      
      // Get all maps from the robot
      const maps = await getRobotMaps();
      if (!maps || !maps.maps || !Array.isArray(maps.maps)) {
        console.error('Failed to get maps from robot');
        return Promise.reject(new Error('Failed to get maps from robot'));
      }
      
      // Use the first floor map
      const floor1Map = maps.maps.find(map => map.name === 'Floor1');
      if (!floor1Map) {
        console.error('Floor1 map not found');
        return Promise.reject(new Error('Floor1 map not found'));
      }
      
      // Get map details including points
      const mapDetails = await fetchMapData(floor1Map.uid);
      if (!mapDetails || !mapDetails.overlays) {
        console.error('Failed to get map details or no overlays found');
        return Promise.reject(new Error('Failed to get map details'));
      }
      
      // Extract and track point IDs found on the robot
      const robotPointIds = new Set<string>();
      
      // Current floor points (for comparison to detect removed points)
      const currentPoints = this.floors[1]?.points || {};
      const currentPointIds = new Set(Object.keys(currentPoints));
      
      // Track new points found to log them
      const newPointsFound: string[] = [];
      
      // Parse and extract points from map overlays
      const features = mapDetails.overlays.features || [];
      for (const feature of features) {
        if (feature.geometry?.type === 'Point' && feature.properties?.id) {
          const pointId = feature.properties.id;
          const coords = feature.geometry.coordinates;
          
          // Only process named points like "110_load" or "110_load_docking"
          if (
            typeof pointId === 'string' && 
            coords && 
            Array.isArray(coords) && 
            coords.length >= 2 &&
            (pointId.includes('_load') || pointId.includes('charger'))
          ) {
            // Add to tracking set
            robotPointIds.add(pointId);
            
            // Extract coordinates
            const x = coords[0];
            const y = coords[1];
            
            // Get orientation (theta) if available, default to 0
            let theta = 0;
            if (feature.properties.orientation !== undefined) {
              theta = feature.properties.orientation;
            }
            
            // Check if this is a new point
            if (!this.hasPoint(1, pointId)) {
              console.log(`Adding new point from robot map: ${pointId} at (${x}, ${y}, ${theta})`);
              newPointsFound.push(pointId);
              
              // Add the point to our map
              this.addPoint(1, pointId, { x, y, theta });
            } else {
              // Update existing point in case coordinates changed
              console.log(`Updating existing point: ${pointId}`);
              this.floors[1].points[pointId] = { x, y, theta };
            }
          }
        }
      }
      
      // Find points to remove (present in our map but not in robot's map)
      const pointsToRemove: string[] = [];
      for (const pointId of currentPointIds) {
        // Only consider _load and _load_docking points for removal, not built-in points
        if ((pointId.includes('_load') || pointId.includes('_docking')) && 
            !robotPointIds.has(pointId) &&
            // Don't remove central pickup/dropoff points which are special
            !pointId.startsWith('pick-up') && 
            !pointId.startsWith('drop-off') &&
            !pointId.startsWith('050') &&
            !pointId.startsWith('001')) {
          pointsToRemove.push(pointId);
        }
      }
      
      // Remove points that no longer exist in the robot map
      for (const pointId of pointsToRemove) {
        console.log(`Removing point no longer in robot map: ${pointId}`);
        delete this.floors[1].points[pointId];
        
        // Also remove from display mappings if present
        const mappingIndex = pointDisplayMappings.findIndex(m => m.technicalId === pointId);
        if (mappingIndex >= 0) {
          pointDisplayMappings.splice(mappingIndex, 1);
        }
      }
      
      console.log('Points refreshed successfully');
      if (newPointsFound.length > 0) {
        console.log(`Added ${newPointsFound.length} new points: ${newPointsFound.join(', ')}`);
      }
      if (pointsToRemove.length > 0) {
        console.log(`Removed ${pointsToRemove.length} points: ${pointsToRemove.join(', ')}`);
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error refreshing points from robot:', error);
      return Promise.reject(error);
    }
  }
};

// Utility functions for easier access to common point operations

/**
 * Get a shelf point by ID (e.g., "104" or "pick-up" or "drop-off")
 * @param shelfId The shelf ID (e.g., "104", "pick-up", "drop-off")
 * @returns The point object if found, null otherwise
 */
export function getShelfPoint(shelfId: string): Point | null {
  // The default floor is 1 unless specified otherwise
  const floorId = 1;
  
  if (!robotPointsMap.floors[floorId]) {
    console.error(`Floor ${floorId} not found in robot points map`);
    return null;
  }
  
  // Use EXACT format from robot API - all lowercase with correct format
  // For shelf points: "104_load", "115_load", etc.
  // For pickup/dropoff: "pick-up_load", "drop-off_load"
  let pointName: string;
  
  // First check if the shelfId is already a fully formatted ID (ends with _load)
  if (shelfId.toLowerCase().endsWith('_load')) {
    // Already formatted, just ensure lowercase
    pointName = shelfId.toLowerCase();
    console.log(`Using already formatted shelf ID: ${pointName}`);
  }
  // Special handling for pickup and dropoff points with new and old nomenclature
  else if (shelfId === 'pick-up') {
    pointName = '050_load'; // New nomenclature
  }
  else if (shelfId === 'drop-off') {
    pointName = '001_load'; // New nomenclature
  }
  else if (shelfId === '050' || shelfId === 'pickup') {
    pointName = '050_load'; // New pickup point
  }
  else if (shelfId === '001' || shelfId === 'dropoff') {
    pointName = '001_load'; // New dropoff point
  } 
  else {
    // For numeric shelf IDs like 104, 115, etc.
    pointName = `${shelfId.toLowerCase()}_load`;
  }
  
  console.log(`Looking for shelf point with ID: ${pointName}`);
  
  if (robotPointsMap.floors[floorId].points[pointName]) {
    console.log(`Found shelf point: ${pointName}`);
    const point = robotPointsMap.floors[floorId].points[pointName];
    return {
      x: point.x,
      y: point.y,
      theta: point.theta
    };
  }
  
  console.error(`Shelf point not found: ${pointName} on floor ${floorId}`);
  return null;
}

/**
 * Get a shelf docking point by ID (e.g., "104" or "pick-up" or "drop-off")
 * @param shelfId The shelf ID (e.g., "104", "pick-up", "drop-off")
 * @returns The point object if found, null otherwise
 */
export function getShelfDockingPoint(shelfId: string): Point | null {
  // The default floor is 1 unless specified otherwise
  const floorId = 1;
  
  if (!robotPointsMap.floors[floorId]) {
    console.error(`Floor ${floorId} not found in robot points map`);
    return null;
  }
  
  // Use EXACT format from robot API - all lowercase with correct format
  // For shelf points: "104_load_docking", "115_load_docking", etc.
  // For pickup/dropoff: "pick-up_load_docking", "drop-off_load_docking"
  let pointName: string;
  
  // First check if the shelfId is already a fully formatted docking ID (ends with _load_docking)
  if (shelfId.toLowerCase().endsWith('_load_docking')) {
    // Already formatted, just ensure lowercase
    pointName = shelfId.toLowerCase();
    console.log(`Using already formatted docking ID: ${pointName}`);
  }
  // Check if it's a fully formatted load point (ends with _load)
  else if (shelfId.toLowerCase().endsWith('_load')) {
    // Convert load point to docking point
    pointName = `${shelfId.toLowerCase()}_docking`;
    console.log(`Converting load point to docking point: ${pointName}`);
  }
  // Special handling for pickup and dropoff points with new and old nomenclature
  else if (shelfId === 'pick-up') {
    pointName = '050_load_docking'; // New nomenclature
  }
  else if (shelfId === 'drop-off') {
    pointName = '001_load_docking'; // New nomenclature
  }
  else if (shelfId === '050' || shelfId === 'pickup') {
    pointName = '050_load_docking'; // New pickup point
  }
  else if (shelfId === '001' || shelfId === 'dropoff') {
    pointName = '001_load_docking'; // New dropoff point
  } 
  else {
    // For numeric shelf IDs like 104, 115, etc.
    pointName = `${shelfId.toLowerCase()}_load_docking`;
  }
  
  console.log(`Looking for shelf docking point with ID: ${pointName}`);
  
  if (robotPointsMap.floors[floorId].points[pointName]) {
    console.log(`Found shelf docking point: ${pointName}`);
    const point = robotPointsMap.floors[floorId].points[pointName];
    return {
      x: point.x,
      y: point.y,
      theta: point.theta
    };
  }
  
  console.error(`Shelf docking point not found: ${pointName} on floor ${floorId}`);
  return null;
}

export default robotPointsMap;