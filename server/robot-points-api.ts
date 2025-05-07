// server/robot-points-api.ts
import { Express, Request, Response } from 'express';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { ROBOT_MAP_POINTS, getShelfPoints } from './robot-map-data';
import { Point } from './types';

/**
 * Fetch map points from the robot
 * @returns Array of map points
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  try {
    const headers = { 'x-api-key': ROBOT_SECRET };

    // First make sure we can even get maps list
    try {
      console.log(`Fetching maps from ${ROBOT_API_URL}/maps/`);
      const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
      const maps = mapsRes.data || [];

      if (!maps.length) {
        console.log("No maps found on robot, falling back to hardcoded data");
        return ROBOT_MAP_POINTS; 
      }

      // We have maps, but the rest of the code requires map details with overlays
      // which may not be supported by this robot. Let's try but be ready to fall back.
      const activeMap = maps[0]; // only one map exists
      const mapId = activeMap.uid || activeMap.id;
      
      // Extract floor from map name like "Phil's Map"
      const rawName = activeMap.name || activeMap.map_name || "";
      const floorMatch = rawName.match(/floor[_\s]*(\d+)/i);
      const floorId = floorMatch ? floorMatch[1] : "1"; // fallback to 1
      
      console.log(`🔍 Using map ${rawName} (ID: ${mapId}) with floor ID: ${floorId}`);
      
      // This part might fail if the API doesn't support the detailed map endpoint
      try {
        // Load map details to get overlays
        const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, { headers });
        const mapData = mapDetailRes.data;
        
        if (!mapData || !mapData.overlays) {
          console.log('No overlays data in map details, falling back to hardcoded data');
          return ROBOT_MAP_POINTS;
        }
        
        // Parse the overlays JSON
        let overlays;
        try {
          overlays = JSON.parse(mapData.overlays);
        } catch (e) {
          console.error('Failed to parse overlays JSON:', e);
          return ROBOT_MAP_POINTS;
        }
        
        if (!overlays || !overlays.features || !Array.isArray(overlays.features)) {
          console.log('Invalid overlays format, falling back to hardcoded data');
          return ROBOT_MAP_POINTS;
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
        
        if (points.length === 0) {
          console.log('No points found in overlays, falling back to hardcoded data');
          return ROBOT_MAP_POINTS;
        }
        
        // Debug output to see what points we have
        const pointIds = points.map(p => p.id).sort();
        console.log('Available point IDs:', pointIds);
        
        return points;
      } catch (error) {
        // Map details endpoint failed, falling back to hardcoded data
        console.error('Error fetching map details, falling back to hardcoded data:', error);
        return ROBOT_MAP_POINTS;
      }
    } catch (error) {
      // Even maps endpoint failed, definitely falling back to hardcoded data
      console.error('Error fetching maps list, falling back to hardcoded data:', error);
      return ROBOT_MAP_POINTS;
    }
  } catch (error: any) {
    console.error('Error in fetchRobotMapPoints, using hardcoded data:', error.message || error);
    return ROBOT_MAP_POINTS;
  }
}

/**
 * Debug utility to get a list of all maps on the robot
 * @returns Array of map names with IDs
 */
export async function debugRobotMapList(): Promise<string[]> {
  try {
    const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    const maps = mapsRes.data || [];
    return maps.map((m: any) => `${m.id || m.uid}: ${m.name || m.map_name || JSON.stringify(m)}`);
  } catch (error) {
    console.error('Error getting map list:', error);
    return ["Error fetching maps: Using hardcoded data instead"];
  }
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
        const id = String(point.id).toLowerCase();
        return !id.includes('pick') && !id.includes('drop') && !id.includes('desk') && !id.includes('standby') && !id.includes('charging');
      });
      
      res.json(shelfPoints);
    } catch (error: any) {
      console.error('Error fetching shelf points:', error);
      
      // Fall back to hardcoded shelf points
      const hardcodedShelfPoints = getShelfPoints();
      console.log(`Falling back to ${hardcodedShelfPoints.length} hardcoded shelf points`);
      res.json(hardcodedShelfPoints);
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
        const label = String(p.id).toLowerCase();
        return label.includes('charging') || 
               label.includes('standby') || 
               label.includes('pick') || 
               label.includes('drop');
      });

      // Sort points by ID for better readability
      points.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      
      console.log('API DEBUG - Special points:', special.map(p => p.id));
      res.json({ points });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      
      // Fall back to hardcoded points
      const hardcodedPoints = ROBOT_MAP_POINTS;
      console.log(`Falling back to ${hardcodedPoints.length} hardcoded points`);
      res.json({ points: hardcodedPoints });
    }
  });
  
  /**
   * GET /api/debug-points
   * Debug endpoint to check our map point fetching
   */
  app.get('/api/debug-points', async (req: Request, res: Response) => {
    try {
      // Get maps list
      console.log('Attempting to get maps list...');
      let mapsList = [];
      try {
        mapsList = await debugRobotMapList();
      } catch (e) {
        console.error('Failed to get maps list:', e);
      }
      
      // Try to get map points
      console.log('Attempting to get map points...');
      let points = [];
      let error = null;
      try {
        points = await fetchRobotMapPoints();
      } catch (e) {
        error = e;
        console.error('Failed to get map points:', e);
      }
      
      // Return debug info
      res.json({
        maps: mapsList,
        points_count: points.length,
        points: points.map(p => ({ id: p.id, x: p.x, y: p.y })),
        error: error ? error.message : null,
        using_hardcoded: points.length > 0 && points[0] === ROBOT_MAP_POINTS[0]
      });
    } catch (error: any) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ error: 'Debug endpoint error', details: error.message });
    }
  });
}