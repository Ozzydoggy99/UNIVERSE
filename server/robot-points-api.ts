// server/robot-points-api.ts
import { Express, Request, Response } from 'express';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  description?: string;
  floorId?: string;
}

/**
 * Fetch map points from the robot
 * @returns Array of map points
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  try {
    // First, get a list of all maps
    console.log(`Fetching all maps from robot at ${ROBOT_API_URL}/maps/`);
    
    const mapsResponse = await axios.get(`${ROBOT_API_URL}/maps/`, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    if (!Array.isArray(mapsResponse.data) || mapsResponse.data.length === 0) {
      throw new Error('No maps found on the robot');
    }
    
    const maps = mapsResponse.data || [];

    // Just use map ID 2 directly (since we know it works)
    const activeMap = maps.find((m: any) => m.id === 2) || maps[0];

    if (!activeMap) throw new Error("❌ No map found");

    // Extract floor ID from map name (e.g. "2 - Track")
    const rawName = activeMap.name || activeMap.map_name || "";
    const floorMatch = rawName.match(/^(\d+)/);
    const floorIdFromMap = floorMatch ? floorMatch[1] : "2";  // fallback to 2
    
    console.log(`Using map ID ${activeMap.id} named "${rawName}" with floor ID: ${floorIdFromMap}`);
    
    // Now fetch the full map data to get the overlays
    const mapUrl = `${ROBOT_API_URL}/maps/${activeMap.id}`;
    console.log(`Fetching map data from ${mapUrl}`);
    
    const response = await axios.get(mapUrl, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    if (!response.data || !response.data.overlays) {
      throw new Error('Invalid response format: missing overlays data');
    }
    
    // The overlays property contains a JSON string with all the map points
    let overlays;
    try {
      overlays = JSON.parse(response.data.overlays);
    } catch (e) {
      console.error('Failed to parse overlays JSON:', e);
      throw new Error('Invalid overlays format: failed to parse JSON');
    }
    
    if (!overlays || !overlays.features || !Array.isArray(overlays.features)) {
      throw new Error('Invalid overlays format: missing features array');
    }
    
    // Define interfaces for GeoJSON structure
    interface GeoJSONFeature {
      id: string;
      type: string;
      geometry: {
        type: string;
        coordinates: number[];
      };
      properties: {
        name?: string;
        type: string;
        yaw?: string;
        [key: string]: any;
      };
    }
    
    // Extract points from the features - focus on "Label" type points
    const points: Point[] = overlays.features
      .filter((feature: GeoJSONFeature) => 
        feature.geometry.type === 'Point' && 
        feature.properties && 
        (feature.properties.type === 'Label' || 
         feature.properties.type === '34' || // Pickup points (shelves)
         feature.properties.type === '11' || // General points
         feature.properties.type === '10' || // Standby points
         feature.properties.type === '9')    // Charging station
      )
      .map((feature: GeoJSONFeature) => {
        // Handle both formats (Label type vs. our existing types)
        if (feature.properties.type === 'Label') {
          return {
            id: feature.properties.text || feature.id,
            x: feature.properties.x || feature.geometry.coordinates[0],
            y: feature.properties.y || feature.geometry.coordinates[1],
            ori: feature.properties.orientation || 0,
            description: feature.properties.text || '',
            floorId: floorIdFromMap // Tag the floor ID directly
          };
        } else {
          return {
            id: feature.properties.name || feature.id,
            x: feature.geometry.coordinates[0], 
            y: feature.geometry.coordinates[1],
            ori: parseFloat(feature.properties.yaw || '0'),
            description: feature.properties.name || '',
            floorId: floorIdFromMap // Tag the floor ID directly
          };
        }
      });
    
    console.log(`Successfully extracted ${points.length} map points from overlays`);
    
    // Debug output to see what points we have
    const pointIds = points.map(p => p.id);
    console.log('Available point IDs:', pointIds);
    
    return points;
  } catch (error: any) {
    console.error('Error fetching robot map points:', error.message || error);
    throw new Error(`Failed to fetch map points: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Debug utility to get a list of all maps on the robot
 * @returns Array of map names with IDs
 */
export async function debugRobotMapList(): Promise<string[]> {
  const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, {
    headers: { "x-api-key": ROBOT_SECRET },
  });

  const maps = mapsRes.data || [];
  return maps.map((m: any) => `${m.id}: ${m.name || m.map_name || JSON.stringify(m)}`);
}

export function registerRobotPointsApiRoutes(app: Express) {
  /**
   * GET /api/robots/points
   * Get all map points from the robot's current map
   */
  app.get('/api/robots/points', async (req: Request, res: Response) => {
    try {
      const points = await fetchRobotMapPoints();
      res.json(points);
    } catch (error: any) {
      console.error('Error fetching map points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch map points', 
        details: error.message 
      });
    }
  });
  
  /**
   * GET /api/robots/points/shelves
   * Get only shelf points from the robot's current map
   * (any point that doesn't have pickup, dropoff, or standby in its ID)
   */
  app.get('/api/robots/points/shelves', async (req: Request, res: Response) => {
    try {
      const allPoints = await fetchRobotMapPoints();
      
      // Filter to only include shelf points
      const shelfPoints = allPoints.filter(point => {
        const id = point.id.toLowerCase();
        return !id.includes('pick') && !id.includes('drop') && !id.includes('desk') && !id.includes('standby');
      });
      
      res.json(shelfPoints);
    } catch (error: any) {
      console.error('Error fetching shelf points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch shelf points', 
        details: error.message 
      });
    }
  });
  
  /**
   * GET /api/fetch-points
   * Alternative endpoint for fetching points (from simplified server)
   */
  app.get('/api/fetch-points', async (req: Request, res: Response) => {
    try {
      const points = await fetchRobotMapPoints();
      console.log('API DEBUG - All points from robot:', points.map(p => p.id));
      
      // Categorize points for better debugging
      const special = points.filter(p => {
        const label = p.id.toLowerCase();
        return label.includes('charging') || 
               label.includes('standby') || 
               label.includes('pick') || 
               label.includes('drop');
      });

      // Sort points by ID for better readability
      points.sort((a, b) => a.id.localeCompare(b.id));
      
      console.log('API DEBUG - Special points:', special.map(p => p.id));
      res.json({ points });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      res.status(500).json({ error: 'Could not fetch points.' });
    }
  });
}