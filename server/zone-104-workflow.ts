// server/zone-104-workflow.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET, ROBOT_SERIAL, getAuthHeaders } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';
import { isRobotCharging, isEmergencyStopPressed, returnToCharger } from './robot-api';
import { missionQueue } from './mission-queue';
import { MissionStep } from './mission-queue';
import { Point } from './types';

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

/**
 * Checks if a bin is present at the specified position
 * First checks our bin status API (with overrides), then fallbacks to assumptions
 * @param pointId Point ID to check for bin presence
 * @returns True if a bin is detected
 */
async function checkForBin(pointId: string): Promise<boolean> {
  try {
    // First check our bin status API (which includes overrides)
    try {
      const binStatusResponse = await axios.get(`http://localhost:5000/api/bins/status?location=${pointId}`);
      if (binStatusResponse.data && binStatusResponse.data.success) {
        const binPresent = binStatusResponse.data.binPresent;
        const source = binStatusResponse.data.source;
        logRobotTask(`Bin detection at ${pointId}: ${binPresent ? '⚠️ BIN PRESENT (OCCUPIED)' : '✅ CLEAR'} [Source: ${source}]`);
        return binPresent;
      }
    } catch (error: any) {
      logRobotTask(`Error checking bin status API: ${error.message}`);
      // Continue to fallback methods
    }
    
    // For pickup points (104_Load), assume a bin is present
    if (pointId === '104_Load') {
      logRobotTask(`[BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
      return true;
    }
    
    // For dropoff points (Drop-off_Load), assume bin is not present (OK to dropoff)
    if (pointId === 'Drop-off_Load') {
      logRobotTask(`[BIN-DETECTION] Assuming dropoff is clear at ${pointId}`);
      return false;
    }
    
    // Default fallback
    logRobotTask(`[BIN-DETECTION] Using default bin detection logic for ${pointId}`);
    return pointId.includes('Load') && !pointId.includes('docking'); // Return true for Load points that are not docking points
  } catch (error: any) {
    logRobotTask(`[BIN-DETECTION] Error checking for bin: ${error.message}`);
    // In case of error, default based on point type
    return pointId.includes('Load') && !pointId.includes('docking');
  }
}

/**
 * Create a direct robot task using the AutoXing API
 * This uses the specialized shelf operation API with proper stepActs for bin operations
 */
async function createDirectShelfTask(
  pickupPoint: Point, 
  pickupDockingPoint: Point, 
  dropoffPoint: Point, 
  dropoffDockingPoint: Point, 
  chargerPoint: Point
): Promise<any> {
  try {
    logRobotTask('Creating a direct shelf task using AutoXing API');
    
    // Create a properly formatted task according to robot API documentation
    const task = {
      name: `Zone 104 Shelf Pickup and Return to Charger ${new Date().toISOString()}`,
      robotSn: ROBOT_SERIAL,
      runNum: 1,
      taskType: 2, // Regular task
      runType: 20, // Standard task
      routeMode: 1, // Best path
      runMode: 1, // One-time execution
      ignorePublicSite: false,
      speed: -1, // Default speed
      // Current position info not needed - robot knows its position
      
      // Define all the points in the task
      pts: [
        // STEP 1: Go to docking position first
        {
          x: pickupDockingPoint.x,
          y: pickupDockingPoint.y,
          yaw: pickupDockingPoint.ori,
          areaId: "",
          type: -1, // Regular point
          ext: {
            id: pickupDockingPoint.id,
            name: pickupDockingPoint.id
          },
          // No special actions at docking point
          stepActs: []
        },
        
        // STEP 2: Go to pickup position
        {
          x: pickupPoint.x,
          y: pickupPoint.y,
          yaw: pickupPoint.ori,
          areaId: "",
          type: 3, // IMPORTANT: Mark as shelf point (type 3)
          ext: {
            id: pickupPoint.id,
            name: pickupPoint.id
          },
          // This is the critical part - we need to use type 47 for lifting
          stepActs: [
            {
              type: 47, // Lift up operation (per documentation)
              data: {} // No special parameters needed
            },
            // Add a pause after lifting for safety
            {
              type: 18, // Pause action
              data: {
                pauseTime: 3 // 3 second pause
              }
            }
          ]
        },
        
        // STEP 3: Go to dropoff docking position
        {
          x: dropoffDockingPoint.x,
          y: dropoffDockingPoint.y,
          yaw: dropoffDockingPoint.ori,
          areaId: "",
          type: -1, // Regular point
          ext: {
            id: dropoffDockingPoint.id,
            name: dropoffDockingPoint.id
          },
          // No special actions at docking point
          stepActs: []
        },
        
        // STEP 4: Go to dropoff position
        {
          x: dropoffPoint.x,
          y: dropoffPoint.y,
          yaw: dropoffPoint.ori,
          areaId: "",
          type: 3, // IMPORTANT: Mark as shelf point (type 3)
          ext: {
            id: dropoffPoint.id,
            name: dropoffPoint.id
          },
          // This is the critical part - we need to use type 48 for dropping
          stepActs: [
            {
              type: 48, // Lift down operation (per documentation)
              data: {} // No special parameters needed
            },
            // Add a pause after dropping for safety
            {
              type: 18, // Pause action
              data: {
                pauseTime: 3 // 3 second pause
              }
            }
          ]
        },
        
        // STEP 5: Return to charger
        {
          x: chargerPoint.x,
          y: chargerPoint.y,
          yaw: chargerPoint.ori,
          areaId: "",
          type: 1, // IMPORTANT: Mark as charging point (type 1)
          ext: {
            id: chargerPoint.id,
            name: chargerPoint.id
          },
          // No special actions needed for charger - the point type takes care of it
          stepActs: []
        }
      ]
    };
    
    // Log the complete task definition
    logRobotTask(`Created direct robot task with ${task.pts.length} points`);
    
    // Call the robot API to create and start the task
    const response = await axios.post(`${ROBOT_API_URL}/api/v2/task`, task, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });
    
    logRobotTask(`✅ Successfully created direct task - Response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error: any) {
    logRobotTask(`❌ Error creating direct shelf task: ${error.message}`);
    if (error.response) {
      logRobotTask(`API Error Details: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Registers the Zone 104 workflow routes
 */
export function registerZone104WorkflowRoute(app: express.Express) {
  /**
   * This handler creates a complete pickup and drop-off workflow for zone 104
   * Followed by a return to the charging station
   */
  const handleZone104Workflow = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    
    logRobotTask(`🔄 Starting ZONE-104 workflow with charging return`);
    
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
      const pickupPoint = allPoints.find(p => p.id === '104_Load');
      const pickupDockingPoint = allPoints.find(p => p.id === '104_Load_docking');
      const dropoffPoint = allPoints.find(p => p.id === 'Drop-off_Load');
      const dropoffDockingPoint = allPoints.find(p => p.id === 'Drop-off_Load_docking');
      const chargerPoint = allPoints.find(p => 
        p.id === 'charger' || 
        p.id === 'Charger' || 
        p.id.toLowerCase().includes('charg') ||
        p.id.includes('Charging Station')
      );
      
      // Validate all required points exist
      if (!pickupPoint) {
        throw new Error('Could not find pickup point "104_Load" in map data');
      }
      
      if (!pickupDockingPoint) {
        throw new Error('Could not find pickup docking point "104_Load_docking" in map data');
      }
      
      if (!dropoffPoint) {
        throw new Error('Could not find dropoff point "Drop-off_Load" in map data');
      }
      
      if (!dropoffDockingPoint) {
        throw new Error('Could not find dropoff docking point "Drop-off_Load_docking" in map data');
      }
      
      if (!chargerPoint) {
        throw new Error('Could not find charger point in map data');
      }
      
      // Log the points we found
      logRobotTask('✅ Found all required map points:');
      logRobotTask(`- Pickup: ${pickupPoint.id} at (${pickupPoint.x}, ${pickupPoint.y}), ori: ${pickupPoint.ori}`);
      logRobotTask(`- Pickup docking: ${pickupDockingPoint.id} at (${pickupDockingPoint.x}, ${pickupDockingPoint.y}), ori: ${pickupDockingPoint.ori}`);
      logRobotTask(`- Dropoff: ${dropoffPoint.id} at (${dropoffPoint.x}, ${dropoffPoint.y}), ori: ${dropoffPoint.ori}`);
      logRobotTask(`- Dropoff docking: ${dropoffDockingPoint.id} at (${dropoffDockingPoint.x}, ${dropoffDockingPoint.y}), ori: ${dropoffDockingPoint.ori}`);
      logRobotTask(`- Charger: ${chargerPoint.id} at (${chargerPoint.x}, ${chargerPoint.y}), ori: ${chargerPoint.ori}`);
      
      // First try using the direct robot API approach 
      try {
        logRobotTask('Attempting to use direct robot task API for better bin operations handling...');
        const directTaskResult = await createDirectShelfTask(
          pickupPoint,
          pickupDockingPoint,
          dropoffPoint,
          dropoffDockingPoint,
          chargerPoint
        );
        
        // Calculate planning time
        const directTaskDuration = Date.now() - startTime;
        
        // Return success to the caller
        return res.status(200).json({
          success: true,
          message: 'Zone 104 workflow initiated successfully with direct robot API',
          taskId: directTaskResult.id || directTaskResult.taskId,
          points: 5,
          duration: directTaskDuration,
          method: 'direct_robot_api',
          note: 'Using specialized shelf points with proper stepActs for bin operations'
        });
      } catch (directTaskError: any) {
        // Log the error but continue with fallback method
        logRobotTask(`⚠️ Direct robot task creation failed: ${directTaskError.message}`);
        logRobotTask('Falling back to mission queue approach...');
      }
      
      // FALLBACK METHOD: Use our mission queue system instead
      // Define the mission steps according to the documented process
      const workflowSteps: Omit<MissionStep, "completed" | "retryCount">[] = [];
      
      // STEP 1: Always go to pickup docking position first
      workflowSteps.push({
        type: 'move',
        params: {
          x: pickupDockingPoint.x,
          y: pickupDockingPoint.y,
          ori: pickupDockingPoint.ori,
          label: pickupDockingPoint.id
        }
      });
      
      // STEP 2: Go to pickup position
      workflowSteps.push({
        type: 'move',
        params: {
          x: pickupPoint.x,
          y: pickupPoint.y,
          ori: pickupPoint.ori,
          label: pickupPoint.id
        }
      });
      
      // STEP 3: Jack up to grab bin
      workflowSteps.push({
        type: 'jack_up',
        params: {
          waitComplete: true,
          stabilizationTime: 3000, // 3 seconds stabilization
          safetyWait: true
        }
      });
      
      // STEP 4: Go to dropoff docking position
      workflowSteps.push({
        type: 'move',
        params: {
          x: dropoffDockingPoint.x,
          y: dropoffDockingPoint.y,
          ori: dropoffDockingPoint.ori,
          label: dropoffDockingPoint.id
        }
      });
      
      // STEP 5: Go to dropoff position
      workflowSteps.push({
        type: 'move',
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
      
      // STEP 7: Return to charger (instead of standby)
      workflowSteps.push({
        type: 'move',
        params: {
          x: chargerPoint.x,
          y: chargerPoint.y,
          ori: chargerPoint.ori,
          label: chargerPoint.id
        }
      });
      
      // Log the workflow steps for documentation
      logRobotTask('📋 Created fallback workflow steps:');
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        if (step.type === 'move') {
          logRobotTask(`- Step ${i+1}: Move to ${step.params.label} (${step.params.x}, ${step.params.y})`);
        } else if (step.type === 'jack_up') {
          logRobotTask(`- Step ${i+1}: JACK UP with safety wait: ${step.params.waitComplete}`);
        } else if (step.type === 'jack_down') {
          logRobotTask(`- Step ${i+1}: JACK DOWN with safety wait: ${step.params.waitComplete}`);
        }
      }
      
      // Clear any existing missions for safety
      await missionQueue.cancelAllActiveMissions();
      logRobotTask('✅ Cancelled any existing active missions');
      
      // Create the mission and let the mission queue execute it
      const missionName = `Zone 104 Workflow with Charger Return (Fallback Method)`;
      const mission = missionQueue.createMission(missionName, workflowSteps, ROBOT_SERIAL);
      
      // Calculate planning time
      const duration = Date.now() - startTime;
      
      logRobotTask(`✅ Created mission with ID: ${mission.id} (fallback method)`);
      logRobotTask(`🚀 Total planning time: ${duration}ms`);
      
      // Return success to the caller
      return res.status(200).json({
        success: true,
        message: 'Zone 104 workflow initiated successfully using fallback method',
        missionId: mission.id,
        steps: workflowSteps.length,
        duration,
        method: 'mission_queue_fallback',
        note: 'Robot will return to charger after completing the pickup and dropoff (using fallback implementation)'
      });
    } catch (error: any) {
      // Comprehensive error handling
      const errorMessage = `Error executing zone-104 workflow: ${error.message}`;
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
  
  // Register the handler for multiple path patterns
  // Old route for backward compatibility
  app.post('/api/robots/workflows/zone-104', handleZone104Workflow);
  
  // New route with consistent RESTful naming
  app.post('/api/zone-104/workflow', handleZone104Workflow);
  
  logRobotTask('✅ Registered zone-104 workflow handler with charger return');
}