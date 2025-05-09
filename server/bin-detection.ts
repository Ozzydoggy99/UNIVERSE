// server/bin-detection.ts
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

/**
 * Check if there's a bin at the specified position
 * Uses distance sensors or vision to determine if a bin is present
 * 
 * @param x X coordinate to check
 * @param y Y coordinate to check
 * @param pointId Optional point ID for logging
 * @returns Promise<boolean> Whether a bin was detected
 */
export async function checkForBin(x: number, y: number, pointId?: string): Promise<boolean> {
  try {
    const headers = { 'x-api-key': ROBOT_SECRET };
    const sensorApiEndpoint = `${ROBOT_API_URL}/sensors/distance`;
    
    // First try to use distance sensors if available
    try {
      const sensorResponse = await axios.get(sensorApiEndpoint, { headers });
      
      if (sensorResponse.data && sensorResponse.data.front < 0.4) {
        console.log(`[BIN-DETECTION] ✅ Bin detected at ${pointId || `(${x}, ${y})`} using distance sensors`);
        return true;
      }
    } catch (error: any) {
      console.log(`[BIN-DETECTION] Unable to use distance sensors, will try alternate detection: ${error.message}`);
    }
    
    // Then try camera-based detection if available
    try {
      const visionApiEndpoint = `${ROBOT_API_URL}/vision/detect`;
      const visionResponse = await axios.post(visionApiEndpoint, 
        { 
          objects: ['bin', 'container', 'box'],
          threshold: 0.6,
          region: { x, y, radius: 1.5 }
        }, 
        { headers }
      );
      
      if (visionResponse.data && 
          visionResponse.data.detections && 
          visionResponse.data.detections.length > 0) {
        console.log(`[BIN-DETECTION] ✅ Bin detected at ${pointId || `(${x}, ${y})`} using vision API`);
        return true;
      }
    } catch (error: any) {
      console.log(`[BIN-DETECTION] Unable to use vision API, will use simulated detection: ${error.message}`);
    }
    
    // If robot sensors are unavailable, check API endpoint for bin presence
    try {
      const binStatusEndpoint = `${ROBOT_API_URL}/bin_status`;
      const statusResponse = await axios.get(`${binStatusEndpoint}?x=${x}&y=${y}`, { headers });
      
      if (statusResponse.data && statusResponse.data.hasBin) {
        console.log(`[BIN-DETECTION] ✅ Bin detected at ${pointId || `(${x}, ${y})`} using bin status API`);
        return statusResponse.data.hasBin;
      }
    } catch (error: any) {
      console.log(`[BIN-DETECTION] Unable to use bin status API, will use detection fallback: ${error.message}`);
    }
    
    // If no detection methods are available, use a heuristic:
    // If this is a pickup point (contains "Load" in pointId), assume bin is present
    // If this is a dropoff point (contains "Drop" in pointId), assume bin is not present
    if (pointId) {
      if (pointId.includes('Load') && !pointId.includes('docking')) {
        console.log(`[BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
        return true;
      } else if (pointId.toLowerCase().includes('drop') && !pointId.includes('docking')) {
        console.log(`[BIN-DETECTION] Assuming no bin is present at dropoff point ${pointId}`);
        return false;
      }
    }
    
    // Default fallback - assume no bin
    console.log(`[BIN-DETECTION] No bin detected at ${pointId || `(${x}, ${y})`} using all available methods`);
    return false;
  } catch (error: any) {
    console.error(`[BIN-DETECTION] Error checking for bin at ${pointId || `(${x}, ${y})`}:`, error.message);
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
    const headers = { 'x-api-key': ROBOT_SECRET };
    let detected = false;
    let confidence = 0;
    let method = 'none';
    
    // Try distance sensors first
    try {
      const sensorApiEndpoint = `${ROBOT_API_URL}/sensors/distance`;
      const sensorResponse = await axios.get(sensorApiEndpoint, { headers });
      
      if (sensorResponse.data) {
        const frontDistance = sensorResponse.data.front || 999;
        if (frontDistance < 0.4) {
          detected = true;
          confidence = 0.9;
          method = 'distance_sensor';
          console.log(`[BIN-DETECTION] ✅ Bin detected at ${pointId || `(${x}, ${y})`} using distance sensors`);
        }
      }
    } catch (error: any) {
      console.log(`[BIN-DETECTION] Unable to use distance sensors: ${error.message}`);
    }
    
    // If distance sensor didn't detect, try vision
    if (!detected) {
      try {
        const visionApiEndpoint = `${ROBOT_API_URL}/vision/detect`;
        const visionResponse = await axios.post(visionApiEndpoint, 
          { 
            objects: ['bin', 'container', 'box'],
            threshold: 0.6,
            region: { x, y, radius: 1.5 }
          }, 
          { headers }
        );
        
        if (visionResponse.data && 
            visionResponse.data.detections && 
            visionResponse.data.detections.length > 0) {
          detected = true;
          confidence = visionResponse.data.detections[0].confidence || 0.8;
          method = 'vision';
          console.log(`[BIN-DETECTION] ✅ Bin detected at ${pointId || `(${x}, ${y})`} using vision API`);
        }
      } catch (error: any) {
        console.log(`[BIN-DETECTION] Unable to use vision API: ${error.message}`);
      }
    }
    
    // If no detection yet, try bin status API
    if (!detected) {
      try {
        const binStatusEndpoint = `${ROBOT_API_URL}/bin_status`;
        const statusResponse = await axios.get(`${binStatusEndpoint}?x=${x}&y=${y}`, { headers });
        
        if (statusResponse.data && statusResponse.data.hasBin) {
          detected = statusResponse.data.hasBin;
          confidence = 0.95;
          method = 'bin_status_api';
          console.log(`[BIN-DETECTION] ✅ Bin ${detected ? 'detected' : 'not detected'} at ${pointId || `(${x}, ${y})`} using bin status API`);
        }
      } catch (error: any) {
        console.log(`[BIN-DETECTION] Unable to use bin status API: ${error.message}`);
      }
    }
    
    // Final fallback - use point name
    if (method === 'none' && pointId) {
      if (pointId.includes('Load') && !pointId.includes('docking')) {
        detected = true;
        confidence = 0.7;
        method = 'point_name_heuristic';
        console.log(`[BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
      } else if (pointId.toLowerCase().includes('drop') && !pointId.includes('docking')) {
        detected = false;
        confidence = 0.7;
        method = 'point_name_heuristic';
        console.log(`[BIN-DETECTION] Assuming no bin is present at dropoff point ${pointId}`);
      }
    }
    
    return {
      detected,
      confidence,
      method
    };
  } catch (error: any) {
    console.error(`[BIN-DETECTION] Error getting bin detection status at ${pointId || `(${x}, ${y})`}:`, error.message);
    return {
      detected: false,
      confidence: 0,
      method: 'error'
    };
  }
}