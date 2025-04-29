import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { demoCameraData } from './robot-api';
import { WebSocket } from 'ws';
import axios from 'axios';
import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Stream buffer to use as fallback when a camera is offline or unreachable
const DEFAULT_CAMERA_IMAGE_PATH = join(__dirname, '../attached_assets/IMG_1576.jpeg');

// Register camera API routes
export function registerCameraApiRoutes(app: Express) {
  // Camera stream proxy endpoint to handle CORS issues
  app.get('/api/camera-stream/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Get the robot camera data to find the stream URL
      const camera = demoCameraData[serialNumber];
      
      if (!camera || !camera.enabled || !camera.streamUrl) {
        // If the camera is not available, return a default image
        return createReadStream(DEFAULT_CAMERA_IMAGE_PATH).pipe(res);
      }
      
      // Try to proxy the camera stream
      try {
        console.log(`Attempting to proxy camera stream from ${camera.streamUrl}`);
        const response = await axios.get(camera.streamUrl, {
          responseType: 'stream',
          timeout: 5000, // 5 second timeout
        });
        
        // Forward the response headers and data
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        // Set CORS headers to allow access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Stream the data back to the client
        return response.data.pipe(res);
      } catch (error) {
        console.error(`Error proxying camera stream from ${camera.streamUrl}:`, error);
        // If the camera is unreachable, return a default image
        return createReadStream(DEFAULT_CAMERA_IMAGE_PATH).pipe(res);
      }
    } catch (error) {
      console.error('Error in camera stream proxy:', error);
      res.status(500).send('Camera stream error');
    }
  });
  // Get camera data for a specific robot
  app.get('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Get camera data for the robot
      const cameraData = demoCameraData[serialNumber];
      
      if (!cameraData) {
        return res.status(404).json({ error: 'Robot camera data not found' });
      }
      
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
      
      // Check if the robot exists in our data
      if (!demoCameraData[serialNumber]) {
        // Check if robot is registered
        const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
        
        if (!existingAssignment) {
          return res.status(404).json({ 
            error: 'Robot not found', 
            message: 'Please register the robot first using the /api/robots/register endpoint'
          });
        }
        
        // Create a new camera data entry for this robot
        demoCameraData[serialNumber] = {
          enabled: enabled !== undefined ? enabled : false,
          streamUrl: enabled ? 'https://example.com/robot-stream-default.jpg' : '',
          resolution: {
            width: 1280,
            height: 720
          },
          rotation: 0,
          nightVision: false,
          timestamp: new Date().toISOString()
        };
      } else {
        // Update the existing camera data
        const cameraData = demoCameraData[serialNumber];
        
        if (enabled !== undefined) {
          cameraData.enabled = enabled;
          
          // Update the stream URL based on the enabled state
          if (enabled && !cameraData.streamUrl) {
            // Use the real robot IP for our physical robot
            if (serialNumber === 'L382502104988is') {
              cameraData.streamUrl = 'http://192.168.4.32:8080/stream';
            } else {
              cameraData.streamUrl = 'https://example.com/robot-stream-default.jpg';
            }
          } else if (!enabled) {
            cameraData.streamUrl = '';
          }
        }
        
        cameraData.timestamp = new Date().toISOString();
      }
      
      res.json(demoCameraData[serialNumber]);
    } catch (error) {
      console.error('Error updating robot camera:', error);
      res.status(500).json({ error: 'Failed to update robot camera' });
    }
  });
}

// WebSocket handlers for camera operations
export function setupCameraWebSocketHandlers(ws: WebSocket, data: any, connectedClients: WebSocket[]) {
  // Handle get camera data request
  if (data.type === 'get_robot_camera' && data.serialNumber) {
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
    } else {
      sendError(ws, `No camera data for robot ${data.serialNumber}`);
    }
  }
  // Handle toggle camera request
  else if (data.type === 'toggle_robot_camera' && data.serialNumber) {
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      // Toggle the camera state
      camera.enabled = data.enabled !== undefined ? data.enabled : !camera.enabled;
      camera.timestamp = new Date().toISOString();
      
      // Update the stream URL based on the enabled state
      if (camera.enabled && !camera.streamUrl) {
        // Use the real robot IP for our physical robot
        if (data.serialNumber === 'L382502104988is') {
          camera.streamUrl = 'http://192.168.4.32:8080/stream';
        } else {
          camera.streamUrl = 'https://example.com/robot-stream-default.jpg';
        }
      } else if (!camera.enabled) {
        camera.streamUrl = '';
      }
      
      // Send the updated camera data back
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      
      // Also broadcast to all other connected clients
      broadcastRobotUpdate(
        connectedClients.filter(client => client !== ws), 
        'camera', 
        data.serialNumber, 
        camera
      );
    } else {
      sendError(ws, `No camera data for robot ${data.serialNumber}`);
    }
  }
}

// Helper function to send error message
function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({
    type: 'error',
    message: message
  }));
}

// Helper function to broadcast robot updates to connected clients
function broadcastRobotUpdate(connectedClients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: updateType,
        data: data
      }));
    }
  });
}