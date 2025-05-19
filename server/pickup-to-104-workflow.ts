// server/pickup-to-104-workflow.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET, ROBOT_SERIAL, getAuthHeaders } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';
import { isRobotCharging, isEmergencyStopPressed, returnToCharger } from './robot-api-fixed';
import { missionQueue } from './mission-queue';
import { MissionStep } from './mission-queue';
import { Point } from './types';

// Configure debug log file
const debugLogFile = path.join(process.cwd(), 'robot-debug.log');

// Helper function to log robot task information to debug file
function logRobotTask(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [PICKUP-TO-104] ${message}\n`;
  
  // Log to console and to file
  console.log(logEntry);
  fs.appendFileSync(debugLogFile, logEntry);
}

/**
 * Registers the specific pickup to 104 workflow routes
 * This workflow picks up a bin from the main pickup point and drops it at point 104
 */
export function registerPickupTo104WorkflowRoute(app: express.Express) {
  /**
   * This handler creates a workflow for picking up a bin from the pickup point
   * and delivering it to point 104 as requested
   */
  const handlePickupTo104Workflow = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    
    logRobotTask(`🔄 Starting Pickup to 104 workflow`);
    
    try {
      // SAFETY CHECK 1: First check emergency stop status
      const emergencyStopPressed = await isEmergencyStopPressed();
      if (emergencyStopPressed) {
        const errorMsg = '🚨 EMERGENCY STOP PRESSED - Cannot start workflow until released';
        logRobotTask(errorMsg);
        return res.status(400).json({ 
          success: false, 
          error: errorMsg,
          code: 'EMERGENCY_STOP_PRESSED'
        });
      }
      
      // SAFETY CHECK 2: Then check charging status
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
      logRobotTask('Fetching all robot map points...');
      const allPoints = await fetchRobotMapPoints();
      
      if (!allPoints || allPoints.length === 0) {
        throw new Error('Failed to get map points from robot');
      }
      
      logRobotTask(`Found ${allPoints.length} map points`);
      
      // Log all available point IDs to aid in debugging
      logRobotTask(`Available point IDs: ${allPoints.map(p => p.id).join(', ')}`);
      
      // Find specifically needed points using exact IDs (case-sensitive)
      // This is the main pickup point in the facility - Using pick-up_load (lowercase p)
      const pickupPoint = allPoints.find(p => p.id === 'pick-up_load');
      const pickupDockingPoint = allPoints.find(p => p.id === 'pick-up_load_docking');
      
      // This is the shelf point 104 where we'll drop off the bin
      const dropoffPoint = allPoints.find(p => p.id === '104_load');
      const dropoffDockingPoint = allPoints.find(p => p.id === '104_load_docking');
      
      // Always use hardcoded charger coordinates instead of trying to get them from the API
      // This ensures return to charger always works
      
      // Create charger point using known coordinates
      const chargerPoint = {
        id: 'Charging Station_docking',
        x: 0.03443853667262486,
        y: 0.4981316698765672,
        ori: 266.11
      };
      
      logRobotTask(`✅ Using verified charger position: (${chargerPoint.x}, ${chargerPoint.y}), ori: ${chargerPoint.ori}`);
      
      // No need to try the API as we know these coordinates work
      
      // Validate required points exist
      if (!pickupPoint) {
        throw new Error('Could not find pickup point "pick-up_load" in map data');
      }
      
      if (!pickupDockingPoint) {
        throw new Error('Could not find pickup docking point "pick-up_load_docking" in map data');
      }
      
      if (!dropoffPoint) {
        throw new Error('Could not find dropoff point "104_load" in map data');
      }
      
      if (!dropoffDockingPoint) {
        throw new Error('Could not find dropoff docking point "104_load_docking" in map data');
      }
      
      // Log the points we found
      logRobotTask('✅ Found all required map points:');
      logRobotTask(`- Pickup: ${pickupPoint.id} at (${pickupPoint.x}, ${pickupPoint.y}), ori: ${pickupPoint.ori}`);
      logRobotTask(`- Pickup docking: ${pickupDockingPoint.id} at (${pickupDockingPoint.x}, ${pickupDockingPoint.y}), ori: ${pickupDockingPoint.ori}`);
      logRobotTask(`- Dropoff (104): ${dropoffPoint.id} at (${dropoffPoint.x}, ${dropoffPoint.y}), ori: ${dropoffPoint.ori}`);
      logRobotTask(`- Dropoff docking: ${dropoffDockingPoint.id} at (${dropoffDockingPoint.x}, ${dropoffDockingPoint.y}), ori: ${dropoffDockingPoint.ori}`);
      
      if (chargerPoint) {
        logRobotTask(`- Charger: ${chargerPoint.id} at (${chargerPoint.x}, ${chargerPoint.y}), ori: ${chargerPoint.ori}`);
      } else {
        logRobotTask(`- No charger point found, will skip return to charger step`);
      }
      
      // Define the mission steps for the workflow
      const workflowSteps: Omit<MissionStep, "completed" | "retryCount">[] = [];
      
      // STEP 1: Go to pickup docking position first (approach point)
      workflowSteps.push({
        type: 'move',
        params: {
          x: pickupDockingPoint.x,
          y: pickupDockingPoint.y,
          ori: pickupDockingPoint.ori,
          label: pickupDockingPoint.id
        }
      });
      
      // STEP 2: Use align_with_rack move for proper rack alignment at pickup
      workflowSteps.push({
        type: 'align_with_rack',
        params: {
          x: pickupPoint.x,
          y: pickupPoint.y,
          ori: pickupPoint.ori,
          label: `Align with rack at ${pickupPoint.id}`
        }
      });
      
      // NOTE: Small backup was removed as the robot's API doesn't support joystick endpoint
      // We'll rely on align_with_rack to handle proper positioning
      
      // STEP 3: Jack up to grab bin
      workflowSteps.push({
        type: 'jack_up',
        params: {
          waitComplete: true,
          stabilizationTime: 3000, // 3 seconds stabilization
          safetyWait: true
        }
      });
      
      // STEP 4: Go to 104 docking position
      workflowSteps.push({
        type: 'move',
        params: {
          x: dropoffDockingPoint.x,
          y: dropoffDockingPoint.y,
          ori: dropoffDockingPoint.ori,
          label: dropoffDockingPoint.id
        }
      });
      
      // STEP 5: Go to 104 point with to_unload_point for precise positioning
      workflowSteps.push({
        type: 'to_unload_point',
        params: {
          x: dropoffPoint.x,
          y: dropoffPoint.y,
          ori: dropoffPoint.ori,
          label: dropoffPoint.id
        }
      });
      
      // STEP 6: Jack down to release bin
      workflowSteps.push({
        type: 'jack_down',
        params: {
          waitComplete: true,
          stabilizationTime: 3000, // 3 seconds stabilization
          safetyWait: true
        }
      });
      
      // STEP 7: Move away from 104 (safety step)
      workflowSteps.push({
        type: 'move',
        params: {
          x: dropoffDockingPoint.x,
          y: dropoffDockingPoint.y,
          ori: dropoffDockingPoint.ori,
          label: `${dropoffDockingPoint.id} (safe position)` 
        }
      });
      
      // STEP 8: Always return to charger
      // First try using the charger point coordinates if available
      if (chargerPoint) {
        workflowSteps.push({
          type: 'move',
          params: {
            x: chargerPoint.x,
            y: chargerPoint.y,
            ori: chargerPoint.ori,
            label: chargerPoint.id,
            isCharger: true // Explicitly mark this as a charger move
          }
        });
      } 
      // If no charger point found, use the dedicated return-to-charger API
      else {
        workflowSteps.push({
          type: 'return_to_charger',
          params: {
            label: 'Return to charging station',
            useApi: true
          }
        });
      }
      
      // Log the workflow steps for documentation
      logRobotTask('📋 Created workflow steps:');
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        if (step.type === 'move') {
          if (step.params.isCharger) {
            logRobotTask(`- Step ${i+1}: CHARGER DOCKING at ${step.params.label} (${step.params.x}, ${step.params.y})`);
          } else {
            logRobotTask(`- Step ${i+1}: Move to ${step.params.label} (${step.params.x}, ${step.params.y})`);
          }
        } else if (step.type === 'jack_up') {
          logRobotTask(`- Step ${i+1}: JACK UP with safety wait: ${step.params.waitComplete}`);
        } else if (step.type === 'jack_down') {
          logRobotTask(`- Step ${i+1}: JACK DOWN with safety wait: ${step.params.waitComplete}`);
        } else if (step.type === 'align_with_rack') {
          logRobotTask(`- Step ${i+1}: ALIGN WITH RACK at ${step.params.label} (${step.params.x}, ${step.params.y})`);
        } else if (step.type === 'to_unload_point') {
          logRobotTask(`- Step ${i+1}: TO UNLOAD POINT at ${step.params.label} (${step.params.x}, ${step.params.y})`);
        } else if (step.type === 'return_to_charger') {
          logRobotTask(`- Step ${i+1}: RETURN TO CHARGER using ${step.params.useApi ? 'API method' : 'point movement'}`);
        }
      }
      
      // Clear any existing missions for safety
      await missionQueue.cancelAllActiveMissions();
      logRobotTask('✅ Cancelled any existing active missions');
      
      // Create the mission and let the mission queue execute it
      const missionName = `Pickup to 104 Workflow`;
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      
      // Calculate planning time
      const duration = Date.now() - startTime;
      
      logRobotTask(`✅ Created mission with ID: ${mission.id}`);
      logRobotTask(`🚀 Total planning time: ${duration}ms`);
      
      // Return success to the caller
      return res.status(200).json({
        success: true,
        message: 'Pickup to 104 workflow initiated successfully',
        missionId: mission.id,
        steps: workflowSteps.length,
        duration,
        method: 'mission_queue',
        note: 'Robot will pick up from the main pickup point and drop at point 104'
      });
    } catch (error: any) {
      // Comprehensive error handling
      const errorMessage = `Error executing pickup-to-104 workflow: ${error.message}`;
      logRobotTask(`❌ ${errorMessage}`);
      
      if (error.response) {
        // Log API response errors in detail
        logRobotTask(`API Error Status: ${error.response.status}`);
        logRobotTask(`API Error Data: ${JSON.stringify(error.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  };
  
  // Register the handler
  app.post('/api/pickup-to-104/workflow', handlePickupTo104Workflow);
  
  logRobotTask('✅ Registered pickup-to-104 workflow handler');
}