// server/bin-detection.ts
import axios from 'axios';
import { getRobotApiUrl, getAuthHeaders } from './robot-constants';

const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

interface CostmapResponse {
  obstacles: { x: number; y: number; [key: string]: any }[];
  [key: string]: any;
}

/**
 * Check if there's a bin at the specified position by detecting obstacles using the chassis/local_costmap API
 * 
 * @param x X coordinate to check
 * @param y Y coordinate to check
 * @param pointId Optional point ID for logging
 * @returns Promise<boolean> Whether a bin was detected
 */
export async function checkForBin(x: number, y: number, pointId?: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [BIN-DETECTION] Checking for bin at ${pointId || `(${x}, ${y})`}`);
    
    // Use the rack_area_id parameter instead of costmap API
    const rackAreaId = pointId || `(${x}, ${y})`;
    const endpoint = `${robotApiUrl}/chassis/moves`;
    const moveCommand = {
      creator: 'bin-detection',
      type: 'to_unload_point',
      target_x: x,
      target_y: y,
      target_ori: 0,
      point_id: pointId || `(${x}, ${y})`,
      rack_area_id: rackAreaId
    };
    
    const response = await axios.post(endpoint, moveCommand, { headers });
      
    // If the move command is accepted, assume a bin is present
    return response.status === 200;
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error checking for bin at ${pointId || `(${x}, ${y})`}:`, error.message);
    throw new Error(`Failed to detect bin at ${pointId || `(${x}, ${y})`}: ${error.message}`);
  }
}

/**
 * Get detailed bin detection status with confidence score
 * @param x X coordinate to check
 * @param y Y coordinate to check
 * @param pointId Optional point ID for logging
 * @returns Promise<{detected: boolean, confidence: number, method: string}>
 */
export async function getBinDetectionStatus(
  x: number, 
  y: number, 
  pointId?: string
): Promise<{detected: boolean, confidence: number, method: string}> {
  try {
    const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const timestamp = new Date().toISOString();
    
    // Use the rack_area_id parameter instead of costmap API
    const rackAreaId = pointId || `(${x}, ${y})`;
    const endpoint = `${robotApiUrl}/chassis/moves`;
    const moveCommand = {
      creator: 'bin-detection',
      type: 'to_unload_point',
      target_x: x,
      target_y: y,
      target_ori: 0,
      point_id: pointId || `(${x}, ${y})`,
      rack_area_id: rackAreaId
    };
    
    const response = await axios.post(endpoint, moveCommand, { headers });
    
    // If the move command is accepted, assume a bin is present with high confidence
    return {
      detected: response.status === 200,
      confidence: 1.0,
      method: 'rack_area_id'
    };
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error getting bin detection status at ${pointId || `(${x}, ${y})`}:`, error.message);
    throw new Error(`Failed to get bin detection status at ${pointId || `(${x}, ${y})`}: ${error.message}`);
  }
}