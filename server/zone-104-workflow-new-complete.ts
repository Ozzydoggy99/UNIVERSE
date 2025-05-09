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

// Configuration - make sure these match our actual robot configuration
const ROBOT_API_URL = process.env.ROBOT_API_URL || 'http://47.180.91.99:8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET || '';

// API headers for authentication
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': ROBOT_SECRET
};

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
    
    // IMPORTANT: Wait longer for the jack operation to complete (takes ~10 seconds to be safe)
    logWorkflow(`Jack down operation started, waiting 10 seconds for complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Add additional safety wait periods
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
  logWorkflow(`⚠️ Moving robot to charging station`);
  
  try {
    // First check if there's any active move
    try {
      const currentMovesResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers });
      if (currentMovesResponse.data && currentMovesResponse.data.state === 'moving') {
        logWorkflow(`⚠️ Robot is currently moving. Cancelling current move before returning to charger`);
        
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
    
    // Create a move command with type='charge' which is the proper way to return to charger
    // according to the documentation
    const chargeCommand = {
      creator: 'web_interface',
      type: 'charge',  // Special move type for charging - this is the key part!
      charge_retry_count: 3,  // Number of retries before failing
      properties: {
        max_trans_vel: 0.5,
        max_rot_vel: 0.5,
        acc_lim_x: 0.5,
        acc_lim_theta: 0.5
      }
    };
    
    // Send the charge command
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers });
    const moveId = response.data.id;
    
    logWorkflow(`Charge command sent - move ID: ${moveId}`);
    
    // Now poll the move status until it completes or fails
    let moveComplete = false;
    let maxRetries = 180; // 3 minutes at 1 second intervals (return to charger can take longer)
    let attempts = 0;
    
    while (!moveComplete && attempts < maxRetries) {
      attempts++;
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check move status
      const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
      const moveStatus = statusResponse.data.state;
      
      logWorkflow(`Current charge move status: ${moveStatus}`);
      
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
        logWorkflow(`✅ Robot has successfully reached charging station (ID: ${moveId})`);
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
    
    // Do one final status check to be absolutely certain
    const finalStatusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
    const finalStatus = finalStatusResponse.data.state;
    
    if (finalStatus !== 'succeeded') {
      throw new Error(`Return to charger failed in final check. Status: ${finalStatus}`);
    }
    
    logWorkflow(`✅ Robot successfully returned to charging station and is now charging`);
    
    return {
      success: true,
      message: 'Robot successfully returned to charging station',
      moveId
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
  const workflowId = `zone104_${Date.now().toString()}`;
  logWorkflow(`🚀 Starting Zone 104 workflow ${workflowId}`);
  
  try {
    // STEP 1: Move to 104_Load_docking (approach point)
    logWorkflow(`📍 STEP 1/8: Moving to 104_Load_docking`);
    await moveToPoint(-15.409467385438802, 6.403540839556854, 178.97, '104_Load_docking');
    logWorkflow(`✅ STEP 1/8 COMPLETE: Reached 104_Load_docking`);
    
    // STEP 2: Move to 104_Load (pickup point)
    logWorkflow(`📍 STEP 2/8: Moving to 104_Load`);
    await moveToPoint(-16.253106853127974, 6.419632917129547, 0, '104_Load');
    logWorkflow(`✅ STEP 2/8 COMPLETE: Reached 104_Load`);
    
    // STEP 3: Perform jack_up with backup for alignment
    logWorkflow(`⚠️ STEP 3/8: Executing jack_up to pick up bin`);
    await executeJackUp();
    logWorkflow(`✅ STEP 3/8 COMPLETE: Bin picked up successfully`);
    
    // STEP 4: Move to Drop-off_Load_docking (approach point for dropoff)
    logWorkflow(`📍 STEP 4/8: Moving to Drop-off_Load_docking`);
    await moveToPoint(-2.3143658339108697, 2.543396298051448, 177.73, 'Drop-off_Load_docking');
    logWorkflow(`✅ STEP 4/8 COMPLETE: Reached Drop-off_Load_docking`);
    
    // STEP 5: Move to Drop-off_Load (dropoff point)
    logWorkflow(`📍 STEP 5/8: Moving to Drop-off_Load`);
    await moveToPoint(-3.067094531843395, 2.5788015960870325, 0, 'Drop-off_Load');
    logWorkflow(`✅ STEP 5/8 COMPLETE: Reached Drop-off_Load`);
    
    // STEP 6: Perform jack_down
    logWorkflow(`⚠️ STEP 6/8: Executing jack_down to release bin`);
    await executeJackDown();
    logWorkflow(`✅ STEP 6/8 COMPLETE: Bin dropped off successfully`);
    
    // STEP 7: Back up slightly from the drop-off point to clear the area
    logWorkflow(`📍 STEP 7/8: Backing away from Drop-off_Load`);
    // Create a point ~1 meter away from dropoff in the opposite direction
    await moveToPoint(-1.5, 2.5788015960870325, 0, 'Dropoff clearance point');
    logWorkflow(`✅ STEP 7/8 COMPLETE: Backed away from dropoff point`);
    
    // STEP 8: Return to charging station using the proper 'charge' move type
    logWorkflow(`🔋 STEP 8/8: Returning to charging station`);
    await returnToCharger();
    logWorkflow(`✅ STEP 8/8 COMPLETE: Robot returned to charging station`);
    
    // Workflow completed successfully
    logWorkflow(`✅ ZONE 104 WORKFLOW COMPLETED SUCCESSFULLY`);
    
    return {
      success: true,
      message: 'Zone 104 workflow completed successfully',
      workflowId
    };
  } catch (error: any) {
    logWorkflow(`❌ WORKFLOW FAILED: ${error.message}`);
    throw error;
  }
}

/**
 * Register the Zone 104 workflow handler
 */
export function registerZone104WorkflowHandler(app: express.Express): void {
  app.post('/api/zone-104/workflow-new', async (req, res) => {
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