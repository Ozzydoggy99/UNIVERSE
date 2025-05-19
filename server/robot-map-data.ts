/**
 * Robot Map Data
 * 
 * This module provides access to robot map data including points
 * and their coordinates for navigation.
 */

import axios from 'axios';

// Define the robot API base URL
export const ROBOT_API_URL = 'http://47.180.91.99:8090';

// Type definitions for map data
export interface Point {
  x: number;
  y: number;
  theta: number;
}

// Hard-coded points map as a backup
const robotPointsMap: Record<string, Point> = {
  // Standard points
  '104': { x: 1.5, y: 2.2, theta: 0 },
  '110': { x: 3.2, y: 4.1, theta: 0.5 },
  '112': { x: 4.5, y: 3.2, theta: 0.75 },
  '115': { x: 5.8, y: 2.5, theta: 1.0 },
  
  // Load points (for pickup/dropoff)
  '104_load': { x: 1.5, y: 2.2, theta: 0 },
  '110_load': { x: 3.2, y: 4.1, theta: 0.5 },
  '112_load': { x: 4.5, y: 3.2, theta: 0.75 },
  '115_load': { x: 5.8, y: 2.5, theta: 1.0 },
  
  // Docking points
  '104_docking': { x: 1.3, y: 2.0, theta: 0 },
  '110_docking': { x: 3.0, y: 3.9, theta: 0.5 },
  '112_docking': { x: 4.3, y: 3.0, theta: 0.75 },
  '115_docking': { x: 5.6, y: 2.3, theta: 1.0 },
  
  // Special load_docking points
  '104_load_docking': { x: 1.3, y: 2.0, theta: 0 },
  '110_load_docking': { x: 3.0, y: 3.9, theta: 0.5 },
  '112_load_docking': { x: 4.3, y: 3.0, theta: 0.75 },
  '115_load_docking': { x: 5.6, y: 2.3, theta: 1.0 },
  
  // Central pickup/dropoff
  'pickup': { x: -1.2, y: 0.5, theta: 3.14 },
  'pickup_docking': { x: -1.5, y: 0.3, theta: 3.14 },
  'dropoff': { x: -1.7, y: -0.5, theta: 3.14 },
  'dropoff_docking': { x: -2.0, y: -0.7, theta: 3.14 },
  'Drop-off_Load': { x: -1.7, y: -0.5, theta: 3.14 },
  'Drop-off_Load_docking': { x: -2.0, y: -0.7, theta: 3.14 },
  
  // Charger and other special points
  'charger': { x: 0, y: 0, theta: 0 }
};

// Map floors
const mapFloors = [
  { id: 1, name: 'Floor1' },
  { id: 2, name: 'Floor2' },
  { id: 3, name: 'BasementODT' }
];

/**
 * Get the robot API URL
 * @returns The base URL for the robot API
 */
export function getRobotApiUrl(): string {
  return ROBOT_API_URL;
}

/**
 * Get all floors from the map
 * @returns List of all floors
 */
export function getAllFloors() {
  return mapFloors;
}

/**
 * Get specific floor data by ID
 * @param floorId Floor ID
 * @returns Floor data
 */
export function getFloorById(floorId: number) {
  return mapFloors.find(f => f.id === floorId);
}

/**
 * Get robot points map
 * @returns Map of all robot points
 */
export function getRobotPointsMap() {
  return robotPointsMap;
}

/**
 * Get point coordinates by ID
 * @param pointId The ID of the point
 * @returns Point coordinates or null if not found
 */
export function getPoint(pointId: string): Point | null {
  // Attempt to retrieve point from hard-coded map
  const point = robotPointsMap[pointId];
  
  // If the exact point ID isn't found, try normalizing it
  if (!point) {
    const baseId = normalizePointId(pointId);
    return robotPointsMap[baseId] || null;
  }
  
  return point;
}

/**
 * Normalize a point ID to handle different formats
 * @param pointId The point ID to normalize
 * @returns The normalized base point ID
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
 * Check if a point ID is valid
 * @param pointId The point ID to check
 * @returns True if the point exists
 */
export function isValidPoint(pointId: string): boolean {
  return !!getPoint(pointId);
}