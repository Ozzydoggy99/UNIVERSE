import { Express, Request, Response } from 'express';
import { storage } from './storage';

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