// server/robot-map-data.ts
import { Point } from './types';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';

/**
 * Fetch all map points from the robot's current map using overlays
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = getAuthHeaders();

  try {
    // Fetch the list of maps
    const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
    const maps = mapsRes.data || [];
    const activeMap = maps[0];  // Get the first map (typically current/active map)
    
    if (!activeMap) {
      const error = 'No maps found from robot API';
      console.error('❌ ' + error);
      throw new Error(error);
    }

    // Extract floor ID from map name if possible
    const rawName = activeMap.name || activeMap.map_name || '';
    const floorMatch = rawName.match(/^(\d+)/);
    const floorId = floorMatch ? floorMatch[1] : '1'; // Default to floor "1"
    
    console.log(`✅ Found map: ${rawName} (Floor ID: ${floorId})`);

    // Get detailed map data including overlays
    const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
    const mapData = mapDetailRes.data;
    
    if (!mapData || !mapData.overlays) {
      const error = 'No overlay data in map';
      console.error('❌ ' + error);
      throw new Error(error);
    }

    // Parse the overlay JSON
    let overlays;
    try {
      overlays = JSON.parse(mapData.overlays);
    } catch (e) {
      const error = 'Failed to parse overlays JSON: ' + (e instanceof Error ? e.message : String(e));
      console.error('❌ ' + error);
      throw new Error(error);
    }

    // Extract point features from the overlays
    const features = overlays.features || [];
    console.log(`✅ Found ${features.length} features in map overlays`);

    // DEBUG: Let's see what point IDs we're actually getting from the robot
    console.log('------ POINT IDS FROM ROBOT API ------');
    const pointIds = [];
    features.forEach((f: any) => {
      if (f && f.properties && f.properties.name) {
        const pointId = f.properties.name;
        pointIds.push(pointId);
        
        // Log shelf points with their case
        if (pointId.includes('104') || pointId.toLowerCase().includes('load')) {
          console.log(`IMPORTANT POINT ID FROM ROBOT: "${pointId}" (case-sensitive exact string)`);
        }
      }
    });
    console.log(`Found ${pointIds.length} total point IDs from robot`);
    console.log('------ END POINT IDS ------');

    // Filter to only point features and extract data
    const points: Point[] = features
      .filter((f: any) => f.geometry?.type === 'Point' && f.properties)
      .map((f: any) => {
        const { properties, geometry } = f;
        const id = String(properties.name || properties.text || '').trim();
        const x = typeof properties.x === 'number' ? properties.x : geometry.coordinates[0];
        const y = typeof properties.y === 'number' ? properties.y : geometry.coordinates[1];
        const ori = parseFloat(String(properties.yaw || properties.orientation || '0'));
        
        // Ensure floorId is always a string and not undefined
        return { 
          id, 
          x, 
          y, 
          ori, 
          floorId, 
          description: id 
        };
      });

    if (points.length > 0) {
      console.log(`✅ Successfully extracted ${points.length} map points from robot`);
      return points;
    } else {
      const error = 'No point features found in map overlays';
      console.error('❌ ' + error);
      throw new Error(error);
    }
  } catch (error) {
    console.error('Error fetching robot map points:', error);
    throw error instanceof Error ? error : new Error('Unknown error fetching map points');
  }
}

/**
 * Return shelves grouped by floor (numeric IDs only)
 */
export function getShelfPointsByFloor(points: Point[]): Record<string, Point[]> {
  const grouped: Record<string, Point[]> = {};
  for (const p of points) {
    // More flexible shelf detection with multiple patterns:
    // 1. Pure numeric IDs (like "104")
    // 2. IDs starting with numbers followed by underscore (like "104_load")
    // 3. IDs containing "_load" (case-insensitive)
    // 4. Long IDs that might be UUIDs with no clear pattern (but excluding _docking points)
    const isShelf = (
      /^\d+$/.test(p.id) || 
      /^\d+_/.test(p.id) ||
      p.id.toLowerCase().includes('_load') ||
      (p.id.length > 20 && !p.id.includes('_docking') && !p.id.toLowerCase().includes('charger'))
    );
    if (!isShelf) continue;
    
    console.log(`Found shelf point in getShelfPointsByFloor: ${p.id} (${p.x}, ${p.y})`);
    const floorId = p.floorId || "1"; // Default to floor 1 if missing
    if (!grouped[floorId]) grouped[floorId] = [];
    grouped[floorId].push(p);
  }
  Object.values(grouped).forEach(list =>
    list.sort((a, b) => parseInt(a.id) - parseInt(b.id))
  );
  return grouped;
}

/**
 * Extract special labeled points using the new naming convention
 * Special points now use the format:
 * - Load points: "number_load" (the actual shelf points where bins will be picked up)
 * - Load docking points: "number_load_docking" (positions before the actual shelf)
 * - Dropoff: "drop-off_load" (where bins are dropped off)
 * - Dropoff docking: "drop-off_load_docking" (position before the dropoff)
 * - Charger: "charging station" (robot charging station)
 */
export function getSpecialPoints(points: Point[]) {
  const match = (label: string, target: string) => label.toLowerCase().includes(target.toLowerCase());
  
  // Find main points
  let pickup, dropoff, standby, charger;
  
  // Find docking points
  let pickupDocking, dropoffDocking;
  
  for (const p of points) {
    const id = p.id.toLowerCase();
    
    // Main points
    if (!pickup && (match(id, 'pick') || match(id, 'load'))) {
      // Filter out docking points from being the main pickup
      if (!id.includes('docking')) {
        pickup = p;
      }
    }
    else if (!dropoff && match(id, 'drop')) {
      // Filter out docking points from being the main dropoff
      if (!id.includes('docking')) {
        dropoff = p;
      }
    }
    else if (!standby && (match(id, 'desk') || match(id, 'standby'))) {
      standby = p;
    }
    else if (!charger && (match(id, 'charge') || match(id, 'charger'))) {
      charger = p;
    }
    
    // Docking points
    if (!pickupDocking && match(id, 'pick') && match(id, 'docking')) {
      pickupDocking = p;
    }
    else if (!dropoffDocking && match(id, 'drop') && match(id, 'docking')) {
      dropoffDocking = p;
    }
  }
  
  return { 
    pickup, 
    pickupDocking,
    dropoff, 
    dropoffDocking,
    standby,
    charger
  };
}

/**
 * Return sorted list of floor IDs
 */
export function getAllFloors(points: Point[]): string[] {
  // Ensure we have valid floor IDs (default to "1" if undefined)
  const floorIds = points.map(p => p.floorId || "1");
  return Array.from(new Set(floorIds)).sort();
}

/**
 * Validate if a shelf ID exists in our map data
 * @param shelfId The shelf ID to validate
 * @param points Array of points to search through
 * @returns True if the shelf ID exists, false otherwise
 */
export function validateShelfId(shelfId: string, points: Point[]): boolean {
  if (!points || points.length === 0) {
    throw new Error('No map points available for shelf ID validation');
  }
  
  return points.some(point => 
    String(point.id).toLowerCase() === String(shelfId).toLowerCase());
}

/**
 * Get a list of all available shelf points (excludes special points like pickup/dropoff)
 * @param points Array of points to filter (required)
 * @returns Array of shelf points
 */
export function getShelfPoints(points: Point[]): Point[] {
  if (!points || points.length === 0) {
    throw new Error('No map points available for shelf filtering');
  }
  
  // Filter using the same flexible detection as getShelfPointsByFloor
  const shelfPoints = points.filter(point => {
    const id = String(point.id || "").trim();
    
    // More flexible shelf detection with multiple patterns
    return (
      /^\d+$/.test(id) || 
      /^\d+_/.test(id) ||
      id.toLowerCase().includes('_load') ||
      (id.length > 20 && !id.includes('_docking') && !id.toLowerCase().includes('charger'))
    );
  });
  
  // Log what we found
  console.log(`Found ${shelfPoints.length} shelf points in getShelfPoints`);
  if (shelfPoints.length > 0) {
    console.log(`First shelf point: ${JSON.stringify(shelfPoints[0])}`);
  }
  
  // Sort shelf points - try numeric sorting when possible
  shelfPoints.sort((a, b) => {
    // If both have numeric IDs, sort numerically
    const numA = parseInt(String(a.id));
    const numB = parseInt(String(b.id));
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    // Otherwise sort alphabetically
    return String(a.id).localeCompare(String(b.id));
  });
  
  return shelfPoints;
}