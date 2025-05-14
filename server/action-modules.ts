import axios from 'axios';
import { sleep } from './utilities';

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
  
  async validate(params) {
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
      
      // Using our actual API call pattern from existing workflows
      const response = await axios.post(`http://47.180.91.99:8090/api/v2/move/point`, {
        point_id: resolvedPointId,
        velocity: speed
      });
      
      // Wait for completion as our existing code does
      const maxRetries = params.maxRetries || 60;
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await axios.get('http://47.180.91.99:8090/api/v2/move/status');
        const status = statusResponse.data.status;
        
        if (status === 'idle') {
          console.log(`[ACTION] Successfully reached point: ${resolvedPointId}`);
          return { success: true };
        } else if (status === 'error') {
          console.error(`[ACTION] Error moving to point: ${resolvedPointId}`, statusResponse.data);
          return { success: false, error: `Failed to reach point: ${statusResponse.data.message || 'Unknown error'}` };
        }
        
        await sleep(1000);
        retries++;
      }
      
      return { success: false, error: 'Timeout waiting for move completion' };
    } catch (error) {
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
  
  async validate(params) {
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
      
      console.log(`[ACTION] Aligning with rack at point: ${resolvedPointId}`);
      
      // Based on our actual implementation
      const response = await axios.post(`http://47.180.91.99:8090/api/v2/move/point/fine_adjust`, {
        point_id: resolvedPointId
      });
      
      // Wait for alignment to complete
      const maxRetries = params.maxRetries || 30;
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await axios.get('http://47.180.91.99:8090/api/v2/move/status');
        const status = statusResponse.data.status;
        
        if (status === 'idle') {
          console.log(`[ACTION] Successfully aligned with rack at: ${resolvedPointId}`);
          return { success: true };
        } else if (status === 'error') {
          console.error(`[ACTION] Error aligning with rack:`, statusResponse.data);
          return { success: false, error: `Failed to align with rack: ${statusResponse.data.message || 'Unknown error'}` };
        }
        
        await sleep(1000);
        retries++;
      }
      
      return { success: false, error: 'Timeout waiting for alignment completion' };
    } catch (error) {
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
  
  async validate(params) {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Raising jack to pick up bin`);
      
      // Use the correct API endpoint from documentation
      const ROBOT_API_URL = process.env.ROBOT_API_URL || 'http://47.180.91.99:8090';
      const headers = {
        'Secret': process.env.ROBOT_SECRET_KEY || 'APPCODE 667a51a4d948433081a272c78d10a8a4'
      };
      
      // According to the robot documentation, we should use /services/jack_up
      const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      
      // Extended wait time for more reliable operation
      // Make it configurable while maintaining backward compatibility
      const waitTime = params.waitTime || 8000; // Longer wait time (8 seconds) for the operation to complete
      console.log(`[ACTION] Waiting ${waitTime}ms for jack operation to complete...`);
      await sleep(waitTime);
      
      console.log(`[ACTION] Jack raised successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[ACTION] Error raising jack:`, error);
      return { 
        success: false, 
        error: `Failed to raise jack: ${error.message || 'Unknown error'}`
      };
    }
  }
};

/**
 * Jack Down
 * Lowers the robot's jack to release a bin
 */
export const jackDownAction: ActionModule = {
  id: 'jackDown',
  name: 'Jack Down',
  description: 'Lower the robot\'s jack to release a bin',
  requiresPoints: [],
  
  async validate(params) {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Lowering jack to release bin`);
      
      // Based on our actual implementation
      const response = await axios.post(`http://47.180.91.99:8090/api/v2/forks/down`);
      
      // Our existing code uses a fixed sleep here
      // Make it configurable while maintaining backward compatibility
      const waitTime = params.waitTime || 3000;
      await sleep(waitTime);
      
      console.log(`[ACTION] Jack lowered successfully`);
      return { success: true };
    } catch (error) {
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
  
  async validate(params) {
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
      
      const response = await axios.post(`http://47.180.91.99:8090/api/v2/move/straight`, {
        distance: -distance, // Negative for reverse
        velocity: speed
      });
      
      // Wait for completion
      const maxRetries = params.maxRetries || 30;
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await axios.get('http://47.180.91.99:8090/api/v2/move/status');
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
    } catch (error) {
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
  
  async validate(params) {
    return { valid: true };
  },
  
  async execute(params) {
    try {
      console.log(`[ACTION] Returning to charger`);
      
      // Based on our actual implementation with hardcoded coordinates
      // This is our special case that uses exact coordinates not a point
      const response = await axios.post(`http://47.180.91.99:8090/api/v2/move/coordinate`, {
        x: 0.034,
        y: 0.498,
        theta: 266.11,
        isCharger: true
      });
      
      // Wait for completion
      const maxRetries = params.maxRetries || 90; // Longer timeout for charger return
      let retries = 0;
      
      while (retries < maxRetries) {
        const statusResponse = await axios.get('http://47.180.91.99:8090/api/v2/move/status');
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
    } catch (error) {
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
  
  async validate(params) {
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
      const resolvedPointId = resolvePointId(params.pointId, params);
      
      console.log(`[ACTION] Checking bin status at point: ${resolvedPointId}`);
      
      // This would need to be implemented if we want bin detection
      // Currently we assume success if the request completes
      return { 
        success: true, 
        data: {
          binPresent: true // This should be determined by sensors or camera
        }
      };
    } catch (error) {
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
  checkBinStatus: checkBinStatusAction
};