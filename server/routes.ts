import express, { type Express, Request, Response } from "express";
import { z } from 'zod';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
import fetch from 'node-fetch';
import { 
  demoRobotStatus, 
  demoRobotPositions, 
  demoRobotSensors, 
  demoMapData, 
  demoTasks,
  registerRobotApiRoutes 
} from './robot-api';
import { adminRequired, renderAdminPage, getAdminTemplatesList, getTemplateAssignments } from './admin-renderer';
import { registerMockAssistantRoutes } from './mock-assistant';
import { registerRobot } from './register-robot';
import { storage } from './storage';
import { setupAuth } from './auth';

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
  
  // Register mock assistant routes
  registerMockAssistantRoutes(app);
  
  // Templates API endpoints
  app.get('/api/templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });
  
  app.get('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });
  
  app.post('/api/templates', async (req: Request, res: Response) => {
    try {
      const template = await storage.createTemplate(req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });
  
  app.put('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const updatedTemplate = await storage.updateTemplate(templateId, req.body);
      
      if (!updatedTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });
  
  app.delete('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const success = await storage.deleteTemplate(templateId);
      
      if (!success) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });
  
  // User API endpoints
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(Array.from(users.values()));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Robots list API endpoint
  app.get('/api/robots', async (req: Request, res: Response) => {
    try {
      // Return a list of all robot status data from the demo data
      const robots = Object.keys(demoRobotStatus).map(serialNumber => ({
        serialNumber,
        ...demoRobotStatus[serialNumber]
      }));
      res.json(robots);
    } catch (error) {
      console.error('Error fetching robots:', error);
      res.status(500).json({ error: 'Failed to fetch robots' });
    }
  });
  
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });
  
  // Update user's template
  app.put('/api/users/:id/template', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { templateId } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // If templateId is null, remove the template assignment
      if (templateId === null) {
        const updatedUser = await storage.updateUser(userId, { templateId: null });
        return res.json(updatedUser);
      }
      
      // Otherwise, verify the template exists and assign it
      const parsedTemplateId = parseInt(templateId);
      const template = await storage.getTemplate(parsedTemplateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const updatedUser = await storage.updateUser(userId, { templateId: parsedTemplateId });
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user template:', error);
      res.status(500).json({ error: 'Failed to update user template' });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Custom WebSocket setup
  setupWebSockets(httpServer);
  
  // Return the HTTP server
  return httpServer;
}

// Setup WebSockets
function setupWebSockets(httpServer: Server) {
  // Create WebSocket servers in noServer mode
  const robotWss = new WebSocketServer({ noServer: true });
  const clientWss = new WebSocketServer({ noServer: true });
  
  // Keep track of connected clients for broadcasting
  const connectedClients: WebSocket[] = [];
  
  // Handle upgrade events
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    console.log(`WebSocket upgrade request for path: ${pathname}`);
    
    if (pathname === '/api/ws/robot') {
      robotWss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Robot WebSocket connection established');
        
        // Store robot information
        let robotSerial: string | null = null;
        let robotModel: string | null = null;
        let isRegistered = false;
        
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('Received robot message:', data);
            
            // Handle message types
            if (data.type === 'register') {
              // Handle robot registration
              if (!data.serialNumber || !data.model) {
                sendError(ws, 'Serial number and model are required');
                return;
              }
              
              robotSerial = data.serialNumber;
              robotModel = data.model;
              isRegistered = true;
              
              // Add the robot to demoRobotStatus if it doesn't exist
              if (!demoRobotStatus[robotSerial]) {
                demoRobotStatus[robotSerial] = {
                  model: robotModel,
                  serialNumber: robotSerial,
                  battery: 100,
                  status: 'registered',
                  mode: 'manual',
                  lastUpdate: new Date().toISOString()
                };
                
                console.log(`Added robot to demoRobotStatus: ${robotSerial}`);
              }
              
              // Manually create a robot assignment if it doesn't exist
              // We will use the existing API to register it fully
              fetch('http://localhost:5000/api/robots/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  serialNumber: robotSerial,
                  model: robotModel || 'Physical Robot',
                  templateId: 1
                })
              })
              .then(response => response.json())
              .then(data => {
                console.log(`Created robot assignment for ${robotSerial}:`, data);
              })
              .catch(error => {
                console.error(`Failed to create robot assignment for ${robotSerial}:`, error);
              });
              
              ws.send(JSON.stringify({
                type: 'registered',
                serialNumber: robotSerial,
                message: 'Robot registered successfully'
              }));
              
              console.log(`Robot registered: ${robotSerial} (${robotModel})`);
            } 
            else if (data.type === 'status_update') {
              // Update robot status
              if (!isRegistered || !robotSerial) {
                sendError(ws, 'Robot must be registered first');
                return;
              }
              
              if (data.status) {
                // Update status in demo data
                const statusData = {
                  ...data.status,
                  serialNumber: robotSerial,
                  model: robotModel || 'Unknown',
                  lastUpdate: new Date().toISOString()
                };
                demoRobotStatus[robotSerial] = statusData;
                
                // Send confirmation to robot
                ws.send(JSON.stringify({
                  type: 'status_updated',
                  timestamp: new Date().toISOString()
                }));
                
                // Broadcast to all connected clients
                broadcastRobotUpdate(connectedClients, 'robot_status_update', robotSerial, statusData);
              }
            }
            else if (data.type === 'position_update') {
              // Update robot position
              if (!isRegistered || !robotSerial) {
                sendError(ws, 'Robot must be registered first');
                return;
              }
              
              if (data.position) {
                // Update position in demo data
                const positionData = {
                  ...data.position,
                  timestamp: new Date().toISOString()
                };
                demoRobotPositions[robotSerial] = positionData;
                
                // Send confirmation to robot
                ws.send(JSON.stringify({
                  type: 'position_updated',
                  timestamp: new Date().toISOString()
                }));
                
                // Broadcast to all connected clients
                broadcastRobotUpdate(connectedClients, 'robot_position_update', robotSerial, positionData);
              }
            }
            else if (data.type === 'sensor_update') {
              // Update robot sensors
              if (!isRegistered || !robotSerial) {
                sendError(ws, 'Robot must be registered first');
                return;
              }
              
              if (data.sensors) {
                // Update sensors in demo data
                const sensorData = {
                  ...data.sensors,
                  timestamp: new Date().toISOString()
                };
                demoRobotSensors[robotSerial] = sensorData;
                
                // Send confirmation to robot
                ws.send(JSON.stringify({
                  type: 'sensors_updated',
                  timestamp: new Date().toISOString()
                }));
                
                // Broadcast to all connected clients
                broadcastRobotUpdate(connectedClients, 'robot_sensors_update', robotSerial, sensorData);
              }
            }
            else if (data.type === 'get_task') {
              // Get task information
              if (!isRegistered || !robotSerial) {
                sendError(ws, 'Robot must be registered first');
                return;
              }
              
              const task = demoTasks[robotSerial] || null;
              
              ws.send(JSON.stringify({
                type: 'task_info',
                task: task,
                timestamp: new Date().toISOString()
              }));
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
            sendError(ws, 'Error processing message');
          }
        });
        
        ws.on('close', () => {
          console.log('Robot WebSocket connection closed');
        });
        
        ws.on('error', (error) => {
          console.error('Robot WebSocket error:', error);
        });
      });
    } 
    else if (pathname === '/api/ws/client') {
      clientWss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Client WebSocket connection established');
        
        // Add to connected clients list
        connectedClients.push(ws);
        
        // Send initial data to the client
        ws.send(JSON.stringify({
          type: 'connection_established',
          message: 'Connected to robot monitoring system',
          timestamp: new Date().toISOString()
        }));
        
        // Handle client messages
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('Received client message:', data);
            
            // Handle different request types
            if (data.type === 'get_robot_status' && data.serialNumber) {
              const status = demoRobotStatus[data.serialNumber];
              if (status) {
                ws.send(JSON.stringify({
                  type: 'status',
                  data: status
                }));
              } else {
                sendError(ws, `No status data for robot ${data.serialNumber}`);
              }
            }
            else if (data.type === 'get_robot_position' && data.serialNumber) {
              const position = demoRobotPositions[data.serialNumber];
              if (position) {
                ws.send(JSON.stringify({
                  type: 'position',
                  data: position
                }));
              } else {
                sendError(ws, `No position data for robot ${data.serialNumber}`);
              }
            }
            else if (data.type === 'get_robot_sensors' && data.serialNumber) {
              const sensors = demoRobotSensors[data.serialNumber];
              if (sensors) {
                ws.send(JSON.stringify({
                  type: 'sensors',
                  data: sensors
                }));
              } else {
                sendError(ws, `No sensor data for robot ${data.serialNumber}`);
              }
            }
            else if (data.type === 'get_robot_map' && data.serialNumber) {
              const map = demoMapData[data.serialNumber];
              if (map) {
                ws.send(JSON.stringify({
                  type: 'map',
                  data: map
                }));
              } else {
                sendError(ws, `No map data for robot ${data.serialNumber}`);
              }
            }
          } catch (error) {
            console.error('Error processing client WebSocket message:', error);
            sendError(ws, 'Error processing message');
          }
        });
        
        // Handle disconnection
        ws.on('close', () => {
          console.log('Client WebSocket connection closed');
          // Remove from connected clients
          const index = connectedClients.indexOf(ws);
          if (index !== -1) {
            connectedClients.splice(index, 1);
          }
        });
        
        // Handle errors
        ws.on('error', (error) => {
          console.error('Client WebSocket error:', error);
        });
      });
    }
    else {
      // Not a recognized WebSocket endpoint
      console.log(`Rejecting WebSocket connection to unhandled path: ${pathname}`);
      socket.destroy();
    }
  });
}

// Helper to send error messages
function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({
    type: 'error',
    message,
    timestamp: new Date().toISOString()
  }));
}

// Broadcast robot updates to all connected clients
function broadcastRobotUpdate(connectedClients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  const message = JSON.stringify({
    type: updateType,
    serialNumber,
    data,
    timestamp: new Date().toISOString()
  });
  
  // Send to all connected clients
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}