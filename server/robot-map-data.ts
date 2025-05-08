// server/robot-map-data.ts
import { Point } from './types';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

/**
 * Fetch all map points from the robot's current map using overlays
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = { 'x-api-key': ROBOT_SECRET };

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
    const isShelf = /^\d+$/.test(p.id);
    if (!isShelf) continue;
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
 * Extract special labeled points
 */
export function getSpecialPoints(points: Point[]) {
  const match = (label: string, target: string) => label.toLowerCase().includes(target.toLowerCase());
  let pickup, dropoff, standby;
  for (const p of points) {
    const id = p.id.toLowerCase();
    if (!pickup && match(id, 'pick')) pickup = p;
    else if (!dropoff && match(id, 'drop')) dropoff = p;
    else if (!standby && match(id, 'desk')) standby = p;
  }
  return { pickup, dropoff, standby };
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
  
  // Filter and return only numeric points (like shelf IDs)
  const numericPoints = points.filter(point => {
    const id = String(point.id || "").trim();
    return /^\d+$/.test(id);
  });
  
  // Sort numeric points by their numeric ID
  numericPoints.sort((a, b) => parseInt(String(a.id)) - parseInt(String(b.id)));
  return numericPoints;
}