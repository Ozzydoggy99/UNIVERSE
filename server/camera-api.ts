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
      const { endpoint } = req.query; // Get any specific endpoint from the query
      
      console.log(`Camera stream request for ${serialNumber}${endpoint ? ` with specific endpoint: ${endpoint}` : ''}`);
      
      // Get the robot camera data to find the stream URL
      const camera = demoCameraData[serialNumber];
      
      if (!camera || !camera.enabled || !camera.streamUrl) {
        // If the camera is not available, return a default image
        console.log('Camera not available or not enabled, returning default image');
        res.setHeader('Content-Type', 'image/jpeg');
        return createReadStream(DEFAULT_CAMERA_IMAGE_PATH).pipe(res);
      }
      
      // Build target URL based on parameters
      let targetUrl = camera.streamUrl;
      
      // If a specific endpoint was requested, use it instead of the default URL
      if (endpoint && typeof endpoint === 'string') {
        const ngrokBase = 'http://8f50-47-180-91-99.ngrok-free.app';
        targetUrl = `${ngrokBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        console.log(`Using custom endpoint for camera feed: ${targetUrl}`);
        
        // Handle RGB cameras directly, based on the documentation
        if (endpoint.startsWith('/rgb_cameras/')) {
          try {
            console.log(`Accessing RGB camera stream directly: ${targetUrl}`);
            
            // First, try to enable the topic
            try {
              const enableMsg = JSON.stringify({ "enable_topic": endpoint.replace(/^\//, '') });
              console.log(`Enabling camera topic with: ${enableMsg}`);
              
              await axios.post(ngrokBase, enableMsg, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 3000
              });
              console.log('Successfully sent enable_topic command');
            } catch (wsError) {
              // Continue anyway even if enabling fails
              console.warn(`Enable topic failed (continuing anyway): ${(wsError as Error).message}`);
            }
            
            // Short delay to let the topic initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Now try to stream from the endpoint
            try {
              console.log(`Streaming from: ${targetUrl}`);
              const response = await axios.get(targetUrl, {
                responseType: 'stream',
                timeout: 5000,
                headers: {
                  'Accept': 'image/jpeg, */*',
                  'Connection': 'keep-alive',
                  'Cache-Control': 'no-cache'
                }
              });
              
              // Set headers and return the stream
              const contentType = response.headers['content-type'] || 'image/jpeg';
              res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              
              console.log(`Successfully connected to RGB camera stream`);
              return response.data.pipe(res);
            } catch (streamError) {
              console.error(`RGB camera stream error: ${(streamError as Error).message}`);
              // Fall through to default handling
            }
          } catch (error) {
            console.error(`Failed to access RGB camera: ${(error as Error).message}`);
            // Fall through to default handling
          }
        }
        // Special handling for topic enabling
        else if (endpoint.startsWith('/enable_topic/')) {
          try {
            const topicName = endpoint.replace('/enable_topic/', '');
            console.log(`Enabling topic '${topicName}' via WebSocket`);
            
            // Send WebSocket message to enable the topic
            const wsUrl = 'http://8f50-47-180-91-99.ngrok-free.app';
            const enableMsg = JSON.stringify({ "enable_topic": topicName });
            
            await axios.post(wsUrl, enableMsg, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 3000
            });
            
            // Now try to access the stream
            console.log(`Topic '${topicName}' enabled. Now attempting to access the stream...`);
            const streamUrl = `http://8f50-47-180-91-99.ngrok-free.app/${topicName}`;
            
            const response = await axios.get(streamUrl, {
              responseType: 'stream',
              timeout: 5000,
              headers: {
                'Accept': 'image/jpeg, */*',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
              }
            });
            
            // Set headers and return the stream
            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            
            console.log(`Successfully connected to topic '${topicName}'`);
            return response.data.pipe(res);
          } catch (error) {
            console.error(`Failed to enable topic: ${(error as Error).message}`);
            // Fall through to default handling
          }
        }
      }
      
      // Default approach: try to proxy the camera stream directly
      try {
        console.log(`Attempting to proxy camera stream from ${targetUrl}`);
        
        const response = await axios.get(targetUrl, {
          responseType: 'stream',
          timeout: 8000,
          headers: {
            'Accept': 'image/jpeg, video/*, */*',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          }
        });
        
        // Set headers
        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        console.log(`Successfully connected to ${serialNumber} camera`);
        return response.data.pipe(res);
      } catch (streamError) {
        console.error(`Error streaming camera: ${(streamError as Error).message}`);
        
        // If our URL is from ngrok or we have no specific endpoint yet but it's the rgb camera stream
        if (targetUrl.includes('ngrok-free.app') || (!endpoint && serialNumber === 'L382502104987ir')) {
          // The CameraHandler component now passes a simple path like '/rgb_cameras/front/compressed'
          // We need to properly enable the topic first, then try to get the stream
          
          // Try up to 3 different approaches to get a camera feed
          
          // Approach 1: Enable the topic via WebSocket and then access direct URL
          try {
            // First, try to enable the topic via WebSocket
            try {
              const enableMsg = JSON.stringify({ "enable_topic": "rgb_cameras/front/compressed" });
              console.log(`Approach 1: Enabling camera topic first: ${enableMsg}`);
              
              await axios.post('http://8f50-47-180-91-99.ngrok-free.app', enableMsg, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 3000
              });
              console.log('Successfully sent enable_topic command');
            } catch (wsError) {
              console.warn(`Enable topic command failed (continuing anyway): ${(wsError as Error).message}`);
            }
            
            // Short delay to let the topic initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try the RGB cameras compressed format specifically
            const rgbUrl = 'http://8f50-47-180-91-99.ngrok-free.app/rgb_cameras/front/compressed';
            console.log(`Trying RGB camera endpoint: ${rgbUrl}`);
            
            const response = await axios.get(rgbUrl, {
              responseType: 'stream',
              timeout: 5000,
              headers: {
                'Accept': 'image/jpeg, */*',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
              }
            });
            
            // Set headers
            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            console.log(`Successfully connected to RGB camera endpoint`);
            return response.data.pipe(res);
          } catch (rgbError) {
            console.error(`RGB camera endpoint failed: ${(rgbError as Error).message}`);
            
            // Approach 2: Try with the topic prefix
            try {
              const topicUrl = 'http://8f50-47-180-91-99.ngrok-free.app/topic/rgb_cameras/front/compressed';
              console.log(`Approach 2: Trying with topic/ prefix: ${topicUrl}`);
              
              const response = await axios.get(topicUrl, {
                responseType: 'stream',
                timeout: 5000,
                headers: {
                  'Accept': 'image/jpeg, */*',
                  'Connection': 'keep-alive',
                  'Cache-Control': 'no-cache'
                }
              });
              
              // Set headers
              const contentType = response.headers['content-type'] || 'image/jpeg';
              res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              
              console.log(`Successfully connected to topic endpoint`);
              return response.data.pipe(res);
            } catch (topicError) {
              console.error(`Topic endpoint failed: ${(topicError as Error).message}`);
              
              // Approach 3: Try JSON WebSocket messages
              try {
                // Try sending a structured message to get a jpeg snapshot from the camera
                console.log('Approach 3: Trying to get snapshot via WebSocket-style request');
                
                const snapshotResponse = await axios.post('http://8f50-47-180-91-99.ngrok-free.app', 
                  JSON.stringify({ "get_jpeg_snapshot": "rgb_cameras/front" }),
                  {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000,
                    responseType: 'arraybuffer'
                  }
                );
                
                if (snapshotResponse.data && snapshotResponse.data.length > 0) {
                  // Stream the snapshot data back to client
                  res.setHeader('Content-Type', 'image/jpeg');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                  
                  console.log('Successfully got a camera snapshot');
                  res.end(snapshotResponse.data);
                  return;
                } else {
                  throw new Error('Empty snapshot response');
                }
              } catch (snapshotError) {
                console.error(`Snapshot attempt failed: ${(snapshotError as Error).message}`);
              }
            }
          }
        }
        
        // If all else fails, return the default image
        console.log('Returning default image after all streaming attempts failed');
        res.setHeader('Content-Type', 'image/jpeg');
        return createReadStream(DEFAULT_CAMERA_IMAGE_PATH).pipe(res);
      }
    } catch (error) {
      console.error('Unhandled error in camera stream proxy:', error);
      res.status(500).send('Camera stream error');
    }
  });
  
  // Get camera info API
  app.get('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      console.log('Camera data requested for robot:', serialNumber);
      
      // Get the camera data for this robot
      const camera = demoCameraData[serialNumber];
      
      if (camera) {
        res.json(camera);
      } else {
        res.status(404).json({ error: 'Camera not found for this robot' });
      }
    } catch (error) {
      console.error('Error getting camera data:', error);
      res.status(500).json({ error: 'Failed to get camera data' });
    }
  });
  
  // Update camera settings API
  app.post('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const updates = req.body;
      
      console.log(`Camera settings update for robot ${serialNumber}:`, updates);
      
      // Get the current camera data
      const camera = demoCameraData[serialNumber];
      
      if (!camera) {
        // Create a new camera data entry for this robot
        demoCameraData[serialNumber] = {
          enabled: true,
          streamUrl: `https://8f50-47-180-91-99.ngrok-free.app/robot-camera/${serialNumber}`,
          resolution: { width: 1280, height: 720 },
          rotation: 0,
          nightVision: true,
          timestamp: new Date().toISOString()
        };
        
        console.log(`Created new camera data for robot ${serialNumber}`);
        res.status(201).json(demoCameraData[serialNumber]);
      } else {
        // Update existing camera data
        const updatedCamera = { ...camera, ...updates, timestamp: new Date().toISOString() };
        demoCameraData[serialNumber] = updatedCamera;
        
        console.log(`Updated camera data for robot ${serialNumber}`);
        res.json(updatedCamera);
      }
    } catch (error) {
      console.error('Error updating camera settings:', error);
      res.status(500).json({ error: 'Failed to update camera settings' });
    }
  });
}

/**
 * Process camera-related WebSocket messages
 * This function will handle all camera-related WebSocket requests
 */
export function processCameraWebSocketMessage(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  try {
    if (data.type === 'get_robot_camera') {
      const { serialNumber } = data;
      console.log('Camera data requested for robot:', serialNumber);
      
      // Get the camera data for this robot
      const camera = demoCameraData[serialNumber];
      
      if (camera) {
        ws.send(JSON.stringify({
          type: 'camera',
          data: camera
        }));
        console.log('Sent camera data for robot:', serialNumber);
      } else {
        sendError(ws, `Camera not found for robot ${serialNumber}`);
      }
    } else if (data.type === 'set_robot_camera') {
      const { serialNumber, camera } = data;
      console.log(`Camera settings update for robot ${serialNumber}:`, camera);
      
      if (!serialNumber || !camera) {
        return sendError(ws, 'Missing serial number or camera data in request');
      }
      
      // Update the camera data
      const updatedCamera = {
        ...demoCameraData[serialNumber],
        ...camera,
        timestamp: new Date().toISOString()
      };
      
      demoCameraData[serialNumber] = updatedCamera;
      
      // Notify all clients about the update
      broadcastRobotUpdate(connectedClients, 'camera', serialNumber, updatedCamera);
      
      console.log(`Updated camera data for robot ${serialNumber} and broadcasted to all clients`);
    } else if (data.type === 'toggle_robot_camera') {
      const { serialNumber, enabled } = data;
      console.log(`Toggle camera for robot ${serialNumber} to ${enabled ? 'enabled' : 'disabled'}`);
      
      if (!serialNumber) {
        return sendError(ws, 'Missing serial number in request');
      }
      
      // Get the current camera data
      const camera = demoCameraData[serialNumber];
      
      if (!camera) {
        return sendError(ws, `Camera not found for robot ${serialNumber}`);
      }
      
      // Update the enabled status
      const newEnabled = enabled !== undefined ? enabled : !camera.enabled;
      const updatedCamera = {
        ...camera,
        enabled: newEnabled,
        timestamp: new Date().toISOString()
      };
      
      demoCameraData[serialNumber] = updatedCamera;
      
      // Notify all clients about the update
      broadcastRobotUpdate(connectedClients, 'camera', serialNumber, updatedCamera);
      
      console.log(`Toggled camera for robot ${serialNumber} to ${newEnabled ? 'enabled' : 'disabled'}`);
    }
  } catch (error) {
    console.error('Error processing camera WebSocket message:', error);
    sendError(ws, `Failed to process camera message: ${(error as Error).message}`);
  }
}

function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({
    type: 'error',
    message
  }));
}

function broadcastRobotUpdate(connectedClients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  const message = JSON.stringify({
    type: updateType,
    data
  });
  
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}