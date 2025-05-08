// server/robot-map-data.ts
// This file contains map point data for when the robot API doesn't support retrieving it directly
import { Point } from './types';

/**
 * Hard-coded map points based on previous successful retrievals and debugging
 * These are used as a fallback when the robot API doesn't support map point retrieval
 */
export const ROBOT_MAP_POINTS: Point[] = [
  {
    id: "Charging Station",
    x: -23.24,
    y: 1.64,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Pick-up",
    x: -11.94,
    y: 6.31,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Drop-off",
    x: 0.5,
    y: 4.2,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Desk",
    x: -5.75,
    y: 5.12,
    ori: 0,
    floorId: "1"
  },
  {
    id: "145",
    x: -13.6,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "146",
    x: -10.2,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "147",
    x: -6.8,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "148",
    x: -3.4,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "149",
    x: 0,
    y: 2.1,
    ori: 0,
    floorId: "1"
  }
];

/**
 * Validate if a shelf ID exists in our map data
 * @param shelfId The shelf ID to validate
 * @returns True if the shelf ID exists, false otherwise
 */
export function validateShelfId(shelfId: string): boolean {
  return ROBOT_MAP_POINTS.some(point => 
    String(point.id).toLowerCase() === String(shelfId).toLowerCase());
}

/**
 * Get a list of all available shelf points (excludes special points like pickup/dropoff)
 * @returns Array of shelf points
 */
export function getShelfPoints(points?: Point[]): Point[] {
  const pointsToFilter = points || ROBOT_MAP_POINTS;
  
  // First implementation: filters out special points by name
  if (!points) {
    return pointsToFilter.filter(point => {
      const id = String(point.id).toLowerCase();
      return !id.includes("pick") && 
             !id.includes("drop") && 
             !id.includes("desk") &&
             !id.includes("charging");
    });
  }
  
  // Second implementation (used when points are provided):
  // Filters and sorts shelf points: any point whose ID is a numeric string
  const numericPoints = pointsToFilter.filter(point => {
    const id = String(point.id || "").trim();
    return /^\d+$/.test(id);
  });
  
  // Sort numeric points by their numeric ID
  numericPoints.sort((a, b) => parseInt(String(a.id)) - parseInt(String(b.id)));
  return numericPoints;
}