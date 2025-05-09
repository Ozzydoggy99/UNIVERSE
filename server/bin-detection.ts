// server/bin-detection.ts
import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

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
    const headers = getAuthHeaders();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [BIN-DETECTION] Checking for bin at ${pointId || `(${x}, ${y})`}`);
    
    // Detect obstacles using the local costmap API
    const costmapEndpoint = `${ROBOT_API_URL}/chassis/local_costmap`;
    const costmapResponse = await axios.get(costmapEndpoint, { headers });
    
    if (!costmapResponse.data || !costmapResponse.data.obstacles) {
      throw new Error("No obstacle data available from costmap API");
    }
    
    // Check if any obstacle is near the specified coordinates
    const obstacles = costmapResponse.data.obstacles;
    for (const obstacle of obstacles) {
      // Calculate distance between point and obstacle
      const distance = Math.sqrt(
        Math.pow(obstacle.x - x, 2) + 
        Math.pow(obstacle.y - y, 2)
      );
      
      // If obstacle is within 0.5 meters of the point, consider it a bin
      if (distance < 0.5) {
        console.log(`[${timestamp}] [BIN-DETECTION] ✅ Obstacle detected near ${pointId || `(${x}, ${y})`} using costmap - bin confirmed`);
        return true;
      }
    }
    
    console.log(`[${timestamp}] [BIN-DETECTION] No obstacles detected near ${pointId || `(${x}, ${y})`} using costmap - no bin present`);
    return false;
    
  } catch (error: any) {
    // Add timestamp for better log tracking
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error checking for bin at ${pointId || `(${x}, ${y})`}:`, error.message);
    // In case of error, throw it so we don't proceed with incorrect assumptions
    throw new Error(`Failed to detect bin at ${pointId || `(${x}, ${y})`}: ${error.message}`);
  }
}

/**
 * Get detailed bin detection status with confidence score using the costmap API only
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
    const headers = getAuthHeaders();
    const timestamp = new Date().toISOString();
    
    // Detect obstacles using the local costmap API
    const costmapEndpoint = `${ROBOT_API_URL}/chassis/local_costmap`;
    const costmapResponse = await axios.get(costmapEndpoint, { headers });
    
    if (!costmapResponse.data || !costmapResponse.data.obstacles) {
      throw new Error("No obstacle data available from costmap API");
    }
    
    // Check if any obstacle is near the specified coordinates
    const obstacles = costmapResponse.data.obstacles;
    let minDistance = 999;
    let detected = false;
    let confidence = 0;
    
    for (const obstacle of obstacles) {
      // Calculate distance between point and obstacle
      const distance = Math.sqrt(
        Math.pow(obstacle.x - x, 2) + 
        Math.pow(obstacle.y - y, 2)
      );
      
      minDistance = Math.min(minDistance, distance);
      
      // If obstacle is within 0.5 meters of the point, consider it a bin
      if (distance < 0.5) {
        detected = true;
        confidence = Math.max(0.5, 1 - distance); // Higher confidence for closer obstacles
        console.log(`[${timestamp}] [BIN-DETECTION] ✅ Obstacle detected near ${pointId || `(${x}, ${y})`} using costmap - bin confirmed (distance: ${distance.toFixed(2)}m)`);
        break;
      }
    }
    
    if (!detected) {
      console.log(`[${timestamp}] [BIN-DETECTION] No obstacles detected near ${pointId || `(${x}, ${y})`} using costmap (closest: ${minDistance.toFixed(2)}m)`);
    }
    
    return {
      detected,
      confidence,
      method: 'costmap_obstacle'
    };
    
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error getting bin detection status at ${pointId || `(${x}, ${y})`}:`, error.message);
    // In case of error, throw it so we don't proceed with incorrect assumptions
    throw new Error(`Failed to get bin detection status at ${pointId || `(${x}, ${y})`}: ${error.message}`);
  }
}