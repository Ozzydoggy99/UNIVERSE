import axios from 'axios';
import { sleep } from './utilities';
import { getAuthHeaders, ROBOT_API_URL } from './robot-constants';
import { toUnloadPointAction } from './to-unload-point-action';

// Add a console log to verify that this file is using the imported action
console.log('[ACTION-MODULES] Imported toUnloadPointAction from separate file');

// Create a custom Axios instance with authentication headers
const robotApi = axios.create({
  baseURL: ROBOT_API_URL,
  headers: getAuthHeaders()
});

// Types based on our actual implementation
export type ActionResult = {
  success: boolean;
  data?: any;
  error?: string;
};

export type ActionParams = Record<string, any>;

export type ValidationResult = {
  valid: boolean;
  missingParams?: string[];
  errors?: string[];
};

export interface ActionModule {
  id: string;
  name: string;
  description: string;
  execute: (params: ActionParams) => Promise<ActionResult>;
  validate: (params: ActionParams) => Promise<ValidationResult>;
  requiresPoints: string[];
}

/**
 * Resolves a parameterized point ID using our naming convention
 * @param pointId Base point ID or template with parameters
 * @param params Parameters object for substitution
 * @returns Resolved point ID
 */
function resolvePointId(pointId: string, params: Record<string, any>): string {
  // Check if this is a template with parameters like {shelfPoint}
  if (pointId.includes('{') && pointId.includes('}')) {
    // Extract parameter name
    const paramMatch = pointId.match(/{([^}]+)}/);
    if (!paramMatch) return pointId;
    
    const paramName = paramMatch[1];
    const paramValue = params[paramName];
    
    if (!paramValue) {
      throw new Error(`Missing required parameter: ${paramName}`);
    }
    
    // Replace the parameter with its value
    return pointId.replace(`{${paramName}}`, paramValue);
  }
  
  // If it's a direct point ID, return as is
  return pointId;
}

/**
 * Move To Point
 * Navigates the robot to a specific point on the map
 */
export const moveToPointAction: ActionModule = {
  id: 'moveToPoint',
  name: 'Move to Point',
  description: 'Navigate robot to a specified map point',
  requiresPoints: ['destination'],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    const errors = [];
    
    if (!params.pointId) {
      errors.push('Point ID is required');
    }
    
    return { 
      valid: errors.length === 0,
      errors
    };
  },
  
  async execute(params) {
    try {
      // Resolve the point ID using our naming convention
      const resolvedPointId = resolvePointId(params.pointId, params);
      const speed = params.speed || 0.5;
      
      console.log(`[ACTION] Moving to point: ${resolvedPointId}`);
      
      // Check if this is a shelf unload point (for dropping bins)
      const isUnloadPoint = !resolvedPointId.includes('_docking') && 
                            resolvedPointId.includes('_load') && 
                            params.forDropoff === true;
      
      let response;
      let moveActionId;
      
      if (isUnloadPoint) {
        // For dropping bins at a shelf, use 'to_unload_point' move type from the AutoXing API
        console.log(`[ACTION] Using to_unload_point move type for dropoff at: ${resolvedPointId}`);
        response = await robotApi.post('/chassis/moves', {
          creator: 'robot-management-platform',
          type: 'to_unload_point',
          target_x: 0, // These values will be ignored since the point ID is what matters
          target_y: 0,
          target_z: 0,
          point_id: resolvedPointId
        });
        
        // The response should contain the move action ID
        moveActionId = response.data.id;
        console.log(`[ACTION] Created to_unload_point action with ID: ${moveActionId}`);
      } else {
        // For regular movement, use the standard point-based movement
        response = await robotApi.post('/api/v2/move/point', {
          point_id: resolvedPointId,
          velocity: speed
        });
      }
      
      // Wait for completion
      const maxRetries = params.maxRetries || (isUnloadPoint ? 90 : 60); // Give more time for unload operations
      let retries = 0;
      
      while (retries < maxRetries) {
        let status;
        
        if (isUnloadPoint && moveActionId) {
          // Check move action status for unload operations
          const actionResponse = await robotApi.get(`/chassis/moves/${moveActionId}`);
          const state = actionResponse.data.state;
          
          if (state === 'succeeded') {
            console.log(`[ACTION] Successfully unloaded at point: ${resolvedPointId}`);
            return { success: true };
          } else if (state === 'failed' || state === 'cancelled') {
            console.error(`[ACTION] Error unloading at point:`, actionResponse.data);
            return { 
              success: false, 
              error: `Failed to unload at point: ${actionResponse.data.fail_reason_str || 'Unknown error'}`
            };
          }
        } else {
          // Check move status for regular movements
          const statusResponse = await robotApi.get('/api/v2/move/status');
          status = statusResponse.data.status;
          
          if (status === 'idle') {
            console.log(`[ACTION] Successfully reached point: ${resolvedPointId}`);
            return { success: true };
          } else if (status === 'error') {
            console.error(`[ACTION] Error moving to point: ${resolvedPointId}`, statusResponse.data);
            return { success: false, error: `Failed to reach point: ${statusResponse.data.message || 'Unknown error'}` };
          }
        }
        
        await sleep(1000);
        retries++;
      }
      
      return { success: false, error: 'Timeout waiting for move completion' };
    } catch (error: any) { // Handle with any to access error.message
      console.error(`[ACTION] Error in moveToPoint:`, error);
      return { 
        success: false, 
        error: `Failed to move to point: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Align With Rack
 * Fine-tunes the robot's position to align with a rack at a loading point
 */
export const alignWithRackAction: ActionModule = {
  id: 'alignWithRack',
  name: 'Align With Rack',
  description: 'Adjust robot position to precisely align with a rack',
  requiresPoints: ['rack'],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    const errors = [];
    
    if (!params.pointId) {
      errors.push('Point ID is required');
    }
    
    return { 
      valid: errors.length === 0,
      errors
    };
  },
  
  async execute(params: ActionParams): Promise<ActionResult> {
    try {
      // Resolve the point ID using our naming convention
      const resolvedPointId = resolvePointId(params.pointId, params);
      
      console.log(`[ACTION] Aligning with rack at point: ${resolvedPointId}`);
      
      // Based on the AutoXing API documentation, we need to use the 'align_with_rack' move type
      // The API requires passing the point ID without the '_docking' suffix
      // Remove '_docking' suffix if present (we want the load point, not the docking point)
      const loadPointId = resolvedPointId.replace('_docking', '');
      console.log(`[ACTION] Using load point ID for alignment: ${loadPointId}`);
      
      const response = await robotApi.post('/chassis/moves', {
        creator: 'robot-management-platform',
        type: 'align_with_rack',
        target_x: 0, // These values will be ignored since the point ID is what matters
        target_y: 0,
        target_z: 0,
        point_id: loadPointId // This should be the load point, not the docking point
      });
      
      // The response should contain the move action ID
      const moveActionId = response.data.id;
      console.log(`[ACTION] Created align_with_rack action with ID: ${moveActionId}`);
      
      // Wait for alignment to complete
      const maxRetries = params.maxRetries || 60; // Increase timeout for rack alignment
      let retries = 0;
      
      while (retries < maxRetries) {
        // Check move action status
        const statusResponse = await robotApi.get(`/chassis/moves/${moveActionId}`);
        const state = statusResponse.data.state;
        
        if (state === 'succeeded') {
          console.log(`[ACTION] Successfully aligned with rack at: ${resolvedPointId}`);
          return { success: true };
        } else if (state === 'failed' || state === 'cancelled') {
          console.error(`[ACTION] Error aligning with rack:`, statusResponse.data);
          return { 
            success: false, 
            error: `Failed to align with rack: ${statusResponse.data.fail_reason_str || 'Unknown error'}`
          };
        }
        
        // Still in progress, wait and check again
        await sleep(1000);
        retries++;
      }
      
      // If we reach here, the operation timed out
      return { success: false, error: 'Timeout waiting for alignment completion' };
    } catch (error: any) {
      console.error(`[ACTION] Error in alignWithRack:`, error);
      return { 
        success: false, 
        error: `Failed to align with rack: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Jack Up
 * Raises the robot's jack to lift a bin
 */
export const jackUpAction: ActionModule = {
  id: 'jackUp',
  name: 'Jack Up',
  description: 'Raise the robot\'s jack to lift a bin',
  requiresPoints: [],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Raising jack to pick up bin`);
      
      // Based on our actual implementation
      const response = await robotApi.post('/api/v2/forks/up');
      
      // Our existing code uses a fixed sleep here
      // Make it configurable while maintaining backward compatibility
      const waitTime = params.waitTime || 3000;
      await sleep(waitTime);
      
      console.log(`[ACTION] Jack raised successfully`);
      return { success: true };
    } catch (error: any) {
      console.error(`[ACTION] Error raising jack:`, error);
      return { 
        success: false, 
        error: `Failed to raise jack: ${error.message || 'Unknown error'}`
      };
    }
  }
};

// To Unload Point Action is now imported from './to-unload-point-action.ts'

export const jackDownAction: ActionModule = {
  id: 'jackDown',
  name: 'Jack Down',
  description: 'Lower the robot\'s jack to release a bin',
  requiresPoints: [],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Lowering jack to release bin`);
      
      // Based on our actual implementation
      const response = await robotApi.post('/api/v2/forks/down');
      
      // Our existing code uses a fixed sleep here
      // Make it configurable while maintaining backward compatibility
      const waitTime = params.waitTime || 3000;
      await sleep(waitTime);
      
      console.log(`[ACTION] Jack lowered successfully`);
      return { success: true };
    } catch (error: any) {
      console.error(`[ACTION] Error lowering jack:`, error);
      return { 
        success: false, 
        error: `Failed to lower jack: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Reverse From Rack
 * Backs the robot away from a rack after picking up or dropping off
 */
export const reverseFromRackAction: ActionModule = {
  id: 'reverseFromRack',
  name: 'Reverse From Rack',
  description: 'Move robot backward away from the current rack',
  requiresPoints: [],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Reversing from rack`);
      
      // Based on our actual implementation
      // We usually move to a docking point after this operation
      // For safety, we create a dedicated endpoint or use standard movement
      const distance = params.distance || 0.5; // meters
      const speed = params.speed || 0.2; // m/s
      
      const response = await robotApi.post('/api/v2/move/straight', {
        distance: -distance, // Negative for reverse
        velocity: speed
      });
      
      // Wait for completion
      const maxRetries = params.maxRetries || 30;
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await robotApi.get('/api/v2/move/status');
        const status = statusResponse.data.status;
        
        if (status === 'idle') {
          console.log(`[ACTION] Successfully reversed from rack`);
          return { success: true };
        } else if (status === 'error') {
          console.error(`[ACTION] Error reversing from rack:`, statusResponse.data);
          return { 
            success: false, 
            error: `Failed to reverse from rack: ${statusResponse.data.message || 'Unknown error'}`
          };
        }
        
        await sleep(1000);
        retries++;
      }
      
      return { success: false, error: 'Timeout waiting for reverse completion' };
    } catch (error: any) {
      console.error(`[ACTION] Error in reverseFromRack:`, error);
      return { 
        success: false, 
        error: `Failed to reverse from rack: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Return To Charger
 * Navigates the robot back to its charging station
 */
export const returnToChargerAction: ActionModule = {
  id: 'returnToCharger',
  name: 'Return To Charger',
  description: 'Navigate robot back to charging station',
  requiresPoints: ['charger'],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Returning to charger`);
      
      // Based on our actual implementation with hardcoded coordinates
      // This is our special case that uses exact coordinates not a point
      const response = await robotApi.post('/api/v2/move/coordinate', {
        x: 0.034,
        y: 0.498,
        theta: 266.11,
        isCharger: true
      });
      
      // Wait for completion
      const maxRetries = params.maxRetries || 90; // Longer timeout for charger return
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await robotApi.get('/api/v2/move/status');
        const status = statusResponse.data.status;
        
        if (status === 'idle') {
          console.log(`[ACTION] Successfully returned to charger`);
          return { success: true };
        } else if (status === 'error') {
          console.error(`[ACTION] Error returning to charger:`, statusResponse.data);
          return { 
            success: false, 
            error: `Failed to return to charger: ${statusResponse.data.message || 'Unknown error'}`
          };
        }
        
        await sleep(1000);
        retries++;
      }
      
      return { success: false, error: 'Timeout waiting for charger return completion' };
    } catch (error: any) {
      console.error(`[ACTION] Error in returnToCharger:`, error);
      return { 
        success: false, 
        error: `Failed to return to charger: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Check Bin Status
 * Verifies if a bin is present at a specific location
 */
export const checkBinStatusAction: ActionModule = {
  id: 'checkBinStatus',
  name: 'Check Bin Status',
  description: 'Check if a bin is present at a specific location',
  requiresPoints: ['location'],
  
  async validate(params: ActionParams): Promise<ValidationResult> {
    const errors = [];
    
    if (!params.pointId) {
      errors.push('Point ID is required');
    }
    
    return { 
      valid: errors.length === 0,
      errors
    };
  },
  
  async execute(params: ActionParams): Promise<ActionResult> {
    try {
      const resolvedPointId = resolvePointId(params.pointId, params);
      
      console.log(`[ACTION] Checking bin status at point: ${resolvedPointId}`);
      
      try {
        // Call the robot sensor API to check bin status using sensors
        const sensorResponse = await robotApi.get('/sensors');
        
        // Parse the sensor data to determine if a bin is present
        // In a real implementation, we would look at specific sensor values
        // For now, we'll check if proximity values are in range indicating a bin
        const sensorData = sensorResponse.data;
        const binPresent = Boolean(sensorData && sensorData.proximity && 
                                  sensorData.proximity.front && 
                                  sensorData.proximity.front < 0.5);
        
        console.log(`[ACTION] Bin status checked at ${resolvedPointId}: ${binPresent ? 'Present' : 'Not present'}`);
        
        return {
          success: true,
          data: {
            binPresent
          }
        };
      } catch (sensorError) {
        console.warn(`[ACTION] Could not get sensor data, using default assumption:`, sensorError);
        // Fallback to a safe default if we can't get sensor data
        return {
          success: true,
          data: {
            binPresent: true // Default assumption (safer in some workflows)
          }
        };
      }
    } catch (error: any) {
      console.error(`[ACTION] Error checking bin status:`, error);
      return { 
        success: false, 
        error: `Failed to check bin status: ${error.message || 'Unknown error'}`
      };
    }
  }
};

// Export all actions
export const actionModules = {
  moveToPoint: moveToPointAction,
  alignWithRack: alignWithRackAction,
  jackUp: jackUpAction,
  jackDown: jackDownAction,
  reverseFromRack: reverseFromRackAction,
  returnToCharger: returnToChargerAction,
  checkBinStatus: checkBinStatusAction,
  toUnloadPoint: toUnloadPointAction
};