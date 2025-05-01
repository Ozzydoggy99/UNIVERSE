import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { registerRobot } from './register-robot';

// We only support a single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';
// Robot API URL
const ROBOT_API_URL = 'http://8f50-47-180-91-99.ngrok-free.app';

// Topic endpoints for different data types
const ROBOT_TOPIC_STATUS = '/status';
const ROBOT_TOPIC_POSITION = '/tracked_pose'; // Position comes from tracked_pose topic
const ROBOT_TOPIC_SENSORS = '/battery_state'; // Sensors data comes from battery_state
const ROBOT_TOPIC_MAP = '/map'; // Map data comes from map topic
const ROBOT_TOPIC_CAMERA = '/rgb_cameras/front/compressed'; // Camera data

// Type definitions for robot data
interface RobotStatus {
  model: string;
  serialNumber: string;
  battery: number;
  status: string;
  mode: string;
  lastUpdate: string;
}

interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

interface RobotSensorData {
  temperature: number;
  humidity: number;
  proximity: number[];
  battery: number;
  timestamp: string;
  light?: number;
  noise?: number;
}

interface MapPoint {
  x: number;
  y: number;
  z: number;
}

interface MapPath {
  points: MapPoint[];
  status: string;
}

interface MapData {
  grid: any[];
  obstacles: MapPoint[];
  paths: MapPath[];
}

interface CameraData {
  enabled: boolean;
  streamUrl: string;
  resolution: {
    width: number;
    height: number;
  };
  rotation: number;
  nightVision: boolean;
  timestamp: string;
}

/**
 * Register all robot-related API routes
 */
export function registerRobotApiRoutes(app: Express) {
  // Register a physical robot for remote communication
  app.get('/api/robots/register-physical/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const model = req.query.model as string || 'Unknown Physical Robot';
      
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
      try {
        console.log('Fetching live status data for robot:', PHYSICAL_ROBOT_SERIAL);
        
        // Fetch live status data
        const statusResponse = await fetch(`${ROBOT_API_URL}/status`);
        
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch robot status: ${statusResponse.status} ${statusResponse.statusText}`);
        }
        
        const liveStatusData = await statusResponse.json() as { status?: string };
        
        // Create status object with live data
        const status: RobotStatus = {
          model: "Physical Robot (Live)",
          serialNumber: PHYSICAL_ROBOT_SERIAL,
          battery: 0, // Will be updated with sensor data
          status: liveStatusData.status || 'unknown',
          mode: 'ready',
          lastUpdate: new Date().toISOString()
        };
        
        // Also fetch sensor data for battery info
        try {
          const sensorResponse = await fetch(`${ROBOT_API_URL}/sensors`);
          if (sensorResponse.ok) {
            const liveSensorData = await sensorResponse.json() as { battery?: number };
            
            // Update battery level if available
            if (liveSensorData.battery !== undefined) {
              status.battery = liveSensorData.battery;
            }
          }
        } catch (sensorErr) {
          console.error('Error fetching sensor data for battery info:', sensorErr);
        }
        
        console.log('Using live data for robot status:', PHYSICAL_ROBOT_SERIAL);
        robots.push(status);
      } catch (err) {
        console.error('Error fetching live robot status:', err);
        return res.status(500).json({ error: 'Failed to fetch live robot status' });
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
      
      try {
        console.log('Fetching live status data for robot:', serialNumber);
        // Fetch live status data
        const statusResponse = await fetch(`${ROBOT_API_URL}/status`);
        
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch robot status: ${statusResponse.status} ${statusResponse.statusText}`);
        }
        
        const liveStatusData = await statusResponse.json() as { status?: string };
        
        // Create status object with live data
        const status: RobotStatus = {
          model: "Physical Robot (Live)",
          serialNumber,
          battery: 0, // Will be updated with sensor data
          status: liveStatusData.status || 'unknown',
          mode: liveStatusData.mode || 'ready',
          lastUpdate: new Date().toISOString()
        };
        
        // Also fetch sensor data for battery info
        try {
          const sensorResponse = await fetch(`${ROBOT_API_URL}/sensors`);
          if (sensorResponse.ok) {
            const liveSensorData = await sensorResponse.json() as { battery?: number };
            
            // Update battery level if available
            if (liveSensorData.battery !== undefined) {
              status.battery = liveSensorData.battery;
            }
          }
        } catch (sensorErr) {
          console.error('Error fetching sensor data for battery info:', sensorErr);
          return res.status(500).json({ error: 'Failed to fetch robot sensor data' });
        }
        
        console.log('Using live data for robot status:', serialNumber);
        res.json(status);
      } catch (err) {
        console.error('Error fetching live robot status:', err);
        return res.status(500).json({ error: 'Failed to fetch live robot status' });
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
      
      // Instead of updating demo data, we would send the command to the physical robot here
      console.log('Would send status update to physical robot:', statusUpdate);
      
      // For now, just return a success response with the current status
      try {
        const statusResponse = await fetch(`${ROBOT_API_URL}/status`);
        
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch robot status: ${statusResponse.status} ${statusResponse.statusText}`);
        }
        
        const liveStatusData = await statusResponse.json() as { status?: string };
        
        const status: RobotStatus = {
          model: "Physical Robot (Live)",
          serialNumber,
          battery: 0,
          status: liveStatusData.status || 'unknown',
          mode: statusUpdate.mode || 'ready',
          lastUpdate: new Date().toISOString()
        };
        
        // Get battery from sensor data
        try {
          const sensorResponse = await fetch(`${ROBOT_API_URL}/sensors`);
          if (sensorResponse.ok) {
            const liveSensorData = await sensorResponse.json() as { battery?: number };
            if (liveSensorData.battery !== undefined) {
              status.battery = liveSensorData.battery;
            }
          }
        } catch (sensorErr) {
          console.error('Error fetching sensor data for battery info:', sensorErr);
        }
        
        res.json(status);
      } catch (err) {
        console.error('Error fetching live robot status after update:', err);
        return res.status(500).json({ error: 'Failed to update robot status' });
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
      
      // Fetch live position data
      try {
        console.log('Fetching live position data for robot:', serialNumber);
        const positionResponse = await fetch(`${ROBOT_API_URL}/position`);
        
        if (!positionResponse.ok) {
          throw new Error(`Failed to fetch robot position: ${positionResponse.status} ${positionResponse.statusText}`);
        }
        
        const livePositionData = await positionResponse.json();
        
        // Create a position object with live data
        const position: RobotPosition = {
          x: livePositionData.x || 0,
          y: livePositionData.y || 0,
          z: livePositionData.z || 0,
          orientation: livePositionData.orientation || 0,
          speed: livePositionData.speed || 0,
          timestamp: livePositionData.timestamp || new Date().toISOString()
        };
        
        console.log('Using live data for robot position:', serialNumber);
        res.json(position);
      } catch (err) {
        console.error('Error fetching live robot position:', err);
        return res.status(500).json({ error: 'Failed to fetch live robot position' });
      }
    } catch (error) {
      console.error('Error fetching robot position:', error);
      res.status(500).json({ error: 'Failed to fetch robot position' });
    }
  });

  // Update a robot's position (only for our physical robot)
  app.post('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const positionUpdate = req.body;
      
      if (!positionUpdate || typeof positionUpdate !== 'object') {
        return res.status(400).json({ error: 'Position update data is required' });
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
      
      // Instead of updating demo data, we would send the command to the physical robot here
      console.log('Would send position update to physical robot:', positionUpdate);
      
      // For now, just return the latest position
      try {
        const positionResponse = await fetch(`${ROBOT_API_URL}/position`);
        
        if (!positionResponse.ok) {
          throw new Error(`Failed to fetch robot position: ${positionResponse.status} ${positionResponse.statusText}`);
        }
        
        const livePositionData = await positionResponse.json();
        
        // Return live position data
        const position: RobotPosition = {
          x: livePositionData.x || 0,
          y: livePositionData.y || 0,
          z: livePositionData.z || 0,
          orientation: livePositionData.orientation || 0,
          speed: livePositionData.speed || 0,
          timestamp: new Date().toISOString()
        };
        
        res.json(position);
      } catch (err) {
        console.error('Error fetching live robot position after update:', err);
        return res.status(500).json({ error: 'Failed to update robot position' });
      }
    } catch (error) {
      console.error('Error updating robot position:', error);
      res.status(500).json({ error: 'Failed to update robot position' });
    }
  });

  // Get a specific robot sensor data by serial number
  app.get('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Fetch live sensor data
      try {
        console.log('Fetching live sensor data for robot:', serialNumber);
        const sensorResponse = await fetch(`${ROBOT_API_URL}/sensors`);
        
        if (!sensorResponse.ok) {
          throw new Error(`Failed to fetch robot sensors: ${sensorResponse.status} ${sensorResponse.statusText}`);
        }
        
        const liveSensorData = await sensorResponse.json();
        
        // Create sensor data object with live data
        const sensors: any = {
          temperature: liveSensorData.temperature || 0,
          humidity: liveSensorData.humidity || 0,
          proximity: liveSensorData.proximity || [0, 0, 0, 0],
          battery: liveSensorData.battery || 0,
          timestamp: liveSensorData.timestamp || new Date().toISOString()
        };
        
        // Include additional sensor data if available
        if (liveSensorData.light !== undefined) sensors.light = liveSensorData.light;
        if (liveSensorData.noise !== undefined) sensors.noise = liveSensorData.noise;
        
        console.log('Using live data for robot sensors:', serialNumber);
        res.json(sensors);
      } catch (err) {
        console.error('Error fetching live robot sensors:', err);
        return res.status(500).json({ error: 'Failed to fetch live robot sensors' });
      }
    } catch (error) {
      console.error('Error fetching robot sensors:', error);
      res.status(500).json({ error: 'Failed to fetch robot sensors' });
    }
  });

  // Update a robot's sensor data
  app.post('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const sensorUpdate = req.body;
      
      if (!sensorUpdate || typeof sensorUpdate !== 'object') {
        return res.status(400).json({ error: 'Sensor update data is required' });
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
      
      // Instead of updating demo data, we would send the command to the physical robot here
      console.log('Would send sensor update to physical robot:', sensorUpdate);
      
      // For now, just return the latest sensor data
      try {
        const sensorResponse = await fetch(`${ROBOT_API_URL}/sensors`);
        
        if (!sensorResponse.ok) {
          throw new Error(`Failed to fetch robot sensors: ${sensorResponse.status} ${sensorResponse.statusText}`);
        }
        
        const liveSensorData = await sensorResponse.json();
        
        // Create sensor data object with live data
        const sensors: any = {
          temperature: liveSensorData.temperature || 0,
          humidity: liveSensorData.humidity || 0,
          proximity: liveSensorData.proximity || [0, 0, 0, 0],
          battery: liveSensorData.battery || 0,
          timestamp: new Date().toISOString()
        };
        
        // Include additional sensor data if available
        if (liveSensorData.light !== undefined) sensors.light = liveSensorData.light;
        if (liveSensorData.noise !== undefined) sensors.noise = liveSensorData.noise;
        
        res.json(sensors);
      } catch (err) {
        console.error('Error fetching live robot sensors after update:', err);
        return res.status(500).json({ error: 'Failed to update robot sensors' });
      }
    } catch (error) {
      console.error('Error updating robot sensors:', error);
      res.status(500).json({ error: 'Failed to update robot sensors' });
    }
  });

  // Get a specific robot map data by serial number
  app.get('/api/robots/map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Fetch live map data
      try {
        console.log('Fetching live map data for robot:', serialNumber);
        const mapResponse = await fetch(`${ROBOT_API_URL}/map`);
        
        if (!mapResponse.ok) {
          throw new Error(`Failed to fetch robot map: ${mapResponse.status} ${mapResponse.statusText}`);
        }
        
        const liveMapData = await mapResponse.json();
        
        // Create map data object with live data
        const mapData: MapData = {
          grid: liveMapData.grid || [],
          obstacles: liveMapData.obstacles || [],
          paths: liveMapData.paths || []
        };
        
        console.log('Using live data for robot map:', serialNumber);
        res.json(mapData);
      } catch (err) {
        console.error('Error fetching live robot map:', err);
        return res.status(500).json({ error: 'Failed to fetch live robot map' });
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
      
      // Create camera data with live information
      const cameraData: CameraData = {
        enabled: true,
        streamUrl: `https://8f50-47-180-91-99.ngrok-free.app/robot-camera/${serialNumber}`,
        resolution: {
          width: 1280,
          height: 720
        },
        rotation: 0,
        nightVision: true,
        timestamp: new Date().toISOString()
      };
      
      res.json(cameraData);
    } catch (error) {
      console.error('Error fetching robot camera data:', error);
      res.status(500).json({ error: 'Failed to fetch robot camera data' });
    }
  });

  // Toggle camera state (enable/disable)
  app.post('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { enabled } = req.body;
      
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
      
      // Instead of updating demo data, we would send the command to the physical robot here
      console.log('Would toggle camera for physical robot:', enabled);
      
      // Return updated camera data
      const cameraData: CameraData = {
        enabled: enabled !== undefined ? enabled : true,
        streamUrl: enabled ? `https://8f50-47-180-91-99.ngrok-free.app/robot-camera/${serialNumber}` : '',
        resolution: {
          width: 1280,
          height: 720
        },
        rotation: 0,
        nightVision: true,
        timestamp: new Date().toISOString()
      };
      
      res.json(cameraData);
    } catch (error) {
      console.error('Error updating robot camera:', error);
      res.status(500).json({ error: 'Failed to update robot camera' });
    }
  });

  // Get all robot template assignments
  app.get('/api/robot-assignments', async (req: Request, res: Response) => {
    try {
      // Add cache control headers to prevent caching
      res.set('Cache-Control', 'no-store, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      // Get all robot template assignments from storage
      const assignments = await storage.getAllRobotTemplateAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching robot assignments:', error);
      res.status(500).json({ error: 'Failed to fetch robot assignments' });
    }
  });

  // Get robot by serial number
  app.get('/api/robot-assignments/by-serial/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Find the robot assignment by serial number
      const assignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!assignment) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error fetching robot assignment:', error);
      res.status(500).json({ error: 'Failed to fetch robot assignment' });
    }
  });

  // Register a physical robot and assign it to a template
  app.post('/api/robot-assignments/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not supported' });
      }
      
      // Register the robot with the template
      const result = await registerRobot(serialNumber, model, templateId);
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot with template:', error);
      res.status(500).json({ error: 'Failed to register robot with template' });
    }
  });

  // Get robot's current task
  app.get('/api/robots/task/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // For now, we don't have task data from the robot API
      // In a real implementation, we would fetch from the robot API
      const task = "Monitoring environment";
      
      res.json({ task });
    } catch (error) {
      console.error('Error fetching robot task:', error);
      res.status(500).json({ error: 'Failed to fetch robot task' });
    }
  });

  // Update a robot assignment
  app.put('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      // Add cache control headers to prevent caching
      res.set('Cache-Control', 'no-store, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // Get the assignment first to check if it exists
      const existingAssignment = await storage.getRobotTemplateAssignment(id);
      
      if (!existingAssignment) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      // Update the assignment in storage
      const updatedAssignment = await storage.updateRobotTemplateAssignment(id, updates);
      
      if (!updatedAssignment) {
        return res.status(500).json({ error: 'Failed to update robot assignment' });
      }
      
      // Return the updated assignment
      res.json(updatedAssignment);
    } catch (error) {
      console.error('Error updating robot assignment:', error);
      res.status(500).json({ error: 'Failed to update robot assignment' });
    }
  });

  // Delete a robot assignment
  app.delete('/api/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the assignment first to check if it exists
      const assignment = await storage.getRobotTemplateAssignment(id);
      
      if (!assignment) {
        return res.status(404).json({ error: 'Robot assignment not found' });
      }
      
      // Delete the assignment from storage
      const success = await storage.deleteRobotTemplateAssignment(id);
      
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete robot assignment' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting robot assignment:', error);
      res.status(500).json({ error: 'Failed to delete robot assignment' });
    }
  });
}