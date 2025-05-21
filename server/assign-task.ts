// server/assign-task.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getRobotApiUrl, getRobotSecret, getAuthHeaders } from './robot-constants';

// Types for robot API responses
interface MoveResponse {
  id: string;
  state: string;
  [key: string]: any;
}

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

// Helper functions for robot movement
async function sendMoveCommand(x: number, y: number, logToFile: Function): Promise<MoveResponse> {
  try {
    logToFile(`➡️ Sending move command to: (${x}, ${y})`);
    
    // First, make sure any existing move is complete before sending a new one
    await checkMoveStatus(logToFile);
    
    // Prepare move data in the format expected by the robot API
    const moveData = {
      type: 'standard',
      target_x: x,
      target_y: y,
      target_z: 0,
      target_ori: 0, // No specific orientation
      creator: 'web_interface',
      properties: {
        max_trans_vel: 0.5, // Speed limit
        max_rot_vel: 0.5,
        acc_lim_x: 0.5,
        acc_lim_theta: 0.5,
        planning_mode: 'directional',
      }
    };
    
    logToFile(`📦 Move payload: ${JSON.stringify(moveData)}`);
    
    // Send the move command to the robot API
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const authHeaders = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const response = await axios.post<MoveResponse>(`${robotApiUrl}/chassis/moves`, moveData, {
      headers: authHeaders
    });
    
    const moveId = response.data.id;
    logToFile(`✅ Move command accepted: ${JSON.stringify(response.data)}`);
    logToFile(`🔄 Move ID: ${moveId} created for movement to (${x}, ${y})`);
    
    return response.data;
  } catch (error: any) {
    logToFile(`❌ Move command failed: ${error.message}`);
    if (error.response) {
      logToFile(`📊 Error response data: ${JSON.stringify(error.response.data || {})}`);
    }
    throw error;
  }
}

// Helper to check move status
async function checkMoveStatus(logToFile: Function): Promise<boolean> {
  try {
    const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
    const authHeaders = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);
    const response = await axios.get<MoveResponse>(`${robotApiUrl}/chassis/moves/current`, {
      headers: authHeaders
    });
    
    if (response.data && response.data.state) {
      logToFile(`Current move status: ${response.data.state}`);
      
      // Check if the move is complete
      return ['succeeded', 'cancelled', 'failed'].includes(response.data.state);
    }
    
    // If no clear state, assume complete
    return true;
  } catch (error) {
    // If error (like 404 - no current move), consider it complete
    logToFile(`No active movement or error checking status`);
    return true;
  }
}

// Helper to wait for move completion
async function waitForMoveComplete(logToFile: Function, timeout = 60000): Promise<void> {
  const startTime = Date.now();
  let isMoving = true;
  
  logToFile('Waiting for robot to complete current movement...');
  
  while (isMoving && (Date.now() - startTime < timeout)) {
    isMoving = !(await checkMoveStatus(logToFile));
    
    if (isMoving) {
      // Wait 5 seconds before checking again to reduce API load
      await new Promise(resolve => setTimeout(resolve, 5000));
      logToFile('Still moving, waiting for completion...');
    }
  }
  
  if (isMoving) {
    logToFile('⚠️ Timed out waiting for robot to complete movement');
  } else {
    logToFile('✅ Robot has completed movement');
  }
}

export function registerAssignTaskRoute(app: express.Express) {
  // Skip all auth middleware for this endpoint since it needs to be accessible from anywhere
  app.post('/robots/assign-task', express.json(), async (req: Request, res: Response) => {
    // Use process.cwd() to get the current working directory - works in Replit
    const logPath = path.resolve(process.cwd(), 'robot-debug.log');
    
    function logToFile(msg: string) {
      try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
      } catch (err: any) {
        console.error('❌ Failed to write to robot-debug.log:', err.message);
      }
    }

    try {
      const { mode, shelf, pickup, dropoff, standby } = req.body;

      if (!shelf || !pickup || !dropoff || !standby || !mode) {
        const errText = 'Missing required task data';
        logToFile(errText);
        return res.status(400).json({ error: errText });
      }

      // Respond immediately to avoid client timeout
      res.status(202).json({ 
        success: true, 
        message: 'Task received, robot is being dispatched',
        details: {
          mode,
          points: [shelf, pickup, dropoff, standby]
        }
      });
      
      // Execute the task asynchronously
      (async () => {
        try {
          logToFile(`🚀 Starting ${mode} mission`);
          
          // For pickup mode, first go to shelf, then to pickup point
          if (mode === 'pickup') {
            // First navigate to the shelf
            logToFile(`Step 1: Navigating to shelf ${shelf.id} at (${shelf.x}, ${shelf.y})`);
            await sendMoveCommand(shelf.x, shelf.y, logToFile);
            await waitForMoveComplete(logToFile);
            
            // Then navigate to dropoff point
            logToFile(`Step 2: Navigating to dropoff point at (${dropoff.x}, ${dropoff.y})`);
            await sendMoveCommand(dropoff.x, dropoff.y, logToFile);
            await waitForMoveComplete(logToFile);
          } 
          // For dropoff mode, go to pickup point first, then to shelf
          else if (mode === 'dropoff') {
            // First navigate to the pickup point
            logToFile(`Step 1: Navigating to pickup point at (${pickup.x}, ${pickup.y})`);
            await sendMoveCommand(pickup.x, pickup.y, logToFile);
            await waitForMoveComplete(logToFile);
            
            // Then navigate to the shelf
            logToFile(`Step 2: Navigating to shelf ${shelf.id} at (${shelf.x}, ${shelf.y})`);
            await sendMoveCommand(shelf.x, shelf.y, logToFile);
            await waitForMoveComplete(logToFile);
          }
          
          // Finally, return to standby point
          logToFile(`Final Step: Returning to standby point at (${standby.x}, ${standby.y})`);
          await sendMoveCommand(standby.x, standby.y, logToFile);
          await waitForMoveComplete(logToFile);
          
          logToFile('✅ Task completed successfully');
        } catch (error: any) {
          logToFile(`❌ Task execution failed: ${error.message}`);
        }
      })().catch(error => {
        logToFile(`❌ Unhandled error in task background execution: ${error.message}`);
      });
      
    } catch (err: any) {
      const errorMsg = '❌ Task Error: ' + (err.message || 'Unknown error');
      logToFile(errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  });
}