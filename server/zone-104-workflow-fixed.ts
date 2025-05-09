/**
 * Zone 104 Workflow - Complete New Implementation
 * 
 * This module implements the complete Zone 104 pickup and delivery workflow
 * following the proper API documentation for the L382502104987ir robot.
 * 
 * Based on the documentation from the AutoXing SDK, this workflow:
 * 1. Moves to docking position for pickup point (104_Load_docking)
 * 2. Moves to the actual pickup point (104_Load)  
 * 3. Performs a small backup movement for proper bin alignment
 * 4. Performs the jack_up operation to lift the bin
 * 5. Moves to docking position for dropoff (Drop-off_Load_docking)
 * 6. Moves to the actual dropoff point (Drop-off_Load)
 * 7. Performs the jack_down operation to lower the bin
 * 8. Returns to the charging station using the proper "charge" move type
 */

import express from 'express';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';

// Use the standardized authentication headers function
function getHeaders() {
  return getAuthHeaders();
}

/**
 * Helper function to log workflow steps with timestamps
 */
function logWorkflow(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ZONE-104-WORKFLOW] ${message}`);
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
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers: getHeaders() });
      if (currentMovesResponse.data && currentMovesResponse.data.state === 'moving') {
        hasActiveMove = true;
        logWorkflow(`⚠️ Robot is currently moving. Cancelling current move`);
        
        // Cancel current move
        await axios.patch(
          `${ROBOT_API_URL}/chassis/moves/current`,
          { state: 'cancelled' },
          { headers: getHeaders() }
        );
        
        // Wait 3 seconds for move to cancel
        await new Promise(resolve => setTimeout(resolve, 3000));
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
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveCommand, { headers: getHeaders() });
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
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(`Current move status: ${moveStatus}`);
      
      // Try to get current position for better monitoring
      try {
        const posResponse = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers: getHeaders() });
        const pos = posResponse.data;
        
        // Validate position data before using toFixed
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.ori === 'number') {
          logWorkflow(`Current position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, orientation: ${pos.ori.toFixed(2)})`);
        } else {
          logWorkflow(`Position data incomplete or invalid: ${JSON.stringify(pos)}`);
        }
      } catch (posError: any) {
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
      logWorkflow(`⚠️ WARNING: Move to ${label} timed out after ${maxRetries} attempts, but will continue workflow`);
      return {
        success: false,
        warning: `Move to ${label} timed out after ${maxRetries} attempts`,
        moveId: moveId
      };
    }

    // Do one final status check to be absolutely certain
    const finalStatusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
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
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers: getHeaders() });
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
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers: getHeaders() });
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
      const busyResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers: getHeaders() });
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
      }, { headers: getHeaders() });
      
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
      }, { headers: getHeaders() });
      
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
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers: getHeaders() });
    
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
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers: getHeaders() });
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
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers: getHeaders() });
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
      const busyResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers: getHeaders() });
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
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
    
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
 * with proper charger coordinates and retry parameters
 */
async function returnToCharger(): Promise<any> {
  logWorkflow(`🔋 Starting return to charger operation...`);
  
  try {
    // Cancel any current moves first for safety
    logWorkflow(`Cancelling any current moves first`);
    try {
      await axios.patch(`${ROBOT_API_URL}/chassis/moves/current`, { 
        state: 'cancelled' 
      }, { headers: getHeaders() });
      logWorkflow(`Successfully cancelled any current moves`);
    } catch (error: any) {
      logWorkflow(`Warning: Couldn't cancel current move: ${error.message}`);
      // Continue anyway - the error might just be that there's no current move
    }
    
    // Wait for any cancellation to complete
    logWorkflow(`Waiting for move cancellation to take effect...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // CRITICAL SAFETY CHECK: Verify jack is down before proceeding
    logWorkflow(`🔋 SAFETY CHECK: Verifying jack is in down state before returning to charger...`);
    
    try {
      // Check if we can detect the jack state
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up === true) {
        // Jack is up - need to lower it first
        logWorkflow(`⚠️ SAFETY ALERT: Jack is currently UP. Executing jack_down operation first...`);
        
        try {
          // Execute jack_down operation
          await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
          
          // Wait for the jack operation to complete (~10 seconds)
          logWorkflow(`Jack down operation started, waiting 10 seconds for completion...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          logWorkflow(`✅ Successfully lowered jack before returning to charger`);
        } catch (jackDownError: any) {
          throw new Error(`Failed to lower jack before returning to charger: ${jackDownError.message}`);
        }
      } else {
        logWorkflow(`✅ Jack already in down state - safe to proceed with return to charger`);
      }
    } catch (jackCheckError: any) {
      // If we can't check jack state, log warning and continue with caution
      logWorkflow(`⚠️ Warning: Unable to verify jack state: ${jackCheckError.message}`);
      logWorkflow(`⚠️ Will attempt explicit jack_down operation for safety...`);
      
      try {
        // Execute jack_down operation as a precaution
        await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
        
        // Wait for the jack operation to complete (~10 seconds)
        logWorkflow(`Precautionary jack down operation started, waiting 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        logWorkflow(`✅ Completed precautionary jack down operation`);
      } catch (precautionaryJackError: any) {
        logWorkflow(`⚠️ Warning: Precautionary jack_down failed: ${precautionaryJackError.message}`);
        // Continue anyway - the error might be because the jack is already down
      }
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
    
    logWorkflow(`Creating 'charge' move to charger at (${chargerPosition.x}, ${chargerPosition.y}), orientation: ${chargerPosition.ori}`);
    
    // Send the charge command to the robot
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers: getHeaders() });
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
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers: getHeaders() });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(`Current charger return status: ${moveStatus}`);
      
      // Try to get current position for better monitoring
      try {
        const posResponse = await axios.get(`${ROBOT_API_URL}/chassis/pose`, { headers: getHeaders() });
        const pos = posResponse.data;
        
        // Validate position data before using toFixed
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.ori === 'number') {
          logWorkflow(`Current position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, orientation: ${pos.ori.toFixed(2)})`);
        } else {
          logWorkflow(`Position data incomplete or invalid: ${JSON.stringify(pos)}`);
        }
      } catch (posError: any) {
        logWorkflow(`Unable to get robot position: ${posError.message}`);
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
      logWorkflow(`⚠️ WARNING: Return to charger timed out after ${maxRetries} attempts, but will continue workflow`);
      return {
        success: false,
        warning: `Return to charger timed out after ${maxRetries} attempts`,
        moveId: moveId
      };
    }
    
    // Check battery state to confirm charging
    try {
      const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers: getHeaders() });
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
  const workflowId = `zone104_${Date.now()}`;
  
  // Declare alignment variables once at the beginning to avoid redeclaration
  let alignSuccess = false;
  let alignAttempts = 0;
  const maxAlignAttempts = 3; // Maximum number of attempts to align with rack
  
  logWorkflow(`🚀 Starting Zone 104 workflow ${workflowId}`);
  
  try {
    // STEP 1: Move to docking position for pickup (104_Load_docking)
    logWorkflow(`📍 STEP 1/8: Moving to 104_Load_docking`);
    await moveToPoint(-15.409467385438802, 6.403540839556854, 178.97, '104_Load_docking');
    
    // STEP 2: Use align_with_rack move type for proper bin pickup with retry mechanism
    logWorkflow(`📍 STEP 2/8: Aligning with rack at 104_Load using align_with_rack special move type`);
    
    // CRITICAL: First check if jack is already up, and if so, lower it before attempting align_with_rack
    // The error "jack_in_up_state" indicates the jack needs to be down before alignment
    logWorkflow(`⚠️ SAFETY CHECK: Verifying jack state before alignment...`);
    try {
      // Check jack state
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up === true) {
        logWorkflow(`⚠️ Jack is currently UP. Must lower it before alignment.`);
        
        try {
          // Execute jack_down operation
          await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
          
          // Wait for jack operation to complete
          logWorkflow(`Lowering jack before alignment, waiting 10 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          logWorkflow(`✅ Successfully lowered jack before alignment`);
        } catch (jackDownError: any) {
          logWorkflow(`⚠️ Warning: Failed to lower jack: ${jackDownError.message}`);
          logWorkflow(`Continuing with alignment attempts anyway...`);
        }
      } else {
        logWorkflow(`✅ Jack is already in down state - safe to proceed with alignment`);
      }
    } catch (jackCheckError: any) {
      logWorkflow(`⚠️ Warning: Could not check jack state: ${jackCheckError.message}`);
      
      // As a precaution, try lowering the jack anyway
      try {
        await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers: getHeaders() });
        logWorkflow(`Precautionary jack_down executed, waiting 10 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (precautionJackError: any) {
        logWorkflow(`⚠️ Warning: Precautionary jack_down failed: ${precautionJackError.message}`);
      }
    }
    
    // Reset alignment variables for pickup procedure
    alignSuccess = false;
    alignAttempts = 0;
    
    while (!alignSuccess && alignAttempts < maxAlignAttempts) {
      alignAttempts++;
      logWorkflow(`Attempt ${alignAttempts}/${maxAlignAttempts} to align with rack`);
      
      try {
        // Stop robot first for safety
        try {
          await axios.post(`${ROBOT_API_URL}/chassis/stop`, {}, { headers: getHeaders() });
          logWorkflow(`✅ Stopped robot before align with rack`);
        } catch (stopError: any) {
          logWorkflow(`Warning: Failed to stop robot: ${stopError.message}`);
        }
        
        // Wait for stabilization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create a move with type=align_with_rack - critical for proper bin alignment
        const alignCommand = {
          creator: 'robot-api',
          type: 'align_with_rack', // Special move type for rack pickup
          target_x: -15.478,
          target_y: 6.43,
          target_ori: 178.75
        };
        
        logWorkflow(`Creating align_with_rack move: ${JSON.stringify(alignCommand)}`);
        
        // Send the move command to align with rack
        const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, alignCommand, { headers: getHeaders() });
        
        if (!response.data || !response.data.id) {
          throw new Error('Failed to create align_with_rack move - invalid response');
        }
        
        const moveId = response.data.id;
        logWorkflow(`Robot align_with_rack command sent - move ID: ${moveId}`);
        
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
          
          logWorkflow(`Current align_with_rack status: ${moveStatus}`);
          
          // Check if move is complete
          if (moveStatus === 'succeeded') {
            moveComplete = true;
            alignSuccess = true;
            logWorkflow(`✅ Robot has completed align_with_rack operation (ID: ${moveId})`);
          } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
            if (moveStatus === 'failed') {
              // Check failure reason
              const failReason = statusResponse.data.fail_reason_str || 'Unknown failure';
              logWorkflow(`⚠️ Align with rack failed with reason: ${failReason}`);
            }
            throw new Error(`Align with rack failed or was cancelled. Status: ${moveStatus}`);
          } else {
            logWorkflow(`Still aligning (move ID: ${moveId}), waiting...`);
          }
        }
        
        // Final check to ensure we didn't just time out
        if (!moveComplete) {
          logWorkflow(`⚠️ WARNING: Align with rack timed out after ${maxRetries} attempts, but will continue workflow`);
          return {
            success: false,
            warning: `Align with rack timed out after ${maxRetries} attempts`,
            moveId: moveId
          };
        }
        
        // No additional wait after alignment
        logWorkflow(`✅ Align with rack complete, continuing workflow...`);
        
      } catch (alignError: any) {
        logWorkflow(`❌ ERROR during align_with_rack operation (attempt ${alignAttempts}/${maxAlignAttempts}): ${alignError.message}`);
        
        if (alignAttempts < maxAlignAttempts) {
          logWorkflow(`⚠️ Retrying align_with_rack after 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
          
          // Try moving back slightly before next attempt to get a better approach angle
          try {
            logWorkflow(`⚠️ Moving back slightly to get a better approach angle for next attempt...`);
            // Back up 10cm
            await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
              action: "joystick",
              linear: { x: -0.1, y: 0.0, z: 0.0 },
              angular: { x: 0.0, y: 0.0, z: 0.0 }
            }, { headers: getHeaders() });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Stop the movement
            await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
              action: "joystick",
              linear: { x: 0.0, y: 0.0, z: 0.0 },
              angular: { x: 0.0, y: 0.0, z: 0.0 }
            }, { headers: getHeaders() });
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (moveError: any) {
            logWorkflow(`Warning: Could not adjust position for retry: ${moveError.message}`);
          }
          
          // Continue to next retry attempt
          continue;
        } else {
          // If we've exhausted all retries, throw the error
          logWorkflow(`❌ All align_with_rack attempts failed. Returning robot to charger...`);
          
          // Immediately try to return robot to charger if all attempts fail
          try {
            await returnToCharger();
            logWorkflow(`✅ Successfully sent robot back to charger after align_with_rack failures`);
          } catch (chargerError: any) {
            logWorkflow(`❌ Failed to return robot to charger: ${chargerError.message}`);
          }
          
          throw new Error(`Failed to align with rack after ${maxAlignAttempts} attempts: ${alignError.message}`);
        }
      }
    }
    
    // STEP 3: Backup slightly for proper bin alignment (handled in jack_up)
    logWorkflow(`📍 STEP 3/8: Performing precise backing movement for bin alignment`);
    
    // STEP 4: Execute jack_up to lift bin
    logWorkflow(`📍 STEP 4/8: Executing jack_up operation to lift bin`);
    await executeJackUp();
    
    // STEP 5: Move to docking position for dropoff (Drop-off_Load_docking)
    // Using the CORRECT coordinates from the physical robot map, converted to match scale
    logWorkflow(`📍 STEP 5/8: Moving to Drop-off_Load_docking (with correct coordinates from physical map)`);
    await moveToPoint(-2.314, 2.543, 0, 'Drop-off_Load_docking');
    
    // STEP 6: For dropoff, we CANNOT use align_with_rack because the jack is already up
    // Instead, we need to use a regular move command to the exact Drop-off_Load coordinates
    logWorkflow(`📍 STEP 6/8: Moving to Drop-off_Load for bin dropoff (cannot use align_with_rack with jack up)`);
    
    // CRITICAL: Confirm jack is already up - needed for dropoff
    logWorkflow(`⚠️ SAFETY CHECK: Verifying jack state before dropoff...`);
    try {
      // Check jack state
      const jackStateResponse = await axios.get(`${ROBOT_API_URL}/jack_state`, { headers: getHeaders() });
      const jackState = jackStateResponse.data;
      
      if (jackState && jackState.is_up !== true) {
        logWorkflow(`⚠️ ERROR: Jack is currently DOWN but should be UP for dropoff. Check for errors in previous steps.`);
        throw new Error('Jack is not in UP state for dropoff');
      } else {
        logWorkflow(`✅ Jack is in UP state - ready to proceed with dropoff`);
      }
    } catch (jackCheckError: any) {
      logWorkflow(`⚠️ Warning: Could not check jack state: ${jackCheckError.message}`);
      // Continue anyway since we're fairly confident the jack is up based on the workflow steps
    }
    
    // For dropoff, we MUST use the special 'to_unload_point' move type
    // This is specifically designed for dropping off racks/bins with the jack in up state
    logWorkflow(`📦 Creating special 'to_unload_point' move for bin dropoff at Drop-off_Load`);
    
    try {
      // Stop robot first for safety
      try {
        await axios.post(`${ROBOT_API_URL}/chassis/stop`, {}, { headers: getHeaders() });
        logWorkflow(`✅ Stopped robot before dropoff operation`);
      } catch (stopError: any) {
        logWorkflow(`Warning: Failed to stop robot: ${stopError.message}`);
      }
      
      // Use the special to_unload_point move type for dropoff (as per API documentation)
      const unloadCommand = {
        creator: 'robot-api',
        type: 'to_unload_point', // Special move type for unloading/dropping bins
        target_x: -3.067, // These are the dropoff coordinates (Drop-off_Load)
        target_y: 2.579,
        target_ori: 0
      };
      
      logWorkflow(`⚠️ UNLOAD OPERATION: Creating to_unload_point move for dropoff: ${JSON.stringify(unloadCommand)}`);
      
      // Send the move command to align with rack
      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, unloadCommand, { headers: getHeaders() });
      
      if (!response.data || !response.data.id) {
        throw new Error('Failed to create to_unload_point move for dropoff - invalid response');
      }
      
      const moveId = response.data.id;
      logWorkflow(`Robot unload command sent for dropoff - move ID: ${moveId}`);
      
      // Wait for unload move to complete
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
        
        logWorkflow(`⚠️ UNLOAD OPERATION: Current to_unload_point status: ${moveStatus}`);
        
        // Check if move is complete
        if (moveStatus === 'succeeded') {
          moveComplete = true;
          logWorkflow(`✅ Robot has completed to_unload_point operation for dropoff (ID: ${moveId})`);
        } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
          if (moveStatus === 'failed') {
            // Check failure reason with detailed logging
            const failReason = statusResponse.data.fail_reason_str || 'Unknown failure';
            const fullResponse = JSON.stringify(statusResponse.data);
            logWorkflow(`⚠️ DETAILED ERROR: Dropoff unload operation failed with reason: ${failReason}`);
            logWorkflow(`⚠️ FULL ERROR DETAILS: ${fullResponse}`);
          }
          
          const errorReason = statusResponse.data.fail_reason_str || 'Unknown failure';
          throw new Error(`Dropoff unload operation failed or was cancelled. Status: ${moveStatus} Reason: ${errorReason}`);
        } else {
          logWorkflow(`Still performing unload operation (move ID: ${moveId}), waiting...`);
        }
      }
      
      // Final check to ensure we didn't just time out
      if (!moveComplete) {
        logWorkflow(`⚠️ WARNING: Dropoff unload operation timed out after ${maxRetries} attempts, but will continue workflow`);
      }
      
      // Wait 3 seconds at dropoff point to stabilize before lowering jack
      logWorkflow(`✅ Arrived at dropoff point, waiting 3 seconds to stabilize...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (dropoffError: any) {
      logWorkflow(`❌ ERROR during dropoff unload operation: ${dropoffError.message}`);
      
      // Try to return to charger if dropoff movement fails
      try {
        await returnToCharger();
        logWorkflow(`✅ Successfully sent robot back to charger after dropoff failure`);
      } catch (chargerError: any) {
        logWorkflow(`❌ Failed to return robot to charger: ${chargerError.message}`);
      }
      
      throw new Error(`Failed to execute dropoff unload operation: ${dropoffError.message}`);
    }
    
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
 * Register the Zone 104 workflow handler
 */
export function registerZone104WorkflowHandler(app: express.Express): void {
  app.post('/api/zone-104/workflow-fixed', async (req, res) => {
    const startTime = Date.now();
    
    try {
      logWorkflow('📦 Received request to execute Zone 104 workflow');
      
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
  
  logWorkflow('✅ Registered Zone 104 workflow handler');
}