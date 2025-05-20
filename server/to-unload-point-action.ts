/**
 * To Unload Point Action
 * 
 * This action handles moving the robot to an unload point and properly
 * handling points with various naming conventions.
 */

import axios from 'axios';
import { normalizePointId } from './robot-map-data';

// Robot API base URL
const ROBOT_API_URL = 'http://47.180.91.99:8090';

// Types for parameters and responses
interface ActionParams {
  point_id: string;
  [key: string]: any;
}

interface ExecuteResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Execute the toUnloadPoint action
 * 
 * This action moves the robot to a specified unload point, handling various
 * point ID formats like "110", "110_load", etc. It works with both standard
 * shelf points and special points like "Drop-off_Load".
 */
// Export both the individual function and as a named object for compatibility
export const toUnloadPointAction = { execute };

export async function execute(params: ActionParams): Promise<ExecuteResponse> {
  try {
    console.log(`[TO-UNLOAD-POINT] Executing with params:`, params);
    
    // Extract parameters
    const { point_id } = params;
    
    if (!point_id) {
      return {
        success: false,
        error: 'Missing required parameter: point_id'
      };
    }
    
    console.log(`[TO-UNLOAD-POINT] Working with point ID: ${point_id}`);
    
    // Extract rack area ID properly handling both formats:
    // Regular shelf points (e.g., "110_load") and special points (e.g., "Drop-off_Load")
    let rack_area_id: string;
    
    // CRITICAL FIX: For points like "110_load", use the original point ID directly
    // This ensures we don't lose the _load suffix which is critical for proper operation
    if (point_id.includes('_load')) {
      // Use the point_id directly if it already has the _load suffix
      rack_area_id = point_id;
      console.log(`[TO-UNLOAD-POINT] Using original point ID (with _load) as rack_area_id: ${rack_area_id}`);
    }
    // Special case for the hyphenated Drop-off point
    else if (point_id.includes('Drop-off') || point_id.toLowerCase().includes('drop-off')) {
      rack_area_id = 'Drop-off';
      console.log(`[TO-UNLOAD-POINT] Using special rack area ID for Drop-off point: ${rack_area_id}`);
    } 
    // For numeric IDs like "110", add the _load suffix
    else if (/^\d+$/.test(point_id)) {
      rack_area_id = `${point_id}_load`;
      console.log(`[TO-UNLOAD-POINT] Added _load suffix to numeric ID: ${rack_area_id}`);
    }
    // For all other points, use the original point ID
    else {
      rack_area_id = point_id;
      console.log(`[TO-UNLOAD-POINT] Using original point ID for rack area: ${rack_area_id}`);
    }
    
    // Construct the API endpoint for placing the bin
    const endpoint = `${ROBOT_API_URL}/move/place`;
    
    // Send the place command to the robot
    console.log(`[TO-UNLOAD-POINT] Sending place command with rack_area_id: ${rack_area_id}`);
    const response = await axios.post(endpoint, {
      rack_area_id
    });
    
    // Handle the response
    if (response.status === 200) {
      console.log(`[TO-UNLOAD-POINT] Successfully executed place command for ${point_id}`);
      return {
        success: true,
        message: `Successfully executed place command for ${point_id}`,
        data: response.data
      };
    } else {
      console.error(`[TO-UNLOAD-POINT] Failed to execute place command: ${response.statusText}`);
      return {
        success: false,
        error: `Place command failed: ${response.statusText}`
      };
    }
  } catch (error: any) {
    console.error(`[TO-UNLOAD-POINT] Error executing action:`, error);
    return {
      success: false,
      error: `Failed to execute toUnloadPoint action: ${error.message}`
    };
  }
}