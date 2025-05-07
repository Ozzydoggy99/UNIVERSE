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
    
    // Prefer Phil's Map (case-insensitive match), fallback to anything not ID 1
    const maps = mapsResponse.data;
    const philMap = maps.find((m: any) => m.map_name?.toLowerCase().includes("phil")) ||
                    maps.find((m: any) => m.id === 2) ||
                    maps.find((m: any) => m.id !== 1);
    
    if (!philMap) {
      throw new Error('❌ No valid map found - need Phil\'s Map or a non-ID 1 map');
    }
    
    const mapId = philMap.id;
    
    console.log(`Using map ID ${mapId} named "${philMap.map_name}"`);
    
    // Now fetch the full map data to get the overlays
    const mapUrl = `${ROBOT_API_URL}/maps/${mapId}`;
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
    const overlays = JSON.parse(response.data.overlays);
    
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
    
    // Extract points from the features - handle both "Label" type points 
    // and our specific known point types (34, 11, 10, 9)
    const points: Point[] = overlays.features
      .filter((feature: GeoJSONFeature) => 
        feature.geometry.type === 'Point' && 
        feature.properties && 
        (feature.properties.type === '34' || // Pickup points (shelves)
         feature.properties.type === '11' || // General points
         feature.properties.type === '10' || // Standby points
         feature.properties.type === '9'  || // Charging station
         feature.properties.type === 'Label') // Label type as mentioned in provided code
      )
      .map((feature: GeoJSONFeature) => {
        // Handle both formats (Label type vs. our existing types)
        if (feature.properties.type === 'Label') {
          return {
            id: feature.properties.text || feature.id,
            x: feature.properties.x || feature.geometry.coordinates[0],
            y: feature.properties.y || feature.geometry.coordinates[1],
            ori: feature.properties.orientation || 0,
            description: feature.properties.text || ''
          };
        } else {
          return {
            id: feature.properties.name || feature.id,
            x: feature.geometry.coordinates[0], 
            y: feature.geometry.coordinates[1],
            ori: parseFloat(feature.properties.yaw || '0'),
            description: feature.properties.name || ''
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
 * Register API routes for robot points
 */
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