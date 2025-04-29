import express, { type Express, Request, Response } from "express";
import { z } from 'zod';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
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
                demoRobotSensors[robotSerial] = {
                  ...data.sensors,
                  timestamp: new Date().toISOString()
                };
                
                ws.send(JSON.stringify({
                  type: 'sensors_updated',
                  timestamp: new Date().toISOString()
                }));
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