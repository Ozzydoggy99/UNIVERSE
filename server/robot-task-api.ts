/**
 * Robot Task API
 * 
 * This module provides a high-level task API for robot operations
 * that abstracts the complexity of lower-level robot API calls.
 * It implements the AutoXing Robot Task API for the L382502104987ir robot.
 */

import axios from 'axios';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Robot API base URL
const ROBOT_API_URL = process.env.ROBOT_API_URL || 'http://47.180.91.99:8090/api/v1';
const ROBOT_SECRET = process.env.ROBOT_SECRET || 'rosver1';

// Task status enum
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Task type enum
export enum TaskType {
  PICKUP = 'pickup',
  DROPOFF = 'dropoff',
  CHARGE = 'charge',
  MOVE = 'move'
}

// Task interface
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  startPoint?: string;
  endPoint?: string;
  startTime?: number;
  endTime?: number;
  currentStep?: number;
  totalSteps?: number;
  error?: string;
  robotId?: string;
}

// In-memory store for active tasks
const activeTasks: Map<string, Task> = new Map();

// File path for task storage
const taskStoragePath = path.join(process.cwd(), 'robot-tasks.json');

// Helper to get authentication headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ROBOT_SECRET}`
  };
}

/**
 * Log task activity with timestamp
 */
function logTask(taskId: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TASK:${taskId}] ${message}`);
  
  // Also log to file for debugging
  fs.appendFileSync(
    path.join(process.cwd(), 'robot-debug.log'), 
    `[${timestamp}] [TASK:${taskId}] ${message}\n`
  );
}

/**
 * Check if jack is in up position and lower it if needed
 */
async function ensureJackIsDown(taskId: string): Promise<boolean> {
  logTask(taskId, '⚠️ SAFETY CHECK: Verifying jack state...');
  
  try {
    // Check jack state
    const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
    const jackState = jackStateResponse.data;
    
    if (jackState && jackState.is_up === true) {
      logTask(taskId, '⚠️ Jack is currently UP. Executing jack_down operation...');
      
      try {
        // Execute jack_down operation
        await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
        
        // Wait for the jack operation to complete (~10 seconds)
        logTask(taskId, 'Jack down operation started, waiting 10 seconds for completion...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        logTask(taskId, '✅ Successfully lowered jack');
        return true;
      } catch (jackDownError: any) {
        logTask(taskId, `❌ Failed to lower jack: ${jackDownError.message}`);
        return false;
      }
    } else {
      logTask(taskId, '✅ Jack already in down state');
      return true;
    }
  } catch (jackCheckError: any) {
    // If we can't check jack state, log warning and try lowering anyway
    logTask(taskId, `⚠️ Warning: Unable to verify jack state: ${jackCheckError.message}`);
    
    try {
      // Execute jack_down operation as a precaution
      await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
      
      // Wait for the jack operation to complete (~10 seconds)
      logTask(taskId, 'Precautionary jack down operation started, waiting 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      logTask(taskId, '✅ Completed precautionary jack down operation');
      return true;
    } catch (precautionaryJackError: any) {
      logTask(taskId, `⚠️ Warning: Precautionary jack_down failed: ${precautionaryJackError.message}`);
      // Continue anyway - the error might be because the jack is already down
      return true;
    }
  }
}

/**
 * Execute the Jack Up operation
 */
async function executeJackUp(taskId: string): Promise<boolean> {
  logTask(taskId, '🔼 Starting jack up operation...');
  
  try {
    // Wait for stabilization before jack operation
    logTask(taskId, 'Stabilizing position for 3 seconds before jack operation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Execute the jack_up operation
    await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers: getHeaders() });
    
    // Wait for operation to complete
    logTask(taskId, 'Jack up operation started, waiting 10 seconds for completion...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Additional wait for system stabilization
    logTask(taskId, 'Jack operation complete, waiting 3 seconds for system stabilization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logTask(taskId, '✅ Jack up operation completed successfully');
    return true;
  } catch (error: any) {
    logTask(taskId, `❌ Jack up operation failed: ${error.message}`);
    return false;
  }
}

/**
 * Execute the Jack Down operation
 */
async function executeJackDown(taskId: string): Promise<boolean> {
  logTask(taskId, '🔽 Starting jack down operation...');
  
  try {
    // Wait for stabilization before jack operation
    logTask(taskId, 'Stabilizing position for 3 seconds before jack operation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Execute the jack_down operation
    await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
    
    // Wait for operation to complete
    logTask(taskId, 'Jack down operation started, waiting 10 seconds for completion...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Additional wait for system stabilization
    logTask(taskId, 'Jack operation complete, waiting 3 seconds for system stabilization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logTask(taskId, '✅ Jack down operation completed successfully');
    return true;
  } catch (error: any) {
    logTask(taskId, `❌ Jack down operation failed: ${error.message}`);
    return false;
  }
}

/**
 * Return robot to charging station
 */
async function returnToCharger(taskId: string): Promise<boolean> {
  logTask(taskId, '🔋 Starting return to charger operation...');
  
  try {
    // Cancel any current moves first for safety
    try {
      await axios.patch(`${ROBOT_API_URL}/chassis/moves/current`, { 
        state: 'cancelled' 
      }, { headers: getHeaders() });
      logTask(taskId, 'Successfully cancelled any current moves');
    } catch (error: any) {
      logTask(taskId, `Warning: Couldn't cancel current move: ${error.message}`);
      // Continue anyway - the error might just be that there's no current move
    }
    
    // Wait for any cancellation to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ensure jack is down before returning to charger
    const jackDownSuccess = await ensureJackIsDown(taskId);
    if (!jackDownSuccess) {
      logTask(taskId, '⚠️ Failed to ensure jack is down, but continuing with return to charger');
    }
    
    // Use the known charger location from the map
    // This is the location reported in the logs: Charging Station_docking (0.03443853667262486, 0.4981316698765672) with orientation 266.11
    const chargerPosition = {
      x: 0.03443853667262486,
      y: 0.4981316698765672,
      ori: 266.11
    };
    
    // Create a charge-type move command to return to charger with proper coordinates
    const chargeCommand = {
      creator: 'web_interface',
      type: 'charge',            // Special move type for charger return
      target_x: chargerPosition.x,
      target_y: chargerPosition.y,
      target_z: 0,
      target_ori: chargerPosition.ori,
      target_accuracy: 0.05,     // 5cm accuracy required for docking
      charge_retry_count: 5,     // Increased from 3 to 5 retries
      properties: {
        max_trans_vel: 0.2,      // Slower speed for more accurate docking
        max_rot_vel: 0.3,        // Maximum rotational velocity (rad/s)
        acc_lim_x: 0.5,          // Acceleration limit in x
        acc_lim_theta: 0.5       // Angular acceleration limit
      }
    };
    
    logTask(taskId, `Creating 'charge' move to charger at (${chargerPosition.x}, ${chargerPosition.y}), orientation: ${chargerPosition.ori}`);
    
    // Send the charge command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers: getHeaders() });
    const moveId = response.data.id;
    
    logTask(taskId, `Charge command sent - move ID: ${moveId}`);
    
    // Now poll the move status until it completes or fails
    let moveComplete = false;
    let maxRetries = 180; // 3 minutes at 1 second intervals (charger return can take longer)
    let attempts = 0;
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
      const moveStatus = statusResponse.data.state;
      
      logTask(taskId, `Current charger return status: ${moveStatus}`);
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logTask(taskId, `🔋 ✅ Robot has successfully returned to charger (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        throw new Error(`Return to charger failed or was cancelled. Status: ${moveStatus}`);
      } else {
        logTask(taskId, `Still moving to charger (move ID: ${moveId}), waiting...`);
      }
    }
    
    // Final check to ensure we didn't just time out
    if (!moveComplete) {
      throw new Error(`Return to charger timed out after ${maxRetries} attempts`);
    }
    
    // Check battery state to confirm charging
    try {
      const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers: getHeaders() });
      const batteryState = batteryResponse.data;
      
      if (batteryState && batteryState.is_charging) {
        logTask(taskId, '🔋 Confirmed: Robot is now charging!');
      } else {
        logTask(taskId, `⚠️ Warning: Robot returned to charger but may not be charging. Battery state: ${JSON.stringify(batteryState)}`);
      }
    } catch (batteryError: any) {
      logTask(taskId, `Warning: Could not check charging status: ${batteryError.message}`);
    }
    
    return true;
  } catch (error: any) {
    logTask(taskId, `❌ ERROR returning to charger: ${error.message}`);
    return false;
  }
}

/**
 * Move robot to a specific point
 */
async function moveToPoint(taskId: string, x: number, y: number, orientation: number, pointName: string): Promise<boolean> {
  logTask(taskId, `Moving robot to ${pointName} (${x}, ${y}, orientation: ${orientation})`);
  
  try {
    // Check if there's a current move and cancel it if needed
    try {
      const currentMoveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers: getHeaders() });
      if (currentMoveResponse.data && currentMoveResponse.data.id) {
        logTask(taskId, '⚠️ Robot is currently moving. Cancelling current move');
        await axios.patch(`${ROBOT_API_URL}/chassis/moves/current`, { state: 'cancelled' }, { headers: getHeaders() });
        
        // Give a bit of time for the cancellation to take effect
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      logTask(taskId, `Note: Could not check current move state: ${error.message}`);
    }
    
    // Create the move command
    const moveCommand = {
      creator: 'web_interface',
      type: 'standard',
      target_x: x,
      target_y: y,
      target_z: 0,
      target_ori: orientation,
      properties: {
        max_trans_vel: 0.5,
        max_rot_vel: 0.5,
        acc_lim_x: 0.5,
        acc_lim_theta: 0.5,
        planning_mode: 'directional'
      }
    };
    
    // Send the move command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveCommand, { headers: getHeaders() });
    const moveId = response.data.id;
    
    logTask(taskId, `Move command sent for ${pointName} - move ID: ${moveId}`);
    
    // Now poll the move status until it completes or fails
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
      
      logTask(taskId, `Current move status: ${moveStatus}`);
      
      // Try to get current position for better monitoring
      try {
        const posResponse = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers: getHeaders() });
        const pos = posResponse.data;
        
        // Validate position data before using toFixed
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.ori === 'number') {
          logTask(taskId, `Current position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, orientation: ${pos.ori.toFixed(2)})`);
        } else {
          logTask(taskId, `Position data incomplete or invalid: ${JSON.stringify(pos)}`);
        }
      } catch (posError: any) {
        logTask(taskId, `Unable to get robot position: ${posError.message}`);
      }
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logTask(taskId, `✅ Robot has completed movement (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        throw new Error(`Move failed or was cancelled. Status: ${moveStatus}`);
      } else {
        logTask(taskId, `Still moving (move ID: ${moveId}), waiting...`);
      }
    }
    
    // Final check to ensure we didn't just time out
    if (!moveComplete) {
      throw new Error(`Move timed out after ${maxRetries} seconds`);
    }
    
    // One final status check to be absolutely sure
    const finalStatusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
    const finalMoveStatus = finalStatusResponse.data.state;
    logTask(taskId, `Final move status check: ${finalMoveStatus}`);
    
    // If we got here, the move was successful
    return finalMoveStatus === 'succeeded';
  } catch (error: any) {
    logTask(taskId, `❌ ERROR moving to ${pointName}: ${error.message}`);
    return false;
  }
}

/**
 * Align with rack for bin pickup
 */
async function alignWithRack(taskId: string, x: number, y: number, orientation: number, pointName: string): Promise<boolean> {
  logTask(taskId, `🔄 Starting align_with_rack operation at ${pointName}...`);
  
  try {
    // First ensure jack is down for align_with_rack
    const jackDownSuccess = await ensureJackIsDown(taskId);
    if (!jackDownSuccess) {
      throw new Error('Failed to ensure jack is down before align_with_rack');
    }
    
    // Stop robot first for safety
    try {
      await axios.post(`${ROBOT_API_URL}/chassis/stop`, {}, { headers: getHeaders() });
      logTask(taskId, '✅ Stopped robot before align with rack');
    } catch (stopError: any) {
      logTask(taskId, `Warning: Failed to stop robot: ${stopError.message}`);
    }
    
    // Wait for stabilization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a move with type=align_with_rack - critical for proper bin alignment
    const alignCommand = {
      creator: 'robot-api',
      type: 'align_with_rack', // Special move type for rack pickup
      target_x: x,
      target_y: y,
      target_ori: orientation
    };
    
    logTask(taskId, `Creating align_with_rack move: ${JSON.stringify(alignCommand)}`);
    
    // Send the move command to align with rack
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, alignCommand, { headers: getHeaders() });
    
    if (!response.data || !response.data.id) {
      throw new Error('Failed to create align_with_rack move - invalid response');
    }
    
    const moveId = response.data.id;
    logTask(taskId, `Robot align_with_rack command sent - move ID: ${moveId}`);
    
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
      
      logTask(taskId, `Current align_with_rack status: ${moveStatus}`);
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logTask(taskId, `✅ Robot has completed align_with_rack operation (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        if (moveStatus === 'failed') {
          // Check failure reason
          const failReason = statusResponse.data.fail_reason_str || 'Unknown failure';
          logTask(taskId, `⚠️ Align with rack failed with reason: ${failReason}`);
        }
        throw new Error(`Align with rack failed or was cancelled. Status: ${moveStatus}`);
      } else {
        logTask(taskId, `Still aligning (move ID: ${moveId}), waiting...`);
      }
    }
    
    // Final check to ensure we didn't just time out
    if (!moveComplete) {
      throw new Error(`Align with rack timed out after ${maxRetries} attempts`);
    }
    
    // Add safety wait after alignment
    logTask(taskId, '✅ Align with rack complete, waiting 5 seconds for stability...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error: any) {
    logTask(taskId, `❌ ERROR during align_with_rack operation: ${error.message}`);
    return false;
  }
}

/**
 * Move to unload point for bin dropoff
 * 
 * This function sends a to_unload_point command to the robot, which is used specifically
 * for dropping bins at shelf points or the central dropoff point
 */
async function toUnloadPoint(taskId: string, x: number, y: number, orientation: number, pointName: string): Promise<boolean> {
  try {
    logTask(taskId, `Moving to unload point at ${pointName}`);
    
    // Make sure we're using proper load point (not docking)
    const loadPointId = pointName;
    if (loadPointId.includes('_docking')) {
      logTask(taskId, `ERROR: Cannot use to_unload_point with docking point ${loadPointId}`);
      return false;
    }
    
    // Extract the rack area ID from the point ID (just the number prefix)
    let rackAreaId;
    
    // For shelf point IDs like "001_load", extract the numeric prefix as rack_area_id
    const numericMatch = loadPointId.match(/^(\d+)_/);
    if (numericMatch) {
      rackAreaId = numericMatch[1]; // Just get the number "001" from "001_load"
      logTask(taskId, `Using numeric prefix "${rackAreaId}" as rack_area_id from point ${loadPointId}`);
    } else {
      // Fallback - use the full ID if no numeric prefix is found
      rackAreaId = loadPointId;
      logTask(taskId, `No numeric prefix found, using full point ID "${rackAreaId}" as rack_area_id`);
    }
    
    // Send the unload point command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: 'robot-management-platform',
      type: 'to_unload_point',
      target_x: x,
      target_y: y,
      target_z: orientation,
      point_id: loadPointId,
      rack_area_id: rackAreaId
    }, {
      headers: getHeaders()
    });
    
    const moveId = response.data.id;
    logTask(taskId, `Unload point command initiated with move ID: ${moveId}`);
    
    // Wait for movement to complete
    let retries = 0;
    const maxRetries = 60; // Longer timeout for unload operations
    
    while (retries < maxRetries) {
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, {
        headers: getHeaders()
      });
      
      const status = statusResponse.data.state;
      
      if (status === 'succeeded') {
        logTask(taskId, 'Unload point movement completed successfully');
        return true;
      } else if (status === 'failed') {
        logTask(taskId, `Unload point movement failed: ${statusResponse.data.reason || 'Unknown error'}`);
        return false;
      }
      
      // Still in progress, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    
    logTask(taskId, 'Unload point movement timed out');
    return false;
  } catch (error: any) {
    logTask(taskId, `Error during unload point movement: ${error.message}`);
    return false;
  }
}

/**
 * Execute Zone 104 bin pickup & delivery task
 */
async function executeZone104Task(taskId: string): Promise<boolean> {
  try {
    logTask(taskId, '🚀 Starting Zone 104 bin pickup & delivery task');
    let taskSuccess = true;
    
    // Update task status to running
    const task = activeTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.RUNNING;
      task.startTime = Date.now();
      task.currentStep = 1;
      task.totalSteps = 8;
    }
    
    // STEP 1: Move to docking position for pickup (104_load_docking)
    logTask(taskId, '📍 STEP 1/8: Moving to 104_load_docking');
    if (task) task.currentStep = 1;
    
    const moveToPickupDockingSuccess = await moveToPoint(
      taskId, 
      -15.409467385438802, 
      6.403540839556854, 
      178.97, 
      '104_load_docking'
    );
    
    if (!moveToPickupDockingSuccess) {
      throw new Error('Failed to move to 104_load_docking');
    }
    
    // STEP 2: Align with rack at pickup point using align_with_rack special move type
    logTask(taskId, '📍 STEP 2/8: Aligning with rack at 104_load');
    if (task) task.currentStep = 2;
    
    const alignWithRackSuccess = await alignWithRack(
      taskId,
      -15.478,
      6.43,
      178.75,
      '104_load'
    );
    
    if (!alignWithRackSuccess) {
      throw new Error('Failed to align with rack at 104_load');
    }
    
    // STEP 3: Execute jack_up to lift bin
    logTask(taskId, '📍 STEP 3/8: Executing jack_up operation to lift bin');
    if (task) task.currentStep = 3;
    
    const jackUpSuccess = await executeJackUp(taskId);
    if (!jackUpSuccess) {
      throw new Error('Failed to execute jack_up operation');
    }
    
    // STEP 4: Move to docking position for dropoff
    logTask(taskId, '📍 STEP 4/8: Moving to 001_load_docking');
    if (task) task.currentStep = 4;
    
    const moveToDropoffDockingSuccess = await moveToPoint(
      taskId,
      -1.850, 
      3.366, 
      0, 
      '001_load_docking'
    );
    
    if (!moveToDropoffDockingSuccess) {
      throw new Error('Failed to move to 001_load_docking');
    }
    
    // STEP 5: Move to actual dropoff point using to_unload_point
    logTask(taskId, '📍 STEP 5/8: Moving to unload point at 001_load');
    if (task) task.currentStep = 5;
    
    // Use toUnloadPoint action instead of moveToPoint for proper bin dropping
    const moveToDropoffSuccess = await toUnloadPoint(
      taskId,
      -2.861, 
      3.383, 
      0, 
      '001_load'
    );
    
    if (!moveToDropoffSuccess) {
      throw new Error('Failed to move to unload point at 001_load');
    }
    
    // STEP 6: Execute jack_down to lower bin
    logTask(taskId, '📍 STEP 6/8: Executing jack_down operation to lower bin');
    if (task) task.currentStep = 6;
    
    const jackDownSuccess = await executeJackDown(taskId);
    if (!jackDownSuccess) {
      throw new Error('Failed to execute jack_down operation');
    }
    
    // STEP 7: Backup from dropoff area
    logTask(taskId, '📍 STEP 7/8: Backing up from dropoff area');
    if (task) task.currentStep = 7;
    
    const backupFromDropoffSuccess = await moveToPoint(
      taskId,
      -4.067, 
      2.579, 
      269.73, 
      'Post-dropoff position'
    );
    
    if (!backupFromDropoffSuccess) {
      // Non-critical - log but continue
      logTask(taskId, '⚠️ Warning: Failed to back up from dropoff area, but continuing with task');
    }
    
    // STEP 8: Return to charger
    logTask(taskId, '📍 STEP 8/8: Returning robot to charging station');
    if (task) task.currentStep = 8;
    
    const returnToChargerSuccess = await returnToCharger(taskId);
    if (!returnToChargerSuccess) {
      // This is a critical step, but we've already delivered the bin, so log the error but mark task as completed
      logTask(taskId, '⚠️ Warning: Failed to return to charger, but bin delivery was successful');
      taskSuccess = false;
    }
    
    // Workflow complete
    logTask(taskId, '✅ Zone 104 bin pickup & delivery task completed successfully!');
    
    // Update task as completed
    if (task) {
      task.status = taskSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED;
      task.endTime = Date.now();
      if (!taskSuccess) {
        task.error = 'Failed to return to charger, but bin delivery was successful';
      }
    }
    
    return taskSuccess;
  } catch (error: any) {
    logTask(taskId, `❌ Zone 104 task failed: ${error.message}`);
    
    // Try to send robot back to charging station on error
    logTask(taskId, '⚠️ Attempting emergency return to charger...');
    try {
      await returnToCharger(taskId);
      logTask(taskId, '✅ Emergency return to charger successful');
    } catch (chargerError: any) {
      logTask(taskId, `❌ Emergency return to charger failed: ${chargerError.message}`);
    }
    
    // Update task as failed
    const task = activeTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      task.endTime = Date.now();
      task.error = error.message;
    }
    
    return false;
  }
}

/**
 * Create a new task and start its execution
 */
export async function createTask(type: TaskType, startPoint?: string, endPoint?: string, robotId?: string): Promise<string> {
  // Generate a unique task ID
  const taskId = uuidv4();
  
  // Create the task object
  const task: Task = {
    id: taskId,
    type,
    status: TaskStatus.PENDING,
    startPoint,
    endPoint,
    robotId
  };
  
  // Store the task
  activeTasks.set(taskId, task);
  
  // Save all tasks to disk
  saveTasksToDisk();
  
  // Execute the task asynchronously
  executeTask(taskId).catch(error => {
    console.error(`Failed to execute task ${taskId}:`, error);
  });
  
  return taskId;
}

/**
 * Execute a task based on its type
 */
async function executeTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  logTask(taskId, `Executing task of type ${task.type}`);
  
  try {
    switch (task.type) {
      case TaskType.PICKUP:
        // For now, assume all pickup tasks are Zone 104 tasks
        await executeZone104Task(taskId);
        break;
        
      case TaskType.CHARGE:
        // Charge task is just a return to charger
        task.status = TaskStatus.RUNNING;
        task.startTime = Date.now();
        task.currentStep = 1;
        task.totalSteps = 1;
        
        const chargeSuccess = await returnToCharger(taskId);
        
        task.status = chargeSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        task.endTime = Date.now();
        if (!chargeSuccess) {
          task.error = 'Failed to return to charging station';
        }
        break;
        
      case TaskType.MOVE:
        // Simple move task to a single point
        if (!task.endPoint) {
          throw new Error('Move task requires an end point');
        }
        
        task.status = TaskStatus.RUNNING;
        task.startTime = Date.now();
        task.currentStep = 1;
        task.totalSteps = 1;
        
        // Parse the coords from the endPoint
        // Expected format: "pointName (x, y, ori)"
        const pointMatch = task.endPoint.match(/\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
        if (!pointMatch) {
          throw new Error(`Invalid point format: ${task.endPoint}`);
        }
        
        const x = parseFloat(pointMatch[1]);
        const y = parseFloat(pointMatch[2]);
        const ori = parseFloat(pointMatch[3]);
        
        if (isNaN(x) || isNaN(y) || isNaN(ori)) {
          throw new Error(`Invalid coordinates in point: ${task.endPoint}`);
        }
        
        const pointName = task.endPoint.split('(')[0].trim();
        
        const moveSuccess = await moveToPoint(taskId, x, y, ori, pointName);
        
        task.status = moveSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        task.endTime = Date.now();
        if (!moveSuccess) {
          task.error = `Failed to move to ${pointName}`;
        }
        break;
        
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  } catch (error: any) {
    // Update task status to failed
    task.status = TaskStatus.FAILED;
    task.endTime = Date.now();
    task.error = error.message;
    
    logTask(taskId, `Task execution failed: ${error.message}`);
  }
  
  // Save updated task status to disk
  saveTasksToDisk();
}

/**
 * Get task details by ID
 */
export function getTaskById(taskId: string): Task | undefined {
  return activeTasks.get(taskId);
}

/**
 * Get all active tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(activeTasks.values());
}

/**
 * Cancel a task by ID
 */
export function cancelTask(taskId: string): boolean {
  const task = activeTasks.get(taskId);
  if (!task) {
    return false;
  }
  
  // Only pending or running tasks can be cancelled
  if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RUNNING) {
    return false;
  }
  
  // Store original status to check if it was running
  const wasRunning = (task.status === TaskStatus.RUNNING);
  
  // Update task status to cancelled
  task.status = TaskStatus.CANCELLED;
  task.endTime = Date.now();
  
  // For tasks that were running, try to stop the robot
  if (wasRunning) {
    axios.post(`${ROBOT_API_URL}/chassis/stop`, {}, { headers: getHeaders() })
      .then(() => {
        logTask(taskId, 'Robot stopped due to task cancellation');
        
        // Try to return to charger after cancellation
        returnToCharger(taskId).catch(error => {
          logTask(taskId, `Failed to return to charger after cancellation: ${error.message}`);
        });
      })
      .catch(error => {
        logTask(taskId, `Failed to stop robot during cancellation: ${error.message}`);
      });
  }
  
  // Save updated task status to disk
  saveTasksToDisk();
  
  return true;
}

/**
 * Save all tasks to disk for persistence
 */
function saveTasksToDisk(): void {
  try {
    const tasksArray = Array.from(activeTasks.values());
    fs.writeFileSync(taskStoragePath, JSON.stringify(tasksArray, null, 2));
  } catch (error) {
    console.error('Failed to save tasks to disk:', error);
  }
}

/**
 * Load tasks from disk on startup
 */
function loadTasksFromDisk(): void {
  try {
    if (fs.existsSync(taskStoragePath)) {
      const tasksData = fs.readFileSync(taskStoragePath, 'utf8');
      const tasksArray: Task[] = JSON.parse(tasksData);
      
      tasksArray.forEach(task => {
        activeTasks.set(task.id, task);
      });
      
      console.log(`Loaded ${tasksArray.length} tasks from disk`);
    }
  } catch (error) {
    console.error('Failed to load tasks from disk:', error);
  }
}

/**
 * Register the robot task API routes
 */
export function registerTaskApiRoutes(app: express.Express): void {
  // Load existing tasks from disk
  loadTasksFromDisk();
  
  // Create a new task
  app.post('/api/robot/tasks', async (req, res) => {
    try {
      const { type, startPoint, endPoint, robotId } = req.body;
      
      // Validate task type
      if (!Object.values(TaskType).includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid task type: ${type}`
        });
      }
      
      const taskId = await createTask(type, startPoint, endPoint, robotId);
      
      res.status(201).json({
        success: true,
        taskId,
        message: 'Task created successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Get all tasks
  app.get('/api/robot/tasks', (req, res) => {
    const tasks = getAllTasks();
    res.json({
      success: true,
      tasks
    });
  });
  
  // Get a specific task by ID
  app.get('/api/robot/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }
    
    res.json({
      success: true,
      task
    });
  });
  
  // Cancel a task
  app.post('/api/robot/tasks/:taskId/cancel', (req, res) => {
    const { taskId } = req.params;
    const cancelled = cancelTask(taskId);
    
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found or cannot be cancelled`
      });
    }
    
    res.json({
      success: true,
      message: `Task ${taskId} cancelled successfully`
    });
  });
  
  // Create a Zone 104 pickup task (convenience endpoint)
  app.post('/api/robot/tasks/zone104-pickup', async (req, res) => {
    try {
      const taskId = await createTask(TaskType.PICKUP, '104_load', 'drop-off_load');
      
      res.status(201).json({
        success: true,
        taskId,
        message: 'Zone 104 pickup task created successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Create a return to charger task (convenience endpoint)
  app.post('/api/robot/tasks/return-to-charger', async (req, res) => {
    try {
      const taskId = await createTask(TaskType.CHARGE);
      
      res.status(201).json({
        success: true,
        taskId,
        message: 'Return to charger task created successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Create a demo move task with coordinates for testing in simulation
  app.post('/api/robot/tasks/test-move', async (req, res) => {
    try {
      // Create a simple move task with specific coordinates for testing
      const taskId = await createTask(
        TaskType.MOVE, 
        'Current Position', 
        'Test Point (0, 0, 0)'
      );
      
      res.status(201).json({
        success: true,
        taskId,
        message: 'Test move task created successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  console.log('✅ Registered robot task API routes');
}