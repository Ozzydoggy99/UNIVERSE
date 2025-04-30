import { Express, Request, Response } from 'express';
import { Server } from 'http';
import fetch from 'node-fetch';
import { demoCameraData } from './robot-api';

/**
 * Register routes for accessing H.264 robot video streams
 * 
 * This provides HTTP endpoints for robot video streaming
 * WebSocket handling is done in routes.ts
 */
export function registerRobotVideoRoutes(app: Express, httpServer: Server) {
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
 * Gets a single frame of H.264 video data from the robot
 */
export async function getVideoFrame(serialNumber: string): Promise<Buffer | null> {
  try {
    const cameraData = demoCameraData[serialNumber];
    
    if (!cameraData || !cameraData.enabled || !cameraData.streamUrl) {
      console.error(`Camera not available for robot ${serialNumber}`);
      return null;
    }
    
    // The streamUrl should be from the ngrok proxy server which is converting 
    // the robot camera feed to H.264
    const h264Url = `${cameraData.streamUrl}/h264-frame`;
    
    // For debugging
    console.log(`Fetching H.264 frame from: ${h264Url}`);
    
    const response = await fetch(h264Url, {
      method: 'GET',
      headers: {
        'Accept': 'application/octet-stream',
        'Cache-Control': 'no-cache'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      console.error(`Error fetching H.264 frame: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Get the binary data
    const buffer = await response.buffer();
    
    // Validate that we got a non-empty buffer
    if (!buffer || buffer.length === 0) {
      console.error(`Received empty buffer from ${h264Url}`);
      return null;
    }
    
    return buffer;
  } catch (error) {
    console.error(`Error getting video frame for ${serialNumber}:`, error);
    return null;
  }
}