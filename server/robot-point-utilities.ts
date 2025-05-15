/**
 * Utility functions for working with the standardized point naming system
 */

/**
 * Extracts the floor number from a shelf point ID
 * @param pointId Point ID following standard naming convention
 * @returns Floor number or null if not a valid shelf point
 */
export function getFloorFromShelfPoint(pointId: string): number | null {
  // Ensure it's a shelf point (not a pickup or dropoff)
  if (pointId.startsWith('pick-up') || pointId.startsWith('drop-off')) {
    return null;
  }
  
  // Extract the first digit which indicates floor
  const match = pointId.match(/^(\d)/);
  if (!match) return null;
  
  return parseInt(match[1], 10);
}

/**
 * Determines if a point is a shelf point
 * @param pointId Point ID to check
 * @returns Boolean indicating if this is a shelf point
 */
export function isShelfPoint(pointId: string): boolean {
  // Shelf points start with a number and end with _load
  return /^\d+_load$/.test(pointId);
}

/**
 * Determines if a point is a pickup point
 * @param pointId Point ID to check
 * @returns Boolean indicating if this is a pickup point
 */
export function isPickupPoint(pointId: string): boolean {
  return pointId.startsWith('pick-up') && pointId.endsWith('_load');
}

/**
 * Determines if a point is a dropoff point
 * @param pointId Point ID to check
 * @returns Boolean indicating if this is a dropoff point
 */
export function isDropoffPoint(pointId: string): boolean {
  return pointId.startsWith('drop-off') && pointId.endsWith('_load');
}

/**
 * Gets the docking point ID for a load point
 * @param loadPointId The load point ID
 * @returns The corresponding docking point ID
 */
export function getDockingPointId(loadPointId: string): string {
  // If it's already a docking point, return as is
  if (loadPointId.endsWith('_docking')) {
    return loadPointId;
  }
  
  // Otherwise, append _docking to the point ID
  return `${loadPointId}_docking`;
}

/**
 * Gets the base point ID for a docking point
 * @param dockingPointId The docking point ID
 * @returns The corresponding base load point ID
 */
export function getBasePointId(dockingPointId: string): string {
  // If it's a docking point, remove the _docking suffix
  if (dockingPointId.endsWith('_load_docking')) {
    return dockingPointId.replace('_docking', '');
  }
  
  // Otherwise, return as is
  return dockingPointId;
}

/**
 * Validates if a point ID follows the naming convention
 * @param pointId Point ID to validate
 * @returns Object containing validation result and any errors
 */
export function validatePointId(pointId: string): { valid: boolean; errors: string[] } {
  const errors = [];
  
  // Check for basic format
  if (!pointId.includes('_load')) {
    errors.push('Point ID must include "_load"');
  }
  
  // Validate shelf points (must start with a number)
  if (!isPickupPoint(pointId) && !isDropoffPoint(pointId)) {
    if (!/^\d+_load/.test(pointId)) {
      errors.push('Shelf points must start with a number followed by "_load"');
    }
  }
  
  // Validate pickup/dropoff points
  if (pointId.startsWith('pick-up') || pointId.startsWith('drop-off')) {
    if (!pointId.endsWith('_load') && !pointId.endsWith('_load_docking')) {
      errors.push('Pickup/dropoff points must end with "_load" or "_load_docking"');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Groups points by floor based on naming convention
 * @param points Array of point IDs
 * @returns Object with floor numbers as keys and arrays of points as values
 */
export function groupPointsByFloor(points: string[]): Record<number, string[]> {
  const floors: Record<number, string[]> = {};
  
  points.forEach(point => {
    // For shelf points, use the first digit as floor
    if (/^\d+_load/.test(point)) {
      const floor = parseInt(point.charAt(0), 10);
      floors[floor] = floors[floor] || [];
      floors[floor].push(point);
    } 
    // For pickup/dropoff points, we need to determine floor from map
    // This would require additional context from map assignment
  });
  
  return floors;
}

/**
 * Extract the shelf number from a shelf point ID
 * @param pointId Point ID following standard naming convention
 * @returns Shelf number (e.g., 104 from "104_load")
 */
export function getShelfNumber(pointId: string): string | null {
  if (!isShelfPoint(pointId)) return null;
  
  const match = pointId.match(/^(\d+)_load/);
  if (!match) return null;
  
  return match[1];
}