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

// Helper function to resolve point IDs with parameters
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
    try {
      // Resolve the point ID using our naming convention
      const resolvedPointId = resolvePointId(params.pointId, params);
      
      console.log(`[ACTION] Moving to unload point at: ${resolvedPointId}`);
      
      // Based on the AutoXing API documentation, we need to use the 'to_unload_point' move type
      // The API requires passing the point ID without the '_docking' suffix
      // Remove '_docking' suffix if present (we want the load point, not the docking point)
      const loadPointId = resolvedPointId.replace('_docking', '');
      console.log(`[ACTION] Using load point ID for unloading: ${loadPointId}`);
      
      // Extract the area ID from the point ID (everything before the underscore)
      // Special handling for the drop-off area which contains a hyphen
      let rackAreaId;
      
      // Special handling for the drop-off area
      if (loadPointId.startsWith('drop-off_')) {
        rackAreaId = 'drop-off';
        console.log(`[ACTION] Using special rack area ID for drop-off: ${rackAreaId}`);
      } else {
        // For other areas, extract everything before the first underscore
        const areaMatch = loadPointId.match(/^([^_]+)/);
        rackAreaId = areaMatch ? areaMatch[1] : loadPointId;
        console.log(`[ACTION] Using standard rack area ID: ${rackAreaId}`);
      }
      
      console.log(`[ACTION] FINAL rack area ID for unloading: ${rackAreaId}`);
      
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