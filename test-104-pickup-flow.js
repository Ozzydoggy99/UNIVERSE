/**
 * Test script to pick up a bin from zone 104 and deliver it to the Drop-off point
 * This script uses the new correct API endpoints based on AutoXing documentation
 */

const axios = require('axios');
require('dotenv').config();

// Environment variables and constants
const ROBOT_API_URL = process.env.ROBOT_API_URL || 'http://47.180.91.99:8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET_KEY || 'APPCODE 667a51a4d948433081a272c78d10a8a4';
const LOG_FILE = 'robot-test-logs.log';
const fs = require('fs');

// Log both to console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Get authorization headers
function getHeaders() {
  return {
    'Secret': ROBOT_SECRET
  };
}

/**
 * Main function to execute pickup from 104 and drop-off operation
 */
async function test104PickupFlow() {
  log('---- STARTING 104 PICKUP TEST FLOW ----');
  log(`Using robot at ${ROBOT_API_URL}`);
  
  try {
    // Step 1: Get current robot position
    log('Step 1: Getting current robot position...');
    const initialPosResponse = await axios.get(`${ROBOT_API_URL}/tracked_pose`, {
      headers: getHeaders()
    });
    log(`Robot position: (${initialPosResponse.data.x}, ${initialPosResponse.data.y}, ${initialPosResponse.data.yaw})`);
    
    // Step 2: Move to 104 docking point
    log('Step 2: Moving to 104 docking point...');
    const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "104-pickup-test",
      type: "standard",
      target_x: 5.2,  // These are example coordinates - replace with actual 104_docking coordinates
      target_y: 3.7,
      target_ori: 270,
      properties: {
        max_trans_vel: 0.5,
        max_rot_vel: 0.5
      }
    }, { headers: getHeaders() });
    
    log(`Move command sent, move ID: ${moveResponse.data.id}`);
    await waitForMoveComplete();
    
    // Step 3: Align with the rack
    log('Step 3: Aligning with the rack...');
    const alignResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "104-pickup-test",
      type: "align_with_rack"
    }, { headers: getHeaders() });
    
    log(`Align command sent, align ID: ${alignResponse.data.id}`);
    await waitForMoveComplete();
    
    // Step 4: Jack up
    log('Step 4: Jacking up to lift the bin...');
    await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { 
      headers: getHeaders() 
    });
    
    // Wait for jack up to complete
    log('Waiting for jack up operation to complete (8 seconds)...');
    await sleep(8000);
    
    // Step 5: Move to drop-off point
    log('Step 5: Moving to drop-off point...');
    const moveToDropoffResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "104-pickup-test",
      type: "standard",
      target_x: 2.1,  // These are example coordinates - replace with actual drop-off coordinates
      target_y: 1.5,
      target_ori: 180,
      properties: {
        max_trans_vel: 0.4,  // Move slower when carrying a bin
        max_rot_vel: 0.4
      }
    }, { headers: getHeaders() });
    
    log(`Move to drop-off command sent, move ID: ${moveToDropoffResponse.data.id}`);
    await waitForMoveComplete();
    
    // Step 6: Align with drop-off rack
    log('Step 6: Aligning with drop-off rack...');
    const alignDropoffResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "104-pickup-test",
      type: "align_with_rack"
    }, { headers: getHeaders() });
    
    log(`Align with drop-off command sent, align ID: ${alignDropoffResponse.data.id}`);
    await waitForMoveComplete();
    
    // Step 7: Jack down
    log('Step 7: Jacking down to release the bin...');
    await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { 
      headers: getHeaders() 
    });
    
    // Wait for jack down to complete
    log('Waiting for jack down operation to complete (8 seconds)...');
    await sleep(8000);
    
    // Step 8: Return to charger
    log('Step 8: Returning to charger...');
    try {
      // Try the services API first
      await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { 
        headers: getHeaders() 
      });
      log('Return to charger command sent via services API');
    } catch (error) {
      log(`Services API failed: ${error.message}. Trying move action instead...`);
      
      // Fall back to move action with type "charge"
      const chargeResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        creator: "104-pickup-test",
        type: "charge",
        charge_retry_count: 3
      }, { headers: getHeaders() });
      
      log(`Return to charger command sent via move action, ID: ${chargeResponse.data.id}`);
    }
    
    // Wait for return to charger to complete
    log('Waiting for return to charger to complete...');
    await waitForMoveComplete(120); // Longer timeout for charger return (2 minutes)
    
    log('---- 104 PICKUP TEST FLOW COMPLETED SUCCESSFULLY ----');
    
  } catch (error) {
    log(`ERROR: Test failed: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
  }
}

/**
 * Wait for a move operation to complete by polling the latest move status
 */
async function waitForMoveComplete(maxRetries = 60) {
  log('Waiting for move to complete...');
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const res = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { 
        headers: getHeaders(),
        timeout: 5000
      });
      
      const { state, fail_reason_str } = res.data;
      log(`Move status: ${state}${fail_reason_str ? ` (${fail_reason_str})` : ''}`);
      
      if (state === 'succeeded') {
        log('Move completed successfully');
        return;
      } else if (state === 'failed') {
        throw new Error(`Move failed: ${fail_reason_str || 'Unknown reason'}`);
      } else if (state === 'cancelled') {
        throw new Error('Move was cancelled');
      }
      
    } catch (err) {
      log(`Warning: Status check error: ${err.message}`);
      // Continue retrying despite errors - the robot might just be transitioning states
    }
    
    await sleep(2000); // Poll every 2 seconds
    retries++;
  }
  
  throw new Error(`Robot did not report arrival within timeout (${maxRetries * 2} seconds)`);
}

/**
 * Sleep for the specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
test104PickupFlow().catch(error => {
  log(`FATAL ERROR: ${error.message}`);
  log(`Stack trace: ${error.stack}`);
});