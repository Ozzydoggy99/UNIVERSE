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
      console.log('❌ No maps found from robot API');
      return [...ROBOT_MAP_POINTS]; // Return fallback data if no maps
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
      console.log('❌ No overlay data in map');
      return [...ROBOT_MAP_POINTS]; // Return fallback data if no overlay data
    }

    // Parse the overlay JSON
    let overlays;
    try {
      overlays = JSON.parse(mapData.overlays);
    } catch (e) {
      console.error('Failed to parse overlays JSON:', e);
      return [...ROBOT_MAP_POINTS]; // Return fallback data if JSON parsing fails
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
      console.log('❌ No point features found in map overlays');
      return [...ROBOT_MAP_POINTS]; // Return fallback data if no point features
    }
  } catch (error) {
    console.error('Error fetching robot map points:', error);
    return [...ROBOT_MAP_POINTS]; // Return fallback data on any error
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
 * Hard-coded map points as a fallback
 * These are only used as a fallback if the above API calls fail
 */
export const ROBOT_MAP_POINTS: Point[] = [
  {
    id: "Charging Station",
    x: -23.24,
    y: 1.64,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Pick-up",
    x: -11.94,
    y: 6.31,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Drop-off",
    x: 0.5,
    y: 4.2,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Desk",
    x: -5.75,
    y: 5.12,
    ori: 0,
    floorId: "1"
  },
  {
    id: "145",
    x: -13.6,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "146",
    x: -10.2,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "147",
    x: -6.8,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "148",
    x: -3.4,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "149",
    x: 0,
    y: 2.1,
    ori: 0,
    floorId: "1"
  }
];

/**
 * Validate if a shelf ID exists in our map data
 * @param shelfId The shelf ID to validate
 * @returns True if the shelf ID exists, false otherwise
 */
export function validateShelfId(shelfId: string): boolean {
  return ROBOT_MAP_POINTS.some(point => 
    String(point.id).toLowerCase() === String(shelfId).toLowerCase());
}

/**
 * Get a list of all available shelf points (excludes special points like pickup/dropoff)
 * @returns Array of shelf points
 */
export function getShelfPoints(points?: Point[]): Point[] {
  const pointsToFilter = points || ROBOT_MAP_POINTS;
  
  // Filter and return only numeric points (like shelf IDs)
  const numericPoints = pointsToFilter.filter(point => {
    const id = String(point.id || "").trim();
    return /^\d+$/.test(id);
  });
  
  // Sort numeric points by their numeric ID
  numericPoints.sort((a, b) => parseInt(String(a.id)) - parseInt(String(b.id)));
  return numericPoints;
}