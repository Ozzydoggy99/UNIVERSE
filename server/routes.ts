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

  app.get('/api/robot-assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getAllRobotTemplateAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching robot assignments:', error);
      res.status(500).json({ error: 'Failed to fetch robot assignments' });
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
  // Create WebSocket servers with error handling for port conflicts
  let cameraWss: WebSocketServer;
  let poseRelayWss: WebSocketServer;
  
  // Setup robot position WebSocket relay
  try {
    // WebSocket relay server for robot position data
    // This solves HTTPS/WSS compatibility issues when connecting to the robot directly
    poseRelayWss = new WebSocketServer({
      server: httpServer,
      path: '/ws/pose',
      clientTracking: true
    });
    
    // Handle server-level errors
    poseRelayWss.on('error', (error: any) => {
      console.error('Pose relay WebSocket server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.log('WebSocket port is already in use, will use the HTTP server port chosen by the dynamic port selection');
      }
    });
    
    // Setup the WebSocket relay for position data
    poseRelayWss.on('connection', (clientSocket) => {
      console.log('[Relay] Client connected to pose relay WebSocket');
      
      // Connect to the robot WebSocket with authentication headers
      const ROBOT_SERIAL = "L382502104987ir";
      // Try using port 8090 which is the same port used for REST API
      const ROBOT_WS = `ws://47.180.91.99:8090/websocket/robot/${ROBOT_SERIAL}/pose`;
      console.log(`[Relay] Connecting to robot WebSocket at ${ROBOT_WS}`);
      
      // Robot requires authentication headers for WebSocket connection
      const ROBOT_AUTH_KEY = ROBOT_SERIAL; // The key is the robot serial number
      const ROBOT_AUTH_SECRET = process.env.ROBOT_SECRET; // Secret from environment variables
      
      // Connection options with auth headers
      const connectionOptions = {
        headers: {
          "x-auth-key": ROBOT_AUTH_KEY,
          "x-auth-secret": ROBOT_AUTH_SECRET || ""
        }
      };
      
      // Variable to hold the WebSocket connection to the robot
      let robotSocket: WebSocket;
      
      // Function to create a new robot socket connection
      const createRobotSocketConnection = () => {
        // Close existing socket if it exists
        if (robotSocket && robotSocket.readyState === WebSocket.OPEN) {
          robotSocket.close();
        }
        
        // Create new socket with authentication headers
        robotSocket = new WebSocket(ROBOT_WS, connectionOptions);
        
        // Set up all event handlers
        robotSocket.on('open', () => {
          console.log('[Relay] Connected to robot position WebSocket');
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ 
              type: 'connected',
              message: 'Connected to robot WebSocket' 
            }));
          }
        });
        
        robotSocket.on('message', (data) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            try {
              // Try to parse the data to see what we're receiving
              const dataStr = data.toString();
              console.log('[Relay] Raw robot position data:', dataStr.substring(0, 200)); // Log first 200 chars to avoid flooding
              
              // Make sure the data is in JSON format with x, y properties
              // If it's just a string or doesn't have those properties, wrap it
              try {
                const parsedData = JSON.parse(dataStr);
                
                // If the data is in proper format, send it directly
                if (typeof parsedData.x === 'number' && typeof parsedData.y === 'number') {
                  console.log('[Relay] Forwarding parsed position data:', { x: parsedData.x, y: parsedData.y, theta: parsedData.theta });
                  clientSocket.send(data);
                } else {
                  // Try to extract x, y, theta from the data if it's in a different format
                  // For example, some robot WebSockets return data in a nested object or array
                  let positionData = extractPositionData(parsedData);
                  if (positionData) {
                    console.log('[Relay] Extracted position data:', positionData);
                    clientSocket.send(JSON.stringify(positionData));
                  } else {
                    console.log('[Relay] Could not extract position data from:', parsedData);
                    // Forward the raw data anyway, client might know how to handle it
                    clientSocket.send(data);
                  }
                }
              } catch (parseError) {
                // If it's not JSON, wrap it in a simple object
                console.log('[Relay] Data is not JSON, forwarding raw');
                clientSocket.send(data);
              }
            } catch (err) {
              console.error('[Relay] Error processing robot data:', err);
              // Forward the raw data anyway
              clientSocket.send(data);
            }
          }
        });
        
        // Helper function to extract position data from various formats
        function extractPositionData(data: any): { x: number, y: number, theta: number } | null {
          // Different robots may have different data formats, try to handle common ones
          
          // Check if data has pose property (common in ROS-based systems)
          if (data.pose && typeof data.pose.position === 'object') {
            return {
              x: data.pose.position.x || 0,
              y: data.pose.position.y || 0,
              theta: extractTheta(data.pose.orientation) || 0
            };
          }
          
          // Check if data has position property
          if (data.position && typeof data.position === 'object') {
            return {
              x: data.position.x || 0,
              y: data.position.y || 0,
              theta: data.theta || data.angle || extractTheta(data.orientation) || 0
            };
          }
          
          // Check if data has x,y directly in a different property
          for (const key of ['location', 'coordinates', 'pos', 'current_position']) {
            if (data[key] && typeof data[key] === 'object' && 
                typeof data[key].x === 'number' && 
                typeof data[key].y === 'number') {
              return {
                x: data[key].x,
                y: data[key].y,
                theta: data[key].theta || data[key].angle || extractTheta(data[key].orientation) || 0
              };
            }
          }
          
          return null;
        }
        
        // Helper function to extract theta from quaternion orientation
        function extractTheta(orientation: any): number | null {
          if (!orientation) return null;
          
          // If theta is directly available
          if (typeof orientation === 'number') return orientation;
          
          // If orientation is a quaternion (x,y,z,w)
          if (typeof orientation === 'object' && 
              typeof orientation.z === 'number' && 
              typeof orientation.w === 'number') {
            // Convert quaternion to Euler angle (simplified for 2D)
            const z = orientation.z;
            const w = orientation.w;
            return Math.atan2(2.0 * (w * z), 1.0 - 2.0 * (z * z)) || 0;
          }
          
          return null;
        }
        
        robotSocket.on('error', (err) => {
          console.error('[Relay] Robot WebSocket error:', err.message || err);
        });
        
        robotSocket.on('close', (code, reason) => {
          console.log(`[Relay] Robot WebSocket closed with code ${code}${reason ? ': ' + reason : ''}`);
          
          // Automatically attempt to reconnect if client is still connected
          if (clientSocket.readyState === WebSocket.OPEN) {
            console.log('[Relay] Attempting to reconnect to robot WebSocket in 2 seconds...');
            
            // Wait a moment before reconnecting
            setTimeout(() => {
              if (clientSocket.readyState === WebSocket.OPEN) {
                console.log('[Relay] Reconnecting to robot WebSocket...');
                createRobotSocketConnection();
              }
            }, 2000);
          }
        });
        
        return robotSocket;
      };
      
      // Initial connection
      robotSocket = createRobotSocketConnection();
      
      clientSocket.on('close', () => {
        console.log('[Relay] Client disconnected from pose relay');
        if (robotSocket && robotSocket.readyState === WebSocket.OPEN) {
          robotSocket.close();
        }
      });
    });
    
  } catch (error) {
    console.error('Failed to create pose relay WebSocket server:', error);
  }
  
  // Create WebSocket server for camera control
  try {
    cameraWss = new WebSocketServer({ 
      server: httpServer, 
      path: '/api/ws/camera',
      // Add error handling for the WebSocket server
      clientTracking: true
    });
    
    // Handle server-level errors
    cameraWss.on('error', (error: any) => {
      console.error('Camera WebSocket server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.log('WebSocket port is already in use, will use the HTTP server port chosen by the dynamic port selection');
      }
    });
  } catch (error) {
    console.error('Failed to create camera WebSocket server:', error);
    return; // Exit if we can't create the WebSocket server
  }
  
  // Store connected clients
  const connectedClients: WebSocket[] = [];
  
  // Handle new connections
  cameraWss.on('connection', (ws) => {
    console.log('New WebSocket connection for camera/position control');
    
    // Add to connected clients
    connectedClients.push(ws);
    
    // Flags to track which clients are requesting position updates
    const clientInfo = {
      wantsPositionUpdates: false,
      topics: [] as string[]
    };
    
    // Set up forwarding of robot position updates to the client
    const robotWs = require('./robot-websocket');
    let positionUpdateListener: ((serialNumber: string, data: any) => void) | null = null;
    
    // Handle robot position updates to forward to the clients
    const setupPositionTracking = () => {
      if (positionUpdateListener) return; // Already set up
      
      positionUpdateListener = (serialNumber: string, data: any) => {
        if (!clientInfo.wantsPositionUpdates) return;
        
        try {
          // Only forward if the client is interested in this topic
          if (data.topic && clientInfo.topics.includes(data.topic)) {
            // Send the position data to the client
            const message = {
              type: 'robot_data',
              serialNumber,
              data
            };
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(message));
            }
          }
        } catch (err) {
          console.error('Error forwarding position update:', err);
        }
      };
      
      // Subscribe to position updates
      robotWs.subscribeToRobotUpdates('position_update', positionUpdateListener);
    };
    
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
          console.log('Starting mapping streams for real-time map building or position tracking');
          
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
          
          // Store the topics the client is interested in
          clientInfo.topics = mappingTopics;
          
          // Check if position tracking is requested
          if (mappingTopics.includes('/tracked_pose')) {
            clientInfo.wantsPositionUpdates = true;
            setupPositionTracking();
          }
          
          console.log(`Enabling ${mappingTopics.length} mapping topics for robot ${data.serialNumber || 'L382502104987ir'}`);
          
          // Send the request to the robot WebSocket
          try {
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
          console.log('Stopping mapping streams for real-time map building or position tracking');
          
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
          
          // Check if position tracking is being stopped
          if (mappingTopics.includes('/tracked_pose')) {
            clientInfo.wantsPositionUpdates = false;
          }
          
          // Clean up any topics the client is no longer interested in
          clientInfo.topics = clientInfo.topics.filter(topic => !mappingTopics.includes(topic));
          
          console.log(`Disabling ${mappingTopics.length} mapping topics for robot ${data.serialNumber || 'L382502104987ir'}`);
          
          // Send the request to the robot WebSocket
          try {
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
      
      // Clean up the position update listener
      if (positionUpdateListener) {
        try {
          // Unsubscribe by passing the same function reference
          // This pattern matches how event emitters typically allow unsubscribing
          robotWs.subscribeToRobotUpdates('position_update', positionUpdateListener);
          
          // Also disable the topics if they're still active
          if (clientInfo.wantsPositionUpdates && clientInfo.topics.includes('/tracked_pose')) {
            robotWs.disableTopics(['/tracked_pose']);
          }
          
          positionUpdateListener = null;
        } catch (err) {
          console.error('Error unsubscribing from position updates:', err);
        }
      }
      
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
      message: 'Connected to camera/position control WebSocket' 
    }));
  });
  
  console.log('WebSocket servers initialized');
}