import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { registerRobot } from './register-robot';

// Keep track of registered robots
const registeredRobots = new Set<string>();

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

// Demo mode for robot data when no real robot connection is available
const demoRobotStatus: Record<string, RobotStatus> = {
  'AX-2000-1': {
    model: 'AxBot 2000',
    serialNumber: 'AX-2000-1',
    battery: 78,
    status: 'active',
    mode: 'autonomous',
    lastUpdate: new Date().toISOString()
  },
  'AX-2000-2': {
    model: 'AxBot 2000',
    serialNumber: 'AX-2000-2',
    battery: 45,
    status: 'idle',
    mode: 'manual',
    lastUpdate: new Date().toISOString()
  },
  'AX-2000-3': {
    model: 'AxBot 3000',
    serialNumber: 'AX-2000-3',
    battery: 92,
    status: 'charging',
    mode: 'sleep',
    lastUpdate: new Date().toISOString()
  }
};

const demoRobotPositions: Record<string, RobotPosition> = {
  'AX-2000-1': {
    x: 120,
    y: 80,
    z: 0,
    orientation: 90,
    speed: 1.2,
    timestamp: new Date().toISOString()
  },
  'AX-2000-2': {
    x: 85,
    y: 45,
    z: 0,
    orientation: 180,
    speed: 0,
    timestamp: new Date().toISOString()
  },
  'AX-2000-3': {
    x: 220,
    y: 160,
    z: 0,
    orientation: 270,
    speed: 0,
    timestamp: new Date().toISOString()
  }
};

const demoRobotSensors: Record<string, RobotSensorData> = {
  'AX-2000-1': {
    temperature: 23.5,
    humidity: 48,
    proximity: [0.5, 1.2, 2.5, 1.8],
    battery: 78,
    timestamp: new Date().toISOString()
  },
  'AX-2000-2': {
    temperature: 24.2,
    humidity: 51,
    proximity: [1.5, 2.1, 3.5, 0.8],
    battery: 45,
    timestamp: new Date().toISOString()
  },
  'AX-2000-3': {
    temperature: 22.8,
    humidity: 47,
    proximity: [5.5, 4.2, 3.5, 4.8],
    battery: 92,
    timestamp: new Date().toISOString()
  }
};

const demoMapData: Record<string, MapData> = {
  'AX-2000-1': {
    grid: [],
    obstacles: [
      { x: 50, y: 50, z: 0 },
      { x: 100, y: 120, z: 0 },
      { x: 200, y: 80, z: 0 }
    ],
    paths: [
      {
        points: [
          { x: 50, y: 50, z: 0 },
          { x: 75, y: 75, z: 0 },
          { x: 100, y: 100, z: 0 },
          { x: 120, y: 80, z: 0 }
        ],
        status: 'active'
      }
    ]
  },
  'AX-2000-2': {
    grid: [],
    obstacles: [
      { x: 30, y: 30, z: 0 },
      { x: 80, y: 85, z: 0 },
      { x: 150, y: 40, z: 0 }
    ],
    paths: [
      {
        points: [
          { x: 30, y: 30, z: 0 },
          { x: 60, y: 45, z: 0 },
          { x: 85, y: 45, z: 0 }
        ],
        status: 'complete'
      }
    ]
  },
  'AX-2000-3': {
    grid: [],
    obstacles: [
      { x: 200, y: 100, z: 0 },
      { x: 180, y: 150, z: 0 },
      { x: 240, y: 180, z: 0 }
    ],
    paths: [
      {
        points: [
          { x: 180, y: 150, z: 0 },
          { x: 200, y: 155, z: 0 },
          { x: 220, y: 160, z: 0 }
        ],
        status: 'charging'
      }
    ]
  }
};

const demoTasks: Record<string, string> = {
  'AX-2000-1': 'Delivering packages to zone A',
  'AX-2000-2': 'Awaiting instructions',
  'AX-2000-3': 'Charging at station 3'
};

export function registerRobotApiRoutes(app: Express) {
  // Register a new robot or update existing robot
  app.post('/api/robots/register', async (req: Request, res: Response) => {
    try {
      const { serialNumber, model, templateId } = req.body;
      
      if (!serialNumber || !model) {
        return res.status(400).json({ error: 'Serial number and model are required' });
      }
      
      const result = await registerRobot(serialNumber, model, templateId);
      
      // Add this robot to our tracking set
      registeredRobots.add(serialNumber);
      
      // Store initial robot data
      if (!demoRobotStatus[serialNumber]) {
        demoRobotStatus[serialNumber] = {
          model: model,
          serialNumber: serialNumber,
          battery: 100,
          status: 'registered',
          mode: 'manual',
          lastUpdate: new Date().toISOString()
        };
      }
      
      if (!demoRobotPositions[serialNumber]) {
        demoRobotPositions[serialNumber] = {
          x: 0,
          y: 0,
          z: 0,
          orientation: 0,
          speed: 0,
          timestamp: new Date().toISOString()
        };
      }
      
      if (!demoRobotSensors[serialNumber]) {
        demoRobotSensors[serialNumber] = {
          temperature: 22,
          humidity: 50,
          proximity: [100, 100, 100, 100],
          battery: 100,
          timestamp: new Date().toISOString()
        };
      }
      
      if (!demoTasks[serialNumber]) {
        demoTasks[serialNumber] = 'Awaiting instructions';
      }
      
      console.log(`Registered new robot ${serialNumber} with model ${model}`);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering robot:', error);
      res.status(500).json({ error: 'Failed to register robot' });
    }
  });
  
  // Get all robots statuses
  app.get('/api/robots/statuses', async (req: Request, res: Response) => {
    try {
      // In a real implementation, we would fetch actual data from robots
      // For demo purposes, we'll use the demo data
      res.json(demoRobotStatus);
    } catch (error) {
      console.error('Error fetching robot statuses:', error);
      res.status(500).json({ error: 'Failed to fetch robot statuses' });
    }
  });

  // Get a specific robot status by serial number
  app.get('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // In a real implementation, we would fetch actual data from the robot
      // For demo purposes, we'll use the demo data
      const status = demoRobotStatus[serialNumber];
      
      if (!status) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      res.json(status);
    } catch (error) {
      console.error('Error fetching robot status:', error);
      res.status(500).json({ error: 'Failed to fetch robot status' });
    }
  });
  
  // Update a robot's status
  app.post('/api/robots/status/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const statusUpdate = req.body;
      
      if (!statusUpdate) {
        return res.status(400).json({ error: 'Status update data is required' });
      }
      
      // Check if the robot exists in our demo data
      if (!demoRobotStatus[serialNumber]) {
        // This is a new robot, let's make sure it's registered
        const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
        
        if (!existingAssignment) {
          return res.status(404).json({ 
            error: 'Robot not found', 
            message: 'Please register the robot first using the /api/robots/register endpoint'
          });
        }
        
        // Create a new status entry for this robot
        demoRobotStatus[serialNumber] = {
          model: existingAssignment.robotModel || 'Unknown Model',
          serialNumber,
          battery: statusUpdate.battery || 100,
          status: statusUpdate.status || 'active',
          mode: statusUpdate.mode || 'manual',
          lastUpdate: new Date().toISOString()
        };
      } else {
        // Update the existing status with new data
        const currentStatus = demoRobotStatus[serialNumber];
        
        // Update only the provided fields
        if (statusUpdate.battery !== undefined) currentStatus.battery = statusUpdate.battery;
        if (statusUpdate.status !== undefined) currentStatus.status = statusUpdate.status;
        if (statusUpdate.mode !== undefined) currentStatus.mode = statusUpdate.mode;
        currentStatus.lastUpdate = new Date().toISOString();
      }
      
      res.json(demoRobotStatus[serialNumber]);
    } catch (error) {
      console.error('Error updating robot status:', error);
      res.status(500).json({ error: 'Failed to update robot status' });
    }
  });

  // Get a specific robot position by serial number
  app.get('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // In a real implementation, we would fetch actual data from the robot
      // For demo purposes, we'll use the demo data
      const position = demoRobotPositions[serialNumber];
      
      if (!position) {
        return res.status(404).json({ error: 'Robot position not found' });
      }
      
      res.json(position);
    } catch (error) {
      console.error('Error fetching robot position:', error);
      res.status(500).json({ error: 'Failed to fetch robot position' });
    }
  });
  
  // Update a robot's position
  app.post('/api/robots/position/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const positionUpdate = req.body;
      
      if (!positionUpdate || typeof positionUpdate !== 'object') {
        return res.status(400).json({ error: 'Position update data is required' });
      }
      
      // Check if the robot exists in our position data
      if (!demoRobotPositions[serialNumber]) {
        // Check if robot is registered
        const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
        
        if (!existingAssignment) {
          return res.status(404).json({ 
            error: 'Robot not found', 
            message: 'Please register the robot first using the /api/robots/register endpoint'
          });
        }
        
        // Create a new position entry for this robot
        demoRobotPositions[serialNumber] = {
          x: positionUpdate.x !== undefined ? positionUpdate.x : 0,
          y: positionUpdate.y !== undefined ? positionUpdate.y : 0,
          z: positionUpdate.z !== undefined ? positionUpdate.z : 0,
          orientation: positionUpdate.orientation !== undefined ? positionUpdate.orientation : 0,
          speed: positionUpdate.speed !== undefined ? positionUpdate.speed : 0,
          timestamp: new Date().toISOString()
        };
      } else {
        // Update the existing position with new data
        const currentPosition = demoRobotPositions[serialNumber];
        
        // Update only the provided fields
        if (positionUpdate.x !== undefined) currentPosition.x = positionUpdate.x;
        if (positionUpdate.y !== undefined) currentPosition.y = positionUpdate.y;
        if (positionUpdate.z !== undefined) currentPosition.z = positionUpdate.z;
        if (positionUpdate.orientation !== undefined) currentPosition.orientation = positionUpdate.orientation;
        if (positionUpdate.speed !== undefined) currentPosition.speed = positionUpdate.speed;
        currentPosition.timestamp = new Date().toISOString();
      }
      
      res.json(demoRobotPositions[serialNumber]);
    } catch (error) {
      console.error('Error updating robot position:', error);
      res.status(500).json({ error: 'Failed to update robot position' });
    }
  });

  // Get a specific robot sensor data by serial number
  app.get('/api/robots/sensors/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // In a real implementation, we would fetch actual data from the robot
      // For demo purposes, we'll use the demo data
      const sensors = demoRobotSensors[serialNumber];
      
      if (!sensors) {
        return res.status(404).json({ error: 'Robot sensors not found' });
      }
      
      res.json(sensors);
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
      
      // Check if the robot exists in our sensor data
      if (!demoRobotSensors[serialNumber]) {
        // Check if robot is registered
        const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
        
        if (!existingAssignment) {
          return res.status(404).json({ 
            error: 'Robot not found', 
            message: 'Please register the robot first using the /api/robots/register endpoint'
          });
        }
        
        // Create a new sensor entry for this robot
        demoRobotSensors[serialNumber] = {
          temperature: sensorUpdate.temperature !== undefined ? sensorUpdate.temperature : 22,
          humidity: sensorUpdate.humidity !== undefined ? sensorUpdate.humidity : 50,
          proximity: sensorUpdate.proximity !== undefined ? sensorUpdate.proximity : [100, 100, 100, 100],
          battery: sensorUpdate.battery !== undefined ? sensorUpdate.battery : 100,
          timestamp: new Date().toISOString()
        };
      } else {
        // Update the existing sensor data with new data
        const currentSensors = demoRobotSensors[serialNumber];
        
        // Update only the provided fields
        if (sensorUpdate.temperature !== undefined) currentSensors.temperature = sensorUpdate.temperature;
        if (sensorUpdate.humidity !== undefined) currentSensors.humidity = sensorUpdate.humidity;
        if (sensorUpdate.proximity !== undefined) currentSensors.proximity = sensorUpdate.proximity;
        if (sensorUpdate.battery !== undefined) currentSensors.battery = sensorUpdate.battery;
        currentSensors.timestamp = new Date().toISOString();
      }
      
      res.json(demoRobotSensors[serialNumber]);
    } catch (error) {
      console.error('Error updating robot sensors:', error);
      res.status(500).json({ error: 'Failed to update robot sensors' });
    }
  });

  // Get a specific robot map data by serial number
  app.get('/api/robots/map/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // In a real implementation, we would fetch actual data from the robot
      // For demo purposes, we'll use the demo data
      const mapData = demoMapData[serialNumber];
      
      if (!mapData) {
        return res.status(404).json({ error: 'Robot map data not found' });
      }
      
      res.json(mapData);
    } catch (error) {
      console.error('Error fetching robot map data:', error);
      res.status(500).json({ error: 'Failed to fetch robot map data' });
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

  // Get robot's current task
  app.get('/api/robots/task/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // In a real implementation, we would fetch actual task data from the robot
      // For demo purposes, we'll use the demo data
      const task = demoTasks[serialNumber];
      
      if (!task) {
        return res.status(404).json({ error: 'Robot task not found' });
      }
      
      res.json({ task });
    } catch (error) {
      console.error('Error fetching robot task:', error);
      res.status(500).json({ error: 'Failed to fetch robot task' });
    }
  });
}