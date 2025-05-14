/**
 * Zone 104 Pickup Workflow
 * 
 * This module implements a workflow to pick up a bin from Zone 104 
 * and deliver it to the Drop-off point, using the correct API endpoints
 * based on AutoXing documentation.
 */

import axios from 'axios';
import { ROBOT_API_URL } from './robot-constants';
import robotPointsMap from './robot-points-map';
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
    
    // Default floor for this operation is Floor 1 (ID: 1)
    const floorId = 1;
    
    // Try to get points from the map first
    let shelfPoint, shelfDocking, dropoffPoint, dropoffDocking;
    
    try {
      shelfPoint = robotPointsMap.getPoint(floorId, '104_load');
      if (!shelfPoint) {
        appendLog('104_load point not found in map, using hardcoded coordinates');
        shelfPoint = SHELF_104_COORDINATES;
      }
      
      shelfDocking = robotPointsMap.getPoint(floorId, '104_load_docking');
      if (!shelfDocking) {
        appendLog('104_load_docking point not found in map, using hardcoded coordinates');
        shelfDocking = SHELF_104_DOCKING;
      }
      
      dropoffPoint = robotPointsMap.getPoint(floorId, 'Drop-off_Load');
      if (!dropoffPoint) {
        appendLog('Drop-off_Load point not found in map, using hardcoded coordinates');
        dropoffPoint = DROPOFF_COORDINATES;
      }
      
      dropoffDocking = robotPointsMap.getPoint(floorId, 'Drop-off_Load_docking');
      if (!dropoffDocking) {
        appendLog('Drop-off_Load_docking point not found in map, using hardcoded coordinates');
        dropoffDocking = DROPOFF_DOCKING;
      }
    } catch (error: any) {
      appendLog(`Error getting map points: ${error.message}. Using hardcoded coordinates.`);
      shelfPoint = SHELF_104_COORDINATES;
      shelfDocking = SHELF_104_DOCKING;
      dropoffPoint = DROPOFF_COORDINATES;
      dropoffDocking = DROPOFF_DOCKING;
    }
    
    // Create a mission in our queue with proper step format
    const mission = missionQueue.createMission(
      `Pickup-104-to-Dropoff-${Date.now()}`,
      [
        {
          type: 'move',
          params: {
            x: shelfDocking.x,
            y: shelfDocking.y,
            theta: shelfDocking.theta,
            label: 'Move to 104 docking point'
          }
        },
        {
          type: 'align_with_rack',
          params: {
            x: shelfPoint.x,
            y: shelfPoint.y,
            theta: shelfPoint.theta,
            label: 'Align with 104 rack'
          }
        },
        {
          type: 'jack_up',
          params: {}
        },
        {
          type: 'move',
          params: {
            x: dropoffDocking.x,
            y: dropoffDocking.y,
            theta: dropoffDocking.theta,
            label: 'Move to drop-off docking point'
          }
        },
        {
          type: 'align_with_rack',
          params: {
            x: dropoffPoint.x,
            y: dropoffPoint.y,
            theta: dropoffPoint.theta,
            label: 'Align with drop-off rack'
          }
        },
        {
          type: 'jack_down',
          params: {}
        },
        {
          type: 'return_to_charger',
          params: {}
        }
      ],
      'L382502104987ir' // Robot serial number
    );
    
    const missionId = mission.id;
    
    appendLog(`Created mission with ID: ${missionId}`);
    
    // The mission queue will automatically process this mission with these steps:
    // 1. Move to 104 docking point
    // 2. Align with rack at 104
    // 3. Jack up to grab bin
    // 4. Move to drop-off docking point
    // 5. Align with drop-off rack
    // 6. Jack down to release bin
    // 7. Return to charger
    
    appendLog('Mission created and queued for processing');
    appendLog('The mission queue system will execute all steps automatically');
    appendLog('---- 104 PICKUP WORKFLOW INITIATED ----');
    
    return { 
      success: true, 
      message: 'Pickup from 104 and drop-off mission created successfully',
      missionId 
    };
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
  
  console.log('[PICKUP-104-WORKFLOW] ✅ Registered pickup-104 workflow handler with AutoXing API endpoints');
}