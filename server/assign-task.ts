// server/assign-task.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

export function registerAssignTaskRoute(app: express.Express) {
  app.post('/api/robots/assign-task', async (req: Request, res: Response) => {
    try {
      const { mode, shelf, pickup, dropoff, standby } = req.body;

      if (!shelf || !pickup || !dropoff || !standby || !mode) {
        return res.status(400).json({ error: 'Missing required task data' });
      }

      const headers = { 'x-api-key': ROBOT_SECRET };
      const robotId = standby.robotId || 'robot_001'; // Replace if you have dynamic IDs

      const points: any[] = [];

      if (mode === 'pickup') {
        points.push({
          x: shelf.x,
          y: shelf.y,
          yaw: shelf.ori,
          areaId: 1,
          type: -1,
          ext: { name: `Pickup from ${shelf.id}` },
          stepActs: [{ type: 47, data: {} }] // LiftUp
        });
        points.push({
          x: dropoff.x,
          y: dropoff.y,
          yaw: dropoff.ori,
          areaId: 1,
          type: -1,
          ext: { name: 'Drop-off Point' },
          stepActs: [{ type: 48, data: {} }] // LiftDown
        });
      } else if (mode === 'dropoff') {
        points.push({
          x: pickup.x,
          y: pickup.y,
          yaw: pickup.ori,
          areaId: 1,
          type: -1,
          ext: { name: 'Pickup Point' },
          stepActs: [{ type: 47, data: {} }] // LiftUp
        });
        points.push({
          x: shelf.x,
          y: shelf.y,
          yaw: shelf.ori,
          areaId: 1,
          type: -1,
          ext: { name: `Drop at ${shelf.id}` },
          stepActs: [{ type: 48, data: {} }] // LiftDown
        });
      }

      const task = {
        name: `AutoTask-${mode}-${Date.now()}`,
        robotId,
        routeMode: 1,
        runMode: 1,
        runNum: 1,
        taskType: 4,
        runType: 21,
        ignorePublicSite: false,
        speed: 1.0,
        pts: points,
        backPt: {
          type: 10,
          x: standby.x,
          y: standby.y,
          yaw: standby.ori,
          areaId: 1,
          ext: { name: 'Return to Standby' }
        }
      };

      console.log('Submitting task to robot API:', JSON.stringify(task, null, 2));

      // Create Task
      const createRes = await axios.post(`${ROBOT_API_URL}/tasks`, task, { headers });
      const taskId = createRes.data?.data?.id;
      if (!taskId) throw new Error('Failed to create task');

      console.log(`Task created successfully with ID: ${taskId}`);

      // Start Task
      await axios.post(`${ROBOT_API_URL}/tasks/${taskId}/start`, {}, { headers });
      console.log(`Task ${taskId} started successfully`);

      res.json({ success: true, taskId });
    } catch (err: any) {
      console.error('❌ Task assignment failed:', err.response?.data || err.message);
      res.status(500).json({ error: err.message });
    }
  });
}