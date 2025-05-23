/**
 * Map Sync Service
 * 
 * This service provides continuous synchronization of robot maps and points,
 * automatically detecting changes and updating the system accordingly.
 */

import { EventEmitter } from 'events';
import { getRobotMaps, fetchMapData } from './robot-map-api';
import { storage } from './storage';
import { DEFAULT_ROBOT_SERIAL } from './robot-constants';

// Event emitter for map/point changes
export const mapSyncEvents = new EventEmitter();

// Cache for map data
interface MapCache {
  maps: any[];
  points: Record<string, any>;
  lastUpdate: number;
}

let mapCache: MapCache = {
  maps: [],
  points: {},
  lastUpdate: 0
};

// Configuration
const SYNC_INTERVAL = 30000; // 30 seconds
const CACHE_TTL = 60000; // 1 minute

/**
 * Start the map sync service
 */
export async function startMapSync() {
  console.log('[MAP-SYNC] Starting map sync service...');
  
  // Initial sync
  await syncMaps();
  
  // Set up periodic sync
  setInterval(syncMaps, SYNC_INTERVAL);
}

/**
 * Sync maps and points from the robot
 */
async function syncMaps() {
  try {
    console.log('[MAP-SYNC] Starting map sync...');
    
    // Get all maps
    const { maps } = await getRobotMaps(DEFAULT_ROBOT_SERIAL);
    if (!maps || !Array.isArray(maps)) {
      console.log('[MAP-SYNC] No maps found or invalid response');
      return;
    }
    
    // Check for map changes
    const mapChanges = detectMapChanges(maps);
    if (mapChanges.added.length > 0 || mapChanges.removed.length > 0) {
      console.log('[MAP-SYNC] Map changes detected:', mapChanges);
      mapSyncEvents.emit('mapsChanged', mapChanges);
    }
    
    // Update map cache
    mapCache.maps = maps;
    
    // Process each map
    for (const map of maps) {
      await processMap(map);
    }
    
    // Update last sync time
    mapCache.lastUpdate = Date.now();
    
    // Store in persistent storage
    await storage.storeMapData(mapCache);
    
    console.log('[MAP-SYNC] Map sync completed successfully');
  } catch (error) {
    console.error('[MAP-SYNC] Error during map sync:', error);
  }
}

/**
 * Process a single map and its points
 */
async function processMap(map: any) {
  try {
    console.log(`[MAP-SYNC] [${new Date().toISOString()}] Processing map: ${map.map_name} (${map.id})`);
    
    // Get detailed map data
    const mapData = await fetchMapData(String(map.id), DEFAULT_ROBOT_SERIAL);
    if (!mapData) {
      console.log(`[MAP-SYNC] No data for map ${map.id}`);
      return;
    }
    
    // Log raw overlays string (first 500 chars for brevity)
    if (mapData.overlays) {
      if (typeof mapData.overlays === 'string') {
        console.log(`[MAP-SYNC] Raw overlays string (truncated): ${mapData.overlays.slice(0, 500)}...`);
      } else {
        console.log(`[MAP-SYNC] Raw overlays object:`, JSON.stringify(mapData.overlays).slice(0, 500) + '...');
      }
    } else {
      console.log(`[MAP-SYNC] No overlays found in map data for map ${map.id}`);
    }
    
    // Parse overlays
    let overlays;
    try {
      if (typeof mapData.overlays === 'string') {
        try {
          overlays = JSON.parse(mapData.overlays);
        } catch (parseError) {
          console.error(`[MAP-SYNC] Failed to parse overlays JSON string for map ${map.id}:`, parseError);
          // Try to extract points directly from the string if it's malformed JSON
          const pointMatches = mapData.overlays.match(/"id":"[^"]+","coordinates":\[[^\]]+\]/g);
          if (pointMatches) {
            console.log(`[MAP-SYNC] Attempting to extract points from malformed JSON`);
            overlays = {
              features: pointMatches.map(match => {
                try {
                  const pointData = JSON.parse(`{${match}}`);
                  return {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: pointData.coordinates
                    },
                    properties: {
                      id: pointData.id
                    }
                  };
                } catch (e) {
                  console.error(`[MAP-SYNC] Failed to parse point data:`, e);
                  return null;
                }
              }).filter(Boolean)
            };
          }
        }
      } else if (typeof mapData.overlays === 'object') {
        overlays = mapData.overlays;
      } else {
        console.log(`[MAP-SYNC] Invalid overlays format for map ${map.id}:`, mapData.overlays);
        return;
      }
    } catch (e) {
      console.error(`[MAP-SYNC] Failed to process overlays for map ${map.id}:`, e);
      return;
    }
    
    // Extract points
    const features = overlays.features || [];
    console.log(`[MAP-SYNC] Found ${features.length} features in map ${map.id}`);
    
    // Log all features of type Point
    const allPoints = features.filter((f: any) => f.geometry?.type === 'Point');
    console.log(`[MAP-SYNC] All Point features:`, allPoints.map((f: any) => ({ id: f.id, name: f.properties?.name, coordinates: f.geometry.coordinates, yaw: f.properties?.yaw })));
    
    const points = features
      .filter((f: any) => f.geometry?.type === 'Point' && f.id)
      .map((f: any) => ({
        id: f.id,
        mapId: map.id,
        coordinates: f.geometry.coordinates,
        orientation: f.properties.yaw ? parseFloat(f.properties.yaw) : 0,
        type: f.properties.type,
        name: f.properties.name,
        metadata: f.properties
      }));
    
    // Log parsed points
    console.log(`[MAP-SYNC] Parsed points for map ${map.id}:`, points);
    
    // Check for point changes
    const pointChanges = detectPointChanges(map.id, points);
    if (pointChanges.added.length > 0 || pointChanges.removed.length > 0) {
      console.log(`[MAP-SYNC] Point changes detected for map ${map.id}:`, pointChanges);
      mapSyncEvents.emit('pointsChanged', {
        mapId: map.id,
        changes: pointChanges
      });
    }
    
    // Update point cache
    mapCache.points[map.id] = points;
    
  } catch (error) {
    console.error(`[MAP-SYNC] Error processing map ${map.id}:`, error);
  }
}

/**
 * Detect changes in maps
 */
function detectMapChanges(newMaps: any[]) {
  const oldMapIds = new Set(mapCache.maps.map(m => m.id));
  const newMapIds = new Set(newMaps.map(m => m.id));
  
  return {
    added: newMaps.filter(m => !oldMapIds.has(m.id)),
    removed: mapCache.maps.filter(m => !newMapIds.has(m.id))
  };
}

/**
 * Detect changes in points for a map
 */
function detectPointChanges(mapId: string, newPoints: any[]) {
  const oldPoints = mapCache.points[mapId] || [];
  const oldPointIds = new Set(oldPoints.map((p: any) => p.id));
  const newPointIds = new Set(newPoints.map(p => p.id));
  
  return {
    added: newPoints.filter(p => !oldPointIds.has(p.id)),
    removed: oldPoints.filter((p: any) => !newPointIds.has(p.id))
  };
}

/**
 * Get current map data
 */
export function getCurrentMapData(): MapCache {
  return mapCache;
}

/**
 * Get points for a specific map
 */
export function getMapPoints(mapId: string): any[] {
  return mapCache.points[mapId] || [];
}

/**
 * Get all points across all maps
 */
export function getAllPoints(): any[] {
  return Object.values(mapCache.points).flat();
}

/**
 * Get a specific point by ID
 */
export function getPoint(pointId: string): any | null {
  for (const points of Object.values(mapCache.points)) {
    const point = points.find((p: any) => p.id === pointId);
    if (point) return point;
  }
  return null;
} 