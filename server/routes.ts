import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, type Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { storage } from './mem-storage';
import { registerRobotApiRoutes } from './robot-api';
import { registerRobotVideoRoutes } from './robot-video';
import { setupVite } from './vite';
import { registerAdminRoutes } from './admin-routes';
import { setupAuth } from './auth';
import { registerRobotMoveApiRoutes } from './robot-move-api';
import { registerRobotInstallerRoutes } from './robot-installer-api';
import { registerRobotJoystickApiRoutes } from './robot-joystick-api';
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  
  // Setup admin routes
  registerAdminRoutes(app);
  
  // Register robot API routes
  registerRobotApiRoutes(app);
  
  // Register robot movement API routes
  registerRobotMoveApiRoutes(app);
  
  // Register robot installer API routes
  registerRobotInstallerRoutes(app);
  
  // Register robot joystick API routes
  registerRobotJoystickApiRoutes(app);
  
  // User-related endpoints
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
      const id = parseInt(req.params.id, 10);
      const template = await storage.getTemplate(id);
      
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
      const newTemplate = req.body;
      
      if (!newTemplate || !newTemplate.name) {
        return res.status(400).json({ error: 'Template name is required' });
      }
      
      const createdTemplate = await storage.createTemplate(newTemplate);
      res.status(201).json(createdTemplate);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  app.put('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const templateUpdate = req.body;
      
      if (!templateUpdate || typeof templateUpdate !== 'object') {
        return res.status(400).json({ error: 'Invalid template data' });
      }
      
      const updatedTemplate = await storage.updateTemplate(id, templateUpdate);
      
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
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteTemplate(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/robots', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getAllRobotTemplateAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching robots:', error);
      res.status(500).json({ error: 'Failed to fetch robots' });
    }
  });

  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.put('/api/users/:id/template', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { templateId } = req.body;
      
      if (templateId === undefined) {
        return res.status(400).json({ error: 'Template ID is required' });
      }
      
      const updated = await storage.updateUser(id, { 
        templateId: templateId ? parseInt(templateId, 10) : null 
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating user template:', error);
      res.status(500).json({ error: 'Failed to update user template' });
    }
  });

  // Create the HTTP server
  const httpServer = createServer(app);
  
  // Register robot video routes and WebSocket server
  registerRobotVideoRoutes(app, httpServer);
  
  // Set up WebSocket server for camera control
  setupWebSockets(httpServer);
  
  // Create a direct route to serve our static HTML page without relying on Vite
  app.get('/static-map', (req: Request, res: Response) => {
    // Serve our static HTML page as an alternative to the Vite-served React app
    res.sendFile('index-static.html', { root: './client' });
    console.log('Serving static map page without Vite HMR');
  });

  // Setup Vite for development frontend
  await setupVite(app, httpServer);
  
  return httpServer;
}

/**
 * Set up WebSocket servers
 */
function setupWebSockets(httpServer: Server) {
  // Create WebSocket server for camera control with error handling for port conflicts
  let wss: WebSocketServer;
  
  try {
    wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/api/ws/camera',
      // Add error handling for the WebSocket server
      clientTracking: true
    });
    
    // Handle server-level errors
    wss.on('error', (error: any) => {
      console.error('WebSocket server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.log('WebSocket port is already in use, will use the HTTP server port chosen by the dynamic port selection');
      }
    });
  } catch (error) {
    console.error('Failed to create WebSocket server:', error);
    return; // Exit if we can't create the WebSocket server
  }
  
  // Store connected clients
  const connectedClients: WebSocket[] = [];
  
  // Handle new connections
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection for camera control');
    
    // Add to connected clients
    connectedClients.push(ws);
    
    // Handle messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Process message based on type
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        else if (data.type === 'start_mapping_streams') {
          // Start mapping-specific WebSocket topics
          console.log('Starting mapping streams for real-time map building visualization');
          
          // Use client-provided topics if available, otherwise use defaults
          let mappingTopics = data.topics || [
            '/slam/state',
            '/map',
            '/map_v2',
            '/trajectory',
            '/trajectory_node_list',
            '/path',
            '/scan_matched_points2',
            '/maps/5cm/1hz',
            '/maps/1cm/1hz',
            '/scan'
          ];
          
          // Ensure mappingTopics is an array
          if (!Array.isArray(mappingTopics)) {
            mappingTopics = [mappingTopics];
          }
          
          console.log(`Enabling ${mappingTopics.length} mapping topics for robot ${data.serialNumber || 'L382502104987ir'}`);
          
          // Send the request to the robot WebSocket
          try {
            const robotWs = require('./robot-websocket');
            
            // Check if robotWs is connected
            if (robotWs.isRobotConnected()) {
              // Enable all mapping topics
              const success = robotWs.enableTopics(mappingTopics);
              
              if (success) {
                // Acknowledge the request
                ws.send(JSON.stringify({
                  type: 'mapping_streams_started',
                  message: 'Successfully enabled mapping-specific WebSocket topics',
                  topics: mappingTopics
                }));
                
                console.log('Enabled mapping streams:', mappingTopics);
              } else {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Failed to enable some mapping topics'
                }));
              }
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Robot WebSocket is not connected'
              }));
            }
          } catch (err) {
            console.error('Error enabling mapping streams:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to enable mapping streams'
            }));
          }
        }
        else if (data.type === 'stop_mapping_streams') {
          // Stop mapping-specific WebSocket topics
          console.log('Stopping mapping streams for real-time map building visualization');
          
          // Use client-provided topics if available, otherwise use defaults
          let mappingTopics = data.topics || [
            '/slam/state',
            '/map',
            '/map_v2',
            '/trajectory',
            '/trajectory_node_list',
            '/path',
            '/scan_matched_points2',
            '/maps/5cm/1hz',
            '/maps/1cm/1hz',
            '/scan'
          ];
          
          // Ensure mappingTopics is an array
          if (!Array.isArray(mappingTopics)) {
            mappingTopics = [mappingTopics];
          }
          
          console.log(`Disabling ${mappingTopics.length} mapping topics for robot ${data.serialNumber || 'L382502104987ir'}`);
          
          // Send the request to the robot WebSocket
          try {
            const robotWs = require('./robot-websocket');
            
            // Check if robotWs is connected
            if (robotWs.isRobotConnected()) {
              // Disable all mapping topics
              const success = robotWs.disableTopics(mappingTopics);
              
              if (success) {
                // Acknowledge the request
                ws.send(JSON.stringify({
                  type: 'mapping_streams_stopped',
                  message: 'Successfully disabled mapping-specific WebSocket topics',
                  topics: mappingTopics
                }));
                
                console.log('Disabled mapping streams:', mappingTopics);
              } else {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Failed to disable some mapping topics'
                }));
              }
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Robot WebSocket is not connected'
              }));
            }
          } catch (err) {
            console.error('Error disabling mapping streams:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to disable mapping streams'
            }));
          }
        }
        // Add more message handlers as needed
        
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      
      // Remove from connected clients
      const index = connectedClients.indexOf(ws);
      if (index !== -1) {
        connectedClients.splice(index, 1);
      }
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Send initial message
    ws.send(JSON.stringify({ 
      type: 'connected',
      message: 'Connected to camera control WebSocket' 
    }));
  });
  
  console.log('WebSocket servers initialized');
}