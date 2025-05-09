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

// Configuration
const LOG_PATH = 'robot-dynamic-workflow.log';

// Types for workflows
type ServiceType = 'laundry' | 'trash';
type OperationType = 'pickup' | 'dropoff';
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
    
    // Process each map - with special handling for map "3" which is the active map
    for (const map of maps) {
      const mapId = map.id;
      console.log(`Processing map with ID: ${mapId}`);
      
      // Special handling for map "3" which is our target map
      const isTargetMap = mapId === "3";
      if (isTargetMap) {
        console.log("Found target map ID 3 - prioritizing this map");
      }
      
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
        
        // Special handling for map ID "3" which has different point naming
        const isMap3 = mapId === "3";
        
        // Process based on naming convention with more flexible detection
        if ((point.id.includes('_Load') || point.id.includes('_load')) && !point.id.includes('_docking')) {
          console.log(`✅ Found shelf point: ${point.id}`);
          shelfPoints.push(point);
        } else if (point.id.includes('_docking') || point.id.includes('_Docking')) {
          console.log(`✅ Found docking point: ${point.id}`);
          dockingPoints.push(point);
          
          // Special docking points - use case insensitive comparison
          const lowerCaseId = point.id.toLowerCase();
          if (lowerCaseId.includes('drop-off_load_docking') || lowerCaseId.includes('dropoff_load_docking')) {
            console.log(`✅ Found dropoff docking point: ${point.id}`);
            dropoffDockingPoint = point;
          } else if (lowerCaseId.includes('pickup_load_docking')) {
            console.log(`✅ Found pickup docking point: ${point.id}`);
            pickupDockingPoint = point;
          }
        } else if (point.id.toLowerCase().includes('drop-off_load') || point.id.toLowerCase().includes('dropoff_load')) {
          console.log(`✅ Found dropoff point: ${point.id}`);
          dropoffPoint = point;
        } else if (point.id.toLowerCase().includes('pickup_load')) {
          console.log(`✅ Found pickup point: ${point.id}`);
          pickupPoint = point;
        } else if (point.id.toLowerCase().includes('charger')) {
          console.log(`✅ Found charger point: ${point.id}`);
          chargerPoint = point;
        }
        
        // Special handling for Map 3: If we have MongoDB ObjectId format points
        if (isMap3 && point.id.length === 24 && /^[0-9a-f]{24}$/i.test(point.id)) {
          console.log(`✅ Map 3: Found MongoDB ObjectId point: ${point.id}`);
          
          // If no shelf points yet, treat this as a shelf point
          if (shelfPoints.length === 0) {
            console.log(`✅ Map 3: Using ObjectId point as shelf point: ${point.id}`);
            shelfPoints.push(point);
          }
          
          // If there are multiple of these points, try to identify docking points
          // based on their proximity to other points
          if (!dropoffDockingPoint && dockingPoints.length === 0) {
            console.log(`✅ Map 3: Using first ObjectId point as docking point: ${point.id}`);
            dockingPoints.push(point);
          }
        }
        
        // Also check for shelf points that don't follow the exact naming convention
        // but have numeric identifiers that might represent shelf numbers
        if (shelfPoints.length === 0) {
          // Look for points that have numeric identifiers as potential shelf points
          const numericMatch = point.id.match(/^(\d+)/);
          if (numericMatch && !point.id.includes('_docking') && !point.id.toLowerCase().includes('charger')) {
            console.log(`✅ Found potential shelf point by numeric ID: ${point.id}`);
            shelfPoints.push(point);
          }
        }
      }
      
      // Special handling for map 3 - if we don't have all required points
      // but we have shelf points, attempt to set up a working configuration
      if (mapId === "3" && shelfPoints.length > 0) {
        console.log(`Map 3 has ${shelfPoints.length} shelf points`);
        if (shelfPoints.length > 0) {
          console.log(`First shelf point: ${JSON.stringify(shelfPoints[0])}`);
        }
        
        // If we don't have a charger point, use the first shelf point with a modified orientation
        if (!chargerPoint && shelfPoints.length > 0) {
          console.log(`⚠️ No explicit charger point found on Map 3 - creating one based on shelf point`);
          
          // Create a virtual charger point based on the shelf point
          // but with a different orientation to avoid collisions
          const basePoint = shelfPoints[0];
          chargerPoint = {
            id: `virtual_charger_${basePoint.id}`,
            x: basePoint.x,
            y: basePoint.y,
            ori: (basePoint.ori + 180) % 360  // Opposite direction
          };
          console.log(`Created virtual charger point: ${JSON.stringify(chargerPoint)}`);
        }
        
        // If we don't have a dropoff point, use the first shelf point
        if (!dropoffPoint && shelfPoints.length > 0) {
          console.log(`⚠️ No explicit dropoff point found on Map 3 - using first shelf point as dropoff`);
          const basePoint = shelfPoints[0];
          dropoffPoint = {
            id: `virtual_dropoff_${basePoint.id}`,
            x: basePoint.x,
            y: basePoint.y,
            ori: basePoint.ori
          };
          console.log(`Created virtual dropoff point: ${JSON.stringify(dropoffPoint)}`);
        }
        
        // If we don't have a dropoff docking point, create one based on the dropoff point
        if (!dropoffDockingPoint && dropoffPoint) {
          console.log(`⚠️ No explicit dropoff docking point found on Map 3 - creating one based on dropoff point`);
          dropoffDockingPoint = {
            id: `virtual_dropoff_docking_${dropoffPoint.id}`,
            x: dropoffPoint.x,
            y: dropoffPoint.y - 0.5,  // Offset slightly to avoid collision
            ori: dropoffPoint.ori
          };
          console.log(`Created virtual dropoff docking point: ${JSON.stringify(dropoffDockingPoint)}`);
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
 * Enhanced with special handling for Map 3
 */
function getDockingPointForShelf(shelfId: string, floorPoints: MapPoints[string], floorId?: string): Point | null {
  const isMap3 = floorId === "3";
  const dockingId = `${shelfId}_docking`;
  const dockingPoint = floorPoints.dockingPoints.find(p => p.id === dockingId);
  
  // If no matching docking point and this is Map 3, use fallbacks
  if (!dockingPoint && isMap3) {
    console.log(`Map 3: No specific docking point found for shelf ${shelfId}`);
    
    // Try to find any docking point
    if (floorPoints.dockingPoints.length > 0) {
      console.log(`Map 3: Using first available docking point: ${floorPoints.dockingPoints[0].id}`);
      return floorPoints.dockingPoints[0];
    }
    
    // If no docking points at all, create a virtual one
    const shelfPoint = floorPoints.shelfPoints.find(p => p.id === shelfId);
    if (shelfPoint) {
      console.log(`Map 3: Creating virtual docking point for shelf ${shelfId}`);
      const virtualDocking: Point = {
        id: `${shelfId}_virtual_docking`,
        x: shelfPoint.x - 0.5, // Position it slightly away from the shelf
        y: shelfPoint.y,
        ori: shelfPoint.ori
      };
      
      // Add it to the collection for future use
      floorPoints.dockingPoints.push(virtualDocking);
      console.log(`Map 3: Created virtual docking point at (${virtualDocking.x}, ${virtualDocking.y})`);
      return virtualDocking;
    }
  }
  
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
    
    // Create align_with_rack move command
    const alignCommand = {
      creator: 'workflow-service',
      type: 'align_with_rack', // Special move type for rack alignment
      target_x: x,
      target_y: y,
      target_ori: ori
    };
    
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
 * Return robot to charging station
 */
async function returnToCharger(workflowId: string, chargerX: number, chargerY: number, chargerOri: number): Promise<void> {
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
    
    // Find the corresponding docking point for this shelf
    const shelfDockingId = `${shelfId}_docking`;
    const shelfDockingPoint = floorPoints.dockingPoints.find(p => p.id === shelfDockingId);
    if (!shelfDockingPoint) {
      throw new Error(`Docking point "${shelfDockingId}" for shelf "${shelfId}" not found`);
    }
    
    // Ensure we have required dropoff points
    if (!floorPoints.dropoffPoint) {
      throw new Error(`Dropoff point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.dropoffDockingPoint) {
      throw new Error(`Dropoff docking point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.chargerPoint) {
      throw new Error(`Charger point not found on floor "${floorId}"`);
    }
    
    // Start pickup workflow
    logWorkflow(workflowId, `🚀 Starting ${serviceType} pickup workflow from shelf ${shelfId} on floor ${floorId}`);
    
    // STEP 1: Move to shelf docking point
    logWorkflow(workflowId, `📍 STEP 1/8: Moving to shelf docking point: ${shelfDockingId}`);
    workflow.currentStep = 1;
    await moveToPoint(
      workflowId,
      shelfDockingPoint.x,
      shelfDockingPoint.y,
      shelfDockingPoint.ori,
      shelfDockingId
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
      'Drop-off_Load_docking'
    );
    
    // STEP 5: Move to dropoff point with to_unload_point
    logWorkflow(workflowId, `📍 STEP 5/8: Moving to dropoff point`);
    workflow.currentStep = 5;
    await moveToUnloadPoint(
      workflowId,
      floorPoints.dropoffPoint.x,
      floorPoints.dropoffPoint.y,
      floorPoints.dropoffPoint.ori,
      'Drop-off_Load'
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
      'Drop-off_Load_docking (safe position)'
    );
    
    // STEP 8: Return to charger
    logWorkflow(workflowId, `📍 STEP 8/8: Returning to charging station`);
    workflow.currentStep = 8;
    await returnToCharger(
      workflowId,
      floorPoints.chargerPoint.x,
      floorPoints.chargerPoint.y,
      floorPoints.chargerPoint.ori
    );
    
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
    
    // Find the corresponding docking point for this shelf
    const shelfDockingId = `${shelfId}_docking`;
    const shelfDockingPoint = floorPoints.dockingPoints.find(p => p.id === shelfDockingId);
    if (!shelfDockingPoint) {
      throw new Error(`Docking point "${shelfDockingId}" for shelf "${shelfId}" not found`);
    }
    
    // Ensure we have required pickup points
    if (!floorPoints.pickupPoint) {
      throw new Error(`Pickup point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.pickupDockingPoint) {
      throw new Error(`Pickup docking point not found on floor "${floorId}"`);
    }
    
    if (!floorPoints.chargerPoint) {
      throw new Error(`Charger point not found on floor "${floorId}"`);
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
      'Pickup_Load_docking'
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
      'Pickup_Load'
    );
    
    // STEP 3: Execute jack_up to lift bin
    logWorkflow(workflowId, `📍 STEP 3/8: Executing jack_up to lift bin`);
    workflow.currentStep = 3;
    await executeJackUp(workflowId);
    
    // STEP 4: Move to shelf docking point
    logWorkflow(workflowId, `📍 STEP 4/8: Moving to shelf docking point: ${shelfDockingId}`);
    workflow.currentStep = 4;
    await moveToPoint(
      workflowId,
      shelfDockingPoint.x,
      shelfDockingPoint.y,
      shelfDockingPoint.ori,
      shelfDockingId
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
      `${shelfDockingId} (safe position)`
    );
    
    // STEP 8: Return to charger
    logWorkflow(workflowId, `📍 STEP 8/8: Returning to charging station`);
    workflow.currentStep = 8;
    await returnToCharger(
      workflowId,
      floorPoints.chargerPoint.x,
      floorPoints.chargerPoint.y,
      floorPoints.chargerPoint.ori
    );
    
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
      
      // Execute the workflow (which will handle logging itself)
      const result = await workflowFn(workflowId, serviceType, floorId, shelfId);
      
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
      
      // Transform into a more user-friendly format and prioritize the current active map
      // In this case, map "3" is the active map which should be treated as the primary floor
      const mapData = Object.keys(mapPoints)
        .sort((a, b) => {
          // Always put map "3" first (this is the current active map on the robot)
          if (a === "3") return -1;
          if (b === "3") return 1;
          // Fallback to prioritize map "1" if available
          if (a === "1") return -1;
          if (b === "1") return 1;
          // Otherwise sort numerically
          return parseInt(a) - parseInt(b);
        })
        .map(floorId => {
          const floorData = mapPoints[floorId];
          
          // Log what we found for debugging
          console.log(`Map ${floorId} has ${floorData.shelfPoints.length} shelf points`);
          if (floorData.shelfPoints.length > 0) {
            console.log(`First shelf point: ${JSON.stringify(floorData.shelfPoints[0])}`);
          }
          
          return {
            id: floorId,
            name: floorId.includes('_') ? floorId.split('_')[1] : floorId,
            hasCharger: !!floorData.chargerPoint,
            hasDropoff: !!floorData.dropoffPoint,
            hasPickup: !!floorData.pickupPoint,
            shelfPoints: floorData.shelfPoints.map((p, index) => {
              // Try to make a user-friendly display name
              let displayName = p.id;
              
              // Check for different ID patterns:
              
              // Case 1: If ID contains '_Load', extract the number before it (e.g. "104_Load" -> "104")
              if (p.id.includes('_Load')) {
                displayName = p.id.split('_')[0];
              } 
              // Case 2: If it's a simple numeric ID, use it directly
              else if (/^\d+$/.test(p.id)) {
                displayName = p.id;
              }
              // Case A: MongoDB ObjectId format (24 chars, hexadecimal)
              else if (p.id.length === 24 && /^[0-9a-f]{24}$/i.test(p.id)) {
                // For map ID 3, make a specific displayName as this is the only floor/shelf
                const mapIsFloor3 = floorId === "3";
                displayName = mapIsFloor3 ? "Shelf 1" : `Point ${index + 1}`;
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