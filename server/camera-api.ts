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
      
      // If this is one of our publicly accessible robots, try to use its stream directly
      if ((serialNumber === 'L382502104987ir' || serialNumber === 'AX923701583RT') && camera && camera.enabled && camera.streamUrl) {
        console.log(`Attempting to proxy robot camera stream from ${camera.streamUrl} for ${serialNumber}`);
        
        // For the specific ngrok URL, we add a special case
        let targetUrl = camera.streamUrl;
        if (targetUrl.includes('ngrok-free.app')) {
          console.log(`Using ngrok proxy for camera feed: ${targetUrl}`);
          
          // Determine if we should use the RGB video stream or JPEG image stream based on the robot documentation
          // First try a list of possible topic endpoints
          const possibleEndpoints = [
            // Topic endpoints (from documentation)
            '/topic',
            '/enable_topic',
            '/rgb_cameras/front/compressed',
            '/rgb_cameras/front/video',
            
            // Direct camera feed
            '/camera/mjpeg',
            '/camera/image',
            '/camera',
            
            // Standard robot endpoints
            '/status',
            '/device/info'
          ];
          
          // Try each endpoint in sequence
          for (const endpoint of possibleEndpoints) {
            const endpointUrl = `https://8f50-47-180-91-99.ngrok-free.app${endpoint}`;
            
            try {
              console.log(`Attempting to access robot camera endpoint: ${endpointUrl}`);
              const response = await axios.get(endpointUrl, {
                responseType: 'stream',
                timeout: 5000, // Shorter timeout to check multiple endpoints
                headers: {
                  'Accept': 'image/jpeg, video/*, */*',
                  'Connection': 'keep-alive',
                  'Cache-Control': 'no-cache'
                }
              });
              
              console.log(`Successful connection to endpoint: ${endpoint}`);
              
              // Set appropriate content type
              const contentType = response.headers['content-type'] || 'application/octet-stream';
              res.setHeader('Content-Type', contentType);
              
              // Set CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              
              console.log(`Successfully connected to ${serialNumber} robot camera via endpoint: ${endpoint}`);
              return response.data.pipe(res);
            } catch (error) {
              const typedError = error as Error;
              console.log(`Failed to access endpoint ${endpoint}: ${typedError.message}`);
              // Continue to the next endpoint
            }
          }
          
          // If we get here, all endpoints failed, try one more with the specific JPEG stream
          const imageStreamUrl = `https://8f50-47-180-91-99.ngrok-free.app/rgb_cameras/front/compressed`;
          try {
            console.log(`Making final attempt with RGB image stream from: ${imageStreamUrl}`);
            const response = await axios.get(imageStreamUrl, {
              responseType: 'stream',
              timeout: 8000, // Longer timeout for this final attempt
              headers: {
                'Accept': 'image/jpeg, image/*',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
              }
            });
            
            // Forward appropriate content type header based on what we received
            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            
            // Set CORS headers to allow access from any origin
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            console.log(`Successfully connected to ${serialNumber} robot image stream via ngrok!`);
            // Stream the data back to the client
            return response.data.pipe(res);
          } catch (error) {
            const imageError = error as Error;
            console.warn(`Error connecting to image stream: ${imageError.message}. Trying video stream...`);
            
            // If image stream fails, try the video stream
            try {
              const videoStreamUrl = `https://8f50-47-180-91-99.ngrok-free.app/rgb_cameras/front/video`;
              console.log(`Attempting to get RGB video stream from: ${videoStreamUrl}`);
              
              const response = await axios.get(videoStreamUrl, {
                responseType: 'stream',
                timeout: 10000,
                headers: {
                  'Accept': 'multipart/x-mixed-replace; boundary=frame, */*',
                  'Connection': 'keep-alive'
                }
              });
              
              // Explicitly set content type for stream
              const contentType = response.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame';
              res.setHeader('Content-Type', contentType);
              
              // Set CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              
              console.log(`Successfully connected to ${serialNumber} robot video stream via ngrok!`);
              return response.data.pipe(res);
            } catch (error) {
              const videoError = error as Error;
              console.error(`Error connecting to video stream: ${videoError.message}`);
              
              // If both methods fail, try the original URL as fallback
              try {
                console.log(`Falling back to original URL: ${targetUrl}`);
                const response = await axios.get(targetUrl, {
                  responseType: 'stream',
                  timeout: 8000,
                  headers: {
                    'Accept': 'multipart/x-mixed-replace; boundary=frame, */*',
                    'Connection': 'keep-alive'
                  }
                });
                
                // Set proper content headers
                res.setHeader('Content-Type', response.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                return response.data.pipe(res);
              } catch (error) {
                const finalError = error as Error;
                console.error(`All connection attempts to camera stream failed: ${finalError.message}`);
                // Fall through to regular camera handling
              }
            }
          }
        } else {
          try {
            // For non-ngrok URLs, use standard approach
            const response = await axios.get(camera.streamUrl, {
              responseType: 'stream',
              timeout: 8000, // Increase timeout for public connection
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
            
            console.log(`Successfully connected to ${serialNumber} robot camera stream!`);
            // Stream the data back to the client
            return response.data.pipe(res);
          } catch (error) {
            console.error(`Error connecting to ${serialNumber} robot camera stream: ${error}`);
            // Fall through to regular camera handling
          }
        }
      }
      
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
            // Set appropriate stream URL based on robot serial number
            if (serialNumber === 'L382502104988is') {
              // Local robot
              cameraData.streamUrl = 'http://192.168.4.32:8080/stream';
            } else if (serialNumber === 'L382502104987ir') {
              // Public accessible robot
              cameraData.streamUrl = 'http://47.180.91.99:8080/stream';
              console.log('Using public IP camera stream for robot:', serialNumber);
            } else if (serialNumber === 'AX923701583RT') {
              // AxBot 5000 Pro - new robot with high resolution camera
              cameraData.streamUrl = 'http://axbot-demo.example.com/stream/AX923701583RT';
              cameraData.resolution = {
                width: 1920,
                height: 1080
              };
              console.log('Using high resolution camera stream for AxBot 5000 Pro:', serialNumber);
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
        // Set appropriate stream URL based on robot serial number
        if (data.serialNumber === 'L382502104988is') {
          // Local robot
          camera.streamUrl = 'http://192.168.4.32:8080/stream';
        } else if (data.serialNumber === 'L382502104987ir') {
          // Public accessible robot
          camera.streamUrl = 'http://47.180.91.99:8080/stream';
          console.log('Using public IP camera stream for robot via WebSocket:', data.serialNumber);
        } else if (data.serialNumber === 'AX923701583RT') {
          // AxBot 5000 Pro - new robot with high resolution camera
          camera.streamUrl = 'http://axbot-demo.example.com/stream/AX923701583RT';
          camera.resolution = {
            width: 1920,
            height: 1080
          };
          console.log('Using high resolution camera stream for AxBot 5000 Pro via WebSocket:', data.serialNumber);
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