// server/assign-task.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

export function registerAssignTaskRoute(app: express.Express) {
  // Skip all auth middleware for this endpoint since it needs to be accessible from anywhere
  app.post('/robots/assign-task', express.json(), async (req: Request, res: Response) => {
    // Use a direct path to the current directory for the log file
    const logPath = 'robot-debug.log';
    
    function logToFile(text: string) {
      try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`);
      } catch (error) {
        console.error('Error writing to log file:', error);
      }
    }

    try {
      const { mode, shelf, pickup, dropoff, standby } = req.body;

      if (!shelf || !pickup || !dropoff || !standby || !mode) {
        const errText = 'Missing required task data';
        logToFile(errText);
        return res.status(400).json({ error: errText });
      }

      const headers = { 'x-api-key': ROBOT_SECRET };
      const sn = 'L382502104987ir'; // correct AutoXing serial number for your robot

      const points: any[] = [];

      if (mode === 'pickup') {
        points.push({
          x: shelf.x, y: shelf.y, yaw: shelf.ori, areaId: 1,
          type: -1, ext: { name: `Pickup from ${shelf.id}` },
          stepActs: [{ type: 47, data: {} }]
        });
        points.push({
          x: dropoff.x, y: dropoff.y, yaw: dropoff.ori, areaId: 1,
          type: -1, ext: { name: 'Drop-off Point' },
          stepActs: [{ type: 48, data: {} }]
        });
      } else if (mode === 'dropoff') {
        points.push({
          x: pickup.x, y: pickup.y, yaw: pickup.ori, areaId: 1,
          type: -1, ext: { name: 'Pickup Point' },
          stepActs: [{ type: 47, data: {} }]
        });
        points.push({
          x: shelf.x, y: shelf.y, yaw: shelf.ori, areaId: 1,
          type: -1, ext: { name: `Drop at ${shelf.id}` },
          stepActs: [{ type: 48, data: {} }]
        });
      }

      const task = {
        name: `AutoTask-${mode}-${Date.now()}`,
        sn,
        routeMode: 1,
        runMode: 1,
        runNum: 1,
        taskType: 4,
        runType: 21,
        ignorePublicSite: false,
        speed: 1.0,
        pts: points,
        backPt: {
          type: 10, x: standby.x, y: standby.y, yaw: standby.ori, areaId: 1,
          ext: { name: 'Return to Standby' }
        }
      };

      logToFile('📦 Task Payload:\n' + JSON.stringify(task, null, 2));

      const createRes = await axios.post(`${ROBOT_API_URL}/tasks`, task, { headers });
      const taskId = createRes.data?.data?.id;
      if (!taskId) throw new Error('No taskId returned from /tasks');

      logToFile(`✅ Task Created: ${taskId}`);

      const startRes = await axios.post(`${ROBOT_API_URL}/tasks/${taskId}/start`, {}, { headers });
      logToFile('🚀 Start Response:\n' + JSON.stringify(startRes.data, null, 2));

      res.json({ success: true, taskId });
    } catch (err: any) {
      const errorMsg = '❌ Task Error: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message);
      logToFile(errorMsg);
      res.status(500).json({ error: err.message });
    }
  });
}