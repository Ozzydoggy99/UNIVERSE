/**
 * Dynamic Workflow Service for Multi-Floor Robot Operations
 * 
 * This module provides a dynamic workflow system that handles:
 * 1. Pickup workflow: Shelf → Pickup → Dropoff → Return to Charger
 * 2. Dropoff workflow: Pickup → Shelf → Return to Charger
 * 
 * The system is designed to work with multiple maps/floors with the
 * proper naming conventions for points.
 * 
 * It uses the physical robot (L382502104987ir) for all operations.
 */

import axios from 'axios';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { 
  ROBOT_API_URL, 
  ROBOT_SECRET, 
  ROBOT_SERIAL, 
  getAuthHeaders 
} from './robot-constants';
import { getRackSpecifications } from './robot-settings-api';
import { missionQueue, MissionStep } from './mission-queue';
import robotPointsMap, { getShelfPoint, getShelfDockingPoint } from './robot-points-map';

// Configuration
const LOG_PATH = 'robot-dynamic-workflow.log';

// Types for workflows
type ServiceType = 'robot';  // We've simplified to a single service type
type OperationType = 'pickup' | 'dropoff' | 'transfer';  // Added transfer operation
type Point = {
  id: string;
  x: number;
  y: number;
  ori: number;
};

type MapPoints = {
  [floorId: string]: {
    shelfPoints: Point[];
    dockingPoints: Point[];
    dropoffPoint?: Point;
    dropoffDockingPoint?: Point;
    pickupPoint?: Point;
    pickupDockingPoint?: Point;
    chargerPoint?: Point;
  }
};

// Workflow state tracking
interface WorkflowState {
  id: string;
  serviceType: ServiceType;
  operationType: OperationType;
  floorId: string;
  shelfId: string;
  startTime: Date;
  endTime?: Date;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  error?: string;
  lastMoveId?: number;
}

// In-memory state - would be replaced with database in production
const workflowStates: { [id: string]: WorkflowState } = {};

/**
 * Helper function to log workflow steps with timestamps
 */
function logWorkflow(workflowId: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [WORKFLOW-${workflowId}] ${message}`;
  
  console.log(logMessage);
  fs.appendFileSync(LOG_PATH, logMessage + '\n');
  
  // If this is associated with a workflow, update its state
  if (workflowStates[workflowId]) {
    // Only update message in a real implementation - here we just log
  }
}

/**
 * Get HTTP headers for robot API
 * Using the standardized authentication headers from robot-constants.ts
 */
function getHeaders() {
  return getAuthHeaders();
}

/**
 * Load and cache map points from the robot
 * In a production implementation, this would be refreshed periodically
 * and cached in a database
 */
let mapPointsCache: MapPoints | null = null;

async function getMapPoints(): Promise<MapPoints> {
  if (mapPointsCache) {
    return mapPointsCache;
  }
  
  try {
    // Fetch all maps
    console.log("Fetching maps from robot API...");
    const mapsResponse = await axios.get(`${ROBOT_API_URL}/maps`, { headers: getHeaders() });
    const maps = mapsResponse.data;
    console.log(`Found ${maps.length} maps from robot API: ${JSON.stringify(maps.map((m: any) => ({ id: m.id, name: m.name || 'unnamed' })))}`);
    
    const mapPoints: MapPoints = {};
    
    // Process each map from the robot API
    for (const map of maps) {
      const mapId = map.id;
      const mapUid = map.uid || ''; // Maps have unique uid string identifiers
      const mapName = map.name || 'unnamed';
      console.log(`Processing map: "${mapName}" (ID: ${mapId}, UID: ${mapUid})`);
      
      // Log all maps for proper understanding - don't assume any specific map ID
      console.log(`Map details: ${JSON.stringify({
        id: mapId,
        uid: mapUid,
        name: mapName
      })}`);
      
      // Get detailed map data including overlays
      const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, { headers: getHeaders() });
      const mapData = mapDetailRes.data;
      console.log(`Map ${mapId} details: ${JSON.stringify({
        name: mapData.name || 'unnamed',
        description: mapData.description || 'no description',
        hasOverlays: !!mapData.overlays
      })}`);
      
      if (!mapData || !mapData.overlays) {
        console.log(`Map ${mapId} does not have overlays data`);
        continue;
      }
      
      // Parse the overlay JSON
      let overlays;
      try {
        overlays = JSON.parse(mapData.overlays);
      } catch (e) {
        const parseError = e as Error;
        console.error(`Failed to parse overlays JSON for map ${mapId}: ${parseError.message}`);
        continue;
      }
      
      // Extract point features from the overlays
      const features = overlays.features || [];
      console.log(`Found ${features.length} features in map ${mapId} overlays`);
      
      // Filter to only point features and extract data
      const points = features
        .filter((f: any) => f.geometry?.type === 'Point' && f.properties)
        .map((f: any) => {
          const { id, properties, geometry } = f;
          const pointId = String(id || properties.name || properties.text || '').trim();
          const x = typeof properties.x === 'number' ? properties.x : geometry.coordinates[0];
          const y = typeof properties.y === 'number' ? properties.y : geometry.coordinates[1];
          const ori = parseFloat(String(properties.yaw || properties.orientation || '0'));
          
          return {
            id: pointId,
            x,
            y,
            ori
          };
        });
      
      console.log(`Extracted ${points.length} point features from map ${mapId}`);
      
      // Categorize points based on naming convention
      const shelfPoints: Point[] = [];
      const dockingPoints: Point[] = [];
      let dropoffPoint: Point | undefined;
      let dropoffDockingPoint: Point | undefined;
      let pickupPoint: Point | undefined;
      let pickupDockingPoint: Point | undefined;
      let chargerPoint: Point | undefined;
      
      console.log(`Processing ${points.length} points for map ${mapId}`);
      for (const point of points) {
        console.log(`Examining point: ${point.id}`);
        
        // Look for special point ID formats like MongoDB ObjectIds
        const hasSpecialObjectIdFormat = point.id.length === 24 && /^[0-9a-f]{24}$/i.test(point.id);
        
        // Process based on naming convention with more flexible detection
        if (point.id.toLowerCase().includes('_load') && !point.id.toLowerCase().includes('_docking')) {
          console.log(`✅ Found shelf point: ${point.id}`);
          shelfPoints.push(point);
        } else if (point.id.toLowerCase().includes('_docking')) {
          console.log(`✅ Found docking point: ${point.id}`);
          dockingPoints.push(point);
          
          // Special docking points - use case insensitive comparison
          const lowerCaseId = point.id.toLowerCase();
          if (lowerCaseId.includes('drop-off_load_docking') || lowerCaseId.includes('dropoff_load_docking')) {
            console.log(`✅ Found dropoff docking point: ${point.id}`);
            dropoffDockingPoint = point;
          } else if (lowerCaseId.includes('pick-up_load_docking')) {
            console.log(`✅ Found pickup docking point: ${point.id}`);
            pickupDockingPoint = point;
          }
        } else if (point.id.toLowerCase().includes('drop-off_load') || point.id.toLowerCase().includes('dropoff_load')) {
          console.log(`✅ Found dropoff point: ${point.id}`);
          dropoffPoint = point;
        } else if (point.id.toLowerCase().includes('pick-up_load')) {
          console.log(`✅ Found pickup point: ${point.id}`);
          pickupPoint = point;
        } else if (point.id.toLowerCase().includes('charger')) {
          console.log(`✅ Found charger point: ${point.id}`);
          chargerPoint = point;
        }
        
        // Special handling for points with MongoDB ObjectId format
        if (hasSpecialObjectIdFormat) {
          console.log(`✅ Found MongoDB ObjectId formatted point: ${point.id}`);
          
          // If no shelf points yet, treat this as a shelf point
          if (shelfPoints.length === 0) {
            console.log(`✅ Using ObjectId point as shelf point: ${point.id}`);
            shelfPoints.push(point);
          } 
          // If we already have one shelf point, consider this as a possible dropoff point
          else if (!dropoffPoint && shelfPoints.length === 1) {
            console.log(`✅ Using second ObjectId point as dropoff point: ${point.id}`);
            dropoffPoint = point;
          }
          // If we already have one shelf point and one dropoff point, consider this as a possible pickup point
          else if (!pickupPoint && shelfPoints.length === 1 && dropoffPoint) {
            console.log(`✅ Using third ObjectId point as pickup point: ${point.id}`);
            pickupPoint = point;
          }
          // Any additional points can be docking points
          else if (dockingPoints.length < 3) {
            console.log(`✅ Using ObjectId point as docking point: ${point.id}`);
            dockingPoints.push(point);
            
            // If we don't have specific docking points yet, assign them based on order
            if (!dropoffDockingPoint && dropoffPoint) {
              console.log(`✅ Assigning docking point to dropoff: ${point.id}`);
              dropoffDockingPoint = point;
            } 
            else if (!pickupDockingPoint && pickupPoint) {
              console.log(`✅ Assigning docking point to pickup: ${point.id}`);
              pickupDockingPoint = point;
            }
          }
        }
        
        // Also check for shelf points that don't follow the exact naming convention
        // but have numeric identifiers that might represent shelf numbers
        if (shelfPoints.length === 0) {
          // Look for points that have numeric identifiers as potential shelf points
          const numericMatch = point.id.match(/^(\d+)/);
          if (numericMatch && !point.id.toLowerCase().includes('_docking') && !point.id.toLowerCase().includes('charger')) {
            console.log(`✅ Found potential shelf point by numeric ID: ${point.id}`);
            shelfPoints.push(point);
          }
        }
      }
      
      // Log summary of points found for this map
      if (shelfPoints.length > 0) {
        console.log(`Map ${mapId} has ${shelfPoints.length} shelf points`);
        if (shelfPoints.length > 0) {
          console.log(`First shelf point: ${JSON.stringify(shelfPoints[0])}`);
        }
        
        // Report on missing points for debugging but don't create virtual ones
        if (!chargerPoint) {
          console.log(`⚠️ Warning: No charger point found on Map ${mapId}`);
        }
        
        if (!pickupPoint) {
          console.log(`⚠️ Warning: No pickup point found on Map ${mapId}`);
        }
        
        if (!pickupDockingPoint) {
          console.log(`⚠️ Warning: No pickup docking point found on Map ${mapId}`);
        }
        
        if (!dropoffPoint) {
          console.log(`⚠️ Warning: No dropoff point found on Map ${mapId}`);
        }
        
        if (!dropoffDockingPoint) {
          console.log(`⚠️ Warning: No dropoff docking point found on Map ${mapId}`);
        }
      }
      
      mapPoints[mapId] = {
        shelfPoints,
        dockingPoints,
        dropoffPoint,
        dropoffDockingPoint,
        pickupPoint,
        pickupDockingPoint,
        chargerPoint
      };
    }
    
    mapPointsCache = mapPoints;
    return mapPoints;
    
  } catch (error: any) {
    console.error('Failed to load map points:', error.message);
    throw new Error(`Failed to load map points: ${error.message}`);
  }
}

/**
 * Get the corresponding docking point for a shelf point
 * Only uses actual data from the robot API, no virtual points
 */
function getDockingPointForShelf(shelfId: string, floorPoints: MapPoints[string], floorId?: string): Point | null {
  // First try the standard naming convention with load_docking suffix (case insensitive)
  const dockingId = `${shelfId}_load_docking`;
  const altDockingId = `${shelfId}_docking`;
  
  // Try to find matching points with case-insensitive comparison
  let dockingPoint = floorPoints.dockingPoints.find(p => 
    p.id.toLowerCase() === dockingId.toLowerCase() || 
    p.id.toLowerCase() === altDockingId.toLowerCase()
  );
  
  if (!dockingPoint) {
    console.log(`📝 Could not find exact docking point match for shelf ${shelfId}, trying alternate formats`);
    
    // If it's a numeric shelf ID (like "104"), try with the standard format
    if (/^\d+$/.test(shelfId)) {
      const numericDockingId = `${shelfId}_load_docking`;
      dockingPoint = floorPoints.dockingPoints.find(p => 
        p.id.toLowerCase().includes(numericDockingId.toLowerCase())
      );
      
      if (dockingPoint) {
        console.log(`✅ Found docking point for shelf ${shelfId} using numeric format: ${dockingPoint.id}`);
      }
    }
  }
  
  // If no point is found with standard naming convention and the shelf ID is a MongoDB ObjectId
  if (!dockingPoint && shelfId.length === 24 && /^[0-9a-f]{24}$/i.test(shelfId)) {
    console.log(`📝 Processing MongoDB ObjectId shelf point: ${shelfId}`);
    
    // For MongoDB ObjectId points, just get the first available docking point
    // Since we've already assigned docking points during map processing
    if (floorPoints.dockingPoints.length > 0) {
      dockingPoint = floorPoints.dockingPoints[0];
      console.log(`✅ Using first available docking point for ObjectId shelf: ${dockingPoint.id}`);
    }
  }
  
  // Only return actual docking points from the API, no fallbacks
  return dockingPoint || null;
}

/**
 * Move robot to a specific point
 */
async function moveToPoint(workflowId: string, x: number, y: number, ori: number, label: string): Promise<number> {
  logWorkflow(workflowId, `Moving robot to ${label} (${x}, ${y}, orientation: ${ori})`);
  
  try {
    // Cancel any current moves first
    try {
      const cancelResponse = await axios.patch(
        `${ROBOT_API_URL}/chassis/moves/current`,
        { state: "cancelled" },
        { headers: getHeaders() }
      );
      logWorkflow(workflowId, `Cancelled current move: ${JSON.stringify(cancelResponse.data)}`);
    } catch (cancelError: any) {
      logWorkflow(workflowId, `Note: Could not check current move state: ${cancelError.message}`);
    }
    
    // Send move command
    const moveCommand = {
      creator: 'workflow-service',
      type: 'standard',
      target_x: x,
      target_y: y,
      target_ori: ori
    };
    
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveCommand, { headers: getHeaders() });
    const moveId = response.data.id;
    
    logWorkflow(workflowId, `Move command sent for ${label} - move ID: ${moveId}`);
    
    // Wait for move to complete
    let moveComplete = false;
    let attempts = 0;
    const maxRetries = 180; // 3 minutes at 1-second intervals
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait before checking
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Check move status
        const statusResponse = await axios.get(
          `${ROBOT_API_URL}/chassis/moves/${moveId}`,
          { headers: getHeaders() }
        );
        
        const moveStatus = statusResponse.data.state;
        logWorkflow(workflowId, `Current move status: ${moveStatus}`);
        
        // Try to get position data for logging
        try {
          const posResponse = await axios.get(`${ROBOT_API_URL}/tracked_pose`, { headers: getHeaders() });
          logWorkflow(workflowId, `Current position: ${JSON.stringify(posResponse.data)}`);
        } catch (error) {
          const posError = error as any;
          logWorkflow(workflowId, `Position data incomplete or invalid: ${JSON.stringify(posError.response?.data || {})}`);
        }
        
        if (moveStatus === 'succeeded') {
          moveComplete = true;
          logWorkflow(workflowId, `✅ Move to ${label} completed successfully`);
        } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
          const reason = statusResponse.data.fail_reason_str || 'Unknown reason';
          throw new Error(`Move to ${label} failed or was cancelled. Status: ${moveStatus} Reason: ${reason}`);
        } else {
          logWorkflow(workflowId, `Still moving (move ID: ${moveId}), waiting...`);
        }
      } catch (error: any) {
        if (error.message.includes('Move to')) {
          // This is our thrown error from above, so re-throw it
          throw error;
        }
        logWorkflow(workflowId, `Error checking move status: ${error.message}`);
        // Continue checking - don't break the loop on transient errors
      }
    }
    
    if (!moveComplete) {
      throw new Error(`Move to ${label} timed out after ${maxRetries} attempts`);
    }
    
    // Return the move ID for potential future reference
    return moveId;
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR moving to ${label}: ${error.message}`);
    throw error;
  }
}

/**
 * Execute align_with_rack operation for bin pickup
 * This is specifically for the pickup operation when the jack is DOWN
 */
async function alignWithRackForPickup(workflowId: string, x: number, y: number, ori: number, label: string): Promise<number> {
  logWorkflow(workflowId, `🔍 Aligning with rack at ${label} (${x}, ${y}) using special align_with_rack move type`);
  
  try {
    // First check if jack is down (required for align_with_rack)
    logWorkflow(workflowId, `⚠️ SAFETY CHECK: Verifying jack state before rack alignment...`);
    try {
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up === true) {
        logWorkflow(workflowId, `⚠️ Jack is currently UP but should be DOWN for rack alignment. Running explicit jack_down.`);
        await executeJackDown(workflowId);
      } else {
        logWorkflow(workflowId, `✅ Jack is in DOWN state - ready to proceed with rack alignment`);
      }
    } catch (jackCheckError: any) {
      logWorkflow(workflowId, `⚠️ Warning: Could not check jack state: ${jackCheckError.message}`);
      // Try jack_down anyway to be safe
      try {
        await executeJackDown(workflowId);
      } catch (jackDownError: any) {
        logWorkflow(workflowId, `⚠️ Warning: Failed to lower jack: ${jackDownError.message}`);
        // Continue anyway - the align operation will fail if jack isn't down
      }
    }
    
    // Get rack specifications from the robot system settings
    let rackSpecs = null;
    try {
      logWorkflow(workflowId, `Getting rack specifications for proper rack alignment...`);
      rackSpecs = await getRackSpecifications();
      logWorkflow(workflowId, `✅ Successfully retrieved rack specifications: width=${rackSpecs.width}, depth=${rackSpecs.depth}, leg_shape=${rackSpecs.leg_shape}`);
    } catch (rackSpecsError: any) {
      logWorkflow(workflowId, `⚠️ Warning: Could not get rack specifications: ${rackSpecsError.message}`);
      // Will continue without rack specs, but expect the operation may fail
    }
    
    // Create align_with_rack move command with rack specs if available
    const alignCommand: any = {
      creator: 'workflow-service',
      type: 'align_with_rack', // Special move type for rack alignment
      target_x: x,
      target_y: y,
      target_ori: ori
    };
    
    // Add rack_specs if we have them - required parameter according to documentation
    if (rackSpecs) {
      alignCommand.rack_specs = rackSpecs;
    }
    
    logWorkflow(workflowId, `⚠️ RACK OPERATION: Creating align_with_rack move: ${JSON.stringify(alignCommand)}`);
    
    // Send the move command
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, alignCommand, { headers: getHeaders() });
    
    if (!response.data || !response.data.id) {
      throw new Error('Failed to create align_with_rack move - invalid response');
    }
    
    const moveId = response.data.id;
    logWorkflow(workflowId, `Robot align_with_rack command sent - move ID: ${moveId}`);
    
    // Wait for alignment to complete
    let moveComplete = false;
    let maxRetries = 120; // 2 minutes at 1 second intervals
    let attempts = 0;
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(workflowId, `⚠️ RACK ALIGNMENT: Current align_with_rack status: ${moveStatus}`);
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logWorkflow(workflowId, `✅ Robot has completed align_with_rack operation (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        const errorReason = statusResponse.data.fail_reason_str || 'Unknown failure';
        throw new Error(`Align with rack failed or was cancelled. Status: ${moveStatus} Reason: ${errorReason}`);
      } else {
        logWorkflow(workflowId, `Still aligning (move ID: ${moveId}), waiting...`);
      }
    }
    
    if (!moveComplete) {
      throw new Error(`Align with rack timed out after ${maxRetries} attempts`);
    }
    
    // Wait 3 seconds after alignment for stability
    logWorkflow(workflowId, `Waiting 3 seconds after alignment for stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return moveId;
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR during align_with_rack operation: ${error.message}`);
    throw error;
  }
}

/**
 * Execute to_unload_point operation for bin dropoff
 * This is specifically for the dropoff operation when the jack is UP
 */
async function moveToUnloadPoint(workflowId: string, x: number, y: number, ori: number, label: string): Promise<number> {
  logWorkflow(workflowId, `📦 Moving to unload point ${label} (${x}, ${y}) using special to_unload_point move type`);
  
  try {
    // First check if jack is up (required for to_unload_point)
    logWorkflow(workflowId, `⚠️ SAFETY CHECK: Verifying jack state before unload operation...`);
    try {
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up !== true) {
        logWorkflow(workflowId, `⚠️ ERROR: Jack is currently DOWN but should be UP for unload operation.`);
        throw new Error('Jack is not in UP state for unload operation');
      } else {
        logWorkflow(workflowId, `✅ Jack is in UP state - ready to proceed with unload operation`);
      }
    } catch (jackCheckError: any) {
      if (jackCheckError.message === 'Jack is not in UP state for unload operation') {
        throw jackCheckError;
      }
      logWorkflow(workflowId, `⚠️ Warning: Could not check jack state: ${jackCheckError.message}`);
      // Continue anyway since we're fairly confident the jack is up based on the workflow steps
    }
    
    // Create to_unload_point move command
    const unloadCommand = {
      creator: 'workflow-service',
      type: 'to_unload_point', // Special move type for dropping off bins
      target_x: x,
      target_y: y,
      target_ori: ori
    };
    
    logWorkflow(workflowId, `⚠️ UNLOAD OPERATION: Creating to_unload_point move: ${JSON.stringify(unloadCommand)}`);
    
    // Send the move command
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, unloadCommand, { headers: getHeaders() });
    
    if (!response.data || !response.data.id) {
      throw new Error('Failed to create to_unload_point move - invalid response');
    }
    
    const moveId = response.data.id;
    logWorkflow(workflowId, `Robot unload command sent - move ID: ${moveId}`);
    
    // Wait for unload movement to complete
    let moveComplete = false;
    let maxRetries = 120; // 2 minutes at 1 second intervals
    let attempts = 0;
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(workflowId, `⚠️ UNLOAD OPERATION: Current to_unload_point status: ${moveStatus}`);
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logWorkflow(workflowId, `✅ Robot has completed to_unload_point operation (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        const errorReason = statusResponse.data.fail_reason_str || 'Unknown failure';
        throw new Error(`Unload operation failed or was cancelled. Status: ${moveStatus} Reason: ${errorReason}`);
      } else {
        logWorkflow(workflowId, `Still performing unload operation (move ID: ${moveId}), waiting...`);
      }
    }
    
    if (!moveComplete) {
      throw new Error(`Unload operation timed out after ${maxRetries} attempts`);
    }
    
    // Wait 3 seconds after unload movement for stability
    logWorkflow(workflowId, `Waiting 3 seconds after unload operation for stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return moveId;
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR during to_unload_point operation: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the robot jack up operation 
 */
async function executeJackUp(workflowId: string): Promise<void> {
  logWorkflow(workflowId, `🔼 Executing jack_up operation`);
  
  try {
    // Send jack_up command
    await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers: getHeaders() });
    
    // Wait for jack to complete operation (typically takes ~5 seconds)
    let jackComplete = false;
    let attempts = 0;
    const maxRetries = 20; // Up to 20 seconds
    
    while (!jackComplete && attempts < maxRetries) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Check jack state
        const jackRes = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
        const jackState = jackRes.data;
        
        logWorkflow(workflowId, `Current jack state: ${JSON.stringify(jackState)}`);
        
        if (jackState && jackState.is_up === true) {
          jackComplete = true;
          logWorkflow(workflowId, `✅ Jack up operation completed successfully`);
        } else {
          logWorkflow(workflowId, `Jack up operation in progress (attempt ${attempts}/${maxRetries})...`);
        }
      } catch (stateError: any) {
        logWorkflow(workflowId, `Warning: Could not check jack state: ${stateError.message}`);
        // Continue retrying despite error
      }
    }
    
    if (!jackComplete) {
      throw new Error(`Jack up operation did not complete after ${maxRetries} seconds`);
    }
    
    // Wait an additional 3 seconds for stability
    logWorkflow(workflowId, `Waiting 3 seconds after jack_up for stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR during jack_up operation: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the robot jack down operation
 */
async function executeJackDown(workflowId: string): Promise<void> {
  logWorkflow(workflowId, `🔽 Executing jack_down operation`);
  
  try {
    // Send jack_down command
    await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
    
    // Wait for jack to complete operation (typically takes ~5 seconds)
    let jackComplete = false;
    let attempts = 0;
    const maxRetries = 20; // Up to 20 seconds
    
    while (!jackComplete && attempts < maxRetries) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Check jack state
        const jackRes = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
        const jackState = jackRes.data;
        
        logWorkflow(workflowId, `Current jack state: ${JSON.stringify(jackState)}`);
        
        if (jackState && jackState.is_up === false) {
          jackComplete = true;
          logWorkflow(workflowId, `✅ Jack down operation completed successfully`);
        } else {
          logWorkflow(workflowId, `Jack down operation in progress (attempt ${attempts}/${maxRetries})...`);
        }
      } catch (stateError: any) {
        logWorkflow(workflowId, `Warning: Could not check jack state: ${stateError.message}`);
        // Continue retrying despite error
      }
    }
    
    if (!jackComplete) {
      throw new Error(`Jack down operation did not complete after ${maxRetries} seconds`);
    }
    
    // Wait an additional 3 seconds for stability
    logWorkflow(workflowId, `Waiting 3 seconds after jack_down for stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR during jack_down operation: ${error.message}`);
    throw error;
  }
}

/**
 * Return robot to charging station with multiple fallback methods
 * @param workflowId The workflow ID for logging
 * @param chargerX X-coordinate of the charger (optional if using API methods)
 * @param chargerY Y-coordinate of the charger (optional if using API methods)
 * @param chargerOri Orientation of the charger (optional if using API methods)
 */
async function returnToCharger(workflowId: string, chargerX?: number, chargerY?: number, chargerOri?: number): Promise<void> {
  logWorkflow(workflowId, `🔋 Starting return to charger operation...`);
  
  try {
    // Cancelling any current moves first
    logWorkflow(workflowId, `Cancelling any current moves first`);
    try {
      await axios.patch(
        `${ROBOT_API_URL}/chassis/moves/current`,
        { state: "cancelled" },
        { headers: getHeaders() }
      );
      // Wait for move cancellation to take effect
      logWorkflow(workflowId, `Waiting for move cancellation to take effect...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      logWorkflow(workflowId, `Warning: Couldn't cancel current move: ${error.message}`);
    }
    
    // SAFETY CHECK: Make sure jack is down before returning to charger
    logWorkflow(workflowId, `🔋 SAFETY CHECK: Verifying jack is in down state before returning to charger...`);
    try {
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up === true) {
        logWorkflow(workflowId, `⚠️ Jack is currently UP - must lower jack before returning to charger`);
        await executeJackDown(workflowId);
      } else {
        logWorkflow(workflowId, `✅ Jack is already DOWN - safe to return to charger`);
      }
    } catch (error: any) {
      logWorkflow(workflowId, `⚠️ Warning: Unable to verify jack state: ${error.message}`);
      logWorkflow(workflowId, `⚠️ Will attempt explicit jack_down operation for safety...`);
      
      try {
        // Send jack_down command
        await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
        logWorkflow(workflowId, `Precautionary jack down operation started, waiting 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        logWorkflow(workflowId, `✅ Completed precautionary jack down operation`);
      } catch (jackError: any) {
        logWorkflow(workflowId, `Warning: Failed to perform precautionary jack_down: ${jackError.message}`);
        // Continue with charger return despite error
      }
    }
    
    // METHOD 1: Try to use the services/return_to_charger API endpoint (newest method)
    logWorkflow(workflowId, `🔋 METHOD 1: Using services API to return to charger`);
    try {
      const serviceResponse = await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { 
        headers: getHeaders() 
      });
      
      logWorkflow(workflowId, `✅ Return to charger command sent via services API`);
      
      // Wait for the robot to start moving to the charger
      logWorkflow(workflowId, `Waiting for robot to begin charger return...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Wait for charging state
      logWorkflow(workflowId, `Waiting for robot to reach charger (up to 3 minutes)...`);
      let chargerReached = false;
      let attempts = 0;
      const maxRetries = 36; // 3 minutes at 5-second intervals
      
      while (!chargerReached && attempts < maxRetries) {
        attempts++;
        try {
          const chargeResponse = await axios.get(`${ROBOT_API_URL}/charging_state`, { 
            headers: getHeaders() 
          });
          
          if (chargeResponse.data && chargeResponse.data.is_charging) {
            chargerReached = true;
            logWorkflow(workflowId, `✅ Confirmed: Robot is now charging via services API method!`);
          } else {
            logWorkflow(workflowId, `Still returning to charger via services API... (attempt ${attempts}/${maxRetries})`);
          }
        } catch (error: any) {
          logWorkflow(workflowId, `Warning: Error checking charging status: ${error.message}`);
        }
        
        if (!chargerReached) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (chargerReached) {
        return; // Success! No need to try other methods
      } else {
        logWorkflow(workflowId, `Method 1 (services API) did not reach charging state after 3 minutes, trying next method...`);
      }
    } catch (serviceError: any) {
      logWorkflow(workflowId, `Warning: Services API method failed: ${serviceError.message}`);
      // Will fall through to next method
    }
    
    // METHOD 2: Fall back to task API with runType 25 (charging task type)
    logWorkflow(workflowId, `🔋 METHOD 2: Using task API with runType 25 (charging task)`);
    try {
      // Create a task with runType 25 (charging) as per documentation
      const chargingTask = {
        runType: 25, // Charging task type
        name: `Return to Charger (${new Date().toISOString()})`,
        robotSn: ROBOT_SERIAL,
        taskPriority: 10, // High priority for charging
        isLoop: false
      };
      
      const taskResponse = await axios.post(`${ROBOT_API_URL}/api/v2/task`, chargingTask, {
        headers: getHeaders()
      });
      
      logWorkflow(workflowId, `✅ Return to charger command sent via task API`);
      
      // Wait for the task to be processed
      logWorkflow(workflowId, `Waiting for task to be processed...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Wait for charging state
      logWorkflow(workflowId, `Waiting for robot to reach charger via task API (up to 3 minutes)...`);
      let chargerReached = false;
      let attempts = 0;
      const maxRetries = 36; // 3 minutes at 5-second intervals
      
      while (!chargerReached && attempts < maxRetries) {
        attempts++;
        try {
          const chargeResponse = await axios.get(`${ROBOT_API_URL}/charging_state`, { 
            headers: getHeaders() 
          });
          
          if (chargeResponse.data && chargeResponse.data.is_charging) {
            chargerReached = true;
            logWorkflow(workflowId, `✅ Confirmed: Robot is now charging via task API method!`);
          } else {
            logWorkflow(workflowId, `Still returning to charger via task API... (attempt ${attempts}/${maxRetries})`);
          }
        } catch (error: any) {
          logWorkflow(workflowId, `Warning: Error checking charging status: ${error.message}`);
        }
        
        if (!chargerReached) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (chargerReached) {
        return; // Success! No need to try other methods
      } else {
        logWorkflow(workflowId, `Method 2 (task API) did not reach charging state after 3 minutes, trying next method...`);
      }
    } catch (taskError: any) {
      logWorkflow(workflowId, `Warning: Task API method failed: ${taskError.message}`);
      // Will fall through to next method
    }
    
    // METHOD 3: Fall back to the v1 charging API
    logWorkflow(workflowId, `🔋 METHOD 3: Using basic charge API endpoint`);
    try {
      const chargingResponse = await axios.post(`${ROBOT_API_URL}/charge`, {}, { headers: getHeaders() });
      
      logWorkflow(workflowId, `✅ Return to charger command sent via charge API`);
      
      // Wait for the command to take effect
      logWorkflow(workflowId, `Waiting for charge command to take effect...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Wait for charging state
      logWorkflow(workflowId, `Waiting for robot to reach charger via charge API (up to 3 minutes)...`);
      let chargerReached = false;
      let attempts = 0;
      const maxRetries = 36; // 3 minutes at 5-second intervals
      
      while (!chargerReached && attempts < maxRetries) {
        attempts++;
        try {
          const chargeResponse = await axios.get(`${ROBOT_API_URL}/charging_state`, { 
            headers: getHeaders() 
          });
          
          if (chargeResponse.data && chargeResponse.data.is_charging) {
            chargerReached = true;
            logWorkflow(workflowId, `✅ Confirmed: Robot is now charging via charge API method!`);
          } else {
            logWorkflow(workflowId, `Still returning to charger via charge API... (attempt ${attempts}/${maxRetries})`);
          }
        } catch (error: any) {
          logWorkflow(workflowId, `Warning: Error checking charging status: ${error.message}`);
        }
        
        if (!chargerReached) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (chargerReached) {
        return; // Success!
      } else {
        logWorkflow(workflowId, `Method 3 (charge API) did not reach charging state after 3 minutes.`);
      }
    } catch (chargeError: any) {
      logWorkflow(workflowId, `Warning: Charge API method failed: ${chargeError.message}`);
    }
    
    // METHOD 4: Last resort - use coordinates if available
    if (chargerX !== undefined && chargerY !== undefined && chargerOri !== undefined) {
      logWorkflow(workflowId, `🔋 METHOD 4: Using coordinate-based move with charge type`);
      try {
        // Create a charge move (special move type for returning to charger)
        logWorkflow(workflowId, `Creating 'charge' move to charger at (${chargerX}, ${chargerY}), orientation: ${chargerOri}`);
        const chargeCommand = {
          creator: 'workflow-service',
          type: 'charge', // Special move type for charger docking
          target_x: chargerX,
          target_y: chargerY,
          target_ori: chargerOri,
          charge_retry_count: 3 // Allow up to 3 retry attempts for docking
        };
        
        // Send charge command
        const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers: getHeaders() });
        
        if (!response.data || !response.data.id) {
          throw new Error('Failed to create charge move command');
        }
        
        const moveId = response.data.id;
        logWorkflow(workflowId, `Charge command sent - move ID: ${moveId}`);
        
        // Wait for charge move to complete
        let moveComplete = false;
        let attempts = 0;
        const maxRetries = 180; // 3 minutes at 1 second intervals
        
        while (!moveComplete && attempts < maxRetries) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            // Check move status
            const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
            const moveStatus = statusResponse.data.state;
            
            logWorkflow(workflowId, `Current charger return status: ${moveStatus}`);
            
            if (moveStatus === 'succeeded') {
              moveComplete = true;
              logWorkflow(workflowId, `🔋 ✅ Robot has successfully returned to charger (ID: ${moveId})`);
            } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
              const reason = statusResponse.data.fail_reason_str || 'Unknown reason';
              throw new Error(`Return to charger failed or was cancelled. Status: ${moveStatus} Reason: ${reason}`);
            } else {
              logWorkflow(workflowId, `Still moving to charger (move ID: ${moveId}), waiting...`);
            }
          } catch (error: any) {
            if (error.message.includes('Return to charger failed')) {
              throw error;
            }
            logWorkflow(workflowId, `Error checking charger return status: ${error.message}`);
            // Continue checking despite error
          }
        }
        
        if (!moveComplete) {
          throw new Error(`Return to charger timed out after ${maxRetries} seconds`);
        }
        
        // Verify charging status
        try {
          const chargeResponse = await axios.get(`${ROBOT_API_URL}/charging_state`, { headers: getHeaders() });
          const chargingState = chargeResponse.data;
          
          if (chargingState && chargingState.is_charging) {
            logWorkflow(workflowId, `✅ Robot is successfully charging`);
          } else {
            logWorkflow(workflowId, `⚠️ Warning: Robot returned to charger but may not be charging`);
          }
        } catch (error: any) {
          logWorkflow(workflowId, `Warning: Could not check charging status: ${error.message}`);
        }
      } catch (moveError: any) {
        logWorkflow(workflowId, `Warning: Coordinate-based charge move failed: ${moveError.message}`);
        throw new Error(`All return to charger methods failed. Robot may not be able to return to charger automatically.`);
      }
    } else {
      // If we reach here, all methods have failed and we don't have coordinates
      logWorkflow(workflowId, `❌ All return to charger methods failed and no coordinates were provided.`);
      throw new Error(`All return to charger methods failed. Robot may not be able to return to charger automatically.`);
    }
    
  } catch (error: any) {
    logWorkflow(workflowId, `❌ ERROR returning to charger: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the pickup workflow (shelf → pickup → dropoff → return to charger)
 */
async function executePickupWorkflow(
  workflowId: string, 
  serviceType: ServiceType,
  floorId: string,
  shelfId: string
): Promise<any> {
  try {
    // Initialize workflow state
    const workflow: WorkflowState = {
      id: workflowId,
      serviceType,
      operationType: 'pickup',
      floorId,
      shelfId,
      startTime: new Date(),
      status: 'in-progress',
      currentStep: 1,
      totalSteps: 8
    };
    
    workflowStates[workflowId] = workflow;
    
    // Load map data
    const mapPoints = await getMapPoints();
    const floorPoints = mapPoints[floorId];
    
    if (!floorPoints) {
      throw new Error(`Floor "${floorId}" not found in available maps`);
    }
    
    // Find the shelf point
    const shelfPoint = floorPoints.shelfPoints.find(p => p.id.includes(shelfId));
    if (!shelfPoint) {
      throw new Error(`Shelf point "${shelfId}" not found on floor "${floorId}"`);
    }
    
    // For Map ID "3" (Phil's Map), add special handling for MongoDB ObjectIds
    // Process points for this map
    if (floorId) {
      logWorkflow(workflowId, `📝 Processing points for map ${floorId}`);
    }
    
    // Find the corresponding docking point for this shelf using our enhanced function
    let shelfDockingPoint = getDockingPointForShelf(shelfId, floorPoints, floorId);
    if (!shelfDockingPoint) {
      throw new Error(`Docking point for shelf "${shelfId}" not found and could not be created`);
    }
    
    // Ensure we have required dropoff points
    if (!floorPoints.dropoffPoint) {
      throw new Error(`Dropoff point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.dropoffDockingPoint) {
      throw new Error(`Dropoff docking point not found on floor "${floorId}"`);
    }
    
    // Check for charger point - but make it optional
    if (!floorPoints.chargerPoint) {
      logWorkflow(workflowId, `⚠️ Warning: No charger point found on floor "${floorId}". Will skip return to charger step.`);
    }
    
    // Start pickup workflow
    logWorkflow(workflowId, `🚀 Starting ${serviceType} pickup workflow from shelf ${shelfId} on floor ${floorId}`);
    
    // STEP 1: Move to shelf docking point
    logWorkflow(workflowId, `📍 STEP 1/8: Moving to shelf docking point: ${shelfDockingPoint.id}`);
    workflow.currentStep = 1;
    await moveToPoint(
      workflowId,
      shelfDockingPoint.x,
      shelfDockingPoint.y,
      shelfDockingPoint.ori,
      shelfDockingPoint.id
    );
    
    // Allow a brief pause for stability
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // STEP 2: Use align_with_rack for precise shelf alignment
    logWorkflow(workflowId, `📍 STEP 2/8: Aligning with shelf ${shelfId} for pickup`);
    workflow.currentStep = 2;
    await alignWithRackForPickup(
      workflowId,
      shelfPoint.x,
      shelfPoint.y,
      shelfPoint.ori,
      shelfId
    );
    
    // STEP 3: Execute jack_up to lift bin
    logWorkflow(workflowId, `📍 STEP 3/8: Executing jack_up to lift bin`);
    workflow.currentStep = 3;
    await executeJackUp(workflowId);
    
    // STEP 4: Move to dropoff docking point
    logWorkflow(workflowId, `📍 STEP 4/8: Moving to dropoff docking point`);
    workflow.currentStep = 4;
    await moveToPoint(
      workflowId,
      floorPoints.dropoffDockingPoint.x,
      floorPoints.dropoffDockingPoint.y,
      floorPoints.dropoffDockingPoint.ori,
      'drop-off_load_docking'
    );
    
    // STEP 5: Move to dropoff point with to_unload_point
    logWorkflow(workflowId, `📍 STEP 5/8: Moving to dropoff point`);
    workflow.currentStep = 5;
    await moveToUnloadPoint(
      workflowId,
      floorPoints.dropoffPoint.x,
      floorPoints.dropoffPoint.y,
      floorPoints.dropoffPoint.ori,
      'drop-off_load'
    );
    
    // STEP 6: Execute jack_down to lower bin
    logWorkflow(workflowId, `📍 STEP 6/8: Executing jack_down to lower bin`);
    workflow.currentStep = 6;
    await executeJackDown(workflowId);
    
    // STEP 7: Move away from dropoff (safety step)
    logWorkflow(workflowId, `📍 STEP 7/8: Moving away from dropoff area (safety step)`);
    workflow.currentStep = 7;
    // Move back to docking point as a safe intermediate position
    await moveToPoint(
      workflowId,
      floorPoints.dropoffDockingPoint.x,
      floorPoints.dropoffDockingPoint.y,
      floorPoints.dropoffDockingPoint.ori,
      'drop-off_load_docking (safe position)'
    );
    
    // STEP 8: Return to charger (if available)
    workflow.currentStep = 8;
    if (floorPoints.chargerPoint) {
      logWorkflow(workflowId, `📍 STEP 8/8: Returning to charging station`);
      await returnToCharger(
        workflowId,
        floorPoints.chargerPoint.x,
        floorPoints.chargerPoint.y,
        floorPoints.chargerPoint.ori
      );
    } else {
      logWorkflow(workflowId, `📍 STEP 8/8: Skipping return to charger as no charger point is available on this floor`);
      // Stay at the last safe position
    }
    
    // Workflow complete
    workflow.endTime = new Date();
    workflow.status = 'completed';
    
    logWorkflow(workflowId, `✅ ${serviceType} pickup workflow completed successfully!`);
    
    return {
      success: true,
      workflowId: workflowId,
      message: `${serviceType} pickup workflow completed successfully`
    };
    
  } catch (error: any) {
    // Update workflow state with error
    if (workflowStates[workflowId]) {
      workflowStates[workflowId].status = 'failed';
      workflowStates[workflowId].error = error.message;
      workflowStates[workflowId].endTime = new Date();
    }
    
    logWorkflow(workflowId, `❌ ${serviceType} pickup workflow failed: ${error.message}`);
    
    // Try emergency return to charger if available
    try {
      const mapPoints = await getMapPoints();
      const floorPoints = mapPoints[floorId];
      
      if (floorPoints && floorPoints.chargerPoint) {
        logWorkflow(workflowId, `⚠️ Attempting emergency return to charger...`);
        await returnToCharger(
          workflowId,
          floorPoints.chargerPoint.x,
          floorPoints.chargerPoint.y,
          floorPoints.chargerPoint.ori
        );
        logWorkflow(workflowId, `✅ Emergency return to charger successful`);
      }
    } catch (chargerError: any) {
      logWorkflow(workflowId, `❌ Emergency return to charger failed: ${chargerError.message}`);
    }
    
    throw error;
  }
}

/**
 * Execute the dropoff workflow (pickup → shelf → return to charger)
 */
async function executeDropoffWorkflow(
  workflowId: string, 
  serviceType: ServiceType,
  floorId: string,
  shelfId: string
): Promise<any> {
  try {
    // Initialize workflow state
    const workflow: WorkflowState = {
      id: workflowId,
      serviceType,
      operationType: 'dropoff',
      floorId,
      shelfId,
      startTime: new Date(),
      status: 'in-progress',
      currentStep: 1,
      totalSteps: 8
    };
    
    workflowStates[workflowId] = workflow;
    
    // Load map data
    const mapPoints = await getMapPoints();
    const floorPoints = mapPoints[floorId];
    
    if (!floorPoints) {
      throw new Error(`Floor "${floorId}" not found in available maps`);
    }
    
    // Find the shelf point
    const shelfPoint = floorPoints.shelfPoints.find(p => p.id.includes(shelfId));
    if (!shelfPoint) {
      throw new Error(`Shelf point "${shelfId}" not found on floor "${floorId}"`);
    }
    
    // For Map ID "3" (Phil's Map), add special handling for MongoDB ObjectIds
    // Process points for this map
    if (floorId) {
      logWorkflow(workflowId, `📝 Processing points for map ${floorId}`);
    }
    
    // Find the corresponding docking point for this shelf using our enhanced function
    let shelfDockingPoint = getDockingPointForShelf(shelfId, floorPoints, floorId);
    if (!shelfDockingPoint) {
      throw new Error(`Docking point for shelf "${shelfId}" not found and could not be created`);
    }
    
    // Ensure we have required pickup points
    if (!floorPoints.pickupPoint) {
      throw new Error(`Pickup point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.pickupDockingPoint) {
      throw new Error(`Pickup docking point not found on floor "${floorId}"`);
    }
    
    // Check for charger point - but make it optional
    if (!floorPoints.chargerPoint) {
      logWorkflow(workflowId, `⚠️ Warning: No charger point found on floor "${floorId}". Will skip return to charger step.`);
    }
    
    // Start dropoff workflow
    logWorkflow(workflowId, `🚀 Starting ${serviceType} dropoff workflow to shelf ${shelfId} on floor ${floorId}`);
    
    // STEP 1: Move to pickup docking point
    logWorkflow(workflowId, `📍 STEP 1/8: Moving to pickup docking point`);
    workflow.currentStep = 1;
    await moveToPoint(
      workflowId,
      floorPoints.pickupDockingPoint.x,
      floorPoints.pickupDockingPoint.y,
      floorPoints.pickupDockingPoint.ori,
      'pick-up_load_docking'
    );
    
    // Allow a brief pause for stability
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // STEP 2: Use align_with_rack for precise pickup alignment
    logWorkflow(workflowId, `📍 STEP 2/8: Aligning with pickup point for bin pickup`);
    workflow.currentStep = 2;
    await alignWithRackForPickup(
      workflowId,
      floorPoints.pickupPoint.x,
      floorPoints.pickupPoint.y,
      floorPoints.pickupPoint.ori,
      'pick-up_load'
    );
    
    // STEP 3: Execute jack_up to lift bin
    logWorkflow(workflowId, `📍 STEP 3/8: Executing jack_up to lift bin`);
    workflow.currentStep = 3;
    await executeJackUp(workflowId);
    
    // STEP 4: Move to shelf docking point
    logWorkflow(workflowId, `📍 STEP 4/8: Moving to shelf docking point: ${shelfDockingPoint.id}`);
    workflow.currentStep = 4;
    await moveToPoint(
      workflowId,
      shelfDockingPoint.x,
      shelfDockingPoint.y,
      shelfDockingPoint.ori,
      shelfDockingPoint.id
    );
    
    // STEP 5: Move to shelf point with to_unload_point
    logWorkflow(workflowId, `📍 STEP 5/8: Moving to shelf point ${shelfId} for dropoff`);
    workflow.currentStep = 5;
    await moveToUnloadPoint(
      workflowId,
      shelfPoint.x,
      shelfPoint.y,
      shelfPoint.ori,
      shelfId
    );
    
    // STEP 6: Execute jack_down to lower bin
    logWorkflow(workflowId, `📍 STEP 6/8: Executing jack_down to lower bin`);
    workflow.currentStep = 6;
    await executeJackDown(workflowId);
    
    // STEP 7: Move away from shelf (safety step)
    logWorkflow(workflowId, `📍 STEP 7/8: Moving away from shelf area (safety step)`);
    workflow.currentStep = 7;
    // Move back to docking point as a safe intermediate position
    await moveToPoint(
      workflowId,
      shelfDockingPoint.x,
      shelfDockingPoint.y,
      shelfDockingPoint.ori,
      `${shelfDockingPoint.id} (safe position)`
    );
    
    // STEP 8: Return to charger (if available)
    workflow.currentStep = 8;
    if (floorPoints.chargerPoint) {
      logWorkflow(workflowId, `📍 STEP 8/8: Returning to charging station`);
      await returnToCharger(
        workflowId,
        floorPoints.chargerPoint.x,
        floorPoints.chargerPoint.y,
        floorPoints.chargerPoint.ori
      );
    } else {
      logWorkflow(workflowId, `📍 STEP 8/8: Skipping return to charger as no charger point is available on this floor`);
      // Stay at the last safe position
    }
    
    // Workflow complete
    workflow.endTime = new Date();
    workflow.status = 'completed';
    
    logWorkflow(workflowId, `✅ ${serviceType} dropoff workflow completed successfully!`);
    
    return {
      success: true,
      workflowId: workflowId,
      message: `${serviceType} dropoff workflow completed successfully`
    };
    
  } catch (error: any) {
    // Update workflow state with error
    if (workflowStates[workflowId]) {
      workflowStates[workflowId].status = 'failed';
      workflowStates[workflowId].error = error.message;
      workflowStates[workflowId].endTime = new Date();
    }
    
    logWorkflow(workflowId, `❌ ${serviceType} dropoff workflow failed: ${error.message}`);
    
    // Try emergency return to charger if available
    try {
      const mapPoints = await getMapPoints();
      const floorPoints = mapPoints[floorId];
      
      if (floorPoints && floorPoints.chargerPoint) {
        logWorkflow(workflowId, `⚠️ Attempting emergency return to charger...`);
        await returnToCharger(
          workflowId,
          floorPoints.chargerPoint.x,
          floorPoints.chargerPoint.y,
          floorPoints.chargerPoint.ori
        );
        logWorkflow(workflowId, `✅ Emergency return to charger successful`);
      }
    } catch (chargerError: any) {
      logWorkflow(workflowId, `❌ Emergency return to charger failed: ${chargerError.message}`);
    }
    
    throw error;
  }
}

/**
 * Register the dynamic workflow API routes
 */
export function registerDynamicWorkflowRoutes(app: express.Express): void {
  // Common response handler function
  const handleWorkflowRequest = async (
    req: express.Request,
    res: express.Response,
    workflowFn: Function
  ) => {
    const startTime = Date.now();
    
    try {
      // Generate a unique workflow ID
      const workflowId = uuidv4().substring(0, 8);
      
      // Extract parameters
      const { serviceType, operationType, floorId, shelfId } = req.body;
      
      // Validation
      if (!serviceType || !['laundry', 'trash'].includes(serviceType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid service type. Must be "laundry" or "trash"'
        });
      }
      
      if (!operationType || !['pickup', 'dropoff'].includes(operationType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid operation type. Must be "pickup" or "dropoff"'
        });
      }
      
      if (!floorId) {
        return res.status(400).json({
          success: false,
          error: 'Floor ID is required'
        });
      }
      
      if (!shelfId) {
        return res.status(400).json({
          success: false,
          error: 'Shelf ID is required'
        });
      }
      
      // We use the map ID directly as provided by the robot API
      // The floorId should be the actual map ID from the robot's maps list
      const mapId = floorId;
      console.log(`Using map ID ${mapId} for robot API calls`);
      
      // Execute the workflow (which will handle logging itself)
      const result = await workflowFn(workflowId, serviceType, mapId, shelfId);
      
      // Return result
      return res.status(200).json({
        success: true,
        workflowId,
        message: result.message,
        duration: Date.now() - startTime
      });
      
    } catch (error: any) {
      console.error(`Workflow error:`, error);
      
      // Return error to client
      return res.status(500).json({
        success: false,
        error: error.message || 'Unknown workflow error',
        duration: Date.now() - startTime
      });
    }
  };
  
  // Route for executing a pickup workflow
  app.post('/api/workflow/pickup', async (req, res) => {
    return handleWorkflowRequest(req, res, executePickupWorkflow);
  });
  
  // Route for executing a dropoff workflow
  app.post('/api/workflow/dropoff', async (req, res) => {
    return handleWorkflowRequest(req, res, executeDropoffWorkflow);
  });
  
  // Route for getting map information (floors and points)
  app.get('/api/workflow/maps', async (req, res) => {
    try {
      // Get real map points from robot API - no fallback data
      const mapPoints = await getMapPoints();
      
      // Transform into a more user-friendly format and prioritize the active map (Map 3)
      const mapData = Object.keys(mapPoints)
        // Sort maps numerically to ensure consistent ordering
        .sort((a, b) => {
          // If both are numeric, sort numerically
          if (!isNaN(parseInt(a)) && !isNaN(parseInt(b))) {
            return parseInt(a) - parseInt(b);
          }
          // If only a is numeric, put it first
          if (!isNaN(parseInt(a))) return -1;
          // If only b is numeric, put it first
          if (!isNaN(parseInt(b))) return 1;
          // Otherwise sort alphabetically
          return a.localeCompare(b);
        })
        .map(mapId => {
          const mapData = mapPoints[mapId];
          
          // Log what we found for debugging
          console.log(`Map ID ${mapId} has ${mapData.shelfPoints.length} shelf points`);
          if (mapData.shelfPoints.length > 0) {
            console.log(`First shelf point: ${JSON.stringify(mapData.shelfPoints[0])}`);
          }
          
          // Make a more descriptive name based on the map ID
          let mapName = "Map " + mapId;
          // Use a generic but user-friendly map name
          // Note: If we had access to the map metadata we could use the actual map name
          
          return {
            id: mapId, // Use actual map ID for all operations 
            name: mapName,
            hasCharger: !!mapData.chargerPoint,
            hasDropoff: !!mapData.dropoffPoint,
            hasPickup: !!mapData.pickupPoint,
            shelfPoints: mapData.shelfPoints.map((p, index) => {
              // Try to make a user-friendly display name
              let displayName = p.id;
              
              // Check for different ID patterns:
              
              // Case 1: If ID contains '_load', extract the number before it (e.g. "104_load" -> "104")
              if (p.id.toLowerCase().includes('_load')) {
                displayName = p.id.split('_')[0];
              } 
              // Case 2: If it's a simple numeric ID, use it directly
              else if (/^\d+$/.test(p.id)) {
                displayName = p.id;
              }
              // Case A: MongoDB ObjectId format (24 chars, hexadecimal)
              else if (p.id.length === 24 && /^[0-9a-f]{24}$/i.test(p.id)) {
                // For MongoDB ObjectId formatted points, give a simple numerical identifier
                displayName = (index === 0) ? "Shelf 1" : `Point ${index + 1}`;
              }
              // Case B: UUID format (with or without hyphens)
              else if ((p.id.length === 36 && p.id.includes('-')) || 
                      (p.id.length === 32 && /^[0-9a-f]{32}$/i.test(p.id))) {
                displayName = `Point ${index + 1}`;
              }
              // Case C: Any other long ID (over 10 chars)
              else if (p.id.length > 10) {
                // Try to extract any numeric parts for a more meaningful name
                const numericPart = p.id.match(/\d+/);
                if (numericPart) {
                  displayName = `Point ${numericPart[0]}`;
                } else {
                  displayName = `Point ${index + 1}`;
                }
              }
              
              return {
                id: p.id,
                displayName: displayName,
                // Include coordinates for reference but don't expose in UI
                x: p.x,
                y: p.y,
                ori: p.ori
              };
            })
          };
        });
      
      // Return real map data from the robot
      return res.status(200).json({
        success: true,
        maps: mapData
      });
      
    } catch (error: any) {
      console.error('Error fetching actual robot map data:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to get robot map data: ${error.message}`,
        message: 'Unable to retrieve floor and shelf data from robot. Please check robot connectivity.'
      });
    }
  });
  
  // Route for getting workflow status
  app.get('/api/workflow/:workflowId', (req, res) => {
    const { workflowId } = req.params;
    
    if (!workflowId || !workflowStates[workflowId]) {
      return res.status(404).json({
        success: false,
        error: `Workflow with ID ${workflowId} not found`
      });
    }
    
    return res.status(200).json({
      success: true,
      workflow: workflowStates[workflowId]
    });
  });
  
  console.log('✅ Registered dynamic workflow API routes');
}

/**
 * Execute a workflow with the given parameters
 * This function is called from the simplified-workflow UI
 */
export async function executeWorkflow(
  workflowType: string, 
  params: {
    serviceType: string,
    operationType: string,
    floorId: string,
    shelfId: string,
    pickupShelf?: string,  // For transfer operations: source shelf
    dropoffShelf?: string, // For transfer operations: destination shelf (same as shelfId)
    sourceFloorId?: string // For transfer operations: floor of the source shelf
  }
): Promise<{
  success: boolean,
  missionId: string,
  message: string
}> {
  try {
    console.log(`[DYNAMIC-WORKFLOW] Executing workflow ${workflowType} with params:`, params);
    
    // Create a unique workflow ID
    const workflowId = uuidv4();
    
    // Initialize workflow state
    workflowStates[workflowId] = {
      id: workflowId,
      serviceType: params.serviceType as ServiceType,
      operationType: params.operationType as OperationType,
      floorId: params.floorId,
      shelfId: params.shelfId,
      startTime: new Date(),
      status: 'queued',
      currentStep: 0,
      totalSteps: 5 // Placeholder, will be updated based on workflow
    };
    
    // Log the workflow start
    logWorkflow(workflowId, `Starting workflow ${workflowType} with params: ${JSON.stringify(params)}`);
    
    // Execute the appropriate workflow based on type
    let missionId: string;
    let workflowSteps: MissionStep[] = [];
    
    // First, cancel any existing missions for safety
    await missionQueue.cancelAllActiveMissions();
    logWorkflow(workflowId, `✅ Cancelled any existing active missions`);
    
    if (workflowType === 'zone-104-workflow') {
      // Create a mission with steps to pick up from Zone 104 and return to charger
      const missionName = `Zone 104 Workflow (${params.shelfId}) - Dynamic execution`;
      
      // Get coordinates for the shelf points
      const shelfPoint = await getShelfPoint(params.shelfId);
      const dockingPoint = await getShelfDockingPoint(params.shelfId);
      
      if (!shelfPoint || !dockingPoint) {
        throw new Error(`Could not find shelf point or docking point for ${params.shelfId}`);
      }
      
      // Build standard Zone 104 workflow steps
      workflowSteps = [
        {
          type: 'move',
          params: {
            x: dockingPoint.x,
            y: dockingPoint.y,
            ori: dockingPoint.theta, // Using theta from the point
            label: `Docking at ${params.shelfId}`
          },
          completed: false,
          retryCount: 0
        },
        {
          type: 'align_with_rack',
          params: {
            x: shelfPoint.x,
            y: shelfPoint.y,
            ori: shelfPoint.theta, // Using theta from the point
            label: `Aligning with shelf ${params.shelfId}`
          },
          completed: false,
          retryCount: 0
        },
        {
          type: 'jack_up',
          params: {
            waitComplete: true
          },
          completed: false,
          retryCount: 0
        },
        // Add other steps like moving to dropoff point, etc.
        {
          type: 'return_to_charger',
          params: {},
          completed: false,
          retryCount: 0
        }
      ];
      
      // Create the mission directly
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      missionId = mission.id;
      logWorkflow(workflowId, `✅ Created mission with ID: ${missionId} and ${workflowSteps.length} steps`);
    } 
    else if (workflowType === 'pickup-to-104-workflow') {
      // Create a mission for pickup to 104 workflow
      const missionName = `Pickup to 104 Workflow (${params.shelfId})`;
      
      // Similar to Zone 104 but with different steps
      // Build appropriate steps based on pickup to 104 workflow
      workflowSteps = [
        // Steps would come here based on the workflow logic
        {
          type: 'return_to_charger',
          params: {},
          completed: false,
          retryCount: 0
        }
      ];
      
      // Create the mission directly
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      missionId = mission.id;
      logWorkflow(workflowId, `✅ Created pickup-to-104 mission with ID: ${missionId}`);
    }
    else if (workflowType === 'shelf-to-central' || workflowType === 'central-to-shelf') {
      // Create a mission for shelf to central or central to shelf
      const missionName = `${workflowType} Workflow (${params.shelfId})`;
      
      // Build appropriate steps based on workflow type
      workflowSteps = [
        // Steps would come here based on the workflow logic
        {
          type: 'return_to_charger',
          params: {},
          completed: false,
          retryCount: 0
        }
      ];
      
      // Create the mission directly
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      missionId = mission.id;
      logWorkflow(workflowId, `✅ Created ${workflowType} mission with ID: ${missionId}`);
    }
    else if (workflowType === 'shelf-to-shelf') {
      // Create a mission for shelf to shelf transfer
      if (!params.pickupShelf) {
        throw new Error('Missing source shelf for shelf-to-shelf transfer');
      }
      
      const missionName = `Shelf-to-Shelf Transfer: ${params.pickupShelf} → ${params.shelfId}`;
      logWorkflow(workflowId, `Executing shelf-to-shelf transfer from ${params.pickupShelf} to ${params.shelfId}`);
      
      // Build appropriate steps for shelf to shelf transfer
      workflowSteps = [
        // Steps would come here based on the workflow logic
        {
          type: 'return_to_charger',
          params: {},
          completed: false,
          retryCount: 0
        }
      ];
      
      // Create the mission directly
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      missionId = mission.id;
      logWorkflow(workflowId, `✅ Created shelf-to-shelf mission with ID: ${missionId}`);
    }
    else {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }
    
    // Update workflow state
    workflowStates[workflowId].status = 'in-progress';
    
    return {
      success: true,
      missionId,
      message: `Workflow ${workflowType} execution started with ID ${missionId}`
    };
  } catch (error: any) {
    console.error(`[DYNAMIC-WORKFLOW] Error executing workflow:`, error);
    return {
      success: false,
      missionId: 'error',
      message: `Error executing workflow: ${error.message}`
    };
  }
}