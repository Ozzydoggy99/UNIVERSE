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
    const headers = { "x-api-key": ROBOT_SECRET };

    // Get maps and select the first one
    const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
    const maps = mapsRes.data || [];
    const activeMap = maps[0];

    if (!activeMap) throw new Error("❌ No map found on robot");

    const rawName = activeMap.name || activeMap.map_name || "";
    const floorMatch = rawName.match(/^(\d+)/);
    const floorId = floorMatch ? floorMatch[1] : "1";

    const mapRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
    const overlays = Array.isArray(mapRes.data?.overlays) ? mapRes.data.overlays : [];

    console.log("🧠 Overlay labels:", overlays.map((o: any) => o.text || o.type));

    // ✅ This is the FIX — make sure floorId is included in each point
    const points = overlays
      .filter((o: any) => o.type === "Label")
      .map((o: any) => ({
        id: o.text?.trim(),
        x: o.x,
        y: o.y,
        ori: o.orientation ?? 0,
        floorId,
        description: o.text?.trim() || '',
      }));
      
    console.log(`Successfully extracted ${points.length} map points from overlays`);
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