// server/robot-task-api.ts
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { Point } from '@shared/types';

interface TaskRequest {
  mode: 'pickup' | 'dropoff';
  shelf: Point;
  pickup?: Point;
  dropoff?: Point;
  standby?: Point;
}

// The known robot serial number from the constants
const ROBOT_SERIAL = "L382502104987ir";

/**
 * Send a move command to the robot
 * @param x - Target x coordinate
 * @param y - Target y coordinate
 * @returns Promise that resolves when the move command is sent
 */
async function sendMoveCommand(x: number, y: number): Promise<any> {
  try {
    console.log(`Sending move command to robot: (${x}, ${y})`);
    
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
    
    // Send the move command to the robot API
    const response = await fetch(`${ROBOT_API_URL}/chassis/moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      },
      body: JSON.stringify(moveData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Robot API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Move command sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send move command:', error);
    throw error;
  }
}

/**
 * Wait for the robot to complete its current move before sending the next command
 */
async function waitForMoveComplete(timeout = 60000): Promise<void> {
  const startTime = Date.now();
  let isMoving = true;
  
  console.log('Waiting for robot to complete current movement...');
  
  while (isMoving && (Date.now() - startTime < timeout)) {
    try {
      // Check the current move status
      const response = await fetch(`${ROBOT_API_URL}/chassis/moves/current`, {
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // If no current move, assume it's complete
        isMoving = false;
        continue;
      }
      
      const moveStatus = await response.json();
      
      // Check if the move is complete
      if (moveStatus.state === 'succeeded' || 
          moveStatus.state === 'cancelled' || 
          moveStatus.state === 'failed') {
        isMoving = false;
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error checking move status:', error);
      // On error, wait a bit and continue checking
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  if (isMoving) {
    console.warn('Timed out waiting for robot to complete movement');
  } else {
    console.log('Robot has completed movement');
  }
}

/**
 * Register robot task API routes
 */
export function registerRobotTaskRoutes(app: express.Express) {
  /**
   * POST /api/robots/assign-task
   * Assign a task to the robot
   */
  app.post('/api/robots/assign-task', async (req: Request, res: Response) => {
    try {
      const task = req.body as TaskRequest;
      console.log('Received task request:', task);
      
      if (!task.mode || !task.shelf) {
        return res.status(400).json({ error: 'Missing required task parameters' });
      }
      
      // Respond immediately to avoid client timeout
      res.status(202).json({ success: true, message: 'Task received, robot is being dispatched' });
      
      // Process the task asynchronously
      (async () => {
        try {
          // For pickup mode, first go to shelf, then to pickup point
          if (task.mode === 'pickup') {
            // First navigate to the shelf
            console.log(`Navigating to shelf ${task.shelf.id} at (${task.shelf.x}, ${task.shelf.y})`);
            await sendMoveCommand(task.shelf.x, task.shelf.y);
            await waitForMoveComplete();
            
            // Then navigate to pickup point if available
            if (task.pickup) {
              console.log(`Navigating to pickup point at (${task.pickup.x}, ${task.pickup.y})`);
              await sendMoveCommand(task.pickup.x, task.pickup.y);
              await waitForMoveComplete();
            }
          } 
          // For dropoff mode, go to dropoff point first, then to shelf
          else if (task.mode === 'dropoff') {
            // First navigate to the dropoff point if available
            if (task.dropoff) {
              console.log(`Navigating to dropoff point at (${task.dropoff.x}, ${task.dropoff.y})`);
              await sendMoveCommand(task.dropoff.x, task.dropoff.y);
              await waitForMoveComplete();
            }
            
            // Then navigate to the shelf
            console.log(`Navigating to shelf ${task.shelf.id} at (${task.shelf.x}, ${task.shelf.y})`);
            await sendMoveCommand(task.shelf.x, task.shelf.y);
            await waitForMoveComplete();
          }
          
          // Finally, return to standby point if available
          if (task.standby) {
            console.log(`Navigating to standby point at (${task.standby.x}, ${task.standby.y})`);
            await sendMoveCommand(task.standby.x, task.standby.y);
            await waitForMoveComplete();
          }
          
          console.log('Task completed successfully');
        } catch (error) {
          console.error('Failed to execute task in background:', error);
        }
      })().catch(error => {
        console.error('Unhandled error in task background execution:', error);
      });
      
    } catch (error: any) {
      console.error('❌ Failed to assign task:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });
  
  /**
   * POST /api/go-home
   * Send the robot back to its charging station
   */
  app.post('/api/go-home', async (req: Request, res: Response) => {
    try {
      console.log('Sending robot to charging station');
      
      // Find the charging station through the robot's points API
      const pointsResponse = await fetch(`${ROBOT_API_URL}/points`, {
        headers: {
          'Secret': ROBOT_SECRET || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!pointsResponse.ok) {
        throw new Error(`Failed to get robot points: ${pointsResponse.status} ${pointsResponse.statusText}`);
      }
      
      const points = await pointsResponse.json();
      const chargingStation = points.find((p: any) => 
        p.name && p.name.toLowerCase().includes('charging')
      );
      
      if (!chargingStation) {
        throw new Error('No charging station found in robot points');
      }
      
      console.log('Found charging station:', chargingStation);
      
      // Send the robot to the charging station
      await sendMoveCommand(chargingStation.x, chargingStation.y);
      
      res.status(200).json({ 
        success: true, 
        message: 'Robot is returning to the charging station'
      });
    } catch (error: any) {
      console.error('Failed to send robot to charging station:', error);
      res.status(500).json({ 
        error: error.message || 'Unknown error'
      });
    }
  });
}