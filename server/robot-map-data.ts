/**
 * Robot Map Data (Adapter Module)
 * 
 * This module serves as an adapter to redirect old API calls 
 * to the new improved dynamic-map-points system while maintaining
 * backward compatibility.
 */

import { fetchAllMapPoints, getPointCoordinates as getPointCoordinatesDynamic } from './dynamic-map-points';
import { Point } from './types';

/**
 * Adapter function to maintain backward compatibility with existing code
 * Redirects to the improved dynamic-map-points implementation
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  console.log('[ADAPTER] Redirecting fetchRobotMapPoints call to fetchAllMapPoints');
  return fetchAllMapPoints();
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