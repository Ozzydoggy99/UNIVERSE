/**
 * Dynamic Map Points Service
 * 
 * This service fetches map points directly from the robot API in real-time,
 * allowing the system to automatically use newly added map points without 
 * requiring code changes or deployments.
 */

import axios from 'axios';
import { Point } from './types';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

// Cache of map points with TTL for performance
let pointsCache: Point[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute cache validity

/**
 * Fetch all map points directly from the robot
 */
export async function fetchAllMapPoints(): Promise<Point[]> {
  const now = Date.now();
  
  // Return cached points if still valid
  if (pointsCache.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
    console.log(`[DYNAMIC-MAP] Using cached points (${pointsCache.length} points)`);
    return pointsCache;
  }
  
  try {
    console.log(`[DYNAMIC-MAP] Fetching points from robot API...`);
    
    // First get the list of maps
    const mapsResponse = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: getAuthHeaders()
    });
    
    const maps = mapsResponse.data || [];
    if (!maps.length) {
      console.error(`[DYNAMIC-MAP] No maps found from robot API`);
      return [];
    }
    
    // Get the first map (assumed to be the current map)
    const activeMap = maps[0];
    console.log(`[DYNAMIC-MAP] Using map: ${activeMap.name || activeMap.map_name} (ID: ${activeMap.id})`);
    
    // Get detailed map data including overlays
    const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, {
      headers: getAuthHeaders()
    });
    
    const mapData = mapDetailRes.data;
    if (!mapData || !mapData.overlays) {
      console.error(`[DYNAMIC-MAP] No overlay data in map`);
      return [];
    }
    
    // Parse the overlays JSON
    let overlays;
    try {
      overlays = JSON.parse(mapData.overlays);
    } catch (e) {
      console.error(`[DYNAMIC-MAP] Failed to parse overlays JSON`);
      return [];
    }
    
    // Extract point features
    const features = overlays.features || [];
    console.log(`[DYNAMIC-MAP] Found ${features.length} features in map overlays`);
    
    // Filter to only point features and extract data
    const points = features
      .filter((f: any) => f.geometry?.type === 'Point' && f.properties)
      .map((f: any) => {
        const { properties, geometry } = f;
        const id = String(properties.name || properties.text || '').trim();
        const x = typeof properties.x === 'number' ? properties.x : geometry.coordinates[0];
        const y = typeof properties.y === 'number' ? properties.y : geometry.coordinates[1];
        const theta = parseFloat(String(properties.yaw || properties.orientation || '0'));
        
        return { id, x, y, theta };
      });
    
    if (points.length > 0) {
      console.log(`[DYNAMIC-MAP] Successfully extracted ${points.length} map points`);
      
      // Log all shelf points for debugging
      const shelfPoints = points.filter(p => 
        /^\d+(_load)?$/.test(p.id) || 
        p.id.includes('_load')
      );
      
      console.log(`[DYNAMIC-MAP] Found ${shelfPoints.length} shelf points:`);
      shelfPoints.forEach(p => {
        console.log(`[DYNAMIC-MAP] - ${p.id}: (${p.x}, ${p.y})`);
      });
      
      // Update cache
      pointsCache = points;
      lastFetchTime = now;
      
      return points;
    }
    
    console.error(`[DYNAMIC-MAP] No point features found in map overlays`);
    return [];
  } catch (error) {
    console.error(`[DYNAMIC-MAP] Error fetching map points:`, error);
    
    // Return cached points as fallback
    if (pointsCache.length > 0) {
      console.log(`[DYNAMIC-MAP] Using cached points as fallback`);
      return pointsCache;
    }
    
    return [];
  }
}

/**
 * Get coordinates for a specific point ID
 */
export async function getPointCoordinates(pointId: string): Promise<Point | null> {
  if (!pointId) {
    console.error(`[DYNAMIC-MAP] Cannot get coordinates for empty point ID`);
    return null;
  }
  
  try {
    const normalizedId = normalizePointId(pointId);
    console.log(`[DYNAMIC-MAP] Finding coordinates for point: ${normalizedId} (original: ${pointId})`);
    
    // Fetch all points
    const allPoints = await fetchAllMapPoints();
    
    // First try exact match
    let point = allPoints.find(p => p.id === normalizedId);
    
    // If not found, try case-insensitive match
    if (!point) {
      point = allPoints.find(p => p.id.toLowerCase() === normalizedId.toLowerCase());
    }
    
    if (point) {
      console.log(`[DYNAMIC-MAP] ✅ Found coordinates for ${normalizedId}: (${point.x}, ${point.y})`);
      return point;
    }
    
    // Try alternate formats
    const alternateIds = generateAlternateIds(normalizedId);
    for (const altId of alternateIds) {
      point = allPoints.find(p => p.id.toLowerCase() === altId.toLowerCase());
      if (point) {
        console.log(`[DYNAMIC-MAP] ✅ Found coordinates using alternate ID ${altId}: (${point.x}, ${point.y})`);
        return point;
      }
    }
    
    console.error(`[DYNAMIC-MAP] ❌ Could not find coordinates for ${normalizedId}`);
    return null;
  } catch (error) {
    console.error(`[DYNAMIC-MAP] Error getting point coordinates:`, error);
    return null;
  }
}

/**
 * Get all shelf points (for dropdowns and UI)
 */
export async function getAllShelfPoints(): Promise<Point[]> {
  const allPoints = await fetchAllMapPoints();
  
  // Filter to just shelf points (numeric IDs or containing _load)
  const shelfPoints = allPoints.filter(p => 
    /^\d+$/.test(p.id) || 
    p.id.toLowerCase().includes('_load')
  );
  
  console.log(`[DYNAMIC-MAP] Filtered ${shelfPoints.length} shelf points from ${allPoints.length} total points`);
  return shelfPoints;
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
 * Generate alternate point IDs to try
 */
function generateAlternateIds(pointId: string): string[] {
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
 * Force refresh the cache
 */
export function refreshPointsCache(): void {
  console.log(`[DYNAMIC-MAP] Clearing points cache to force refresh`);
  pointsCache = [];
  lastFetchTime = 0;
}