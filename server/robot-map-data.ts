/**
 * Robot Map Data Service
 * 
 * This service provides direct access to the robot's map data,
 * including points, overlays, and other map features.
 */

import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';
import { Point } from './types';

// Cache to avoid too many API calls
let pointsCache: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch all map points directly from the robot API
 */
export async function fetchRobotMapPoints(): Promise<any[]> {
  const now = Date.now();
  
  // Return cached data if fresh enough
  if (pointsCache.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
    console.log(`[ROBOT-MAP-DATA] Using cached points (${pointsCache.length} points)`);
    return pointsCache;
  }
  
  try {
    console.log(`[ROBOT-MAP-DATA] Fetching points from robot API...`);
    
    // First get the list of maps
    const mapsResponse = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: getAuthHeaders()
    });
    
    const maps = mapsResponse.data || [];
    if (!maps.length) {
      console.error(`[ROBOT-MAP-DATA] No maps found from robot API`);
      return [];
    }
    
    // Get the first map (assumed to be the current map)
    const activeMap = maps[0];
    console.log(`[ROBOT-MAP-DATA] Using map: ${activeMap.name || activeMap.map_name} (ID: ${activeMap.id})`);
    
    // Get detailed map data including overlays
    const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, {
      headers: getAuthHeaders()
    });
    
    const mapData = mapDetailRes.data;
    if (!mapData || !mapData.overlays) {
      console.error(`[ROBOT-MAP-DATA] No overlay data in map`);
      return [];
    }
    
    // Parse the overlays JSON
    let overlays;
    try {
      overlays = typeof mapData.overlays === 'string' 
        ? JSON.parse(mapData.overlays) 
        : mapData.overlays;
    } catch (e) {
      console.error(`[ROBOT-MAP-DATA] Failed to parse overlays JSON:`, e);
      return [];
    }
    
    // Extract point features
    const features = overlays?.features || [];
    console.log(`[ROBOT-MAP-DATA] Found ${features.length} features in map overlays`);
    
    // Filter to only point features
    const points = features
      .filter((f: any) => f.geometry?.type === 'Point' && f.properties)
      .map((f: any) => {
        const { properties, geometry } = f;
        
        // Ensure we have a valid ID
        const id = String(properties.name || properties.text || '').trim();
        
        // Get coordinates, trying multiple possible property names
        const x = typeof properties.x === 'number' ? properties.x : geometry.coordinates[0];
        const y = typeof properties.y === 'number' ? properties.y : geometry.coordinates[1];
        
        // Get orientation, trying multiple possible property names
        const ori = parseFloat(String(properties.yaw || properties.orientation || properties.theta || '0'));
        
        return { id, x, y, ori };
      })
      .filter((p: any) => p.id && p.id.trim() !== ''); // Filter out points without IDs
    
    if (points.length > 0) {
      console.log(`[ROBOT-MAP-DATA] Successfully extracted ${points.length} map points`);
      
      // Log all shelf points for debugging
      const shelfPoints = points.filter((p: any) => 
        /^\d+(_load)?$/.test(p.id) || 
        p.id.includes('_load')
      );
      
      if (shelfPoints.length > 0) {
        console.log(`[ROBOT-MAP-DATA] Found ${shelfPoints.length} shelf points:`);
        shelfPoints.forEach((p: any) => {
          console.log(`[ROBOT-MAP-DATA] - ${p.id}: (${p.x}, ${p.y}, ${p.ori})`);
        });
      }
      
      // Update cache
      pointsCache = points;
      lastFetchTime = now;
      
      return points;
    }
    
    console.error(`[ROBOT-MAP-DATA] No point features found in map overlays`);
    return [];
  } catch (error) {
    console.error(`[ROBOT-MAP-DATA] Error fetching map points:`, error);
    
    // Return cached points as fallback
    if (pointsCache.length > 0) {
      console.log(`[ROBOT-MAP-DATA] Using cached points as fallback`);
      return pointsCache;
    }
    
    return [];
  }
}

/**
 * Convert robot map points to standard Point format
 */
export function convertToStandardPoints(robotPoints: any[]): Point[] {
  return robotPoints.map(p => ({
    x: p.x,
    y: p.y,
    theta: p.ori || 0
  }));
}

/**
 * Refresh the points cache
 */
export function refreshPointsCache(): void {
  console.log(`[ROBOT-MAP-DATA] Clearing points cache to force refresh`);
  pointsCache = [];
  lastFetchTime = 0;
}