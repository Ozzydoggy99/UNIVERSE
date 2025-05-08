// server/assign-task-local-dropoff.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { isRobotCharging } from './robot-api';
import { missionQueue } from './mission-queue';

function logRobotTask(message: string) {
  try {
    const logPath = path.resolve(process.cwd(), 'robot-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [LOCAL-DROPOFF] ${message}\n`);
  } catch (err: any) {
    console.error('❌ Failed to write to robot-debug.log:', err.message);
  }
}

export function registerLocalDropoffRoute(app: express.Express) {
  app.post('/api/robots/assign-task/local-dropoff', express.json(), async (req: Request, res: Response) => {
    const { shelf, pickup, standby } = req.body;
    const headers = { 'x-api-key': ROBOT_SECRET };
    const startTime = Date.now();

    logRobotTask(`New LOCAL DROPOFF task received - Shelf: ${shelf.id}, Pickup: ${pickup.id}`);
    logRobotTask(`Full task details: ${JSON.stringify(req.body, null, 2)}`);

    async function moveTo(point: any, label: string, headers: any) {
      logRobotTask(`➡️ Initiating move to ${label} (${point.x}, ${point.y}, yaw: ${point.ori ?? 0})`);
      try {
        // Step 1: Send move command to robot
        await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
          action: 'move_to',
          target_x: point.x,
          target_y: point.y,
          target_ori: point.ori ?? 0
        }, { headers });

        // Step 2: Poll for move completion
        const maxWaitMs = 30000;
        const pollIntervalMs = 2000;
        let waited = 0;

        while (waited < maxWaitMs) {
          await new Promise(res => setTimeout(res, pollIntervalMs));
          waited += pollIntervalMs;

          const stateRes = await axios.get(`${ROBOT_API_URL}/robot/state`, { headers });
          const moveState = stateRes.data?.data?.moveState;

          logRobotTask(`⏱️ moveState: ${moveState} after ${waited / 1000}s`);

          if (moveState === 'idle') {
            logRobotTask(`✅ Robot arrived at ${label}`);
            return;
          }
        }

        throw new Error(`Timeout waiting for move to ${label} to complete`);
      } catch (err: any) {
        logRobotTask(`❌ Error moving to ${label}: ${err.message || err.response?.data}`);
        throw err;
      }
    }

    try {
      // Check if robot is charging before attempting jack up
      logRobotTask('🚀 Starting LOCAL DROPOFF sequence');
      const charging = await isRobotCharging();
      
      // Create mission plan based on charging status
      let missionSteps = [];
      
      if (charging) {
        logRobotTask('⚠️ Robot is currently charging. Creating simplified mission (no bin operations)');
        
        // Simplified mission without bin operations
        missionSteps = [
          // Step 1: Go to pickup point
          {
            type: 'move' as const,
            params: {
              x: pickup.x,
              y: pickup.y,
              ori: pickup.ori ?? 0,
              label: `pickup ${pickup.id}`
            }
          },
          // Step 2: Go to shelf (without jack operations)
          {
            type: 'move' as const,
            params: {
              x: shelf.x,
              y: shelf.y,
              ori: shelf.ori ?? 0,
              label: `shelf ${shelf.id}`
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
          // Step 1: Go to pickup point
          {
            type: 'move' as const,
            params: {
              x: pickup.x,
              y: pickup.y,
              ori: pickup.ori ?? 0,
              label: `pickup ${pickup.id}`
            }
          },
          // Step 2: Jack Up
          {
            type: 'jack_up' as const,
            params: {}
          },
          // Step 3: Go to shelf
          {
            type: 'move' as const,
            params: {
              x: shelf.x,
              y: shelf.y,
              ori: shelf.ori ?? 0,
              label: `shelf ${shelf.id}`
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
      const missionName = `Local Dropoff - Pickup ${pickup.id} to Shelf ${shelf.id}`;
      const mission = missionQueue.createMission(missionName, missionSteps, 'L382502104987ir');
      
      logRobotTask(`Mission created with ID: ${mission.id}`);
      logRobotTask(`Mission will continue executing even if the robot goes offline`);
      
      // Start immediate execution of the first step to provide feedback
      // The rest will continue in the background via the queue
      await missionQueue.processMissionQueue();
      
      const totalDuration = Date.now() - startTime;
      logRobotTask(`🚀 LOCAL DROPOFF task initiated. Planning took: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: charging ? 
          'Local dropoff task started in simplified mode (robot is charging).' : 
          'Local dropoff task started with full bin operations.',
        missionId: mission.id,
        charging,
        duration: totalDuration
      });
    } catch (err: any) {
      const errorMessage = err.response?.data || err.message;
      logRobotTask(`❌ LOCAL DROPOFF task error: ${errorMessage}`);
      res.status(500).json({ error: err.message, response: err.response?.data });
    }
  });
}