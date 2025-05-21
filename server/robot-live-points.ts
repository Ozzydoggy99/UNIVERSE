/**
 * Robot Live Points Service
 * 
 * This service provides real-time access to robot map points,
 * fetching them directly from the robot API with caching for performance.
 */

import axios from 'axios';
// Import functions for robot API URL and auth headers
import { getRobotApiUrl, getAuthHeaders } from './robot-constants';

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

// Types for robot map points
interface RobotPoint {
  id: string;
  x: number;
  y: number;
  theta: number;
  pointType?: string;
}

// Add type for map response
interface MapResponse {
  overlays: {
    features: Array<{
      properties: {
        type: string;
        name: string;
        ori: number;
        point_type?: string;
      };
      geometry: {
        coordinates: number[];
      };
    }>;
  };
}

// Cache storage
let pointsCache: RobotPoint[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds

/**
 * Normalize a point ID to handle different formats
 * 
 * This handles conversions between formats like:
 * - "110" (base point)
 * - "110_load" (load point)
 * - "110_load_docking" (docking point)
 */
export function normalizePointId(pointId: string): string {
  // If it's already normalized (no suffixes), return as is
  if (!pointId.includes('_')) {
    return pointId;
  }
  
  // Remove suffixes to get the base ID
  if (pointId.includes('_load_docking')) {
    return pointId.replace('_load_docking', '');
  } else if (pointId.includes('_load')) {
    return pointId.replace('_load', '');
  } else if (pointId.includes('_docking')) {
    return pointId.replace('_docking', '');
  }
  
  return pointId;
}

/**
 * Fetch all points from the robot's map API
 */
export async function fetchRobotPoints(): Promise<RobotPoint[]> {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (pointsCache.length > 0 && now - lastCacheUpdate < CACHE_TTL) {
      console.log('[ROBOT-LIVE-POINTS] Using cached points data');
      return pointsCache;
    }
    
    console.log('[ROBOT-LIVE-POINTS] Fetching fresh points data from robot API');
    
    // Get the robot API base URL and auth headers
    const baseUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    
    // Fetch maps from the robot API
    console.log('[ROBOT-LIVE-POINTS] Fetching maps list');
    const mapsResponse = await axios.get(`${baseUrl}/maps/`, { headers });
    
    if (!mapsResponse.data || !Array.isArray(mapsResponse.data)) {
      throw new Error('Invalid maps response from robot API');
    }
    
    // Find the active map
    const maps = mapsResponse.data;
    if (maps.length === 0) {
      console.warn('[ROBOT-LIVE-POINTS] No maps found on robot');
      return [];
    }
    
    // Use the first map (can be enhanced to use the active map)
    const mapId = maps[0].id;
    const mapName = maps[0].map_name;
    console.log(`[ROBOT-LIVE-POINTS] Using map: ${mapName} (${mapId})`);
    
    // Fetch map details to get points
    console.log(`[ROBOT-LIVE-POINTS] Fetching map details for map ID ${mapId}`);
    const mapResponse = await axios.get<MapResponse>(`${baseUrl}/maps/${mapId}`, { headers });
    
    if (!mapResponse.data || !mapResponse.data.overlays) {
      throw new Error('Invalid map details response from robot API');
    }
    
    // Extract points from map overlays
    const overlays = mapResponse.data.overlays;
    const points: RobotPoint[] = [];
    
    // Process overlays to extract points
    if (overlays && overlays.features && Array.isArray(overlays.features)) {
      console.log(`[ROBOT-LIVE-POINTS] Processing ${overlays.features.length} map features`);
      
      overlays.features.forEach((feature: any) => {
        if (feature.properties && feature.properties.type === 'point') {
          // Extract point details
          const pointId = feature.properties.name || '';
          const coordinates = feature.geometry.coordinates;
          const theta = feature.properties.ori || 0;
          
          if (pointId && coordinates && coordinates.length >= 2) {
            points.push({
              id: pointId,
              x: coordinates[0],
              y: coordinates[1],
              theta,
              pointType: feature.properties.point_type || 'unknown'
            });
          }
        }
      });
    }
    
    console.log(`[ROBOT-LIVE-POINTS] Extracted ${points.length} points from map`);
    
    // Cache the points
    pointsCache = points;
    lastCacheUpdate = now;
    
    return points;
  } catch (error: any) {
    console.error('[ROBOT-LIVE-POINTS] Error fetching points:', error.message);
    
    // If we have cached data and get an error, return the cache
    if (pointsCache.length > 0) {
      console.log('[ROBOT-LIVE-POINTS] Returning cached points due to error');
      return pointsCache;
    }
    
    throw error;
  }
}

/**
 * Get a specific point by its ID
 * 
 * This function handles various point ID formats automatically,
 * including conversion between base, load, and docking points.
 */
export async function getPointById(pointId: string): Promise<RobotPoint | null> {
  // First, try to find the exact point ID
  try {
    const points = await fetchRobotPoints();
    
    // Look for the exact match first
    let point = points.find(p => p.id === pointId);
    
    // If not found, try normalizing and looking for the base ID
    if (!point) {
      const normalizedId = normalizePointId(pointId);
      console.log(`[ROBOT-LIVE-POINTS] Point ${pointId} not found, trying normalized ID: ${normalizedId}`);
      point = points.find(p => p.id === normalizedId);
      
      // If still not found, try generating variants based on the base ID
      if (!point) {
        console.log(`[ROBOT-LIVE-POINTS] Normalized ID ${normalizedId} not found, trying variants`);
        
        // Generate variant point IDs to try
        const variants = [
          `${normalizedId}_load`,
          `${normalizedId}_load_docking`,
          `${normalizedId}_docking`
        ];
        
        // Try each variant
        for (const variant of variants) {
          const variantPoint = points.find(p => p.id === variant);
          if (variantPoint) {
            console.log(`[ROBOT-LIVE-POINTS] Found variant point: ${variant}`);
            point = variantPoint;
            break;
          }
        }
      }
    }
    
    if (point) {
      console.log(`[ROBOT-LIVE-POINTS] Found point for ID ${pointId}:`, point);
    } else {
      console.log(`[ROBOT-LIVE-POINTS] No point found for ${pointId} or any of its variants`);
    }
    
    return point || null;
  } catch (error: any) {
    console.error(`[ROBOT-LIVE-POINTS] Error getting point ${pointId}:`, error.message);
    return null;
  }
}

/**
 * Clear the points cache to force a refresh
 */
export function clearCache(): void {
  console.log('[ROBOT-LIVE-POINTS] Clearing points cache');
  pointsCache = [];
  lastCacheUpdate = 0;
}