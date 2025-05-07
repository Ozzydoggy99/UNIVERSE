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
    // Always fetch map ID 2
    const mapId = 2;
    const headers = { 'x-api-key': ROBOT_SECRET };

    // Confirm map details (optional for logging)
    console.log(`Fetching map ID ${mapId} directly from ${ROBOT_API_URL}/maps/${mapId}`);
    const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, { headers });
    const mapData = mapDetailRes.data;
    
    if (!mapData || !mapData.overlays) {
      throw new Error('Invalid response format: missing overlays data');
    }

    // Extract floor ID from name like "2-Phil's Map" or "2 - Track"
    const rawMapName = mapData.name || mapData.map_name || "";
    const floorMatch = rawMapName.match(/^(\d+)/);
    const floorId = floorMatch ? floorMatch[1] : "2";  // default to 2
    
    console.log(`🔍 Using map ID ${mapId} — name: ${rawMapName} with floor ID: ${floorId}`);
    
    // Parse the overlays JSON
    let overlays;
    try {
      overlays = JSON.parse(mapData.overlays);
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
        text?: string;
        type: string;
        yaw?: string;
        orientation?: number;
        x?: number;
        y?: number;
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
            floorId: floorId // Tag the floor ID directly
          };
        } else {
          return {
            id: feature.properties.name || feature.id,
            x: feature.geometry.coordinates[0], 
            y: feature.geometry.coordinates[1],
            ori: parseFloat(feature.properties.yaw || '0'),
            description: feature.properties.name || '',
            floorId: floorId // Tag the floor ID directly
          };
        }
      });
    
    console.log(`Successfully extracted ${points.length} map points from overlays`);
    
    // Debug output to see what points we have
    const pointIds = points.map(p => p.id).sort();
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