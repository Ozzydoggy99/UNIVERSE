import type { Express, Request, Response } from 'express';
import axios from 'axios';
import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { createReadStream } from 'fs';
import { join } from 'path';

// Default image to display when a camera is not available
const DEFAULT_CAMERA_IMAGE_PATH = join(process.cwd(), 'client', 'public', 'robot-camera-placeholder.jpg');

/**
 * Register routes for accessing H.264 robot video streams
 * 
 * This provides HTTP and WebSocket endpoints for robot video streaming
 */
export function registerRobotVideoRoutes(app: Express, httpServer: Server) {
  // Set up WebSocket server for robot video streaming
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/api/robot-video'
  });

  wss.on('connection', (ws, req) => {
    console.log('Robot video WebSocket client connected');
    
    // Extract serial number from URL
    const urlPath = req.url || '';
    const serialNumberMatch = urlPath.match(/\/([^\/]+)$/);
    const serialNumber = serialNumberMatch ? serialNumberMatch[1] : '';
    
    if (!serialNumber) {
      ws.send(JSON.stringify({ error: 'Missing robot serial number' }));
      ws.close();
      return;
    }
    
    console.log(`Robot video stream requested for ${serialNumber}`);
    
    // Set up video streaming
    startVideoStream(ws, serialNumber);
    
    ws.on('close', () => {
      console.log(`Robot video WebSocket connection closed for ${serialNumber}`);
    });
    
    ws.on('error', (error) => {
      console.error(`Robot video WebSocket error for ${serialNumber}:`, error);
    });
  });
  
  // HTTP endpoint for a single video frame (for fallback when WebSockets aren't working)
  app.get('/api/robot-video-frame/:serialNumber', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      console.log(`Single video frame requested for robot ${serialNumber}`);
      
      const frame = await getVideoFrame(serialNumber);
      if (frame) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(frame);
      } else {
        res.status(404).send('No video frame available');
      }
    } catch (error) {
      console.error('Error getting video frame:', error);
      res.status(500).send('Error retrieving video frame');
    }
  });
}

/**
 * Start streaming video data to the provided WebSocket connection
 */
function startVideoStream(ws: WebSocket, serialNumber: string) {
  // Set up variables for streaming
  let isActive = true;
  let consecutiveErrors = 0;
  let datasSent = 0;
  
  // Start streaming by calling the relevant endpoint repeatedly
  const streamVideo = async () => {
    if (!isActive) return;
    
    try {
      // Get video data
      const data = await getVideoFrame(serialNumber);
      
      // If data exists and socket is open, send it
      if (data && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        datasSent++;
        consecutiveErrors = 0;
        
        if (datasSent % 100 === 0) {
          console.log(`Sent ${datasSent} video frames to client for robot ${serialNumber}`);
        }
      } else if (!data) {
        console.warn(`No video data available for robot ${serialNumber}`);
        consecutiveErrors++;
      }
      
      // If too many consecutive errors, stop the stream
      if (consecutiveErrors > 10) {
        console.error(`Too many consecutive errors, stopping video stream for ${serialNumber}`);
        isActive = false;
        ws.close();
        return;
      }
      
      // Schedule next frame
      setTimeout(streamVideo, 33); // ~30fps
    } catch (error) {
      console.error(`Error streaming video for ${serialNumber}:`, error);
      consecutiveErrors++;
      
      // Continue trying with a delay
      setTimeout(streamVideo, 1000);
    }
  };
  
  // Set up cleanup when WebSocket closes
  ws.on('close', () => {
    isActive = false;
  });
  
  // Start streaming
  streamVideo();
}

/**
 * Gets a single frame of H.264 video data from the robot
 */
async function getVideoFrame(serialNumber: string): Promise<Buffer | null> {
  try {
    // Try different methods to get video data
    // Method 1: Try to get H.264 data from the robot's video endpoint
    try {
      // Get video data from the ngrok proxy
      const response = await axios({
        method: 'GET',
        url: `http://8f50-47-180-91-99.ngrok-free.app/rgb_cameras/front/video/frame`,
        responseType: 'arraybuffer',
        timeout: 2000,
        headers: {
          'Accept': 'application/octet-stream',
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.data && response.data.length > 0) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.warn(`Method 1 failed to get video frame: ${(error as Error).message}`);
    }
    
    // Method 2: Try WebSocket-style request to get a JPEG snapshot
    try {
      const response = await axios.post(
        'http://8f50-47-180-91-99.ngrok-free.app',
        JSON.stringify({ "get_jpeg_snapshot": "rgb_cameras/front" }),
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 2000,
          responseType: 'arraybuffer'
        }
      );
      
      if (response.data && response.data.length > 0) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.warn(`Method 2 failed to get video frame: ${(error as Error).message}`);
    }
    
    // Method 3: Try alternative path
    try {
      const response = await axios({
        method: 'GET',
        url: `http://8f50-47-180-91-99.ngrok-free.app/h264/snapshot`,
        responseType: 'arraybuffer',
        timeout: 2000
      });
      
      if (response.data && response.data.length > 0) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.warn(`Method 3 failed to get video frame: ${(error as Error).message}`);
    }
    
    // All methods failed
    return null;
  } catch (error) {
    console.error('Error getting video frame:', error);
    return null;
  }
}