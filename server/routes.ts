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
// New optimized points API for shelf filtering
import robotPointsApiRouter, { registerRobotPointRoutes } from './robot-points-api';
// Import point display mappings
import { pointDisplayMappings } from './robot-points-map';
// Task assignment API for AutoXing structured mission execution
import { registerAssignTaskRoute } from './assign-task';
// Local pickup handling with jack up/down operations
import { registerLocalPickupRoute } from './assign-task-local';
// Local dropoff handling with jack up/down operations (reverse of pickup)
import { registerLocalDropoffRoute } from './assign-task-local-dropoff';
import { missionQueue } from './mission-queue';
import { missionRouter } from './mission-routes';
import { setupRobotWebSocketServer } from './robot-websocket';
import { registerReturnToChargerHandler } from './return-to-charger';
import { registerZone104WorkflowRoute } from './zone-104-workflow';
// Completely new implementation of Zone 104 workflow with proper documentation
import { registerZone104WorkflowHandler } from './zone-104-workflow-new-complete';
// Fixed implementation with proper error handling
import { registerZone104WorkflowHandler as registerFixedWorkflowHandler } from './zone-104-workflow-fixed';
// Specific workflow for picking up at pickup point and dropping at 104
import { registerPickupTo104WorkflowRoute } from './pickup-to-104-workflow';
// Specific workflow for picking up at 104 and dropping at main dropoff
import { registerPickupFrom104WorkflowRoute } from './pickup-from-104-workflow';
// Robot settings API for retrieving rack specifications
import { registerRobotSettingsRoutes } from './robot-settings-api';
// Direct charger docking implementation for testing
import { registerChargerDockingRoutes } from './charger-docking';
import { registerBinStatusRoutes } from './bin-status-routes';
// Robot capabilities API for dynamic template configuration
import { registerRobotCapabilitiesAPI } from './robot-capabilities-api';
import { registerTaskApiRoutes } from './robot-task-api';
import { registerDynamicWorkflowRoutes } from './dynamic-workflow';
import { ROBOT_SERIAL, ROBOT_SECRET } from './robot-constants';
import dynamicPointsApiRouter from './dynamic-points-api';
import { registerRefreshPointsRoutes } from './refresh-points-api';
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
  
  
  // Register the new shelf points API
  registerRobotPointRoutes(app);
  
  // Register our dynamic points API for auto-detecting new map points
  app.use('/api/dynamic-points', dynamicPointsApiRouter);
  
  // Register refresh points API for dynamically updating shelf points
  registerRefreshPointsRoutes(app);
  
  // Register AutoXing task assignment API (new version)
  registerAssignTaskRoute(app);
  
  // Register local pickup route with jack up/down operations
  registerLocalPickupRoute(app);
  
  // Register local dropoff route with jack up/down operations (reverse flow)
  registerLocalDropoffRoute(app);
  
  // Register return to charger and jack down operations
  registerReturnToChargerHandler(app);
  
  // Register direct charger docking route for testing
  registerChargerDockingRoutes(app);
  
  // Register the zone-104 workflow implementation - keeping this active since it has the working flow
  registerZone104WorkflowRoute(app);
  // Register our new pickup-to-104 workflow specifically for testing
  registerPickupTo104WorkflowRoute(app);
  // Register the new pickup-from-104 to main dropoff workflow
  registerPickupFrom104WorkflowRoute(app);
  // Comment out other workflow implementations
  // registerZone104WorkflowHandler(app);
  // registerFixedWorkflowHandler(app);
  
  // Register bin status routes for testing
  registerBinStatusRoutes(app);
  
  // Register the new Task API for unified robot task management
  registerTaskApiRoutes(app);
  
  // Register the dynamic workflow system for multi-floor robot operations
  registerDynamicWorkflowRoutes(app);
  
  // Register robot capabilities API for dynamic template configuration
  registerRobotCapabilitiesAPI(app);
  
  // Add endpoint for point display mappings (for UI friendly names)
  app.get('/api/robots/points/display-mappings', (req: Request, res: Response) => {
    res.json(pointDisplayMappings);
  });
  
  // Test endpoint for the toUnloadPoint action
  app.post('/api/robot/test-unload-action', async (req: Request, res: Response) => {
    try {
      const { pointId } = req.body;
      
      if (!pointId) {
        return res.status(400).json({ success: false, error: 'pointId is required' });
      }
      
      // Test the rack_area_id extraction logic
      // This doesn't actually call the robot API
      const loadPointId = pointId.replace('_docking', '');
      
      let rackAreaId;
      
      // Check if this is a drop-off point
      if (loadPointId.startsWith('drop-off')) {
        rackAreaId = 'drop-off';
      } else {
        // For all other points, use everything before the first underscore
        const areaMatch = loadPointId.match(/^([^_]+)/);
        rackAreaId = areaMatch ? areaMatch[1] : loadPointId;
      }
      
      return res.json({
        success: true,
        pointId,
        loadPointId,
        rackAreaId
      });
    } catch (error) {
      console.error('[TEST-UNLOAD-ACTION] Error testing unload action:', error);
      return res.status(500).json({ success: false, error: formatError(error) });
    }
  });
  
  // Register the robot settings API for rack specifications
  registerRobotSettingsRoutes(app);
  
  // Debug endpoint to directly check map points
  app.get('/api/debug/points', async (req, res) => {
    try {
      // Import properly using ES6 syntax
      const mapDataModule = await import('./robot-map-data');
      const points = await mapDataModule.fetchRobotMapPoints();
      
      // Extract shelf points for inspection
      const shelfPoints = points.filter((p: any) => 
        p.id.includes('104') || 
        p.id.toLowerCase().includes('load')
      );
      
      res.json({
        total: points.length,
        shelfPoints: shelfPoints.map((p: any) => ({
          id: p.id,
          originalCase: p.id,
          lowerCase: p.id.toLowerCase(),
          upperCase: p.id.toUpperCase(),
          coordinates: { x: p.x, y: p.y }
        }))
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Dynamic Point Service API for automatic detection of new map points
  app.get('/api/dynamic-points/:pointId', async (req, res) => {
    try {
      const { pointId } = req.params;
      console.log(`[DYNAMIC-POINTS-API] Getting coordinates for point ID: ${pointId}`);
      
      // Import the dynamic-map-points module
      const { getPointCoordinates } = await import('./dynamic-map-points');
      
      const point = await getPointCoordinates(pointId);
      
      if (point) {
        console.log(`[DYNAMIC-POINTS-API] Found coordinates for ${pointId}: (${point.x}, ${point.y})`);
        res.json({
          found: true,
          point
        });
      } else {
        console.log(`[DYNAMIC-POINTS-API] Could not find coordinates for point: ${pointId}`);
        res.json({
          found: false,
          message: `Could not find point with ID: ${pointId}`
        });
      }
    } catch (error) {
      console.error('[DYNAMIC-POINTS-API] Error getting point coordinates:', error);
      res.status(500).json({
        found: false,
        error: 'Internal server error'
      });
    }
  });
  
  // Get all available shelf points (for dropdowns, etc.)
  app.get('/api/dynamic-points', async (req, res) => {
    try {
      console.log('[DYNAMIC-POINTS-API] Fetching all shelf points');
      
      // Import the dynamic-map-points module
      const { getAllShelfPoints } = await import('./dynamic-map-points');
      
      const points = await getAllShelfPoints();
      
      console.log(`[DYNAMIC-POINTS-API] Found ${points.length} shelf points`);
      res.json({
        points
      });
    } catch (error) {
      console.error('[DYNAMIC-POINTS-API] Error getting shelf points:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });
  
  // Register mission router for robot task execution
  app.use('/api', missionRouter);
  
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
  
  // Set up WebSocket server for robot data
  setupRobotWebSocketServer(httpServer);
  
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
      // Based on the logs, the robot WebSocket endpoint should be '/ws'
      const ROBOT_WS = `ws://47.180.91.99:8090/ws`;
      console.log(`[Relay] Connecting to robot WebSocket at ${ROBOT_WS}`);
      
      // Looking at the logs earlier, the robot has these enabled topics we can subscribe to
      console.log('[Relay] Will subscribe to /tracked_pose topic for position updates');
      console.log('[Relay] Robot also supports /map, /slam/state, /wheel_state, /battery_state etc.');
      
      // Robot requires authentication headers for WebSocket connection
      // Use the same 'x-api-key' header format that works in all other robot API calls
      const connectionOptions = {
        headers: {
          "x-api-key": ROBOT_SECRET
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
          
          // Subscribe to the tracked_pose topic for position updates
          // The format is {"command": "enable_topics", "topics": ["/tracked_pose"]}
          robotSocket.send(JSON.stringify({
            command: "enable_topics",
            topics: ["/tracked_pose"]
          }));
          
          console.log('[Relay] Subscribed to /tracked_pose topic for position updates');
          
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
              
              try {
                const parsedData = JSON.parse(dataStr);
                
                // Check if this is a tracked_pose message as seen in logs
                if (parsedData.topic === '/tracked_pose' && Array.isArray(parsedData.pos) && parsedData.pos.length >= 2) {
                  // Convert from robot format to our client format
                  const positionData = {
                    x: parsedData.pos[0],
                    y: parsedData.pos[1],
                    theta: parsedData.ori || 0,
                    timestamp: Date.now()
                  };
                  
                  // Update our position tracker singleton
                  const { robotPositionTracker } = require('./robot-position-tracker');
                  robotPositionTracker.updatePosition(positionData);
                  
                  console.log('[Relay] Extracted tracked_pose data:', positionData);
                  clientSocket.send(JSON.stringify(positionData));
                  return;
                }
                
                // If the data is already in the expected x,y format, send it directly  
                if (typeof parsedData.x === 'number' && typeof parsedData.y === 'number') {
                  console.log('[Relay] Forwarding position data:', { x: parsedData.x, y: parsedData.y, theta: parsedData.theta });
                  clientSocket.send(data);
                  return;
                }
                
                // Try to extract position data from other formats
                const positionData = extractPositionData(parsedData);
                if (positionData) {
                  console.log('[Relay] Extracted position data:', positionData);
                  clientSocket.send(JSON.stringify(positionData));
                  return;
                }
                
                // If we couldn't extract data but it has a topic field
                if (parsedData.topic) {
                  // Log what topic we received but don't forward to client
                  console.log(`[Relay] Received message for topic ${parsedData.topic}, not forwarding`);
                  return;
                }
                
                // If it's a command acknowledgement or enabled_topics list
                if (parsedData.enabled_topics) {
                  console.log('[Relay] Received enabled_topics list:', parsedData.enabled_topics);
                  return;
                }
                
                // Unknown format, log it but don't forward
                console.log('[Relay] Unknown data format:', parsedData);
              } catch (parseError) {
                // If it's not JSON, log the error
                console.error('[Relay] JSON parse error:', parseError);
              }
            } catch (err) {
              console.error('[Relay] Error processing robot data:', err);
            }
          }
        });
        
        // Helper function to extract position data from various formats
        function extractPositionData(data: any): { x: number, y: number, theta: number } | null {
          // Different robots may have different data formats, try to handle common ones
          
          // AxBot specific format found in logs:
          // topic: "/tracked_pose", pos: [-0.435, 3.265], ori: 4.34
          if (data.topic === '/tracked_pose' && Array.isArray(data.pos) && data.pos.length >= 2) {
            const positionData = {
              x: data.pos[0],
              y: data.pos[1],
              theta: typeof data.ori === 'number' ? data.ori : 0
            };
            
            // Update our position tracker singleton
            const { robotPositionTracker } = require('./robot-position-tracker');
            robotPositionTracker.updatePosition({...positionData, timestamp: Date.now()});
            
            return positionData;
          }
          
          // Check if data has pos as array (as seen in the robot logs)
          if (Array.isArray(data.pos) && data.pos.length >= 2) {
            return {
              x: data.pos[0],
              y: data.pos[1],
              theta: data.ori || data.theta || data.angle || 0
            };
          }
          
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
            if (data[key] && typeof data[key] === 'object') {
              // Check if it's an object with x,y properties
              if (typeof data[key].x === 'number' && typeof data[key].y === 'number') {
                return {
                  x: data[key].x,
                  y: data[key].y,
                  theta: data[key].theta || data[key].angle || extractTheta(data[key].orientation) || 0
                };
              }
              // Check if it's an array with at least 2 elements
              else if (Array.isArray(data[key]) && data[key].length >= 2) {
                return {
                  x: data[key][0],
                  y: data[key][1],
                  theta: data.ori || data.theta || data.angle || 0
                };
              }
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