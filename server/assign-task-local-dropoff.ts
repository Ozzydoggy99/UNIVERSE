// server/assign-task-local-dropoff.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

function logRobotTask(message: string) {
  try {
    const logPath = path.resolve(process.cwd(), 'robot-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [LOCAL-DROPOFF] ${message}\n`);
  } catch (err: any) {
    console.error('❌ Failed to write to robot-debug.log:', err.message);
  }
}

export function registerLocalDropoffRoute(app: express.Express) {
  app.post('/robots/assign-task/local/dropoff', express.json(), async (req: Request, res: Response) => {
    const { shelf, pickup, standby } = req.body;
    const headers = { 'x-api-key': ROBOT_SECRET };
    const startTime = Date.now();

    logRobotTask(`New LOCAL DROPOFF task received - Shelf: ${shelf.id}, Pickup: ${pickup.id}`);
    logRobotTask(`Full task details: ${JSON.stringify(req.body, null, 2)}`);

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
      // Step 1: Go to pickup point
      logRobotTask('🚀 Starting LOCAL DROPOFF sequence');
      await moveTo(pickup, `pickup point ${pickup.id}`);

      // Step 2: Jack Up
      logRobotTask('⬆️ Lifting bin...');
      const jackUpResponse = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      logRobotTask(`✅ Jack up operation complete - Response: ${JSON.stringify(jackUpResponse.data)}`);

      // Step 3: Go to shelf
      await moveTo(shelf, `shelf ${shelf.id}`);

      // Step 4: Jack Down
      logRobotTask('⬇️ Dropping bin...');
      const jackDownResponse = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
      logRobotTask(`✅ Jack down operation complete - Response: ${JSON.stringify(jackDownResponse.data)}`);

      // Step 5: Return to standby
      await moveTo(standby, 'standby');

      const totalDuration = Date.now() - startTime;
      logRobotTask(`🏁 LOCAL DROPOFF task complete. Total duration: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: 'Local dropoff task complete.',
        duration: totalDuration
      });
    } catch (err: any) {
      const errorMessage = err.response?.data || err.message;
      logRobotTask(`❌ LOCAL DROPOFF task error: ${errorMessage}`);
      res.status(500).json({ error: err.message, response: err.response?.data });
    }
  });
}