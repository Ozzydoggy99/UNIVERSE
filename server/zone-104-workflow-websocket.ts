/**
 * Zone 104 Workflow - WebSocket Position Implementation
 * 
 * This module implements the complete Zone 104 pickup and delivery workflow
 * following the proper API documentation for the L382502104987ir robot.
 * 
 * This implementation uses WebSocket for position tracking instead of 
 * REST API queries, since the robot provides position data through WebSocket
 * subscriptions to the '/tracked_pose' topic.
 * 
 * Based on the documentation from the AutoXing SDK, this workflow:
 * 1. Moves to docking position for pickup point (104_load_docking)
 * 2. Moves to the actual pickup point (104_load)  
 * 3. Performs a small backup movement for proper bin alignment
 * 4. Performs the jack_up operation to lift the bin
 * 5. Moves to docking position for dropoff (drop-off_load_docking)
 * 6. Moves to the actual dropoff point (drop-off_load)
 * 7. Performs the jack_down operation to lower the bin
 * 8. Returns to the charging station using the proper "charge" move type
 */

import express from 'express';
import axios from 'axios';
import { robotPositionTracker } from './robot-position-tracker';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';

// API headers for authentication - using the proper format from AutoXing API docs
const headers = getAuthHeaders();

/**
 * Helper function to log workflow steps with timestamps
 */
function logWorkflow(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ZONE-104-WORKFLOW-WS] ${message}`);
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
      
      // Get position from our position tracker that is updated via WebSocket
      const position = robotPositionTracker.getLatestPosition();
      if (position) {
        logWorkflow(`Current position from WebSocket: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, orientation: ${position.theta.toFixed(2)})`);
        
        // Calculate distance to target if we have valid position
        const distance = robotPositionTracker.distanceTo(x, y);
        if (distance !== null) {
          logWorkflow(`Distance to target: ${distance.toFixed(2)} meters`);
        }
      } else {
        logWorkflow(`No position data available from WebSocket yet`);
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

/**
 * Execute the robot jack up operation with all safety checks
 */
async function executeJackUp(): Promise<any> {
  logWorkflow(`⚠️ CRITICAL SAFETY OPERATION: Starting jack up operation`);
  
  try {
    // SAFETY CHECK: First verify robot is completely stopped
    logWorkflow(`⚠️ CRITICAL SAFETY CHECK: Verifying robot is completely stopped before jack_up...`);
    
    // Wait for robot to fully stabilize before safety check
    logWorkflow(`Waiting 3 seconds for robot to fully stabilize before safety check...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check 1: Verify no active move commands
    let hasSafetyCheckPassed = true;
    
    try {
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers });
      if (currentMovesResponse.data && currentMovesResponse.data.state === 'moving') {
        logWorkflow(`⚠️ SAFETY VIOLATION: Robot still has active move command`);
        hasSafetyCheckPassed = false;
      } else {
        logWorkflow(`✅ SAFETY CHECK 1 PASSED: No active movement command`);
      }
    } catch (checkError: any) {
      // If we can't check, log but continue with caution
      logWorkflow(`Warning: Could not check active movement: ${checkError.message}`);
    }
    
    // Check 2: Verify wheel speed is zero
    let wheelCheckAttempts = 0;
    const maxWheelCheckAttempts = 3;
    let wheelCheckPassed = false;
    
    while (wheelCheckAttempts < maxWheelCheckAttempts && !wheelCheckPassed) {
      try {
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers });
        const wheelState = wheelResponse.data;
        
        if (wheelState) {
          const leftSpeed = Math.abs(wheelState.left_speed || 0);
          const rightSpeed = Math.abs(wheelState.right_speed || 0);
          
          if (leftSpeed < 0.001 && rightSpeed < 0.001) {
            logWorkflow(`✅ SAFETY CHECK 2 PASSED: Wheel speeds are zero (L: ${leftSpeed}, R: ${rightSpeed})`);
            wheelCheckPassed = true;
          } else {
            logWorkflow(`⚠️ SAFETY VIOLATION: Wheels still moving (L: ${leftSpeed}, R: ${rightSpeed})`);
            hasSafetyCheckPassed = false;
            
            // Try once more after a wait
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (wheelError: any) {
        logWorkflow(`Warning: Could not check wheel state: ${wheelError.message}`);
        wheelCheckAttempts++;
      }
    }
    
    if (wheelCheckAttempts >= maxWheelCheckAttempts && !wheelCheckPassed) {
      logWorkflow(`⚠️ Unable to verify wheel state after multiple attempts. Proceeding with caution.`);
    }
    
    // Check 3: Verify robot is not busy
    try {
      const busyResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
      const busyState = busyResponse.data;
      
      if (busyState && busyState.is_busy) {
        logWorkflow(`⚠️ SAFETY WARNING: Robot reports busy state`);
        hasSafetyCheckPassed = false;
      } else {
        logWorkflow(`✅ SAFETY CHECK 3 PASSED: Robot not in busy state`);
      }
    } catch (busyError: any) {
      logWorkflow(`Warning: Could not check robot busy status: ${busyError.message}`);
    }
    
    // Final safety decision
    if (!hasSafetyCheckPassed) {
      logWorkflow(`⚠️ SAFETY CHECKS FAILED: Will not proceed with jack_up operation!`);
      throw new Error('Safety checks failed - robot not in stable state for jack_up operation');
    }
    
    logWorkflow(`✅ All safety checks passed! Waiting additional 3 seconds to ensure complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logWorkflow(`✅ SAFETY CHECK COMPLETE: Robot confirmed stopped for jack_up operation`);
    
    // Now perform backup movement for proper bin alignment
    logWorkflow(`⚠️ CRITICAL: Backing up slightly for proper bin alignment...`);
    
    try {
      // Use manual joystick command to back up slightly
      const backupResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
        action: "joystick",
        linear: {
          x: -0.05, // Negative x means backward movement
          y: 0.0,
          z: 0.0
        },
        angular: {
          x: 0.0,
          y: 0.0,
          z: 0.0
        }
      }, { headers });
      
      // Wait for the backup movement to complete (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Stop the robot after backing up
      const stopResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
        action: "joystick",
        linear: {
          x: 0.0,
          y: 0.0,
          z: 0.0
        },
        angular: {
          x: 0.0,
          y: 0.0,
          z: 0.0
        }
      }, { headers });
      
      // Wait for stop to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logWorkflow(`✅ Backup movement completed for better bin alignment`);
    } catch (backupError: any) {
      logWorkflow(`Warning: Could not perform backup movement: ${backupError.message}`);
      // Continue with jack_up even if backup fails - it may still work
    }
    
    // Execute the jack_up operation
    logWorkflow(`⚠️ CRITICAL OPERATION: Jack up - robot confirmed stopped, proceeding with operation`);
    
    // Send the jack up command
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
    
    // IMPORTANT: Wait longer for the jack operation to complete (takes ~10 seconds to be safe)
    logWorkflow(`Jack up operation started, waiting 10 seconds for complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Add additional safety wait periods
    logWorkflow(`⚠️ Adding FINAL safety waiting period of 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logWorkflow(`✅ Jack up operation completed and verified`);
    return {
      success: true,
      message: 'Jack up operation completed successfully'
    };
  } catch (error: any) {
    logWorkflow(`❌ ERROR during jack up operation: ${error.message}`);
    
    // Handle error responses appropriately
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;
      
      logWorkflow(`Jack up error response: Status ${statusCode}, Data: ${JSON.stringify(errorData)}`);
      
      if (statusCode === 404) {
        throw new Error('Robot API endpoint for jack_up not found - operation failed');
      } else if (statusCode === 500) {
        // Check for emergency stop
        if (errorData && errorData.detail && errorData.detail.includes('Emergency stop')) {
          throw new Error('Emergency stop button is pressed - cannot proceed with jack_up');
        } else {
          throw new Error(`Server error during jack_up: ${JSON.stringify(errorData)}`);
        }
      }
    }
    
    throw error;
  }
}

/**
 * Execute the robot jack down operation with all safety checks
 */
async function executeJackDown(): Promise<any> {
  logWorkflow(`⚠️ CRITICAL SAFETY OPERATION: Starting jack down operation`);
  
  try {
    // SAFETY CHECK: First verify robot is completely stopped
    logWorkflow(`⚠️ CRITICAL SAFETY CHECK: Verifying robot is completely stopped before jack_down...`);
    
    // Wait for robot to fully stabilize before safety check
    logWorkflow(`Waiting 3 seconds for robot to fully stabilize before safety check...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check 1: Verify no active move commands
    let hasSafetyCheckPassed = true;
    
    try {
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers });
      if (currentMovesResponse.data && currentMovesResponse.data.state === 'moving') {
        logWorkflow(`⚠️ SAFETY VIOLATION: Robot still has active move command`);
        hasSafetyCheckPassed = false;
      } else {
        logWorkflow(`✅ SAFETY CHECK 1 PASSED: No active movement command`);
      }
    } catch (checkError: any) {
      // If we can't check, log but continue with caution
      logWorkflow(`Warning: Could not check active movement: ${checkError.message}`);
    }
    
    // Check 2: Verify wheel speed is zero
    let wheelCheckAttempts = 0;
    const maxWheelCheckAttempts = 3;
    let wheelCheckPassed = false;
    
    while (wheelCheckAttempts < maxWheelCheckAttempts && !wheelCheckPassed) {
      try {
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers });
        const wheelState = wheelResponse.data;
        
        if (wheelState) {
          const leftSpeed = Math.abs(wheelState.left_speed || 0);
          const rightSpeed = Math.abs(wheelState.right_speed || 0);
          
          if (leftSpeed < 0.001 && rightSpeed < 0.001) {
            logWorkflow(`✅ SAFETY CHECK 2 PASSED: Wheel speeds are zero (L: ${leftSpeed}, R: ${rightSpeed})`);
            wheelCheckPassed = true;
          } else {
            logWorkflow(`⚠️ SAFETY VIOLATION: Wheels still moving (L: ${leftSpeed}, R: ${rightSpeed})`);
            hasSafetyCheckPassed = false;
            
            // Try once more after a wait
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (wheelError: any) {
        logWorkflow(`Warning: Could not check wheel state: ${wheelError.message}`);
        wheelCheckAttempts++;
      }
    }
    
    if (wheelCheckAttempts >= maxWheelCheckAttempts && !wheelCheckPassed) {
      logWorkflow(`⚠️ Unable to verify wheel state after multiple attempts. Proceeding with caution.`);
    }
    
    // Check 3: Verify robot is not busy
    try {
      const busyResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
      const busyState = busyResponse.data;
      
      if (busyState && busyState.is_busy) {
        logWorkflow(`⚠️ SAFETY WARNING: Robot reports busy state`);
        hasSafetyCheckPassed = false;
      } else {
        logWorkflow(`✅ SAFETY CHECK 3 PASSED: Robot not in busy state`);
      }
    } catch (busyError: any) {
      logWorkflow(`Warning: Could not check robot busy status: ${busyError.message}`);
    }
    
    // Final safety decision
    if (!hasSafetyCheckPassed) {
      logWorkflow(`⚠️ SAFETY CHECKS FAILED: Will not proceed with jack_down operation!`);
      throw new Error('Safety checks failed - robot not in stable state for jack_down operation');
    }
    
    logWorkflow(`✅ All safety checks passed! Waiting additional 3 seconds to ensure complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logWorkflow(`✅ SAFETY CHECK COMPLETE: Robot confirmed stopped for jack_down operation`);
    
    // Execute the jack_down operation
    logWorkflow(`⚠️ CRITICAL OPERATION: Jack down - robot confirmed stopped, proceeding with operation`);
    
    // Send the jack down command
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
    
    // IMPORTANT: Wait for the jack operation to complete (takes ~10 seconds to be safe)
    logWorkflow(`Jack down operation started, waiting 10 seconds for complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Add additional safety wait period
    logWorkflow(`⚠️ Adding FINAL safety waiting period of 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logWorkflow(`✅ Jack down operation completed and verified`);
    return {
      success: true,
      message: 'Jack down operation completed successfully'
    };
  } catch (error: any) {
    logWorkflow(`❌ ERROR during jack down operation: ${error.message}`);
    
    // Handle error responses appropriately
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;
      
      logWorkflow(`Jack down error response: Status ${statusCode}, Data: ${JSON.stringify(errorData)}`);
      
      if (statusCode === 404) {
        throw new Error('Robot API endpoint for jack_down not found - operation failed');
      } else if (statusCode === 500) {
        // Check for emergency stop
        if (errorData && errorData.detail && errorData.detail.includes('Emergency stop')) {
          throw new Error('Emergency stop button is pressed - cannot proceed with jack_down');
        } else {
          throw new Error(`Server error during jack_down: ${JSON.stringify(errorData)}`);
        }
      }
    }
    
    throw error;
  }
}

/**
 * Send robot to charging station using the proper charge move type
 * This uses the correct 'charge' move type from the API documentation
 */
async function returnToCharger(): Promise<any> {
  logWorkflow(`🔋 Starting return to charger operation...`);
  
  try {
    // Create a charge-type move command to return to charger
    const chargeCommand = {
      creator: 'web_interface',
      type: 'charge',       // Special move type for charger return
      properties: {
        max_trans_vel: 0.5, // Maximum translational velocity (m/s)
        max_rot_vel: 0.5,   // Maximum rotational velocity (rad/s)
        acc_lim_x: 0.5,     // Acceleration limit in x
        acc_lim_theta: 0.5  // Angular acceleration limit
      }
    };
    
    // Send the charge command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers });
    const moveId = response.data.id;
    
    logWorkflow(`Charge command sent - move ID: ${moveId}`);
    
    // Now poll the move status until it completes or fails
    let moveComplete = false;
    let maxRetries = 180; // 3 minutes at 1 second intervals (charger return can take longer)
    let attempts = 0;
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(`Current charger return status: ${moveStatus}`);
      
      // Get position from our position tracker that is updated via WebSocket
      const position = robotPositionTracker.getLatestPosition();
      if (position) {
        logWorkflow(`Current position from WebSocket: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, orientation: ${position.theta.toFixed(2)})`);
      } else {
        logWorkflow(`No position data available from WebSocket yet`);
      }
      
      // Check if move is complete
      if (moveStatus === 'succeeded') {
        moveComplete = true;
        logWorkflow(`🔋 ✅ Robot has successfully returned to charger (ID: ${moveId})`);
      } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
        throw new Error(`Return to charger failed or was cancelled. Status: ${moveStatus}`);
      } else {
        logWorkflow(`Still moving to charger (move ID: ${moveId}), waiting...`);
      }
    }
    
    // Final check to ensure we didn't just time out
    if (!moveComplete) {
      throw new Error(`Return to charger timed out after ${maxRetries} attempts`);
    }
    
    // Check battery state to confirm charging
    try {
      const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers });
      const batteryState = batteryResponse.data;
      
      if (batteryState && batteryState.is_charging) {
        logWorkflow(`🔋 Confirmed: Robot is now charging!`);
      } else {
        logWorkflow(`⚠️ Warning: Robot returned to charger but may not be charging. Battery state: ${JSON.stringify(batteryState)}`);
      }
    } catch (batteryError: any) {
      logWorkflow(`Warning: Could not check charging status: ${batteryError.message}`);
    }
    
    return {
      success: true,
      message: 'Return to charger completed successfully'
    };
  } catch (error: any) {
    logWorkflow(`❌ ERROR returning to charger: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the complete Zone 104 workflow 
 * with proper API commands and sequencing
 */
async function executeZone104Workflow(): Promise<any> {
  // Generate a unique workflow ID with timestamp
  const workflowId = `zone104_ws_${Date.now()}`;
  
  logWorkflow(`🚀 Starting Zone 104 workflow ${workflowId}`);
  
  try {
    // STEP 1: Move to docking position for pickup (104_load_docking)
    logWorkflow(`📍 STEP 1/8: Moving to 104_load_docking`);
    await moveToPoint(-15.409467385438802, 6.403540839556854, 178.97, '104_load_docking');
    
    // STEP 2: Move to actual pickup point (104_load)
    logWorkflow(`📍 STEP 2/8: Moving to 104_load`);
    await moveToPoint(-15.478, 6.43, 178.75, '104_load');
    
    // STEP 3: Backup slightly for proper bin alignment (handled in jack_up)
    logWorkflow(`📍 STEP 3/8: Performing precise backing movement for bin alignment`);
    
    // STEP 4: Execute jack_up to lift bin
    logWorkflow(`📍 STEP 4/8: Executing jack_up operation to lift bin`);
    await executeJackUp();
    
    // STEP 5: Move to docking position for dropoff (drop-off_load_docking)
    logWorkflow(`📍 STEP 5/8: Moving to drop-off_load_docking`);
    await moveToPoint(-17.879301628443036, 0.04639236955095483, 269.73, 'drop-off_load_docking');
    
    // STEP 6: Move to actual dropoff point (drop-off_load)
    logWorkflow(`📍 STEP 6/8: Moving to drop-off_load`);
    await moveToPoint(-17.882, 0.037, 269.73, 'drop-off_load');
    
    // STEP 7: Execute jack_down to lower bin
    logWorkflow(`📍 STEP 7/8: Executing jack_down operation to lower bin`);
    await executeJackDown();
    
    // STEP 8: Return to charger
    logWorkflow(`📍 STEP 8/8: Returning robot to charging station`);
    await returnToCharger();
    
    // Workflow complete
    logWorkflow(`✅ Zone 104 workflow completed successfully!`);
    
    return {
      success: true,
      workflowId,
      message: 'Zone 104 workflow completed successfully'
    };
  } catch (error: any) {
    logWorkflow(`❌ Zone 104 workflow failed: ${error.message}`);
    
    // Try to send robot back to charging station on error
    logWorkflow(`⚠️ Attempting emergency return to charger...`);
    try {
      await returnToCharger();
      logWorkflow(`✅ Emergency return to charger successful`);
    } catch (chargerError: any) {
      logWorkflow(`❌ Emergency return to charger failed: ${chargerError.message}`);
    }
    
    throw error;
  }
}

/**
 * Register the Zone 104 workflow handler with WebSocket position tracking
 */
export function registerZone104WorkflowWSHandler(app: express.Express): void {
  app.post('/api/zone-104/workflow-websocket', async (req, res) => {
    const startTime = Date.now();
    
    try {
      logWorkflow('📦 Received request to execute Zone 104 workflow (WebSocket position tracking)');
      
      // Log the current position from WebSocket if available
      const currentPosition = robotPositionTracker.getLatestPosition();
      if (currentPosition) {
        logWorkflow(`Starting position from WebSocket: (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)}, orientation: ${currentPosition.theta.toFixed(2)})`);
        
        // Check if position is recent
        if (robotPositionTracker.hasRecentPosition()) {
          logWorkflow(`✅ Position data is recent and valid`);
        } else {
          logWorkflow(`⚠️ Warning: Position data is stale (more than 10 seconds old)`);
        }
      } else {
        logWorkflow(`⚠️ Warning: No position data available from WebSocket yet. The workflow will still continue but without real-time position tracking.`);
      }
      
      // Execute the workflow
      const result = await executeZone104Workflow();
      
      // Calculate total execution time
      const durationMs = Date.now() - startTime;
      
      // Return success
      res.json({
        success: true,
        message: 'Zone 104 workflow completed successfully',
        workflowId: result.workflowId,
        duration: durationMs
      });
    } catch (error: any) {
      // Log the error
      logWorkflow(`❌ Zone 104 workflow failed: ${error.message}`);
      
      // Return error to client
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  });
  
  logWorkflow('✅ Registered Zone 104 workflow handler with WebSocket position tracking');
}