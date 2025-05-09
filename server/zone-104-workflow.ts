// server/zone-104-workflow.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';
import { isRobotCharging, isEmergencyStopPressed } from './robot-api';
import { missionQueue } from './mission-queue';

// Configure debug log file
const debugLogFile = path.join(process.cwd(), 'robot-debug.log');

// Helper function to log robot task information to debug file
function logRobotTask(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [ZONE-104-WORKFLOW] ${message}\n`;
  
  // Log to console and to file
  console.log(logEntry);
  fs.appendFileSync(debugLogFile, logEntry);
}

export function registerZone104WorkflowRoute(app: express.Express) {
  /**
   * This handler creates a complete pickup and drop-off workflow for zone 104
   * using the specialized point naming convention:
   * - Load points: "number_Load" (the actual shelf points where bins will be picked up)
   * - Load docking points: "number_Load_docking" (positions before the actual shelf)
   * - Dropoff: "Dropoff" (where bins are dropped off)
   * - Dropoff docking: "Dropoff_docking" (position before the dropoff)
   */
  const handleZone104Workflow = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const headers = { 'x-api-key': ROBOT_SECRET };
    
    logRobotTask(`🚀 Starting ZONE-104 workflow (pickup and dropoff sequence)`);
    
    try {
      // First check emergency stop status
      const emergencyStopPressed = await isEmergencyStopPressed();
      if (emergencyStopPressed) {
        const errorMsg = '🚨 Emergency stop button is pressed. Please release it before executing tasks.';
        logRobotTask(errorMsg);
        return res.status(400).json({ 
          success: false, 
          error: errorMsg,
          code: 'EMERGENCY_STOP_PRESSED'
        });
      }
      
      // Then check charging status
      const charging = await isRobotCharging();
      if (charging) {
        const errorMsg = '⚠️ Robot is currently charging. Please disconnect from charger before starting a workflow.';
        logRobotTask(errorMsg);
        return res.status(400).json({ 
          success: false, 
          error: errorMsg,
          code: 'ROBOT_CHARGING'
        });
      }
      
      // Get all map points
      logRobotTask('Fetching map points...');
      const points = await fetchRobotMapPoints();
      
      if (!points || points.length === 0) {
        throw new Error('Failed to get map points from robot');
      }
      logRobotTask(`Found ${points.length} map points`);
      
      // Find our specific points using the new naming convention
      const pickupPoint = points.find(p => p.id === '104_Load');
      const pickupDockingPoint = points.find(p => p.id === '104_Load_docking');
      const dropoffPoint = points.find(p => p.id === 'Dropoff');
      const dropoffDockingPoint = points.find(p => p.id === 'Dropoff_docking');
      const standbyPoint = points.find(p => 
        p.id.toLowerCase().includes('desk') || 
        p.id.toLowerCase().includes('standby')
      );
      
      // Validate all required points exist
      if (!pickupPoint) {
        throw new Error('Could not find pickup point "104_Load" in map data');
      }
      
      if (!pickupDockingPoint) {
        logRobotTask('⚠️ Warning: Pickup docking point "104_Load_docking" not found, will create one dynamically');
        // Create a docking point 1 meter away from the pickup point
        const dockingDistance = 1.0; // 1 meter
        const orientation = pickupPoint.ori || 0;
        const radians = (orientation * Math.PI) / 180;
        
        // Calculate approach point opposite to orientation
        pickupDockingPoint = {
          id: '104_Load_docking_dynamic',
          x: pickupPoint.x - dockingDistance * Math.cos(radians),
          y: pickupPoint.y - dockingDistance * Math.sin(radians),
          ori: orientation,
          floorId: pickupPoint.floorId,
          description: 'Dynamic docking point for 104_Load'
        };
      }
      
      if (!dropoffPoint) {
        throw new Error('Could not find dropoff point "Dropoff" in map data');
      }
      
      if (!dropoffDockingPoint) {
        logRobotTask('⚠️ Warning: Dropoff docking point "Dropoff_docking" not found, will create one dynamically');
        // Create a docking point 1 meter away from the dropoff point
        const dockingDistance = 1.0; // 1 meter
        const orientation = dropoffPoint.ori || 0;
        const radians = (orientation * Math.PI) / 180;
        
        // Calculate approach point opposite to orientation
        dropoffDockingPoint = {
          id: 'Dropoff_docking_dynamic',
          x: dropoffPoint.x - dockingDistance * Math.cos(radians),
          y: dropoffPoint.y - dockingDistance * Math.sin(radians),
          ori: orientation,
          floorId: dropoffPoint.floorId,
          description: 'Dynamic docking point for Dropoff'
        };
      }
      
      if (!standbyPoint) {
        logRobotTask('⚠️ Warning: No standby point found, will use dropoff point as final position');
      }
      
      // Log the points we found
      logRobotTask('✅ Found all required map points:');
      logRobotTask(`- Pickup: ${pickupPoint.id} at (${pickupPoint.x}, ${pickupPoint.y}), orientation: ${pickupPoint.ori}`);
      logRobotTask(`- Pickup docking: ${pickupDockingPoint.id} at (${pickupDockingPoint.x}, ${pickupDockingPoint.y}), orientation: ${pickupDockingPoint.ori}`);
      logRobotTask(`- Dropoff: ${dropoffPoint.id} at (${dropoffPoint.x}, ${dropoffPoint.y}), orientation: ${dropoffPoint.ori}`);
      logRobotTask(`- Dropoff docking: ${dropoffDockingPoint.id} at (${dropoffDockingPoint.x}, ${dropoffDockingPoint.y}), orientation: ${dropoffDockingPoint.ori}`);
      if (standbyPoint) {
        logRobotTask(`- Standby: ${standbyPoint.id} at (${standbyPoint.x}, ${standbyPoint.y}), orientation: ${standbyPoint.ori}`);
      }
      
      // Create mission steps for pickup sequence
      const pickupMissionSteps = [
        // Step 1: Go to docking position near pickup point
        {
          type: 'move' as const,
          params: {
            x: pickupDockingPoint.x,
            y: pickupDockingPoint.y,
            ori: pickupDockingPoint.ori || 0,
            label: `docking for ${pickupPoint.id}`
          }
        },
        // Step 2: Move precisely to pickup position
        {
          type: 'move' as const,
          params: {
            x: pickupPoint.x,
            y: pickupPoint.y,
            ori: pickupPoint.ori || 0,
            label: pickupPoint.id
          }
        },
        // Step 3: Jack Up to grab bin
        {
          type: 'jack_up' as const,
          params: {}
        },
        // Step 4: Go to docking position near dropoff
        {
          type: 'move' as const,
          params: {
            x: dropoffDockingPoint.x,
            y: dropoffDockingPoint.y,
            ori: dropoffDockingPoint.ori || 0,
            label: `docking for ${dropoffPoint.id}`
          }
        },
        // Step 5: Move precisely to dropoff position
        {
          type: 'move' as const,
          params: {
            x: dropoffPoint.x,
            y: dropoffPoint.y,
            ori: dropoffPoint.ori || 0,
            label: dropoffPoint.id
          }
        },
        // Step 6: Jack Down to release bin
        {
          type: 'jack_down' as const,
          params: {}
        },
        // Step 7: Return to standby position
        {
          type: 'move' as const,
          params: {
            x: standbyPoint ? standbyPoint.x : dropoffDockingPoint.x,
            y: standbyPoint ? standbyPoint.y : dropoffDockingPoint.y,
            ori: standbyPoint ? standbyPoint.ori || 0 : dropoffDockingPoint.ori || 0,
            label: standbyPoint ? standbyPoint.id : 'final position'
          }
        }
      ];
      
      // First clear any existing active missions
      await missionQueue.cancelAllActiveMissions();
      logRobotTask('✅ Cancelled any existing active missions');
      
      // Create the mission in the queue
      const missionName = `Zone 104 Complete Workflow (Pickup to Dropoff)`;
      const mission = missionQueue.createMission(missionName, pickupMissionSteps, 'L382502104987ir');
      
      logRobotTask(`✅ Mission created with ID: ${mission.id}`);
      logRobotTask(`Mission will continue executing even if the robot goes offline`);
      
      // Start immediate execution
      await missionQueue.processMissionQueue();
      
      const totalDuration = Date.now() - startTime;
      logRobotTask(`🚀 ZONE-104 WORKFLOW initiated. Planning took: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: 'Zone 104 complete workflow started (pickup → dropoff)',
        missionId: mission.id,
        duration: totalDuration,
        steps: pickupMissionSteps.length
      });
    } catch (err: any) {
      const errorMessage = err.response?.data || err.message;
      logRobotTask(`❌ ZONE-104 WORKFLOW error: ${errorMessage}`);
      res.status(500).json({ 
        success: false,
        error: err.message, 
        details: err.response?.data 
      });
    }
  };
  
  // Register the handler
  app.post('/api/robots/workflows/zone-104', handleZone104Workflow);
  
  logRobotTask('✅ Registered zone-104 workflow handler');
}