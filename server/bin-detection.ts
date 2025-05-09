// server/bin-detection.ts
import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

/**
 * Check if there's a bin at the specified position
 * 
 * Since the L382502104987ir robot doesn't have specific bin detection endpoints,
 * this function uses a combination of:
 * 1. Checking for obstacles using the chassis/local_costmap API if available
 * 2. Looking at point naming patterns
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
    
    // Try to detect obstacles using the local costmap if available
    try {
      const costmapEndpoint = `${ROBOT_API_URL}/chassis/local_costmap`;
      const costmapResponse = await axios.get(costmapEndpoint, { headers });
      
      if (costmapResponse.data && costmapResponse.data.obstacles) {
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
            console.log(`[${timestamp}] [BIN-DETECTION] ✅ Obstacle detected near ${pointId || `(${x}, ${y})`} using costmap - assuming it's a bin`);
            return true;
          }
        }
        console.log(`[${timestamp}] [BIN-DETECTION] No obstacles detected near ${pointId || `(${x}, ${y})`} using costmap`);
      }
    } catch (error: any) {
      console.log(`[${timestamp}] [BIN-DETECTION] Unable to use local costmap for detection: ${error.message}`);
    }
    
    // Try to check the robot's status to see if it's carrying something
    try {
      const statusEndpoint = `${ROBOT_API_URL}/chassis/state`;
      const statusResponse = await axios.get(statusEndpoint, { headers });
      
      // If robot is at dropoff point and carrying something (jack is up)
      if (statusResponse.data && 
          statusResponse.data.jack_state === 'up' && 
          pointId && pointId.toLowerCase().includes('drop')) {
        console.log(`[${timestamp}] [BIN-DETECTION] ✅ Robot has jack up and is at dropoff ${pointId} - ready to drop bin`);
        return false; // At a dropoff location with jack up means no bin is present yet
      }
      
      // If robot is at pickup point and not carrying anything (jack is down)
      if (statusResponse.data && 
          statusResponse.data.jack_state === 'down' && 
          pointId && pointId.includes('Load') && 
          !pointId.toLowerCase().includes('drop')) {
        console.log(`[${timestamp}] [BIN-DETECTION] ✅ Robot has jack down and is at pickup ${pointId} - bin should be present`);
        return true; // At a pickup location with jack down means a bin should be present
      }
    } catch (error: any) {
      console.log(`[${timestamp}] [BIN-DETECTION] Unable to check robot state: ${error.message}`);
    }
    
    // If no detection methods are available, use a naming heuristic:
    // If this is a pickup point (contains "Load" in pointId), assume bin is present
    // If this is a dropoff point (contains "Drop" in pointId), assume bin is not present
    if (pointId) {
      // Check for dropoff points first since they take precedence
      if (pointId.toLowerCase().includes('drop') && !pointId.includes('docking')) {
        console.log(`[${timestamp}] [BIN-DETECTION] Assuming no bin is present at dropoff point ${pointId}`);
        return false;
      }
      // Then check for load points that are not dropoff points and not docking points
      else if (pointId.includes('Load') && !pointId.includes('docking') && 
               !pointId.toLowerCase().includes('drop')) {
        console.log(`[${timestamp}] [BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
        return true;
      }
    }
    
    // Default fallback - assume no bin
    console.log(`[${timestamp}] [BIN-DETECTION] No bin detected at ${pointId || `(${x}, ${y})`} using all available methods`);
    return false;
  } catch (error: any) {
    // Add timestamp for better log tracking
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error checking for bin at ${pointId || `(${x}, ${y})`}:`, error.message);
    // In case of error, don't stop the workflow - assume no bin
    return false;
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
    const headers = getAuthHeaders();
    let detected = false;
    let confidence = 0;
    let method = 'none';
    const timestamp = new Date().toISOString();
    
    // Try to detect obstacles using the local costmap
    try {
      const costmapEndpoint = `${ROBOT_API_URL}/chassis/local_costmap`;
      const costmapResponse = await axios.get(costmapEndpoint, { headers });
      
      if (costmapResponse.data && costmapResponse.data.obstacles) {
        // Check if any obstacle is near the specified coordinates
        const obstacles = costmapResponse.data.obstacles;
        let minDistance = 999;
        
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
            method = 'costmap_obstacle';
            console.log(`[${timestamp}] [BIN-DETECTION] ✅ Obstacle detected near ${pointId || `(${x}, ${y})`} using costmap - assuming it's a bin (distance: ${distance.toFixed(2)}m)`);
            break;
          }
        }
        
        if (!detected) {
          console.log(`[${timestamp}] [BIN-DETECTION] No obstacles detected near ${pointId || `(${x}, ${y})`} using costmap (closest: ${minDistance.toFixed(2)}m)`);
        }
      }
    } catch (error: any) {
      console.log(`[${timestamp}] [BIN-DETECTION] Unable to use local costmap for detection: ${error.message}`);
    }
    
    // If costmap didn't detect obstacles, try robot state
    if (!detected) {
      try {
        const statusEndpoint = `${ROBOT_API_URL}/chassis/state`;
        const statusResponse = await axios.get(statusEndpoint, { headers });
        
        // If robot is at dropoff point and carrying something (jack is up)
        if (statusResponse.data && 
            statusResponse.data.jack_state === 'up' && 
            pointId && pointId.toLowerCase().includes('drop')) {
          detected = false;
          confidence = 0.85;
          method = 'robot_state';
          console.log(`[${timestamp}] [BIN-DETECTION] Robot has jack up and is at dropoff ${pointId} - ready to drop bin`);
        }
        
        // If robot is at pickup point and not carrying anything (jack is down)
        if (statusResponse.data && 
            statusResponse.data.jack_state === 'down' && 
            pointId && pointId.includes('Load') && 
            !pointId.toLowerCase().includes('drop')) {
          detected = true;
          confidence = 0.85;
          method = 'robot_state';
          console.log(`[${timestamp}] [BIN-DETECTION] Robot has jack down and is at pickup ${pointId} - bin should be present`);
        }
      } catch (error: any) {
        console.log(`[${timestamp}] [BIN-DETECTION] Unable to check robot state: ${error.message}`);
      }
    }
    
    // Final fallback - use point name
    if (method === 'none' && pointId) {
      // Check for dropoff points first since they take precedence
      if (pointId.toLowerCase().includes('drop') && !pointId.includes('docking')) {
        detected = false;
        confidence = 0.7;
        method = 'point_name_heuristic';
        console.log(`[${timestamp}] [BIN-DETECTION] Assuming no bin is present at dropoff point ${pointId}`);
      }
      // Then check for load points that are not dropoff points
      else if (pointId.includes('Load') && !pointId.includes('docking') && 
               !pointId.toLowerCase().includes('drop')) {
        detected = true;
        confidence = 0.7;
        method = 'point_name_heuristic';
        console.log(`[${timestamp}] [BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
      }
    }
    
    return {
      detected,
      confidence,
      method
    };
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [BIN-DETECTION] Error getting bin detection status at ${pointId || `(${x}, ${y})`}:`, error.message);
    return {
      detected: false,
      confidence: 0,
      method: 'error'
    };
  }
}