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
      throw new Error('Camera not available');
    }
    
    // The streamUrl should be from the ngrok proxy server which is converting 
    // the robot camera feed to H.264
    const h264Url = `${cameraData.streamUrl}/h264-frame`;
    
    console.log(`Fetching H.264 frame from: ${h264Url}`);
    
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