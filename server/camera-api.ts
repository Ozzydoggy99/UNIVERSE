import { Express, Request, Response } from 'express';
import { storage } from './storage';
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

// Only support our single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';
const ROBOT_API_URL = 'http://8f50-47-180-91-99.ngrok-free.app';

// Register camera API routes
export function registerCameraApiRoutes(app: Express) {
  // Camera stream proxy endpoint to handle CORS issues
  app.get('/api/camera-stream/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { endpoint } = req.query; // Get any specific endpoint from the query
      
      console.log(`Camera stream request for ${serialNumber}${endpoint ? ` with specific endpoint: ${endpoint}` : ''}`);
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        // If the camera is not available, return a default image
        console.log('Camera not available or not enabled, returning default image');
        res.setHeader('Content-Type', 'image/jpeg');
        return createReadStream(DEFAULT_CAMERA_IMAGE_PATH).pipe(res);
      }
      
      // Build target URL based on parameters
      let targetUrl = `${ROBOT_API_URL}/robot-camera/${serialNumber}`;
      
      // If a specific endpoint was requested, use it instead of the default URL
      if (endpoint && typeof endpoint === 'string') {
        targetUrl = `${ROBOT_API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        console.log(`Using custom endpoint for camera feed: ${targetUrl}`);
        
        // Handle RGB cameras directly, based on the documentation
        if (endpoint.startsWith('/rgb_cameras/')) {
          try {
            console.log(`Accessing RGB camera stream directly: ${targetUrl}`);
            
            // First, try to enable the topic
            try {
              const enableMsg = JSON.stringify({ "enable_topic": endpoint.replace(/^\//, '') });
              console.log(`Enabling camera topic with: ${enableMsg}`);
              
              await axios.post(ROBOT_API_URL, enableMsg, {
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
            const enableMsg = JSON.stringify({ "enable_topic": topicName });
            
            await axios.post(ROBOT_API_URL, enableMsg, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 3000
            });
            
            // Now try to access the stream
            console.log(`Topic '${topicName}' enabled. Now attempting to access the stream...`);
            const streamUrl = `${ROBOT_API_URL}/${topicName}`;
            
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
        if (targetUrl.includes('ngrok-free.app') || (!endpoint && serialNumber === PHYSICAL_ROBOT_SERIAL)) {
          // The CameraHandler component now passes a simple path like '/rgb_cameras/front/compressed'
          // We need to properly enable the topic first, then try to get the stream
          
          // Try up to 3 different approaches to get a camera feed
          
          // Approach 1: Enable the topic via WebSocket and then access direct URL
          try {
            // First, try to enable the topic via WebSocket
            try {
              const enableMsg = JSON.stringify({ "enable_topic": "rgb_cameras/front/compressed" });
              console.log(`Approach 1: Enabling camera topic first: ${enableMsg}`);
              
              await axios.post(ROBOT_API_URL, enableMsg, {
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
            const rgbUrl = `${ROBOT_API_URL}/rgb_cameras/front/compressed`;
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
              const topicUrl = `${ROBOT_API_URL}/topic/rgb_cameras/front/compressed`;
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
                
                const snapshotResponse = await axios.post(ROBOT_API_URL, 
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
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot camera not found' });
      }
      
      // Get robot template assignment
      const robotAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      // Send live camera data
      console.log('Sent camera data for robot:', serialNumber);
      res.json({
        enabled: true,
        streamUrl: `${ROBOT_API_URL}/robot-camera/${serialNumber}`,
        resolution: {
          width: 1280,
          height: 720
        },
        rotation: 0,
        nightVision: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting camera data:', error);
      res.status(500).json({ error: 'Failed to get camera data' });
    }
  });
  
  // Update camera settings API
  app.post('/api/robots/camera/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const { enabled, nightVision, rotation } = req.body;
      
      console.log(`Camera update for ${serialNumber}:`, req.body);
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot camera not found' });
      }
      
      // Get robot template assignment
      const robotAssignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      
      if (!robotAssignment) {
        return res.status(404).json({ error: 'Robot not registered' });
      }
      
      // Here you would send the settings to the physical robot
      // For now, we just return the updated camera data
      
      // Return updated camera data
      res.json({
        enabled: enabled !== undefined ? enabled : true,
        streamUrl: enabled === false ? '' : `${ROBOT_API_URL}/robot-camera/${serialNumber}`,
        resolution: {
          width: 1280,
          height: 720
        },
        rotation: rotation !== undefined ? rotation : 0,
        nightVision: nightVision !== undefined ? nightVision : true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating camera:', error);
      res.status(500).json({ error: 'Failed to update camera' });
    }
  });
}

/**
 * Process camera-related WebSocket messages
 * This function will handle all camera-related WebSocket requests
 */
export function processCameraWebSocketMessage(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  console.log('Camera data requested for robot:', data.serialNumber);
  
  if (data.type === 'get_robot_camera') {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      sendError(ws, `Camera not available for robot ${data.serialNumber}`);
      return;
    }
    
    // Send back the camera data
    const cameraData = {
      enabled: true,
      streamUrl: `${ROBOT_API_URL}/robot-camera/${data.serialNumber}`,
      resolution: {
        width: 1280,
        height: 720
      },
      rotation: 0,
      nightVision: true,
      timestamp: new Date().toISOString()
    };
    
    // Send data back to the client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: cameraData
      }));
      console.log('Sent camera data for robot:', data.serialNumber);
    }
    
    // Also broadcast to all connected clients
    broadcastRobotUpdate(connectedClients, 'camera', data.serialNumber, cameraData);
  }
  else if (data.type === 'toggle_robot_camera') {
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      sendError(ws, `Camera not available for robot ${data.serialNumber}`);
      return;
    }
    
    // Here you would send the camera toggle command to the physical robot
    // For now, we just send back the updated camera data
    
    // Send updated camera data
    const cameraData = {
      enabled: data.enabled !== undefined ? data.enabled : true,
      streamUrl: data.enabled === false ? '' : `${ROBOT_API_URL}/robot-camera/${data.serialNumber}`,
      resolution: {
        width: 1280,
        height: 720
      },
      rotation: 0,
      nightVision: true,
      timestamp: new Date().toISOString()
    };
    
    // Send data back to the client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: cameraData
      }));
      console.log('Sent updated camera data for robot:', data.serialNumber);
    }
    
    // Also broadcast to all connected clients
    broadcastRobotUpdate(connectedClients, 'camera', data.serialNumber, cameraData);
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message: message
    }));
  }
}

function broadcastRobotUpdate(clients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  const message = JSON.stringify({
    type: updateType,
    data: data
  });
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}