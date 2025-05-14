/**
 * Zone 104 Pickup Workflow
 * 
 * This module implements a workflow to pick up a bin from Zone 104 
 * and deliver it to the Drop-off point, using the correct API endpoints
 * based on AutoXing documentation.
 */

import axios from 'axios';
import { ROBOT_API_URL } from './robot-constants';
import { robotPointsMap } from './robot-points-map';
import { appendLog } from './debug-log';
import { missionQueue } from './mission-queue';

// Constants for coordinates
// Note: In a production system, these would come from the robot's map or our database
const SHELF_104_COORDINATES = {
  id: '104_load',
  x: 5.2,
  y: 3.7,
  theta: 270
};

const SHELF_104_DOCKING = {
  id: '104_load_docking',
  x: 5.0,
  y: 4.2,
  theta: 270
};

const DROPOFF_COORDINATES = {
  id: 'Drop-off_Load',
  x: 2.1, 
  y: 1.5,
  theta: 180
};

const DROPOFF_DOCKING = {
  id: 'Drop-off_Load_docking',
  x: 1.8,
  y: 1.9,
  theta: 180
};

// Get authorization headers
function getAuthHeaders() {
  return {
    'Secret': process.env.ROBOT_SECRET_KEY || 'APPCODE 667a51a4d948433081a272c78d10a8a4'
  };
}

/**
 * Sleep for the specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a move operation to complete by polling the latest move status
 */
async function waitForMoveComplete(maxRetries = 60): Promise<void> {
  appendLog('Waiting for move to complete...');
  const headers = getAuthHeaders();
  
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const res = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { 
        headers,
        timeout: 5000
      });
      
      const { state, fail_reason_str } = res.data;
      appendLog(`Move status: ${state}${fail_reason_str ? ` (${fail_reason_str})` : ''}`);
      
      if (state === 'succeeded') {
        appendLog('Move completed successfully');
        return;
      } else if (state === 'failed') {
        throw new Error(`Move failed: ${fail_reason_str || 'Unknown reason'}`);
      } else if (state === 'cancelled') {
        throw new Error('Move was cancelled');
      }
      
    } catch (err: any) {
      appendLog(`Warning: Status check error: ${err.message}`);
      // Continue retrying despite errors - the robot might just be transitioning states
    }
    
    await sleep(2000); // Poll every 2 seconds
    retries++;
  }
  
  throw new Error(`Robot did not report arrival within timeout (${maxRetries * 2} seconds)`);
}

/**
 * Execute the pickup workflow from zone 104 to drop-off
 */
export async function executePickup104Workflow() {
  appendLog('---- STARTING 104 PICKUP WORKFLOW ----');
  
  try {
    const headers = getAuthHeaders();
    
    // Get real points from map if available, otherwise use hardcoded fallbacks
    const shelfPoint = robotPointsMap.getPoint('104_load') || SHELF_104_COORDINATES;
    const shelfDocking = robotPointsMap.getPoint('104_load_docking') || SHELF_104_DOCKING;
    const dropoffPoint = robotPointsMap.getPoint('Drop-off_Load') || DROPOFF_COORDINATES;
    const dropoffDocking = robotPointsMap.getPoint('Drop-off_Load_docking') || DROPOFF_DOCKING;
    
    // Create a mission in our queue
    const missionId = await missionQueue.createMission({
      name: `Pickup-104-to-Dropoff-${Date.now()}`,
      steps: [
        { name: 'Move to 104 docking', completed: false, retryCount: 0 },
        { name: 'Align with 104 rack', completed: false, retryCount: 0 },
        { name: 'Jack up to lift bin', completed: false, retryCount: 0 },
        { name: 'Move to drop-off docking', completed: false, retryCount: 0 },
        { name: 'Align with drop-off rack', completed: false, retryCount: 0 },
        { name: 'Jack down to release bin', completed: false, retryCount: 0 },
        { name: 'Return to charger', completed: false, retryCount: 0 }
      ]
    });
    
    appendLog(`Created mission with ID: ${missionId}`);
    
    // Step 1: Move to 104 docking point
    appendLog('Step 1: Moving to 104 docking point...');
    const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "pickup-104-workflow",
      type: "standard",
      target_x: shelfDocking.x,
      target_y: shelfDocking.y,
      target_ori: shelfDocking.theta,
      properties: {
        max_trans_vel: 0.5,
        max_rot_vel: 0.5
      }
    }, { headers });
    
    appendLog(`Move command sent, move ID: ${moveResponse.data.id}`);
    await waitForMoveComplete();
    await missionQueue.completeStep(missionId, 0);
    
    // Step 2: Align with the rack
    appendLog('Step 2: Aligning with the rack...');
    const alignResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "pickup-104-workflow",
      type: "align_with_rack",
      target_x: shelfPoint.x,
      target_y: shelfPoint.y,
      target_ori: shelfPoint.theta
    }, { headers });
    
    appendLog(`Align command sent, align ID: ${alignResponse.data.id}`);
    await waitForMoveComplete();
    await missionQueue.completeStep(missionId, 1);
    
    // Step 3: Jack up
    appendLog('Step 3: Jacking up to lift the bin...');
    await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
    
    // Wait for jack up to complete
    appendLog('Waiting for jack up operation to complete (8 seconds)...');
    await sleep(8000);
    await missionQueue.completeStep(missionId, 2);
    
    // Step 4: Move to drop-off point
    appendLog('Step 4: Moving to drop-off docking point...');
    const moveToDropoffResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "pickup-104-workflow",
      type: "standard",
      target_x: dropoffDocking.x,
      target_y: dropoffDocking.y,
      target_ori: dropoffDocking.theta,
      properties: {
        max_trans_vel: 0.4,  // Move slower when carrying a bin
        max_rot_vel: 0.4
      }
    }, { headers });
    
    appendLog(`Move to drop-off command sent, move ID: ${moveToDropoffResponse.data.id}`);
    await waitForMoveComplete();
    await missionQueue.completeStep(missionId, 3);
    
    // Step 5: Align with drop-off rack
    appendLog('Step 5: Aligning with drop-off rack...');
    const alignDropoffResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      creator: "pickup-104-workflow",
      type: "align_with_rack",
      target_x: dropoffPoint.x,
      target_y: dropoffPoint.y,
      target_ori: dropoffPoint.theta
    }, { headers });
    
    appendLog(`Align with drop-off command sent, align ID: ${alignDropoffResponse.data.id}`);
    await waitForMoveComplete();
    await missionQueue.completeStep(missionId, 4);
    
    // Step 6: Jack down
    appendLog('Step 6: Jacking down to release the bin...');
    await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
    
    // Wait for jack down to complete
    appendLog('Waiting for jack down operation to complete (8 seconds)...');
    await sleep(8000);
    await missionQueue.completeStep(missionId, 5);
    
    // Step 7: Return to charger
    appendLog('Step 7: Returning to charger...');
    try {
      // Try the services API first (preferred method)
      await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { headers });
      appendLog('Return to charger command sent via services API');
    } catch (error: any) {
      appendLog(`Services API failed: ${error.message}. Trying move action instead...`);
      
      // Fall back to move action with type "charge"
      const chargeResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        creator: "pickup-104-workflow",
        type: "charge",
        charge_retry_count: 3
      }, { headers });
      
      appendLog(`Return to charger command sent via move action, ID: ${chargeResponse.data.id}`);
    }
    
    // Wait for return to charger to complete
    appendLog('Waiting for return to charger to complete...');
    await waitForMoveComplete(120); // Longer timeout for charger return
    await missionQueue.completeStep(missionId, 6);
    
    // Complete the mission
    await missionQueue.completeMission(missionId);
    
    appendLog('---- 104 PICKUP WORKFLOW COMPLETED SUCCESSFULLY ----');
    return { success: true, missionId };
  } catch (error: any) {
    appendLog(`ERROR: Workflow failed: ${error.message}`);
    appendLog(`Stack trace: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Register route handler for 104 pickup workflow
 */
export function registerPickup104WorkflowHandler(app: any) {
  app.post('/api/workflow/pickup-104', async (req: any, res: any) => {
    try {
      appendLog('Received request to execute pickup-104 workflow');
      const result = await executePickup104Workflow();
      res.json(result);
    } catch (error: any) {
      appendLog(`Error in pickup-104 API route: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  appendLog('[PICKUP-104-WORKFLOW] ✅ Registered pickup-104 workflow handler');
}