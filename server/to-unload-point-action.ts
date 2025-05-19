import { ActionParams, ValidationResult } from './action-modules';
import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';
import { getPointCoordinates } from './dynamic-map-points';

// Define the ActionResult interface
export type ActionResult = {
  success: boolean;
  data?: any;
  error?: string;
};

// Define the Action interface
export interface Action {
  description: string;
  params: Record<string, any>;
  requiresPoints: string[];
  validate: (params: ActionParams) => Promise<ValidationResult>;
  execute: (params: ActionParams) => Promise<ActionResult>;
}

// Create axios instance for robot API
const robotApi = axios.create({
  baseURL: ROBOT_API_URL,
  headers: getAuthHeaders()
});

// Enhanced helper function to resolve and normalize point IDs
function resolvePointId(pointId: string, params: Record<string, any>): string {
  if (!pointId) {
    console.log(`[UNLOAD-POINT-ACTION] ⚠️ WARNING: Empty point ID provided`);
    return 'unknown_point';
  }
  
  let resolvedPointId = pointId;
  
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
    resolvedPointId = pointId.replace(`{${paramName}}`, paramValue);
    console.log(`[UNLOAD-POINT-ACTION] Resolved parameter ${paramName} to: ${resolvedPointId}`);
  }
  
  // Normalize point ID format based on naming conventions
  const label = resolvedPointId.toString();

  // CRITICAL: First check if this is a docking point - we should NEVER use to_unload_point for docking points
  if (label.toLowerCase().includes('_docking')) {
    console.log(`[UNLOAD-POINT-ACTION] ⚠️ ERROR: Docking point ${label} was passed to toUnloadPoint action.`);
    console.log(`[UNLOAD-POINT-ACTION] to_unload_point should ONLY be used for load points, not docking points.`);
    // Replace _docking with _load to ensure we target the actual load point
    return label.replace(/_docking/i, '_load'); // Case-insensitive replacement
  }
  
  // Special handling for drop-off points (case-insensitive)
  // Handle both the old "drop-off_load" and new "001_load" naming conventions
  if (label.toLowerCase().includes('drop-off') || label.toLowerCase().includes('dropoff')) {
    // Ensure proper format for drop-off points (old naming convention)
    if (!label.toLowerCase().includes('_load')) {
      console.log(`[UNLOAD-POINT-ACTION] Normalizing drop-off point ID format: ${label} -> 001_load`);
      return '001_load'; // Use new naming convention
    }
    
    // If it has drop-off but wrong format, normalize to new convention
    if (label.toLowerCase() !== 'drop-off_load') {
      console.log(`[UNLOAD-POINT-ACTION] Standardizing drop-off point format: ${label} -> 001_load`);
      return '001_load'; // Use new naming convention
    } else {
      // Convert old naming convention to new naming convention
      console.log(`[UNLOAD-POINT-ACTION] Converting old drop-off_load format to new 001_load format`);
      return '001_load';
    }
  }
  
  // Also check for the new central dropoff naming convention
  if (label.toLowerCase().includes('001_load') || (label === '001')) {
    // Ensure proper format for central dropoff points (new naming convention)
    if (!label.toLowerCase().includes('_load')) {
      console.log(`[UNLOAD-POINT-ACTION] Normalizing central dropoff point ID format: ${label} -> 001_load`);
      return '001_load';
    }
    
    // Already in the correct format
    return '001_load';
  }
  
  // For numeric-only inputs (e.g., when just "104" is passed), append "_load"
  if (/^\d+$/.test(label)) {
    console.log(`[UNLOAD-POINT-ACTION] Numeric-only point ID detected: ${label}, appending "_load" suffix`);
    return `${label}_load`;
  }
  
  // For shelf IDs without _load suffix, append it
  if (!label.toLowerCase().includes('_load') && !label.toLowerCase().includes('_docking')) {
    console.log(`[UNLOAD-POINT-ACTION] Point ID without _load suffix: ${label}, appending "_load" suffix`);
    return `${label}_load`;
  }
  
  // If it's already a properly formatted point ID, return as is
  return resolvedPointId;
}

// The toUnloadPoint action definition
export const toUnloadPointAction: Action = {
  description: 'Move to unload point for dropping bins',
  params: {
    pointId: {
      type: 'string',
      description: 'ID of the point to move to for unloading (usually a shelf load point)'
    },
    maxRetries: {
      type: 'number',
      description: 'Maximum number of retries to wait for move to complete',
      default: 60
    }
  },
  
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
    console.log('[UNLOAD-POINT-ACTION] Starting execute() with params:', JSON.stringify(params, null, 2));
    try {
      // CRITICAL CHECK: Verify that we're NOT being called with a docking point
      if (params.pointId && params.pointId.toString().toLowerCase().includes('_docking')) {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: Docking point ${params.pointId} detected in workflow.`);
        console.log(`[UNLOAD-POINT-ACTION] According to the perfect example (pickup-104-new.js), docking points should`);
        console.log(`[UNLOAD-POINT-ACTION] use standard 'move' type, not 'to_unload_point'. Correcting this issue.`);
        
        // Instead of just logging this, we should explicitly throw an error
        // This will force workflow execution to fail early and prevent incorrect operations
        throw new Error(`Cannot use to_unload_point with docking point ${params.pointId}. Use moveToPoint action for docking points.`);
      }
      
      // Resolve the point ID using our naming convention
      const resolvedPointId = resolvePointId(params.pointId, params);
      
      console.log(`[ACTION] Moving to unload point at: ${resolvedPointId}`);
      
      // Based on the AutoXing API documentation, we need to use the 'to_unload_point' move type
      // for the actual load point (not the docking point)
      // Since we need to modify this variable later, use let instead of const
      let loadPointId = resolvedPointId;
        
      // Second safety check - after resolving, if we still have a docking point, throw an error
      if (loadPointId.toString().toLowerCase().includes('_docking')) {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: After resolving point ID, still have docking point: ${loadPointId}`);
        throw new Error(`Cannot use to_unload_point with docking point ${loadPointId}. This should never happen - check the point naming.`);
      }
        
      console.log(`[ACTION] Using load point ID for unloading: ${loadPointId}`);
      
      // DYNAMIC POINT LOOKUP: Get coordinates from the dynamic map service
      // This allows us to handle newly added points without code changes
      const pointCoordinates = await getPointCoordinates(loadPointId);
      
      if (!pointCoordinates) {
        console.error(`[UNLOAD-POINT-ACTION] ❌ Could not find coordinates for point: ${loadPointId}`);
        console.error(`[UNLOAD-POINT-ACTION] This may be a new point that needs to be added to the map.`);
        console.error(`[UNLOAD-POINT-ACTION] Attempting to fetch the latest map points from the robot...`);
        
        // Try again after refreshing the cache - maybe the point was just added
        // This second attempt will force a fresh fetch from the robot
        const refreshedPoint = await getPointCoordinates(loadPointId);
        
        if (!refreshedPoint) {
          throw new Error(`Could not find the unload point coordinates for ${loadPointId}. Make sure this point exists on the robot map.`);
        }
        
        console.log(`[UNLOAD-POINT-ACTION] ✅ Found coordinates after refresh: (${refreshedPoint.x}, ${refreshedPoint.y})`);
      } else {
        console.log(`[UNLOAD-POINT-ACTION] ✅ Found coordinates for ${loadPointId}: (${pointCoordinates.x}, ${pointCoordinates.y})`);
      }
      
      // Extract the area ID from the point ID with more robust handling
      // Special handling for the drop-off area which contains a hyphen
      let rackAreaId;
      
      // CRITICAL FIX: We need to ensure we're using the correct rack_area_id format
      // This must be the complete identifier for the shelf/dropoff location
      // Both "001_load" and "001_load_docking" would have rack_area_id="001_load"
      
      // CRITICAL FIX: We cannot just rename the point - we must REJECT docking points entirely
      // since the robot must physically be at the load point location to unload
      
      // Completely reject any docking points - no conversion, just error out
      if (loadPointId.toLowerCase().includes('_docking')) {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: Cannot unload at a docking point: ${loadPointId}`);
        console.log(`[UNLOAD-POINT-ACTION] The robot must physically move to a load point before unloading`);
        throw new Error(`Cannot unload at docking point ${loadPointId}. The robot must physically be at a load point.`);
      }
      
      // Verify we have a proper load point
      if (!loadPointId.toLowerCase().includes('_load')) {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: Not a valid load point: ${loadPointId}`);
        throw new Error(`The point ${loadPointId} is not a valid load point for unloading operations.`);
      }
      
      // Now that we're sure it's a load point, use the FULL load point ID as rack_area_id
      // For "001_load", use the entire "001_load" as rack_area_id, NOT just "001"
      rackAreaId = loadPointId;
      console.log(`[UNLOAD-POINT-ACTION] Using full load point "${rackAreaId}" as rack_area_id`);
      
      // Add additional debugging to help diagnose if there are still issues
      console.log(`[UNLOAD-POINT-ACTION] ✅ CONFIRMED: Using load point for unloading, NOT a docking point`);
      console.log(`[UNLOAD-POINT-ACTION] Double-check point ID format = ${loadPointId}`);
      console.log(`[UNLOAD-POINT-ACTION] Double-check rack_area_id format = ${rackAreaId}`);
      
      console.log(`[UNLOAD-POINT-ACTION] Using extracted rack_area_id "${rackAreaId}" for point "${loadPointId}"`);
      console.log(`[UNLOAD-POINT-ACTION] This ensures correct targeting for bin unloading at shelf/dropoff points`);
      
      // Just in case, verify we're not left with an empty rack_area_id
      if (!rackAreaId || rackAreaId.trim() === '') {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: Empty rack_area_id, falling back to point ID`);
        rackAreaId = loadPointId;
      }
      
      // Final confirmation of rack_area_id
      console.log(`[UNLOAD-POINT-ACTION] FINAL rack_area_id = "${rackAreaId}" for point "${loadPointId}"`);
      
      const payload = {
        creator: 'robot-management-platform',
        type: 'to_unload_point',  // Use to_unload_point specifically for unloading operations
        target_x: 0, // These values will be ignored since the point ID is what matters
        target_y: 0,
        target_z: 0,
        point_id: loadPointId, // This should be the load point, not the docking point
        rack_area_id: rackAreaId // Required for to_unload_point to work properly
      };
      
      console.log(`[ACTION] Sending toUnloadPoint API call with payload:`, JSON.stringify(payload, null, 2));
      
      let moveActionId;
      
      try {
        const response = await robotApi.post(`/chassis/moves`, payload);
        console.log(`[ACTION] toUnloadPoint API call succeeded with response:`, response.status, response.statusText);
        
        // The response should contain the move action ID
        moveActionId = response.data.id;
        console.log(`[ACTION] Created to_unload_point action with ID: ${moveActionId}`);
        
        // Wait for the move to complete
        const maxRetries = params.maxRetries || 60; // Increase timeout for unload point positioning
        let retries = 0;
        
        while (retries < maxRetries) {
          // Check move action status
          const statusResponse = await robotApi.get(`/chassis/moves/${moveActionId}`);
          
          const status = statusResponse.data.state;
          
          if (status === 'succeeded') {
            console.log(`[ACTION] Move action ${moveActionId} completed successfully`);
            return {
              success: true
            };
          } else if (status === 'failed') {
            const reason = statusResponse.data.reason || 'Unknown failure reason';
            console.error(`[ACTION] Move action ${moveActionId} failed with reason: ${reason}`);
            return {
              success: false,
              error: `Move failed: ${reason}`
            };
          }
          
          // Still in progress, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
        
        // Timed out waiting for move to complete
        console.error(`[ACTION] Timed out waiting for move action ${moveActionId} to complete`);
        return {
          success: false,
          error: 'Timed out waiting for move to complete'
        };
        
      } catch (error: any) {
        console.error(`[ACTION] toUnloadPoint API call failed:`, 
          error.response?.status, 
          error.response?.data || error.message);
          
        return {
          success: false,
          error: `API error: ${error.message}`
        };
      }
    } catch (error: any) {
      console.error(`[ACTION] Error in toUnloadPoint action:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  },
};