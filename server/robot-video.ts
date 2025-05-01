import { Express, Request, Response } from 'express';
import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { getVideoFrame } from './robot-websocket';

// We only support a single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

// Store connected clients by robot serial number
const videoClients = new Map<string, Set<WebSocket>>();

/**
 * Register routes for accessing H.264 robot video streams
 * 
 * This provides HTTP endpoints for robot video streaming
 * WebSocket handling is in this file
 */
export function registerRobotVideoRoutes(app: Express, httpServer: Server) {
  // Create WebSocket server for video streaming
  const videoWss = new WebSocketServer({ 
    server: httpServer, 
    path: '/api/robot-video/:serialNumber'
  });
  
  // Handle WebSocket connections for video
  videoWss.on('connection', (ws, req) => {
    let serialNumber = '';
    
    try {
      // Extract robot serial number from URL
      const match = req.url?.match(/\/api\/robot-video\/([^/]+)/);
      if (match && match[1]) {
        serialNumber = match[1];
      }
      
      // Validate serial number
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        ws.close(4000, 'Invalid robot serial number');
        return;
      }
      
      // Add client to list of video clients for this robot
      if (!videoClients.has(serialNumber)) {
        videoClients.set(serialNumber, new Set());
      }
      videoClients.get(serialNumber)?.add(ws);
      
      console.log(`Video WebSocket client connected for robot ${serialNumber}`);
      
      // Handle client disconnect
      ws.on('close', () => {
        console.log(`Video WebSocket client disconnected for robot ${serialNumber}`);
        videoClients.get(serialNumber)?.delete(ws);
        
        // Clean up empty sets
        if (videoClients.get(serialNumber)?.size === 0) {
          videoClients.delete(serialNumber);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`Video WebSocket error for robot ${serialNumber}:`, error);
      });
      
      // Start sending video frames
      startSendingVideoFrames(serialNumber, ws);
    } catch (error) {
      console.error('Error handling video WebSocket connection:', error);
      ws.close(1011, 'Internal Server Error');
    }
  });
  
  // HTTP endpoint for getting a single video frame
  app.get('/api/robot-video-frame/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      
      // Only support our physical robot
      if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
        return res.status(404).json({ error: 'Robot not found' });
      }
      
      // Get a single frame of video
      const frameData = getVideoFrame(serialNumber);
      
      if (frameData) {
        // If it's a JPEG frame (compressed topic)
        if (Buffer.isBuffer(frameData)) {
          res.set('Content-Type', 'image/jpeg');
          res.send(frameData);
        } else {
          // If we don't have frame data
          res.status(404).json({ error: 'Video frame not available' });
        }
      } else {
        res.status(404).json({ error: 'Video frame not available' });
      }
    } catch (error) {
      console.error('Error getting video frame:', error);
      res.status(500).json({ error: 'Failed to get video frame' });
    }
  });
}

/**
 * Start sending video frames to a WebSocket client
 */
function startSendingVideoFrames(serialNumber: string, ws: WebSocket) {
  // We'll get frames from the robot WebSocket connection
  // and forward them to the client
  let frameInterval: NodeJS.Timeout | null = null;
  
  // Function to send a single frame
  const sendFrame = () => {
    try {
      // Skip if client is not connected
      if (ws.readyState !== WebSocket.OPEN) {
        if (frameInterval) {
          clearInterval(frameInterval);
          frameInterval = null;
        }
        return;
      }
      
      // Get a frame from the robot
      const frameData = getVideoFrame(serialNumber);
      
      // If we have frame data, send it to the client
      if (frameData) {
        ws.send(frameData);
      }
    } catch (error) {
      console.error('Error sending video frame:', error);
      
      // Clear interval on error
      if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
      }
    }
  };
  
  // Start sending frames at 30fps (approximately)
  frameInterval = setInterval(sendFrame, 33);
  
  // Handle WebSocket close to clean up interval
  ws.on('close', () => {
    if (frameInterval) {
      clearInterval(frameInterval);
      frameInterval = null;
    }
  });
}