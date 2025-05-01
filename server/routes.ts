import express, { type Express, Request, Response } from "express";
import { z } from 'zod';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
import fetch from 'node-fetch';
import { registerRobotApiRoutes } from './robot-api';
import { registerCameraApiRoutes } from './camera-api';
import { registerRobotVideoRoutes, getVideoFrame } from './robot-video';
import { processCameraWebSocketMessage } from './camera-websocket';
import {
  handleRobotStatusRequest,
  handleRobotPositionRequest,
  handleRobotSensorRequest,
  handleRobotMapRequest,
  handleRobotCameraRequest,
  handleToggleRobotCamera
} from './websocket-handlers';
import { adminRequired, renderAdminPage, getAdminTemplatesList, getTemplateAssignments } from './admin-renderer';
import { registerMockAssistantRoutes } from './mock-assistant';
import { registerRobot } from './register-robot';
import { storage } from './storage';
import { setupAuth } from './auth';
import axios from 'axios';

// Only support our physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';
const ROBOT_API_URL = 'http://8f50-47-180-91-99.ngrok-free.app';

// Global storage for in-memory robot state data (only used when robot is unreachable)
const robotStatusCache = new Map();
const robotPositionCache = new Map();
const robotSensorCache = new Map();
const robotTaskCache = new Map();

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  
  // Register robot API routes
  registerRobotApiRoutes(app);
  
  // Register camera API routes
  registerCameraApiRoutes(app);
  
  // Register mock assistant routes
  registerMockAssistantRoutes(app);
  
  // Register robot video routes
  const httpServer = createServer(app);
  registerRobotVideoRoutes(app, httpServer);
  
  // Set up WebSocket server for real-time updates
  setupWebSockets(httpServer);
  
  // Template routes
  app.get('/api/templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  app.get('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  app.post('/api/templates', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        config: z.record(z.any())
      });
      
      const validatedData = schema.parse(req.body);
      const newTemplate = await storage.createTemplate(validatedData);
      
      res.status(201).json(newTemplate);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(400).json({ error: formatError(error) });
    }
  });

  app.put('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate request body
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        config: z.record(z.any())
      });
      
      const validatedData = schema.parse(req.body);
      const updated = await storage.updateTemplate(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(400).json({ error: formatError(error) });
    }
  });

  app.delete('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTemplate(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  // User routes
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  // Robot routes
  app.get('/api/robots', async (req: Request, res: Response) => {
    try {
      // Get physical robot data
      const serialNumber = PHYSICAL_ROBOT_SERIAL;
      let robotData = null;
      
      try {
        // Try to get live data from the robot
        const response = await axios.get(`${ROBOT_API_URL}/robot-info/${serialNumber}`, {
          timeout: 2000,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.status === 200) {
          robotData = response.data;
        }
      } catch (robotError) {
        console.error(`Could not fetch live robot data: ${robotError}`);
        
        // Fall back to cached data if we have it
        if (robotStatusCache.has(serialNumber)) {
          robotData = {
            status: robotStatusCache.get(serialNumber),
            position: robotPositionCache.get(serialNumber) || null,
            sensors: robotSensorCache.get(serialNumber) || null
          };
        }
      }
      
      // If we don't have robot data, create a default entry
      if (!robotData) {
        robotData = {
          serialNumber,
          status: {
            model: 'AxBot 5000',
            serialNumber,
            battery: 0,
            status: 'offline',
            mode: 'standby',
            lastUpdate: new Date().toISOString()
          }
        };
      }
      
      // Get robot assignment data
      const assignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      // Combine the data
      const result = {
        serialNumber,
        ...robotData,
        assignment: assignment || null
      };
      
      // For now, we only support our one physical robot
      res.json([result]);
    } catch (error) {
      console.error('Error fetching robots:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  app.put('/api/users/:id/template', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { templateId } = req.body;
      
      // Update the user's template assignment
      const updated = await storage.updateUserTemplate(userId, templateId ? parseInt(templateId) : null);
      
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating user template:', error);
      res.status(500).json({ error: formatError(error) });
    }
  });

  return httpServer;
}

function setupWebSockets(httpServer: Server) {
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/ws'
  });
  
  // Create a separate WebSocket server for camera streams
  const cameraWss = new WebSocketServer({
    server: httpServer,
    path: '/api/ws/camera'
  });
  
  console.log('WebSocket servers initialized');
  
  // Store connected clients
  const connectedClients: WebSocket[] = [];
  const cameraClients: WebSocket[] = [];
  
  // Main WebSocket server for general robot communication
  wss.on('connection', (ws) => {
    console.log('Client connected to main WebSocket');
    connectedClients.push(ws);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data.type);
        
        // Handle different message types
        switch (data.type) {
          case 'get_robot_status':
            await handleRobotStatusWebSocket(data, ws);
            break;
          case 'get_robot_position':
            await handleRobotPositionWebSocket(data, ws);
            break;
          case 'get_robot_sensors':
            await handleRobotSensorWebSocket(data, ws);
            break;
          case 'get_robot_map':
            await handleRobotMapWebSocket(data, ws);
            break;
          case 'register_physical_robot':
            await handleRegisterPhysicalRobot(data, ws, connectedClients);
            break;
          case 'update_robot_status':
            await handleUpdateRobotStatus(data, ws, connectedClients);
            break;
          case 'update_robot_position':
            await handleUpdateRobotPosition(data, ws, connectedClients);
            break;
          case 'update_robot_sensors':
            await handleUpdateRobotSensors(data, ws, connectedClients);
            break;
          case 'get_robot_task':
            await handleGetRobotTask(data, ws);
            break;
          case 'robot_control':
            await handleRobotControl(data, ws);
            break;
          default:
            sendError(ws, `Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        sendError(ws, `Error: ${formatError(error)}`);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from main WebSocket');
      const index = connectedClients.indexOf(ws);
      if (index !== -1) {
        connectedClients.splice(index, 1);
      }
    });
    
    // Send initial welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to robot management system',
      timestamp: new Date().toISOString()
    }));
  });
  
  // Camera WebSocket server for video streaming
  cameraWss.on('connection', (ws) => {
    console.log('Client connected to camera WebSocket');
    cameraClients.push(ws);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received camera WebSocket message:', data.type);
        
        // Process camera messages in the dedicated handler
        processCameraWebSocketMessage(data, ws, cameraClients);
      } catch (error) {
        console.error('Error handling camera WebSocket message:', error);
        sendError(ws, `Error: ${formatError(error)}`);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from camera WebSocket');
      const index = cameraClients.indexOf(ws);
      if (index !== -1) {
        cameraClients.splice(index, 1);
      }
    });
    
    // Send initial welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to robot camera system',
      timestamp: new Date().toISOString()
    }));
  });
  
  console.log('WebSocket setup complete');
}

// WebSocket handler functions
async function handleRobotStatusWebSocket(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot ${data.serialNumber} is not registered`);
    }
    
    // Try to get real-time status from robot
    try {
      const response = await axios.get(`${ROBOT_API_URL}/status`, {
        timeout: 2000,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 200 && response.data) {
        // Format the status data
        const status = {
          model: 'AxBot 5000',
          serialNumber: data.serialNumber,
          battery: response.data.battery || 0,
          status: response.data.status || 'unknown',
          mode: response.data.mode || 'standby',
          lastUpdate: new Date().toISOString()
        };
        
        // Cache the status
        robotStatusCache.set(data.serialNumber, status);
        
        // Send the status
        ws.send(JSON.stringify({
          type: 'robot_status',
          serialNumber: data.serialNumber,
          data: status
        }));
        
        return;
      }
    } catch (robotError) {
      console.error(`Error getting robot status: ${robotError}`);
    }
    
    // If we couldn't get live data, use cached data
    if (robotStatusCache.has(data.serialNumber)) {
      const status = robotStatusCache.get(data.serialNumber);
      
      ws.send(JSON.stringify({
        type: 'robot_status',
        serialNumber: data.serialNumber,
        data: status
      }));
    } else {
      // Create a default status
      const defaultStatus = {
        model: 'AxBot 5000',
        serialNumber: data.serialNumber,
        battery: 0,
        status: 'offline',
        mode: 'standby',
        lastUpdate: new Date().toISOString()
      };
      
      // Cache the status
      robotStatusCache.set(data.serialNumber, defaultStatus);
      
      // Send the status
      ws.send(JSON.stringify({
        type: 'robot_status',
        serialNumber: data.serialNumber,
        data: defaultStatus
      }));
    }
  } catch (error) {
    console.error('Error handling robot status request:', error);
    sendError(ws, `Error getting robot status: ${formatError(error)}`);
  }
}

async function handleRobotPositionWebSocket(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot ${data.serialNumber} is not registered`);
    }
    
    // Try to get real-time position from robot
    try {
      const response = await axios.get(`${ROBOT_API_URL}/position`, {
        timeout: 2000,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 200 && response.data) {
        // Format the position data
        const position = {
          x: response.data.x || 0,
          y: response.data.y || 0,
          z: response.data.z || 0,
          orientation: response.data.orientation || 0,
          speed: response.data.speed || 0,
          timestamp: new Date().toISOString()
        };
        
        // Cache the position
        robotPositionCache.set(data.serialNumber, position);
        
        // Send the position
        ws.send(JSON.stringify({
          type: 'robot_position',
          serialNumber: data.serialNumber,
          data: position
        }));
        
        return;
      }
    } catch (robotError) {
      console.error(`Error getting robot position: ${robotError}`);
    }
    
    // If we couldn't get live data, use cached data
    if (robotPositionCache.has(data.serialNumber)) {
      const position = robotPositionCache.get(data.serialNumber);
      
      ws.send(JSON.stringify({
        type: 'robot_position',
        serialNumber: data.serialNumber,
        data: position
      }));
    } else {
      // Create a default position
      const defaultPosition = {
        x: 0,
        y: 0,
        z: 0,
        orientation: 0,
        speed: 0,
        timestamp: new Date().toISOString()
      };
      
      // Cache the position
      robotPositionCache.set(data.serialNumber, defaultPosition);
      
      // Send the position
      ws.send(JSON.stringify({
        type: 'robot_position',
        serialNumber: data.serialNumber,
        data: defaultPosition
      }));
    }
  } catch (error) {
    console.error('Error handling robot position request:', error);
    sendError(ws, `Error getting robot position: ${formatError(error)}`);
  }
}

async function handleRobotSensorWebSocket(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot ${data.serialNumber} is not registered`);
    }
    
    // Try to get real-time sensor data from robot
    try {
      const response = await axios.get(`${ROBOT_API_URL}/sensors`, {
        timeout: 2000,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 200 && response.data) {
        // Format the sensor data
        const sensors = {
          temperature: response.data.temperature || 0,
          humidity: response.data.humidity || 0,
          proximity: response.data.proximity || [0, 0, 0, 0],
          battery: response.data.battery || 0,
          light: response.data.light || 0,
          noise: response.data.noise || 0,
          timestamp: new Date().toISOString()
        };
        
        // Cache the sensors
        robotSensorCache.set(data.serialNumber, sensors);
        
        // Send the sensors
        ws.send(JSON.stringify({
          type: 'robot_sensors',
          serialNumber: data.serialNumber,
          data: sensors
        }));
        
        return;
      }
    } catch (robotError) {
      console.error(`Error getting robot sensors: ${robotError}`);
    }
    
    // If we couldn't get live data, use cached data
    if (robotSensorCache.has(data.serialNumber)) {
      const sensors = robotSensorCache.get(data.serialNumber);
      
      ws.send(JSON.stringify({
        type: 'robot_sensors',
        serialNumber: data.serialNumber,
        data: sensors
      }));
    } else {
      // Create default sensor data
      const defaultSensors = {
        temperature: 20,
        humidity: 50,
        proximity: [0, 0, 0, 0],
        battery: 0,
        light: 500,
        noise: 0,
        timestamp: new Date().toISOString()
      };
      
      // Cache the sensors
      robotSensorCache.set(data.serialNumber, defaultSensors);
      
      // Send the sensors
      ws.send(JSON.stringify({
        type: 'robot_sensors',
        serialNumber: data.serialNumber,
        data: defaultSensors
      }));
    }
  } catch (error) {
    console.error('Error handling robot sensor request:', error);
    sendError(ws, `Error getting robot sensors: ${formatError(error)}`);
  }
}

async function handleRobotMapWebSocket(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot ${data.serialNumber} is not registered`);
    }
    
    // For map data, we would typically get this from a robot's mapping system
    // Here we send a basic map structure that could be populated with real data
    const mapData = {
      grid: [],
      obstacles: [],
      paths: [{
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 2, y: 0, z: 0 }
        ],
        status: 'completed'
      }]
    };
    
    // Send the map data
    ws.send(JSON.stringify({
      type: 'robot_map',
      serialNumber: data.serialNumber,
      data: mapData
    }));
  } catch (error) {
    console.error('Error handling robot map request:', error);
    sendError(ws, `Error getting robot map: ${formatError(error)}`);
  }
}

async function handleRegisterPhysicalRobot(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Registering physical robot: ${robotSerial}`);
    
    // Get model from data or use default
    const model = data.model || 'AxBot 5000';
    
    // Create status data
    const statusData = {
      model,
      serialNumber: robotSerial,
      battery: data.battery || 0,
      status: data.status || 'online',
      mode: data.mode || 'ready',
      lastUpdate: new Date().toISOString()
    };
    
    // Cache the status
    robotStatusCache.set(robotSerial, statusData);
    
    // Register with the database if needed
    try {
      // Try to get existing registration
      const assignment = await storage.getRobotTemplateAssignmentBySerial(robotSerial);
      
      // If not registered yet, register it
      if (!assignment) {
        await registerRobot(robotSerial, model);
        console.log(`Robot ${robotSerial} registered successfully`);
      } else {
        console.log(`Robot ${robotSerial} already registered`);
      }
    } catch (dbError) {
      console.error(`Error registering robot in database: ${dbError}`);
    }
    
    // Confirm registration
    ws.send(JSON.stringify({
      type: 'robot_registered',
      serialNumber: robotSerial,
      status: statusData
    }));
    
    // Broadcast to all clients
    broadcastRobotUpdate(
      connectedClients.filter(client => client !== ws),
      'status_update',
      robotSerial,
      statusData
    );
    
    console.log(`Robot ${robotSerial} registration complete`);
  } catch (error) {
    console.error('Error registering physical robot:', error);
    sendError(ws, `Error registering robot: ${formatError(error)}`);
  }
}

async function handleUpdateRobotStatus(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Updating robot status: ${robotSerial}`);
    
    // Update status data
    const statusData = {
      model: data.model || 'AxBot 5000',
      serialNumber: robotSerial,
      battery: data.battery != null ? data.battery : (robotStatusCache.get(robotSerial)?.battery || 0),
      status: data.status || (robotStatusCache.get(robotSerial)?.status || 'unknown'),
      mode: data.mode || (robotStatusCache.get(robotSerial)?.mode || 'standby'),
      lastUpdate: new Date().toISOString()
    };
    
    // Cache the status
    robotStatusCache.set(robotSerial, statusData);
    
    // Confirm update
    ws.send(JSON.stringify({
      type: 'status_updated',
      serialNumber: robotSerial,
      status: statusData
    }));
    
    // Broadcast to all clients
    broadcastRobotUpdate(
      connectedClients.filter(client => client !== ws),
      'status_update',
      robotSerial,
      statusData
    );
    
    console.log(`Robot ${robotSerial} status updated`);
  } catch (error) {
    console.error('Error updating robot status:', error);
    sendError(ws, `Error updating status: ${formatError(error)}`);
  }
}

async function handleUpdateRobotPosition(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Updating robot position: ${robotSerial}`);
    
    // Update position data
    const positionData = {
      x: data.x != null ? data.x : (robotPositionCache.get(robotSerial)?.x || 0),
      y: data.y != null ? data.y : (robotPositionCache.get(robotSerial)?.y || 0),
      z: data.z != null ? data.z : (robotPositionCache.get(robotSerial)?.z || 0),
      orientation: data.orientation != null ? data.orientation : (robotPositionCache.get(robotSerial)?.orientation || 0),
      speed: data.speed != null ? data.speed : (robotPositionCache.get(robotSerial)?.speed || 0),
      timestamp: new Date().toISOString()
    };
    
    // Cache the position
    robotPositionCache.set(robotSerial, positionData);
    
    // Confirm update
    ws.send(JSON.stringify({
      type: 'position_updated',
      serialNumber: robotSerial,
      position: positionData
    }));
    
    // Broadcast to all clients
    broadcastRobotUpdate(
      connectedClients.filter(client => client !== ws),
      'position_update',
      robotSerial,
      positionData
    );
    
    console.log(`Robot ${robotSerial} position updated`);
  } catch (error) {
    console.error('Error updating robot position:', error);
    sendError(ws, `Error updating position: ${formatError(error)}`);
  }
}

async function handleUpdateRobotSensors(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Updating robot sensors: ${robotSerial}`);
    
    // Update sensor data
    const sensorData = {
      temperature: data.temperature != null ? data.temperature : (robotSensorCache.get(robotSerial)?.temperature || 20),
      humidity: data.humidity != null ? data.humidity : (robotSensorCache.get(robotSerial)?.humidity || 50),
      proximity: data.proximity || (robotSensorCache.get(robotSerial)?.proximity || [0, 0, 0, 0]),
      battery: data.battery != null ? data.battery : (robotSensorCache.get(robotSerial)?.battery || 0),
      light: data.light != null ? data.light : (robotSensorCache.get(robotSerial)?.light || 500),
      noise: data.noise != null ? data.noise : (robotSensorCache.get(robotSerial)?.noise || 0),
      timestamp: new Date().toISOString()
    };
    
    // Cache the sensors
    robotSensorCache.set(robotSerial, sensorData);
    
    // Confirm update
    ws.send(JSON.stringify({
      type: 'sensors_updated',
      serialNumber: robotSerial,
      sensors: sensorData
    }));
    
    // Broadcast to all clients
    broadcastRobotUpdate(
      connectedClients.filter(client => client !== ws),
      'sensors_update',
      robotSerial,
      sensorData
    );
    
    console.log(`Robot ${robotSerial} sensors updated`);
  } catch (error) {
    console.error('Error updating robot sensors:', error);
    sendError(ws, `Error updating sensors: ${formatError(error)}`);
  }
}

async function handleGetRobotTask(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Getting tasks for robot: ${robotSerial}`);
    
    // Get cached task data or null
    const task = robotTaskCache.get(robotSerial) || null;
    
    // Send the task data
    ws.send(JSON.stringify({
      type: 'robot_task',
      serialNumber: robotSerial,
      task
    }));
    
    console.log(`Sent task data for robot ${robotSerial}`);
  } catch (error) {
    console.error('Error getting robot task:', error);
    sendError(ws, `Error getting task: ${formatError(error)}`);
  }
}

async function handleRobotControl(data: any, ws: WebSocket) {
  if (!data.serialNumber) {
    return sendError(ws, 'Serial number is required');
  }
  
  if (!data.command) {
    return sendError(ws, 'Command is required');
  }
  
  try {
    const robotSerial = data.serialNumber;
    const command = data.command;
    
    // Validate this is our real physical robot
    if (robotSerial !== PHYSICAL_ROBOT_SERIAL) {
      return sendError(ws, `Robot serial ${robotSerial} is not allowed. Only ${PHYSICAL_ROBOT_SERIAL} is supported.`);
    }
    
    console.log(`Sending control command to robot ${robotSerial}: ${command}`);
    
    // Here, we would typically send a command to the robot through the robot's API
    let result = {
      success: false,
      message: 'Command not processed'
    };
    
    // Try to send the command to the robot
    try {
      const response = await axios.post(`${ROBOT_API_URL}/control`, {
        command,
        params: data.params || {}
      }, {
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200) {
        result = {
          success: true,
          message: 'Command processed successfully',
          ...response.data
        };
      }
    } catch (robotError) {
      console.error(`Error sending command to robot: ${robotError}`);
      result = {
        success: false,
        message: `Failed to send command: ${formatError(robotError)}`
      };
    }
    
    // Send the command result
    ws.send(JSON.stringify({
      type: 'robot_control_result',
      serialNumber: robotSerial,
      command,
      result
    }));
    
    console.log(`Control command result for ${robotSerial}: ${result.success ? 'success' : 'failure'}`);
  } catch (error) {
    console.error('Error processing robot control command:', error);
    sendError(ws, `Error processing command: ${formatError(error)}`);
  }
}

// WebSocket helper functions
function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message: message,
      timestamp: new Date().toISOString()
    }));
  }
}

function broadcastRobotUpdate(clients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  const message = JSON.stringify({
    type: `robot_${updateType}`,
    serialNumber,
    data,
    timestamp: new Date().toISOString()
  });
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}