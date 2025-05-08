// server/assign-task-local.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { isRobotCharging, isEmergencyStopPressed } from './robot-api';
import { missionQueue } from './mission-queue';

// Configure debug log file - consistent with assign-task.ts
const debugLogFile = path.join(process.cwd(), 'robot-debug.log');

// Helper function to log robot task information to debug file
function logRobotTask(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [LOCAL-PICKUP] ${message}\n`;
  
  // Log to console and to file
  console.log(logEntry);
  fs.appendFileSync(debugLogFile, logEntry);
}

export function registerLocalPickupRoute(app: express.Express) {
  app.post('/api/robots/assign-task/local', async (req, res) => {
    const startTime = Date.now();
    const { shelf, pickup, standby } = req.body;
    const headers = { 'x-api-key': ROBOT_SECRET };
    
    logRobotTask(`New LOCAL PICKUP task received - Shelf: ${shelf?.id}, Pickup: ${pickup?.id}`);
    logRobotTask(`Full task details: ${JSON.stringify({
      shelf: { id: shelf?.id, x: shelf?.x, y: shelf?.y, ori: shelf?.ori },
      pickup: { id: pickup?.id, x: pickup?.x, y: pickup?.y, ori: pickup?.ori },
      standby: { id: standby?.id, x: standby?.x, y: standby?.y, ori: standby?.ori }
    }, null, 2)}`);

    async function moveTo(point: any, label: string, headers: any) {
      logRobotTask(`➡️ Sending move command to: (${point.x}, ${point.y})`);

      const payload = {
        type: "standard",
        target_x: point.x,
        target_y: point.y,
        target_z: 0,
        target_ori: point.ori || 0,
        creator: "web_interface",
        properties: {
          max_trans_vel: 0.5,
          max_rot_vel: 0.5,
          acc_lim_x: 0.5,
          acc_lim_theta: 0.5,
          planning_mode: "directional"
        }
      };

      const moveRes = await axios.post(`${ROBOT_API_URL}/chassis/moves`, payload, { headers });
      logRobotTask(`✅ Move command sent: ${JSON.stringify(moveRes.data)}`);
      
      // Robot specific API doesn't have /robot/state endpoint
      // We'll wait a fixed time to let the robot start moving
      logRobotTask(`Robot move command sent for ${label} - move ID: ${moveRes.data.id}`);
      
      // Wait a fixed amount of time - the robot should eventually complete the move
      // In a real implementation, we'd monitor position via WebSocket
      await new Promise(res => setTimeout(res, 5000));
      
      logRobotTask(`Robot move command to ${label} considered complete`);
      return moveRes.data;
    }

    try {
      // Check if robot is charging before attempting jack up
      logRobotTask('🚀 Starting LOCAL PICKUP sequence');
      
      // Check emergency stop status first
      const emergencyStopPressed = await isEmergencyStopPressed();
      if (emergencyStopPressed) {
        const errorMsg = '🚨 Emergency stop button is pressed. Please release it before executing tasks.';
        logRobotTask(errorMsg);
        return res.status(400).json({ 
          success: false, 
          error: errorMsg,
          code: 'EMERGENCY_STOP_PRESSED'
        });
      }
      
      // Then check charging status
      const charging = await isRobotCharging();
      
      // Create mission plan based on charging status
      let missionSteps = [];
      
      if (charging) {
        logRobotTask('⚠️ Robot is currently charging. Creating simplified mission (no bin operations)');
        
        // Simplified mission without bin operations
        missionSteps = [
          // Step 1: Go to Shelf
          {
            type: 'move' as const,
            params: {
              x: shelf.x,
              y: shelf.y,
              ori: shelf.ori ?? 0,
              label: `shelf ${shelf.id}`
            }
          },
          // Step 2: Go to pickup point (without jack operations)
          {
            type: 'move' as const,
            params: {
              x: pickup.x,
              y: pickup.y,
              ori: pickup.ori ?? 0,
              label: `pickup ${pickup.id}`
            }
          },
          // Step 3: Return to standby
          {
            type: 'move' as const,
            params: {
              x: standby.x,
              y: standby.y,
              ori: standby.ori ?? 0,
              label: 'standby'
            }
          }
        ];
        
        logRobotTask(`Created simplified mission plan with ${missionSteps.length} steps (charging mode)`);
        
      } else {
        // Full mission with bin operations
        logRobotTask('Creating full mission plan with bin operations');
        
        missionSteps = [
          // Step 1: Go to Shelf
          {
            type: 'move' as const,
            params: {
              x: shelf.x,
              y: shelf.y,
              ori: shelf.ori ?? 0,
              label: `shelf ${shelf.id}`
            }
          },
          // Step 2: Jack Up
          {
            type: 'jack_up' as const,
            params: {}
          },
          // Step 3: Go to pickup point
          {
            type: 'move' as const,
            params: {
              x: pickup.x,
              y: pickup.y,
              ori: pickup.ori ?? 0,
              label: `pickup ${pickup.id}`
            }
          },
          // Step 4: Jack Down
          {
            type: 'jack_down' as const,
            params: {}
          },
          // Step 5: Return to standby
          {
            type: 'move' as const,
            params: {
              x: standby.x,
              y: standby.y,
              ori: standby.ori ?? 0,
              label: 'standby'
            }
          }
        ];
        
        logRobotTask(`Created full mission plan with ${missionSteps.length} steps`);
      }
      
      // Create the mission in the queue
      const missionName = `Local Pickup - Shelf ${shelf.id} to Pickup ${pickup.id}`;
      const mission = missionQueue.createMission(missionName, missionSteps, 'L382502104987ir');
      
      logRobotTask(`Mission created with ID: ${mission.id}`);
      logRobotTask(`Mission will continue executing even if the robot goes offline`);
      
      // Start immediate execution of the first step to provide feedback
      // The rest will continue in the background via the queue
      await missionQueue.processMissionQueue();
      
      const totalDuration = Date.now() - startTime;
      logRobotTask(`🚀 LOCAL PICKUP task initiated. Planning took: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: charging ? 
          'Local pickup task started in simplified mode (robot is charging).' : 
          'Local pickup task started with full bin operations.',
        missionId: mission.id,
        charging,
        duration: totalDuration
      });
    } catch (err: any) {
      const errorMessage = err.response?.data || err.message;
      logRobotTask(`❌ LOCAL PICKUP task error: ${errorMessage}`);
      res.status(500).json({ error: err.message, response: err.response?.data });
    }
  });
}