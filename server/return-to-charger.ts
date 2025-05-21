import { Express } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getRobotApiUrl, getAuthHeaders } from './robot-constants';
import { missionQueue, MissionQueueManager } from './mission-queue';

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

interface ErrorResponse {
  response?: {
    data?: unknown;
  };
}

// Function to log robot task messages with timestamps
function logRobotTask(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${new Date().toISOString()}] [RETURN-TO-CHARGER] ${message}`;
  console.log(`${timestamp} ${message}`);
  
  // Append to log file
  try {
    const logPath = path.join(process.cwd(), 'robot-debug.log');
    fs.appendFileSync(logPath, logMessage + '\n');
  } catch (err: unknown) {
    console.error('Failed to write to log file:', err instanceof Error ? err.message : 'Unknown error');
  }
}

export function registerReturnToChargerHandler(app: Express) {
  // Handler for robot jack_down command
  const handleJackDown = async (req: any, res: any) => {
    const startTime = Date.now();
    logRobotTask('🔽 Received request to JACK DOWN robot');
    
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getAuthHeaders(DEFAULT_ROBOT_SERIAL);

      // Execute the jack_down command
      const response = await axios.post(
        `${robotApiUrl}/services/jack_down`,
        {},
        { headers }
      );
      
      const result = response.data;
      logRobotTask(`✅ Robot JACK DOWN command executed successfully. Response: ${JSON.stringify(result)}`);
      
      res.json({ 
        success: true, 
        message: 'Robot jack_down command executed successfully',
        result,
        duration: Date.now() - startTime
      });
    } catch (err: unknown) {
      const errorResponse = err as ErrorResponse;
      const errorMessage = err instanceof Error ? err.message : 
        (errorResponse?.response?.data) || 
        'Unknown error occurred';
      logRobotTask(`❌ Failed to JACK DOWN robot: ${errorMessage}`);
      res.status(500).json({ 
        error: errorMessage, 
        response: errorResponse?.response?.data 
      });
    }
  };
  
  // Handler for return to charger
  const handleReturnToCharger = async (req: any, res: any) => {
    const startTime = Date.now();
    logRobotTask('🔋 Received request to return robot to charger');
    
    try {
      // Import helper functions from robot-map-data
      const { fetchRobotMapPoints } = await import('./robot-map-data');
      
      // Get all map points using our existing function
      const points = await fetchRobotMapPoints();
      logRobotTask(`Fetched ${points.length} map points`);
      
      // First try to find charger points directly
      const chargerPoints = points.filter((point: any) => {
        return point.id && (
          point.id.toString().toLowerCase().includes('charger') || 
          point.id.toString().toLowerCase().includes('charging') ||
          (point.description && point.description.toString().toLowerCase().includes('charge'))
        );
      });
      
      logRobotTask(`Found ${chargerPoints.length} charger points on the map`);
      
      let charger;
      
      if (chargerPoints && chargerPoints.length > 0) {
        charger = chargerPoints[0]; // Use the first charger point
        logRobotTask(`Found charger point with ID: ${charger.id}`);
      } else {
        // Backup: try using the standby point as a charger location
        const standbyPoints = points.filter((point: any) => {
          return point.id && (
            point.id.toString().toLowerCase().includes('standby') || 
            point.id.toString().toLowerCase().includes('home')
          );
        });
        
        if (standbyPoints && standbyPoints.length > 0) {
          charger = standbyPoints[0];
          logRobotTask(`No charger point found, using standby point as fallback: ${charger.id}`);
        } else {
          throw new Error('No charger or standby points found on the map');
        }
      }
      logRobotTask(`🔋 Using charger point at (${charger.x}, ${charger.y}) with orientation ${charger.ori ?? 0}`);
      
      // Create a docking point 1 meter away from the charger
      const dockingDistance = 1.0; // 1 meter
      
      // Get orientation and convert to radians
      const orientation = charger.ori ?? 0;
      const theta = (orientation * Math.PI) / 180;
      
      // Calculate approach point based on orientation
      // Approach from the opposite direction of the charger's orientation
      const dockX = charger.x - dockingDistance * Math.cos(theta);
      const dockY = charger.y - dockingDistance * Math.sin(theta);
      
      logRobotTask(`📍 Creating docking approach point at (${dockX.toFixed(3)}, ${dockY.toFixed(3)}) with orientation ${orientation} for charger`);
      
      // Create a mission with steps to return to charger
      const missionSteps = [
        // Step 1: Go to docking position near charger
        {
          type: 'move' as const,
          params: {
            x: dockX,
            y: dockY,
            ori: charger.ori ?? 0,
            label: 'docking point for charger'
          }
        },
        // Step 2: Move precisely to charger position with charge move type
        {
          type: 'move' as const,
          params: {
            x: charger.x,
            y: charger.y,
            ori: charger.ori ?? 0,
            label: 'charger point',
            isCharger: true // This indicates we want the charge move type with charge_retry_count
          }
        },
        // We do not want to jack_down at the charger - removed this step
      ];
      
      logRobotTask('🔋 NOTE: Using charge move type with charge_retry_count for final charger docking step');
      
      // Cancel all other pending or in-progress missions first
      logRobotTask('⚠️ Cancelling all other missions before returning to charger');
      
      // Since we don't have direct access to missionQueue.missions, we'll modify the implementation
      // to add a cancelAllMissions method first, and then use it
      const cancelMethod = (missionQueue as any).cancelAllMissions || missionQueue.cancelAllActiveMissions;
      if (typeof cancelMethod === 'function') {
        await cancelMethod.call(missionQueue);
        logRobotTask('✅ Successfully cancelled all other missions');
      } else {
        logRobotTask('⚠️ Could not cancel other missions - function not available');
      }
      
      // Create and execute the mission
      const missionName = 'Return to Charger - HIGH PRIORITY';
      const mission = missionQueue.createMission(missionName, missionSteps, DEFAULT_ROBOT_SERIAL);
      
      logRobotTask(`✅ Created mission to return to charger. Mission ID: ${mission.id}`);
      
      // Start immediate execution
      await missionQueue.processMissionQueue();
      
      res.json({ 
        success: true, 
        message: 'Robot is returning to charger',
        missionId: mission.id,
        chargerLocation: {
          x: charger.x,
          y: charger.y,
          ori: charger.ori ?? 0
        },
        duration: Date.now() - startTime
      });
    } catch (err: unknown) {
      const errorResponse = err as ErrorResponse;
      const errorMessage = err instanceof Error ? err.message : 
        (errorResponse?.response?.data) || 
        'Unknown error occurred';
      logRobotTask(`❌ Failed to return robot to charger: ${errorMessage}`);
      res.status(500).json({ 
        error: errorMessage, 
        response: errorResponse?.response?.data 
      });
    }
  };
  
  // Register the handlers
  app.post('/api/robot/jack_down', handleJackDown);
  app.post('/api/robot/return-to-charger', handleReturnToCharger);
  
  logRobotTask('Registered jack_down and return-to-charger handlers');
}