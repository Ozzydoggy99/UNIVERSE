/**
 * Robot Map Data (Adapter Module)
 * 
 * This module serves as an adapter to redirect old fetchRobotMapPoints calls 
 * to the new improved dynamic-map-points system.
 */

import { fetchAllMapPoints } from './dynamic-map-points';
import { Point } from './types';

/**
 * Adapter function to maintain backward compatibility with existing code
 * Redirects to the improved dynamic-map-points implementation
 */
export async function fetchRobotMapPoints(): Promise<Point[]> {
  console.log('[ADAPTER] Redirecting fetchRobotMapPoints call to fetchAllMapPoints');
  return fetchAllMapPoints();
}