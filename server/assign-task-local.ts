// server/assign-task-local.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { isRobotCharging } from './robot-api';
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
  app.post('/robots/assign-task/local', async (req, res) => {
    const startTime = Date.now();
    const { shelf, pickup, standby } = req.body;
    const headers = { 'x-api-key': ROBOT_SECRET };
    
    logRobotTask(`New LOCAL PICKUP task received - Shelf: ${shelf?.id}, Pickup: ${pickup?.id}`);
    logRobotTask(`Full task details: ${JSON.stringify({
      shelf: { id: shelf?.id, x: shelf?.x, y: shelf?.y, ori: shelf?.ori },
      pickup: { id: pickup?.id, x: pickup?.x, y: pickup?.y, ori: pickup?.ori },
      standby: { id: standby?.id, x: standby?.x, y: standby?.y, ori: standby?.ori }
    }, null, 2)}`);

    async function moveTo(point: any, label: string) {
      const moveStartTime = Date.now();
      logRobotTask(`➡️ Moving to ${label} (${point.x}, ${point.y}, ori: ${point.ori ?? 0})`);
      
      try {
        // Start the move
        const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
          action: 'move_to',
          target_x: point.x,
          target_y: point.y,
          target_ori: point.ori ?? 0
        }, { headers });
        
        const moveId = moveResponse.data.id;
        logRobotTask(`🔄 Move to ${label} started with ID: ${moveId}`);
        
        // Poll until move completes
        let moveStatus = 'moving';
        while (moveStatus === 'moving') {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between checks
          
          const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
          moveStatus = statusResponse.data.state;
          logRobotTask(`🔄 Move to ${label} status: ${moveStatus}`);
        }
        
        const duration = Date.now() - moveStartTime;
        logRobotTask(`✅ Move to ${label} complete in ${duration}ms - Final status: ${moveStatus}`);
        return moveResponse;
      } catch (error: any) {
        logRobotTask(`❌ Move to ${label} failed: ${error.message}`);
        if (error.response) {
          logRobotTask(`Error response: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      }
    }

    try {
      // Check if robot is charging before attempting jack up
      logRobotTask('🚀 Starting LOCAL PICKUP sequence');
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