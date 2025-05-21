/**
 * Robot Map API
 * 
 * Utility functions for fetching map data, robot maps, and points
 * from the robot API. These functions are used to synchronize the
 * points map with the actual robot configuration.
 */

import axios from 'axios';
import { getRobotApiUrl, getAuthHeaders, DEFAULT_ROBOT_SERIAL } from './robot-constants';

/**
 * Interface for a map point from the robot API
 */
export interface RobotMapPoint {
  id: string;
  coordinates: [number, number];
  orientation?: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for a map from the robot API
 */
export interface RobotMap {
  id?: string | number;
  uid: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for detailed map data including points
 */
export interface RobotMapDetails {
  uid: string;
  name?: string;
  overlays?: {
    type: string;
    features: Array<{
      type: string;
      geometry: {
        type: string;
        coordinates: [number, number];
      };
      properties: {
        id: string;
        orientation?: number;
        [key: string]: any;
      };
    }>;
  };
  [key: string]: any;
}

/**
 * Get a list of all available maps from the robot
 */
export async function getRobotMaps(serialNumber: string = DEFAULT_ROBOT_SERIAL): Promise<{ maps: RobotMap[] }> {
  try {
    console.log('Fetching all robot maps');
    const robotApiUrl = await getRobotApiUrl(serialNumber);
    const response = await axios.get(`${robotApiUrl}/maps`, {
      headers: await getAuthHeaders(serialNumber),
      timeout: 5000
    });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`Retrieved ${response.data.length} maps from robot`);
      return { maps: response.data };
    } else {
      console.log('No maps found or unexpected response format');
      return { maps: [] };
    }
  } catch (error) {
    console.error('Error fetching robot maps:', error);
    // Return empty array instead of throwing to allow graceful fallback
    return { maps: [] };
  }
}

/**
 * Get detailed data for a specific map including points and overlays
 */
export async function fetchMapData(mapId: string, serialNumber: string = DEFAULT_ROBOT_SERIAL): Promise<RobotMapDetails> {
  try {
    console.log(`Fetching detailed map data for map ID: ${mapId}`);
    const robotApiUrl = await getRobotApiUrl(serialNumber);
    const response = await axios.get(`${robotApiUrl}/maps/${mapId}`, {
      headers: await getAuthHeaders(serialNumber),
      timeout: 10000
    });
    
    if (response.data) {
      const data = response.data as RobotMapDetails;
      // Check if the response contains the expected overlays with points
      if (data.overlays && data.overlays.features) {
        const pointFeatures = data.overlays.features.filter(
          (f: any) => f.geometry?.type === 'Point' && f.properties?.id
        );
        console.log(`Found ${pointFeatures.length} point features in map ${mapId}`);
      } else {
        console.log(`Map ${mapId} found but no overlays or points detected`);
      }
      
      return data;
    } else {
      console.log(`Empty or invalid response for map ${mapId}`);
      return { uid: mapId };
    }
  } catch (error) {
    console.error(`Error fetching map data for ${mapId}:`, error);
    // Return minimal object instead of throwing for graceful fallback
    return { uid: mapId };
  }
}

/**
 * Extract points from map details
 */
export function extractPointsFromMap(mapDetails: RobotMapDetails): RobotMapPoint[] {
  if (!mapDetails.overlays || !mapDetails.overlays.features) {
    return [];
  }
  
  const points: RobotMapPoint[] = [];
  
  for (const feature of mapDetails.overlays.features) {
    if (feature.geometry?.type === 'Point' && feature.properties?.id) {
      points.push({
        id: feature.properties.id,
        coordinates: feature.geometry.coordinates as [number, number],
        orientation: feature.properties.orientation,
        metadata: { ...feature.properties }
      });
    }
  }
  
  return points;
}

/**
 * Check if a point follows the load/docking naming pattern
 */
export function isPointPair(pointId: string): { isLoadPoint: boolean, isDockingPoint: boolean, baseId: string } {
  // Check for _load and _load_docking pattern
  const loadPattern = /^(.+)_load$/;
  const dockingPattern = /^(.+)_load_docking$/;
  
  const loadMatch = pointId.match(loadPattern);
  const dockingMatch = pointId.match(dockingPattern);
  
  if (dockingMatch) {
    return { 
      isLoadPoint: false, 
      isDockingPoint: true, 
      baseId: dockingMatch[1] 
    };
  }
  
  if (loadMatch && !pointId.endsWith('_docking')) {
    return { 
      isLoadPoint: true, 
      isDockingPoint: false, 
      baseId: loadMatch[1] 
    };
  }
  
  return { 
    isLoadPoint: false, 
    isDockingPoint: false,
    baseId: pointId 
  };
}