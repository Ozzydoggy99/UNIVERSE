import { Express, Request, Response } from 'express';
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fetch from 'node-fetch';
import { demoCameraData } from './robot-api';

/**
 * Register routes for accessing H.264 robot video streams
 * 
 * This provides HTTP and WebSocket endpoints for robot video streaming
 */
export function registerRobotVideoRoutes(app: Express, httpServer: Server) {
  // WebSocket endpoint for streaming H.264 video data
  const videoWss = new WebSocketServer({ noServer: true });
  
  // Register the WebSocket handler
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    // Check if this is a video WebSocket request
    if (pathname.startsWith('/api/robot-video/')) {
      videoWss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Robot video WebSocket connection established');
        
        // Extract the robot serial number from the URL
        const serialNumber = pathname.split('/').pop();
        if (!serialNumber) {
          sendError(ws, 'Missing robot serial number');
          return;
        }
        
        // Start streaming video data
        startVideoStream(ws, serialNumber);
        
        ws.on('close', () => {
          console.log(`Robot video WebSocket for ${serialNumber} closed`);
        });
        
        ws.on('error', (err) => {
          console.error(`Robot video WebSocket error for ${serialNumber}:`, err);
        });
      });
    }
  });
  
  // HTTP endpoint for single frame retrieval
  app.get('/api/robot-video-frame/:serialNumber', async (req: Request, res: Response) => {
    try {
      const serialNumber = req.params.serialNumber;
      
      if (!serialNumber) {
        return res.status(400).send('Missing robot serial number');
      }
      
      const frame = await getVideoFrame(serialNumber);
      
      if (!frame) {
        return res.status(404).send('No video frame available');
      }
      
      res.set('Content-Type', 'application/octet-stream');
      res.send(frame);
    } catch (error) {
      console.error('Error retrieving video frame:', error);
      res.status(500).send('Error retrieving video frame');
    }
  });
}

/**
 * Start streaming video data to the provided WebSocket connection
 */
function startVideoStream(ws: WebSocket, serialNumber: string) {
  let isActive = true;
  const intervalId = setInterval(async () => {
    if (!isActive || ws.readyState !== WebSocket.OPEN) {
      clearInterval(intervalId);
      return;
    }
    
    try {
      const frame = await getVideoFrame(serialNumber);
      
      if (frame && ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    } catch (error) {
      console.error(`Error streaming video for ${serialNumber}:`, error);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: 'Failed to retrieve video frame' }));
      }
    }
  }, 33); // ~30fps
  
  // Clean up on close
  ws.on('close', () => {
    isActive = false;
    clearInterval(intervalId);
  });
}

/**
 * Gets a single frame of H.264 video data from the robot
 */
async function getVideoFrame(serialNumber: string): Promise<Buffer | null> {
  try {
    const cameraData = demoCameraData[serialNumber];
    
    if (!cameraData || !cameraData.enabled || !cameraData.streamUrl) {
      throw new Error('Camera not available');
    }
    
    // The streamUrl should be from the ngrok proxy server which is converting 
    // the robot camera feed to H.264
    const h264Url = `${cameraData.streamUrl}/h264-frame`;
    
    const response = await fetch(h264Url);
    
    if (!response.ok) {
      console.error(`Error fetching H.264 frame: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const buffer = await response.buffer();
    return buffer;
  } catch (error) {
    console.error(`Error getting video frame for ${serialNumber}:`, error);
    return null;
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ error: message }));
  }
}