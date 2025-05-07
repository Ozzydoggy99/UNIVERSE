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
  const headers = { "x-api-key": ROBOT_SECRET };

  const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
  const maps = mapsRes.data || [];

  const activeMap = maps[0];
  if (!activeMap) throw new Error("❌ No map found");

  const rawName = activeMap.name || activeMap.map_name || "";
  const floorMatch = rawName.match(/^(\d+)/);
  const floorId = floorMatch ? floorMatch[1] : "1";

  const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
  const mapData = mapDetailRes.data;

  if (!mapData || !mapData.overlays) throw new Error("Missing overlays");

  let overlays;
  try {
    overlays = JSON.parse(mapData.overlays);
  } catch (e) {
    throw new Error("Failed to parse overlays JSON");
  }

  const features = overlays.features || [];

  interface GeoJSONFeature {
    id?: string;
    type?: string;
    geometry: {
      type: string;
      coordinates: number[];
    };
    properties: {
      name?: string;
      text?: string;
      type?: string;
      yaw?: string | number;
      orientation?: string | number;
      x?: number;
      y?: number;
      [key: string]: any;
    };
  }

  const points: Point[] = features
    .filter((f: any) => f.geometry?.type === "Point" && f.properties)
    .map((f: GeoJSONFeature) => {
      const { properties, geometry } = f;
      const id = String(properties.name || properties.text || "").trim();

      const x = typeof properties.x === "number" ? properties.x : geometry.coordinates[0];
      const y = typeof properties.y === "number" ? properties.y : geometry.coordinates[1];
      const ori = parseFloat(properties.yaw || properties.orientation || "0");

      return {
        id,
        x,
        y,
        ori,
        floorId, // ✅ Always include
        description: id,
      };
    });

  return points;
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
    return maps.map((m: any) => `${String(m.id || m.uid)}: ${String(m.name || m.map_name) || JSON.stringify(m)}`);
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
      
      // Filter to only include numeric shelf points
      const shelfPoints = allPoints.filter(point => {
        const id = String(point.id);
        // Keep only points with purely numeric IDs (shelf numbers)
        return /^\d+$/.test(id);
      });
      
      // Sort points by numerical ID for better display
      shelfPoints.sort((a, b) => {
        const aNum = parseInt(String(a.id));
        const bNum = parseInt(String(b.id));
        return aNum - bNum;
      });
      
      console.log(`Found ${shelfPoints.length} shelf points with numeric IDs`);
      res.json(shelfPoints);
    } catch (error: any) {
      console.error('Error fetching shelf points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch shelf points', 
        details: error.message || 'Unknown error' 
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
      
      // Categorize points by type for better debugging
      const special = points.filter(p => {
        const label = String(p.id).toLowerCase();
        return label.includes('charging') || 
               label.includes('standby') || 
               label.includes('pick') || 
               label.includes('drop');
      });

      // Sort points by ID for better readability (numeric order for shelf numbers)
      points.sort((a, b) => {
        const aNum = parseInt(String(a.id));
        const bNum = parseInt(String(b.id));
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum; // Sort numerically if both are numbers
        }
        return String(a.id).localeCompare(String(b.id)); // Otherwise alphabetically
      });
      
      console.log('API DEBUG - Special points:', special.map(p => p.id));
      res.json({ points });
    } catch (error: any) {
      console.error('Error fetching points:', error);
      res.status(500).json({ 
        error: 'Failed to fetch points', 
        details: error.message || 'Unknown error' 
      });
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
      let mapsList: string[] = [];
      try {
        mapsList = await debugRobotMapList();
      } catch (e) {
        console.error('Failed to get maps list:', e);
      }
      
      // Try to get map points
      console.log('Attempting to get map points...');
      let points: Point[] = [];
      let error: Error | null = null;
      try {
        points = await fetchRobotMapPoints();
      } catch (e) {
        error = e as Error;
        console.error('Failed to get map points:', e);
      }
      
      // Identify numeric points
      const numericPoints = points.filter(p => /^\d+$/.test(String(p.id)));
      console.log(`Found ${numericPoints.length} numeric points out of ${points.length} total points`);
      
      // Output detailed point information
      points.forEach(p => {
        console.log(`Point ID: "${p.id}", x: ${p.x}, y: ${p.y}, ori: ${p.ori}, floorId: ${p.floorId}`);
      });
      
      // Return debug info
      res.json({
        maps: mapsList,
        points_count: points.length,
        numeric_points_count: numericPoints.length,
        points: points.map(p => ({ 
          id: p.id, 
          x: p.x, 
          y: p.y,
          ori: p.ori,
          floorId: p.floorId,
          is_numeric: /^\d+$/.test(String(p.id))
        })),
        error: error ? error.message : null
      });
    } catch (error: any) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ error: 'Debug endpoint error', details: error.message });
    }
  });
}