import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { registerRobot } from './register-robot';
import {
  getRobotStatus,
  getRobotPosition,
  getRobotSensorData,
  getRobotMapData,
  getRobotCameraData,
  isRobotConnected
} from './robot-websocket';

// We only support a single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

/**
 * Register all robot-related API routes
 */
export function registerRobotApiRoutes(app: Express) {
  // Register a physical robot for remote communication
  app.get('/api/robots/register-physical/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const model = req.query.model as string || 'Physical Robot';
      
      // Only allow our specific robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not supported' });
      }
      
      // Attempt to register the robot
      const result = await registerRobot(serialNumber, model);
      res.json(result);
    } catch (error) {
      console.error('Error registering physical robot:', error);
      res.status(500).json({ error: 'Failed to register physical robot' });
    }
  });

  // Register a robot and optionally assign it to a template
  app.post('/api/robots/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      // Only allow our specific robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not supported' });
      }
      
      // Register the robot with the template
      const result = await registerRobot(serialNumber, model, templateId);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot:', error);
      res.status(500).json({ error: 'Failed to register robot' });
    }
  });

  // Get all robot statuses
  app.get('/api/robots/statuses', async (req: Request, res: Response) => {
    try {
      const robots = [];
      
      // Only fetch data for our physical robot
      const status = getRobotStatus(PHYSICAL_ROBOT_SERIAL);
      
      if (status) {
        robots.push(status);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return an empty array if no robots are found
        return res.json([]);
      }
      
      res.json(robots);
    } catch (error) {
      console.error('Error fetching robot statuses:', error);
      res.status(500).json({ error: 'Failed to fetch robot statuses' });
    }
  });

  // Get a specific robot status by serial number
  app.get('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // First check if we have a robot assignment for this serial number
      const robotAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!robotAssignment) {
        console.warn(`No robot assignment found for serial ${serialNumber}`);
      } else {
        console.log(`Found robot assignment for ${serialNumber}: ${robotAssignment.name}`);
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get status from WebSocket cache
      const status = getRobotStatus(serialNumber);
      
      if (status) {
        res.json(status);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return a 404 if the robot is not found
        return res.status(404).json({ error: 'Robot status not available' });
      }
    } catch (error) {
      console.error('Error fetching robot status:', error);
      res.status(500).json({ error: 'Failed to fetch robot status' });
    }
  });

  // Update a robot's status (only for our physical robot)
  app.post('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const statusUpdate = req.body;
      
      if (!statusUpdate || typeof statusUpdate !== 'object') {
        return res.status(400).json({ error: 'Status update data is required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // We're not actually implementing this right now since it would 
      // require commands to the robot, which we don't have documentation for
      console.log('Would send status update to physical robot:', statusUpdate);
      
      // Return current status
      const status = getRobotStatus(serialNumber);
      
      if (status) {
        res.json(status);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot status not available' });
      }
    } catch (error) {
      console.error('Error updating robot status:', error);
      res.status(500).json({ error: 'Failed to update robot status' });
    }
  });

  // Get a specific robot position by serial number
  app.get('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get position from WebSocket cache
      const position = getRobotPosition(serialNumber);
      
      if (position) {
        res.json(position);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return a 404 if the robot is not found
        return res.status(404).json({ error: 'Robot position not available' });
      }
    } catch (error) {
      console.error('Error fetching robot position:', error);
      res.status(500).json({ error: 'Failed to fetch robot position' });
    }
  });

  // Update a robot's position (only for demo purposes)
  app.post('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const positionUpdate = req.body;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // We're not actually implementing this right now since it would 
      // require commands to the robot, which we don't have documentation for
      console.log('Would send position update to physical robot:', positionUpdate);
      
      // Get current position from WebSocket cache
      const position = getRobotPosition(serialNumber);
      
      if (position) {
        res.json(position);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot position not available' });
      }
    } catch (error) {
      console.error('Error updating robot position:', error);
      res.status(500).json({ error: 'Failed to update robot position' });
    }
  });

  // Get sensor data for a specific robot
  app.get('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get sensor data from WebSocket cache
      const sensorData = getRobotSensorData(serialNumber);
      
      if (sensorData) {
        res.json(sensorData);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return a 404 if the robot is not found
        return res.status(404).json({ error: 'Robot sensor data not available' });
      }
    } catch (error) {
      console.error('Error fetching robot sensor data:', error);
      res.status(500).json({ error: 'Failed to fetch robot sensor data' });
    }
  });

  // Update sensor data for a specific robot (only for demo purposes)
  app.post('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // Get current sensor data from WebSocket cache
      const sensorData = getRobotSensorData(serialNumber);
      
      if (sensorData) {
        res.json(sensorData);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot sensor data not available' });
      }
    } catch (error) {
      console.error('Error updating robot sensor data:', error);
      res.status(500).json({ error: 'Failed to update robot sensor data' });
    }
  });

  // Get map data for a specific robot
  app.get('/api/robots/map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get map data from WebSocket cache
      const mapData = getRobotMapData(serialNumber);
      
      if (mapData) {
        res.json(mapData);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return a 404 if the robot is not found
        return res.status(404).json({ error: 'Robot map data not available' });
      }
    } catch (error) {
      console.error('Error fetching robot map data:', error);
      res.status(500).json({ error: 'Failed to fetch robot map data' });
    }
  });

  // Get camera data for a specific robot
  app.get('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get camera data from WebSocket cache
      const cameraData = getRobotCameraData(serialNumber);
      
      if (cameraData) {
        res.json(cameraData);
      } else {
        // If we don't have any data yet, check if the robot is connected
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        // Return a 404 if the robot is not found
        return res.status(404).json({ error: 'Robot camera data not available' });
      }
    } catch (error) {
      console.error('Error fetching robot camera data:', error);
      res.status(500).json({ error: 'Failed to fetch robot camera data' });
    }
  });

  // Update camera settings for a specific robot
  app.post('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // Get current camera data from WebSocket cache
      const cameraData = getRobotCameraData(serialNumber);
      
      if (cameraData) {
        res.json(cameraData);
      } else {
        if (!isRobotConnected()) {
          return res.status(503).json({ 
            error: 'Robot not connected', 
            message: 'The robot is not currently connected. Please check the connection.'
          });
        }
        
        return res.status(404).json({ error: 'Robot camera data not available' });
      }
    } catch (error) {
      console.error('Error updating robot camera settings:', error);
      res.status(500).json({ error: 'Failed to update robot camera settings' });
    }
  });

  // Get all robot-template assignments
  app.get('/api/robot-assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getAllRobotTemplateAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching robot template assignments:', error);
      res.status(500).json({ error: 'Failed to fetch robot template assignments' });
    }
  });

  // Get a robot-template assignment by serial number
  app.get('/api/robot-assignments/by-serial/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const assignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!assignment) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error fetching robot template assignment:', error);
      res.status(500).json({ error: 'Failed to fetch robot template assignment' });
    }
  });

  // Register a robot and assign it to a template
  app.post('/api/robot-assignments/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      // Register the robot
      const result = await registerRobot(serialNumber, model, templateId);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot:', error);
      res.status(500).json({ error: 'Failed to register robot' });
    }
  });

  // Get the current task for a robot
  app.get('/api/robots/task/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Check if robot is registered
      const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!existingAssignment) {
        return res.status(404).json({ 
          error: 'Robot not found', 
          message: 'Please register the robot first using the /api/robots/register endpoint'
        });
      }
      
      // In a real implementation, we would fetch the current task from a task queue
      // For now, return a placeholder response
      res.json({
        taskId: null,
        status: 'idle',
        message: 'No active task'
      });
    } catch (error) {
      console.error('Error fetching robot task:', error);
      res.status(500).json({ error: 'Failed to fetch robot task' });
    }
  });

  // Update a robot-template assignment
  app.put('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }
      
      // Update the assignment
      const updated = await storage.updateRobotTemplateAssignment(parseInt(id, 10), {
        templateId: parseInt(templateId, 10)
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating robot template assignment:', error);
      res.status(500).json({ error: 'Failed to update robot template assignment' });
    }
  });

  // Delete a robot-template assignment
  app.delete('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Delete the assignment
      const success = await storage.deleteRobotTemplateAssignment(parseInt(id, 10));
      
      if (!success) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting robot template assignment:', error);
      res.status(500).json({ error: 'Failed to delete robot template assignment' });
    }
  });
}