/**
 * Dynamic Point Service
 * 
 * This service provides real-time access to robot map points, automatically detecting
 * new points as they are added to the map without requiring code changes.
 */

import { fetchRobotMapPoints } from './robot-map-data';
import { default as robotPointsMapDefault } from './robot-points-map';

// Define Point interface to match what we need internally
interface Point {
  x: number;
  y: number;
  theta: number;
}

// Cache to store live points from robot
let cachedPoints: Point[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute cache validity

/**
 * Get point coordinates by ID, combining static map with live robot data
 * This ensures we can handle newly added points automatically
 */
export async function getPointCoordinates(pointId: string): Promise<Point | null> {
  if (!pointId) {
    console.error('[DYNAMIC-POINT-SERVICE] Cannot find coordinates for null/undefined point ID');
    return null;
  }
  
  const normalizedPointId = normalizePointId(pointId);
  console.log(`[DYNAMIC-POINT-SERVICE] Finding coordinates for point: ${normalizedPointId} (original: ${pointId})`);
  
  try {
    // First try to get point from static map (faster)
    const staticPoint = getStaticPointCoordinates(normalizedPointId);
    if (staticPoint) {
      console.log(`[DYNAMIC-POINT-SERVICE] Found point ${normalizedPointId} in static map`);
      return staticPoint;
    }
    
    // If not in static map, refresh live points and try again
    console.log(`[DYNAMIC-POINT-SERVICE] Point ${normalizedPointId} not found in static map, checking live robot data...`);
    const livePoints = await getLiveRobotPoints();
    
    const livePoint = livePoints.find(p => 
      p.id.toLowerCase() === normalizedPointId.toLowerCase()
    );
    
    if (livePoint) {
      console.log(`[DYNAMIC-POINT-SERVICE] ✅ Found point ${normalizedPointId} in live robot data: (${livePoint.x}, ${livePoint.y})`);
      
      // Convert to standard Point format
      return {
        x: livePoint.x,
        y: livePoint.y,
        theta: livePoint.ori || 0
      };
    }
    
    // Try with different naming conventions
    const alternateIds = generateAlternatePointIds(normalizedPointId);
    for (const altId of alternateIds) {
      const altPoint = livePoints.find(p => p.id.toLowerCase() === altId.toLowerCase());
      if (altPoint) {
        console.log(`[DYNAMIC-POINT-SERVICE] ✅ Found point using alternate ID ${altId}: (${altPoint.x}, ${altPoint.y})`);
        return {
          x: altPoint.x,
          y: altPoint.y,
          theta: altPoint.ori || 0
        };
      }
    }
    
    console.error(`[DYNAMIC-POINT-SERVICE] ❌ Point ${normalizedPointId} not found in static map or live robot data`);
    return null;
  } catch (error) {
    console.error(`[DYNAMIC-POINT-SERVICE] Error getting point coordinates:`, error);
    return null;
  }
}

/**
 * Try to retrieve point coordinates from the static map
 */
function getStaticPointCoordinates(pointId: string): Point | null {
  try {
    // Access the static map from server/robot-points-map.ts
    const floorIds = robotPointsMap.getFloorIds();
    
    for (const floorId of floorIds) {
      try {
        const point = robotPointsMap.getPoint(floorId, pointId);
        if (point) {
          return point;
        }
      } catch (e) {
        // Point not found in this floor, continue to the next one
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[DYNAMIC-POINT-SERVICE] Error accessing static map:`, error);
    return null;
  }
}

/**
 * Get fresh live points data from the robot
 */
async function getLiveRobotPoints(): Promise<Point[]> {
  const now = Date.now();
  
  // Return cached points if they're fresh enough
  if (cachedPoints.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
    console.log(`[DYNAMIC-POINT-SERVICE] Using cached points (${cachedPoints.length} points, ${Math.round((now - lastFetchTime)/1000)}s old)`);
    return cachedPoints;
  }
  
  try {
    console.log(`[DYNAMIC-POINT-SERVICE] Fetching fresh points from robot API...`);
    const points = await fetchRobotMapPoints();
    
    if (points && points.length > 0) {
      console.log(`[DYNAMIC-POINT-SERVICE] Successfully fetched ${points.length} points from robot`);
      
      // Log any points that look like shelf points
      const shelfPoints = points.filter(p => 
        p.id.includes('_load') || 
        /^\d+$/.test(p.id)
      );
      
      console.log(`[DYNAMIC-POINT-SERVICE] Found ${shelfPoints.length} potential shelf points:`);
      shelfPoints.forEach(p => {
        console.log(`[DYNAMIC-POINT-SERVICE] - ${p.id}: (${p.x}, ${p.y})`);
      });
      
      // Update cache
      cachedPoints = points;
      lastFetchTime = now;
      
      return points;
    } else {
      console.error(`[DYNAMIC-POINT-SERVICE] No points returned from robot API`);
      return [];
    }
  } catch (error) {
    console.error(`[DYNAMIC-POINT-SERVICE] Error fetching points from robot:`, error);
    
    // If we have cached points, use them as fallback
    if (cachedPoints.length > 0) {
      console.log(`[DYNAMIC-POINT-SERVICE] Using cached points as fallback`);
      return cachedPoints;
    }
    
    return [];
  }
}

/**
 * Normalize point ID to standard format
 */
function normalizePointId(pointId: string): string {
  if (!pointId) return '';
  
  const id = pointId.toString();
  
  // If it's a number only, add _load suffix (e.g., "110" -> "110_load")
  if (/^\d+$/.test(id)) {
    return `${id}_load`;
  }
  
  // If it already has _load or _docking, keep as is
  if (id.includes('_load') || id.includes('_docking')) {
    return id;
  }
  
  // Otherwise add _load
  return `${id}_load`;
}

/**
 * Generate alternate point IDs to try when looking up points
 */
function generateAlternatePointIds(pointId: string): string[] {
  const alternateIds = [];
  
  // For example, if passed "110_load", also try "110", "110_load_docking"
  if (pointId.endsWith('_load')) {
    const baseId = pointId.replace('_load', '');
    alternateIds.push(baseId);
    alternateIds.push(`${baseId}_load_docking`);
  } 
  // If passed a base ID like "110", try with _load and _docking
  else if (/^\d+$/.test(pointId)) {
    alternateIds.push(`${pointId}_load`);
    alternateIds.push(`${pointId}_load_docking`);
  }
  
  return alternateIds;
}

/**
 * Clear the cache to force a refresh of point data
 */
export function clearPointCache() {
  console.log(`[DYNAMIC-POINT-SERVICE] Clearing point cache`);
  cachedPoints = [];
  lastFetchTime = 0;
}

/**
 * Get all available shelf points from the robot
 */
export async function getAllShelfPoints(): Promise<Point[]> {
  const points = await getLiveRobotPoints();
  
  // Filter to just shelf points (numeric IDs or containing _load)
  return points.filter(p => 
    /^\d+$/.test(p.id) || 
    p.id.toLowerCase().includes('_load')
  );
}