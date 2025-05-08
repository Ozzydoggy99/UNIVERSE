// server/assign-task-local.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

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

    function moveTo(point: any, label: string) {
      const moveStartTime = Date.now();
      logRobotTask(`➡️ Moving to ${label} (${point.x}, ${point.y}, ori: ${point.ori ?? 0})`);
      
      return axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        action: 'move_to',
        target_x: point.x,
        target_y: point.y,
        target_ori: point.ori ?? 0
      }, { headers })
      .then(response => {
        const duration = Date.now() - moveStartTime;
        logRobotTask(`✅ Move to ${label} complete in ${duration}ms - Response: ${JSON.stringify(response.data)}`);
        return response;
      })
      .catch(error => {
        logRobotTask(`❌ Move to ${label} failed: ${error.message}`);
        if (error.response) {
          logRobotTask(`Error response: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      });
    }

    try {
      // Step 1: Go to Shelf
      logRobotTask('🚀 Starting LOCAL PICKUP sequence');
      await moveTo(shelf, `shelf ${shelf.id}`);

      // Step 2: Jack Up
      logRobotTask('⬆️ Lifting bin...');
      const jackUpResponse = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      logRobotTask(`✅ Jack up operation complete - Response: ${JSON.stringify(jackUpResponse.data)}`);

      // Step 3: Go to pickup point
      await moveTo(pickup, 'pickup point');

      // Step 4: Jack Down
      logRobotTask('⬇️ Dropping bin...');
      const jackDownResponse = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
      logRobotTask(`✅ Jack down operation complete - Response: ${JSON.stringify(jackDownResponse.data)}`);

      // Step 5: Return to standby
      await moveTo(standby, 'standby');

      const totalDuration = Date.now() - startTime;
      logRobotTask(`🏁 LOCAL PICKUP task complete. Total duration: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: 'Local pickup task complete.',
        duration: totalDuration
      });
    } catch (err: any) {
      const errorMessage = err.response?.data || err.message;
      logRobotTask(`❌ LOCAL PICKUP task error: ${errorMessage}`);
      res.status(500).json({ error: err.message, response: err.response?.data });
    }
  });
}