/**
 * Robot Map Data (Adapter Module)
 * 
 * This module serves as an adapter to redirect old API calls 
 * to the new improved dynamic-map-points system while maintaining
 * backward compatibility.
 */

import { fetchAllMapPoints, getPointCoordinates as getPointCoordinatesDynamic } from './dynamic-map-points';
import { Point } from './types';

// Cache for robot points map
let robotPointsCache: Record<string, Point> = {};
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute cache TTL

/**
 * Adapter function to maintain backward compatibility with existing code
 * Redirects to the improved dynamic-map-points implementation
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  console.log('[ADAPTER] Redirecting fetchRobotMapPoints call to fetchAllMapPoints');
  
  // Update the cache while we're at it
  const points = await fetchAllMapPoints();
  updatePointsCache(points);
  
  return points;
}

/**
 * Normalize point ID to standard format
 * Adapter function to maintain backward compatibility
 */
export function normalizePointId(pointId: string): string {
  if (!pointId) return '';
  
  const id = pointId.toString();
  
  // FIXED: If it already has _load or _docking, keep as is
  if (id.includes('_load') || id.includes('_docking')) {
    console.log(`[ADAPTER] Point ${id} already has _load or _docking suffix, keeping as is`);
    return id;
  }
  
  // If it's a number only, add _load suffix (e.g., "110" -> "110_load")
  if (/^\d+$/.test(id)) {
    console.log(`[ADAPTER] Adding _load suffix to numeric point ID: ${id} -> ${id}_load`);
    return `${id}_load`;
  }
  
  // Special case for Drop-off points
  if (id.toLowerCase().includes('drop-off') || id.toLowerCase() === 'dropoff') {
    if (!id.includes('_load')) {
      console.log(`[ADAPTER] Adding _load suffix to Drop-off point: ${id} -> ${id}_load`);
      return `${id}_load`;
    }
    return id;
  }
  
  // Otherwise add _load
  console.log(`[ADAPTER] Adding _load suffix to point ID: ${id} -> ${id}_load`);
  return `${id}_load`;
}

/**
 * Adapter for getPointCoordinates
 */
export async function getPointCoordinates(pointId: string): Promise<Point | null> {
  console.log('[ADAPTER] Redirecting getPointCoordinates call to dynamic implementation');
  return getPointCoordinatesDynamic(pointId);
}

/**
 * Get a specific point by ID
 * @param pointId The point ID to look up
 */
export async function getPoint(pointId: string): Promise<Point | null> {
  console.log(`[ADAPTER] Getting point for ID: ${pointId}`);
  return getPointCoordinates(pointId);
}

/**
 * Get the robot points map
 * This is an adapter for backwards compatibility
 */
export async function getRobotPointsMap(): Promise<Record<string, Point>> {
  const now = Date.now();
  
  // Return cached map if valid
  if (Object.keys(robotPointsCache).length > 0 && (now - lastCacheUpdate) < CACHE_TTL) {
    console.log(`[ADAPTER] Using cached robot points map (${Object.keys(robotPointsCache).length} points)`);
    return robotPointsCache;
  }
  
  // Otherwise fetch fresh data
  console.log(`[ADAPTER] Fetching fresh robot points map`);
  const points = await fetchAllMapPoints();
  updatePointsCache(points);
  
  return robotPointsCache;
}

/**
 * Update the points cache from a list of points
 */
function updatePointsCache(points: Point[]): void {
  robotPointsCache = {};
  
  // Convert points array to map for quick lookups
  for (const point of points) {
    if (point.id) {
      robotPointsCache[point.id] = point;
    }
  }
  
  lastCacheUpdate = Date.now();
  console.log(`[ADAPTER] Updated points cache with ${Object.keys(robotPointsCache).length} points`);
}