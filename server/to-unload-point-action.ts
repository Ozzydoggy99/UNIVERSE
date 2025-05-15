import { ActionParams, ValidationResult } from './action-modules';
import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

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
  
  // Special handling for dropoff points (case-insensitive)
  if (label.toLowerCase().includes('drop-off') || label.toLowerCase().includes('dropoff')) {
    // Ensure proper format for dropoff points
    if (!label.toLowerCase().includes('_load')) {
      console.log(`[UNLOAD-POINT-ACTION] Normalizing dropoff point ID format: ${label} -> dropoff_load`);
      return 'dropoff_load';
    }
    
    // If it has dropoff but wrong format, normalize to dropoff_load
    if (label.toLowerCase() !== 'dropoff_load') {
      console.log(`[UNLOAD-POINT-ACTION] Standardizing dropoff point format: ${label} -> dropoff_load`);
      return 'dropoff_load';
    }
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
      // Ensure we're using a proper load point without any docking suffix
      const loadPointId = resolvedPointId.toLowerCase().includes('_docking') 
        ? resolvedPointId.replace('_docking', '_load').replace('_DOCKING', '_load')
        : resolvedPointId;
        
      // Second safety check - after resolving, if we still have a docking point, throw an error
      if (loadPointId.toString().toLowerCase().includes('_docking')) {
        console.log(`[UNLOAD-POINT-ACTION] ⚠️ CRITICAL ERROR: After resolving point ID, still have docking point: ${loadPointId}`);
        throw new Error(`Cannot use to_unload_point with docking point ${loadPointId}. This should never happen - check the point naming.`);
      }
        
      console.log(`[ACTION] Using load point ID for unloading: ${loadPointId}`);
      
      // Extract the area ID from the point ID with more robust handling
      // Special handling for the dropoff area
      let rackAreaId;
      
      // CRITICAL FIX: We need to use the EXACT point ID as the rack_area_id 
      // This ensures the robot can distinguish between dropoff_load and dropoff_load_docking
      // Using just "dropoff" as the rack_area_id doesn't provide enough information
      
      // For proper targeting, use the FULL POINT ID as the rack_area_id
      rackAreaId = loadPointId;
      
      console.log(`[UNLOAD-POINT-ACTION] CRITICAL FIX: Using exact point ID "${loadPointId}" as rack_area_id`);
      console.log(`[UNLOAD-POINT-ACTION] This ensures the robot can distinguish between load points and docking points`);
      
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