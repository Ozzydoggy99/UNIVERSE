/**
 * Robot Live Points Service
 * 
 * This service provides direct access to points on the robot map in real-time,
 * allowing the system to detect and use newly added points without requiring code changes.
 */

import axios from 'axios';
import { Point } from './types';
import { ROBOT_API_URL, ROBOT_SERIAL, getAuthHeaders } from './robot-constants';

// Cache to store recently fetched points
let cachedPoints: any[] = [];
let cachedPointsMap: Map<string, Point> = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch all points directly from the robot
 */
export async function fetchRobotPoints(): Promise<any[]> {
  try {
    // Use cache if available and fresh
    const now = Date.now();
    if (cachedPoints.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
      return cachedPoints;
    }
    
    console.log(`[ROBOT-LIVE-POINTS] Fetching points directly from robot...`);
    
    // Step 1: Get a list of all maps
    const mapsResponse = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: getAuthHeaders()
    });
    
    if (!mapsResponse.data || !Array.isArray(mapsResponse.data) || mapsResponse.data.length === 0) {
      console.error('[ROBOT-LIVE-POINTS] No maps found on robot');
      return [];
    }
    
    // Use the first map (usually the current one)
    const activeMap = mapsResponse.data[0];
    console.log(`[ROBOT-LIVE-POINTS] Using map: ${activeMap.name || activeMap.map_name} (ID: ${activeMap.id})`);
    
    // Step 2: Get detailed map data with overlays
    const mapDetailResponse = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, {
      headers: getAuthHeaders()
    });
    
    if (!mapDetailResponse.data || !mapDetailResponse.data.overlays) {
      console.error('[ROBOT-LIVE-POINTS] No overlay data in map');
      return [];
    }
    
    // Parse overlays (these contain our points)
    let overlays;
    try {
      overlays = typeof mapDetailResponse.data.overlays === 'string'
        ? JSON.parse(mapDetailResponse.data.overlays)
        : mapDetailResponse.data.overlays;
    } catch (e) {
      console.error('[ROBOT-LIVE-POINTS] Error parsing overlays:', e);
      return [];
    }
    
    if (!overlays.features || !Array.isArray(overlays.features)) {
      console.error('[ROBOT-LIVE-POINTS] No features in map overlays');
      return [];
    }
    
    // Extract points from features (looking for Point type features with properties)
    const points = overlays.features
      .filter((f: any) => f.geometry?.type === 'Point' && f.properties)
      .map((f: any) => {
        const { properties, geometry } = f;
        const id = properties.name?.trim() || properties.text?.trim() || '';
        
        // Get coordinates from properties or geometry
        const x = properties.x !== undefined ? properties.x : geometry.coordinates[0];
        const y = properties.y !== undefined ? properties.y : geometry.coordinates[1];
        
        // Get orientation
        const theta = properties.yaw !== undefined ? properties.yaw : 
                     (properties.orientation !== undefined ? properties.orientation : 0);
        
        return { id, x, y, theta };
      })
      .filter((p: any) => p.id && typeof p.id === 'string' && p.id.trim() !== '');
    
    console.log(`[ROBOT-LIVE-POINTS] Found ${points.length} points on robot map`);
    
    // Update cache
    cachedPoints = points;
    
    // Also create a map for quick lookups
    cachedPointsMap = new Map();
    points.forEach((p: any) => {
      // Store both original case and lowercase versions for case-insensitive lookup
      cachedPointsMap.set(p.id, p);
      cachedPointsMap.set(p.id.toLowerCase(), p);
    });
    
    lastFetchTime = now;
    return points;
  } catch (error) {
    console.error('[ROBOT-LIVE-POINTS] Error fetching points:', error);
    return [];
  }
}

/**
 * Get coordinates for a specific point by ID
 */
export async function getPointById(pointId: string): Promise<Point | null> {
  if (!pointId) return null;
  
  try {
    // Normalize the point ID
    const normalizedId = normalizePointId(pointId);
    console.log(`[ROBOT-LIVE-POINTS] Looking for point: ${normalizedId} (original: ${pointId})`);
    
    // Try cache first
    if (cachedPointsMap.size > 0) {
      // Try exact match first
      if (cachedPointsMap.has(normalizedId)) {
        const point = cachedPointsMap.get(normalizedId);
        console.log(`[ROBOT-LIVE-POINTS] Found point in cache: ${normalizedId}`);
        return point ? { x: point.x, y: point.y, theta: point.theta } : null;
      }
      
      // Try lowercase
      if (cachedPointsMap.has(normalizedId.toLowerCase())) {
        const point = cachedPointsMap.get(normalizedId.toLowerCase());
        console.log(`[ROBOT-LIVE-POINTS] Found point in cache (case-insensitive): ${normalizedId}`);
        return point ? { x: point.x, y: point.y, theta: point.theta } : null;
      }
    }
    
    // If not in cache, fetch fresh data
    console.log(`[ROBOT-LIVE-POINTS] Point not in cache, fetching fresh data...`);
    await fetchRobotPoints();
    
    // Try again with fresh data
    if (cachedPointsMap.has(normalizedId)) {
      const point = cachedPointsMap.get(normalizedId);
      console.log(`[ROBOT-LIVE-POINTS] Found point after refresh: ${normalizedId}`);
      return point ? { x: point.x, y: point.y, theta: point.theta } : null;
    }
    
    if (cachedPointsMap.has(normalizedId.toLowerCase())) {
      const point = cachedPointsMap.get(normalizedId.toLowerCase());
      console.log(`[ROBOT-LIVE-POINTS] Found point after refresh (case-insensitive): ${normalizedId}`);
      return point ? { x: point.x, y: point.y, theta: point.theta } : null;
    }
    
    // Try alternate IDs (e.g., with/without _load suffix)
    const alternateIds = generateAlternateIds(normalizedId);
    for (const altId of alternateIds) {
      if (cachedPointsMap.has(altId) || cachedPointsMap.has(altId.toLowerCase())) {
        const point = cachedPointsMap.get(altId) || cachedPointsMap.get(altId.toLowerCase());
        console.log(`[ROBOT-LIVE-POINTS] Found point using alternate ID: ${altId}`);
        return point ? { x: point.x, y: point.y, theta: point.theta } : null;
      }
    }
    
    console.log(`[ROBOT-LIVE-POINTS] Point not found: ${normalizedId}`);
    return null;
  } catch (error) {
    console.error('[ROBOT-LIVE-POINTS] Error getting point:', error);
    return null;
  }
}

/**
 * Generate alternate point IDs to try 
 */
function generateAlternateIds(pointId: string): string[] {
  const alternateIds = [];
  
  // For example, for "110", try "110_load"
  if (/^\d+$/.test(pointId)) {
    alternateIds.push(`${pointId}_load`);
    alternateIds.push(`${pointId}_load_docking`);
  }
  
  // For "110_load", try "110"
  if (pointId.endsWith('_load')) {
    alternateIds.push(pointId.replace('_load', ''));
  }
  
  // For "110_load_docking", try "110_load" and "110"
  if (pointId.endsWith('_load_docking')) {
    alternateIds.push(pointId.replace('_load_docking', '_load'));
    alternateIds.push(pointId.replace('_load_docking', ''));
  }
  
  return alternateIds;
}

/**
 * Normalize point ID to our standard format
 */
function normalizePointId(pointId: string): string {
  if (!pointId) return '';
  
  // For numeric-only IDs, add _load suffix (e.g., "110" -> "110_load")
  if (/^\d+$/.test(pointId)) {
    return `${pointId}_load`;
  }
  
  // If it already has a suffix, keep as is
  if (pointId.includes('_load') || pointId.includes('_docking')) {
    return pointId;
  }
  
  // Default: add _load suffix
  return `${pointId}_load`;
}

/**
 * Clear the cache to force a refresh
 */
export function clearCache(): void {
  console.log('[ROBOT-LIVE-POINTS] Clearing cache');
  cachedPoints = [];
  cachedPointsMap.clear();
  lastFetchTime = 0;
}

/**
 * Get all shelf points
 */
export async function getShelfPoints(): Promise<Point[]> {
  const points = await fetchRobotPoints();
  
  return points
    .filter((p: any) => {
      const id = p.id.toLowerCase();
      return /^\d+(_load)?$/.test(id) || id.includes('_load');
    })
    .map((p: any) => ({
      x: p.x,
      y: p.y,
      theta: p.theta
    }));
}