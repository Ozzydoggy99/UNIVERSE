console.log('Script is running!');

// import express from 'express';
// import axios from 'axios';
// import * as fs from 'fs';
// import * as path from 'path';
// import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants.js';
// import { fetchRobotMapPoints } from './robot-map-data.js';
// import { isRobotCharging, isEmergencyStopPressed, returnToCharger } from './robot-api.js';
// import { missionQueue } from './mission-queue.js';
// import { MissionStep } from './mission-queue.js';
// import { Point } from './types.js';

console.log('Imports succeeded!');

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

// Configure debug log file
const debugLogFile = path.join(process.cwd(), 'robot-debug.log');

// API headers for authentication
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': ROBOT_SECRET
};

// Helper function to log robot task information to debug file
function logRobotTask(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [TEST-DROPOFF] ${message}\n`;
  console.log(logEntry);
  fs.appendFileSync(debugLogFile, logEntry);
}

/**
 * Helper function to log workflow steps with timestamps
 */
function logWorkflow(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TEST-DROPOFF] ${message}`);
}

/**
 * Execute a move to a specific point
 * 
 * @param x X coordinate
 * @param y Y coordinate
 * @param ori Orientation in degrees
 * @param label Label for logging
 */
async function moveToPoint(x: number, y: number, ori: number, label: string): Promise<any> {
  logWorkflow(`Moving robot to ${label} (${x}, ${y}, orientation: ${ori})`);

  try {
    // First verify robot is not currently moving
    let hasActiveMove = false;

    try {
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers });
      if (currentMovesResponse.data && currentMovesResponse.data.state === 'moving') {
        hasActiveMove = true;
        logWorkflow(`⚠️ Robot is currently moving. Cancelling current move`);
        
        // Cancel current move
        await axios.patch(
          `${ROBOT_API_URL}/chassis/moves/current`,
          { state: 'cancelled' },
          { headers }
        );
        
        // Wait for move to cancel
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (checkError: any) {
      // If we can't check current move, proceed anyway
      logWorkflow(`Note: Could not check current move state: ${checkError.message}`);
    }

    // Create the move command
    const moveCommand = {
      creator: 'web_interface',
      type: 'standard',
      target_x: x,
      target_y: y,
      target_z: 0,
      target_ori: ori,
      properties: {
        max_trans_vel: 0.5,         // Maximum translational velocity (m/s)
        max_rot_vel: 0.5,           // Maximum rotational velocity (rad/s)
        acc_lim_x: 0.5,             // Acceleration limit in x direction
        acc_lim_theta: 0.5,         // Angular acceleration limit
        planning_mode: 'directional' // Use directional planning
      }
    };

    // Send the move command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveCommand, { headers });
    const moveId = response.data.id;

    logWorkflow(`Move command sent for ${label} - move ID: ${moveId}`);

    // Now poll the move status until it completes or fails
    let moveComplete = false;
    let maxRetries = 120; // 2 minutes at 1 second intervals
    let attempts = 0;

    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(`Current move status: ${moveStatus}`);
      
      // Try to get current position for better monitoring
      try {
        const posResponse = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers });
        const pos = posResponse.data;
        logWorkflow(`Current position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, orientation: ${pos.ori.toFixed(2)})`);
      } catch (posError) {
        logWorkflow(`Unable to get robot position: ${posError.message}`);
      }
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logWorkflow(`✅ Robot has completed movement (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        throw new Error(`Move to ${label} failed or was cancelled. Status: ${moveStatus}`);
      } else {
        logWorkflow(`Still moving (move ID: ${moveId}), waiting...`);
      }
    }
    
    // Final check to ensure we didn't just time out
    if (!moveComplete) {
      throw new Error(`Move to ${label} timed out after ${maxRetries} attempts`);
    }

    // Do one final status check to be absolutely certain
    const finalStatusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
    const finalStatus = finalStatusResponse.data.state;
    logWorkflow(`Final move status check: ${finalStatus}`);
    
    if (finalStatus !== 'succeeded') {
      throw new Error(`Move to ${label} failed in final check. Status: ${finalStatus}`);
    }
    
    return {
      success: true,
      message: `Move command to ${label} completed successfully`,
      moveId
    };
  } catch (error: any) {
    logWorkflow(`❌ ERROR moving to ${label}: ${error.message}`);
    throw error;
  }
}

async function testDropoffWorkflow() {
  logWorkflow('🚀 Starting test: Dropoff workflow to 001_load_docking...');
  try {
    // Move to 001_load_docking point using the chassis move API
    await moveToPoint(-0.45, 0.55, 89, '001_load_docking');
    logWorkflow('✅ Test complete. The robot has moved to 001_load_docking.');
  } catch (error: any) {
    logWorkflow(`❌ Error executing dropoff workflow: ${error.message}`);
  }
}

// Execute the test
testDropoffWorkflow().catch(error => {
  logWorkflow(`❌ Unhandled error in testDropoffWorkflow: ${error.message}`);
});

console.log('[TEST] Script ended.'); 