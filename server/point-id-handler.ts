/**
 * Point ID Handler
 * 
 * This module provides functions for working with robot point IDs,
 * including normalizing different formats and handling special cases.
 */

// Define point data structure
export interface Point {
  x: number;
  y: number;
  theta: number;
}

// Hard-coded map of point coordinates as a fallback solution
const pointMap: Record<string, Point> = {
  // Standard shelf points
  '104': { x: 1.5, y: 2.2, theta: 0 },
  '110': { x: 3.2, y: 4.1, theta: 0.5 },
  '112': { x: 4.5, y: 3.2, theta: 0.75 },
  '115': { x: 5.8, y: 2.5, theta: 1.0 },
  
  // Load points (for pickup/dropoff)
  '104_load': { x: 1.5, y: 2.2, theta: 0 },
  '110_load': { x: 3.2, y: 4.1, theta: 0.5 },
  '112_load': { x: 4.5, y: 3.2, theta: 0.75 },
  '115_load': { x: 5.8, y: 2.5, theta: 1.0 },

  // Special drop-off points
  'dropoff': { x: -1.7, y: -0.5, theta: 3.14 },
  'Drop-off_Load': { x: -1.7, y: -0.5, theta: 3.14 }
};

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
 * Get rack area ID from a point ID
 * 
 * This handles both regular shelf points and special points like Drop-off
 */
export function getRackAreaId(pointId: string): string {
  // Special case for Drop-off point (hyphenated format)
  if (pointId.includes('Drop-off') || pointId.toLowerCase().includes('drop-off')) {
    return 'Drop-off';
  }
  
  // For regular shelf points, use the normalized ID (e.g., '110' from '110_load')
  return normalizePointId(pointId);
}

/**
 * Get point coordinates by ID
 * 
 * This tries various formats of the point ID to find a match
 */
export function getPointCoordinates(pointId: string): Point | null {
  console.log(`Looking up coordinates for point: ${pointId}`);
  
  // Try the exact point ID first
  if (pointId in pointMap) {
    console.log(`Found exact match for ${pointId}`);
    return pointMap[pointId];
  }
  
  // If not found, try normalizing the ID
  const normalizedId = normalizePointId(pointId);
  console.log(`Normalized ID: ${normalizedId}`);
  
  if (normalizedId in pointMap) {
    console.log(`Found match for normalized ID ${normalizedId}`);
    return pointMap[normalizedId];
  }
  
  // If the normalized ID isn't found, try with _load suffix
  const loadId = `${normalizedId}_load`;
  console.log(`Trying with _load suffix: ${loadId}`);
  
  if (loadId in pointMap) {
    console.log(`Found match for ${loadId}`);
    return pointMap[loadId];
  }
  
  console.log(`No coordinates found for ${pointId} or its variants`);
  return null;
}

/**
 * Check if this is a special drop-off point
 */
export function isDropOffPoint(pointId: string): boolean {
  return pointId.includes('Drop-off') || 
         pointId.toLowerCase().includes('drop-off') || 
         pointId.toLowerCase() === 'dropoff' ||
         pointId.toLowerCase().includes('dropoff');
}