// server/zone-104-workflow.ts
import express from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';
import { isRobotCharging, isEmergencyStopPressed } from './robot-api';
import { missionQueue } from './mission-queue';
import { Point } from './types';

// Extended point interface with description for our workflow points
interface WorkflowPoint extends Point {
  description?: string;
}

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
 * @param x X coordinate
 * @param y Y coordinate
 * @param pointId For logging purposes
 * @returns True if a bin is detected
 */
async function checkForBin(x: number, y: number, pointId: string): Promise<boolean> {
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
    
    // For pickup points (contains "Load"), assume a bin is present
    if (pointId.includes('Load') && !pointId.includes('docking')) {
      logRobotTask(`[BIN-DETECTION] Assuming bin is present at pickup point ${pointId}`);
      return true;
    }
    
    // For dropoff points, assume bin is not present (OK to dropoff)
    if (pointId.toLowerCase().includes('drop') && !pointId.includes('docking')) {
      logRobotTask(`[BIN-DETECTION] Assuming dropoff is clear at ${pointId}`);
      return false;
    }
    
    // Default fallback
    logRobotTask(`[BIN-DETECTION] Using default bin detection logic for ${pointId}`);
    return pointId.includes('Load'); // Return true for Load points, false otherwise
  } catch (error: any) {
    logRobotTask(`[BIN-DETECTION] Error checking for bin: ${error.message}`);
    // In case of error, default based on point type
    return pointId.includes('Load');
  }
}

export function registerZone104WorkflowRoute(app: express.Express) {
  /**
   * This handler creates a complete pickup and drop-off workflow for zone 104
   * using the specialized point naming convention:
   * - Load points: "number_Load" (the actual shelf points where bins will be picked up)
   * - Load docking points: "number_Load_docking" (positions before the actual shelf)
   * - Dropoff: "Drop-off_Load" (where bins are dropped off)
   * - Dropoff docking: "Drop-off_Load_docking" (position before the dropoff)
   */
  const handleZone104Workflow = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    
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
      
      // First, log all available point IDs to help debug which points are present
      logRobotTask(`Available point IDs: ${points.map(p => p.id).join(', ')}`);
      
      // Find our specific points using the new naming convention
      const pickupPoint = points.find(p => p.id === '104_Load') as Point;
      const pickupDockingPoint = points.find(p => p.id === '104_Load_docking') as WorkflowPoint;
      
      // Try multiple names for dropoff point since naming may vary
      const dropoffPoint = points.find(p => 
        p.id === 'Drop-off_Load' || 
        p.id === 'Dropoff_Load' || 
        p.id === 'dropoff_Load' ||
        p.id === 'drop-off_load'
      ) as Point;
      
      const dropoffDockingPoint = points.find(p => 
        p.id === 'Drop-off_Load_docking' || 
        p.id === 'Dropoff_Load_docking' ||
        p.id === 'dropoff_Load_docking' ||
        p.id === 'drop-off_load_docking'
      ) as WorkflowPoint;
      
      const standbyPoint = points.find(p => 
        p.id.toLowerCase().includes('desk') || 
        p.id.toLowerCase().includes('standby')
      ) as Point | undefined;
      
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
      
      // Create a properly formatted task based on the AutoXing API documentation
      // For bin lifting, we need stepActs with type 47 (jack up) or 48 (jack down)
      
      // Construct the task using proper structure from the API documentation
      const task = {
        runType: 0,          // Standard task
        name: `Zone 104 Complete Workflow (${new Date().toISOString()})`,
        robotSn: 'L382502104987ir',
        areaId: pickupPoint.areaId || dropoffPoint.areaId, // Use the area ID from the points
        startPoiId: pickupDockingPoint.id,  // Start from the pickup docking
        steps: [
          // STEP 1: Move to pickup docking position
          {
            poiId: pickupDockingPoint.id,  // First go to docking position
            stepActs: [] // No special actions at docking point
          },
          
          // STEP 2: Move to pickup position
          {
            poiId: pickupPoint.id,  // Move to actual pickup position
            stepActs: [] // No actions yet - we'll add jack_up after checking bin presence
          },
          
          // STEP 3: Perform jack up operation at pickup point
          {
            poiId: pickupPoint.id,  // Stay at pickup position
            stepActs: [
              {
                actType: 47,  // 47 = jack up operation per documentation
                actParams: {
                  waitComplete: true,  // Wait for complete stop before continuing
                  stabilizationTime: 3000  // 3 seconds stabilization time for safety
                }
              }
            ]
          },
          
          // STEP 4: Move to dropoff docking position
          {
            poiId: dropoffDockingPoint.id,  // Important - go to docking point first
            stepActs: []  // No special actions at docking
          },
          
          // STEP 5: Move to actual dropoff position
          {
            poiId: dropoffPoint.id,  // Move to actual dropoff position
            stepActs: []  // No actions yet
          },
          
          // STEP 6: Perform jack down operation at dropoff point
          {
            poiId: dropoffPoint.id,  // Stay at dropoff position
            stepActs: [
              {
                actType: 48,  // 48 = jack down operation per documentation
                actParams: {
                  waitComplete: true,  // Wait for complete stop before continuing
                  stabilizationTime: 3000  // 3 seconds stabilization time for safety
                }
              }
            ]
          },
          
          // STEP 7: Return to standby position
          {
            poiId: standbyPoint ? standbyPoint.id : dropoffDockingPoint.id,
            stepActs: []  // No special actions for standby
          }
        ],
        taskPriority: 5,  // High priority
        isLoop: false      // Not a looping task
      };
      
      // Log the task structure
      logRobotTask('📋 Constructed task with proper API structure:');
      logRobotTask(`- Task name: ${task.name}`);
      logRobotTask(`- Robot SN: ${task.robotSn}`);
      logRobotTask(`- Area ID: ${task.areaId}`);
      logRobotTask(`- Start POI: ${task.startPoiId}`);
      
      for (let i = 0; i < task.steps.length; i++) {
        const step = task.steps[i];
        let stepDesc = `- Step ${i+1}: Go to ${step.poiId}`;
        
        if (step.stepActs && step.stepActs.length > 0) {
          for (const act of step.stepActs) {
            if (act.actType === 47) {
              stepDesc += ` and JACK UP (type: ${act.actType})`;
            } else if (act.actType === 48) {
              stepDesc += ` and JACK DOWN (type: ${act.actType})`;
            } else {
              stepDesc += ` and perform action type ${act.actType}`;
            }
            
            if (act.actParams && act.actParams.waitComplete) {
              stepDesc += ' [with safety wait]';
            }
          }
        }
        
        logRobotTask(stepDesc);
      }
      
      // Clear any existing missions
      await missionQueue.cancelAllActiveMissions();
      logRobotTask('✅ Cancelled any existing active missions');
      
      // Create API request to assign the task
      logRobotTask('🔄 Sending task to robot API...');
      try {
        const apiUrl = `${ROBOT_API_URL}/api/v2/task`;
        logRobotTask(`📡 API URL: ${apiUrl}`);
        
        const response = await axios.post(apiUrl, task, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ROBOT_SECRET
          }
        });
        
        // Check the response and assign the task ID
        const taskId = response.data.id || response.data.taskId || null;
        
        if (!taskId) {
          throw new Error('Robot API returned success but no task ID was provided');
        }
        
        logRobotTask(`✅ Task created successfully with ID: ${taskId}`);
        
        // Calculate planning time
        const duration = Date.now() - startTime;
        
        logRobotTask(`🚀 ZONE-104 WORKFLOW initiated. Planning took: ${duration}ms`);
        
        // Return success response with task ID and planning details
        return res.status(200).json({
          success: true,
          message: 'Zone 104 workflow initiated successfully using direct task API',
          taskId: taskId,
          steps: task.steps.length,
          duration,
          taskStructure: task  // Include the task structure for debugging
        });
      } catch (error: any) {
        const errorMessage = `Error assigning task to robot API: ${error.message}`;
        const responseData = error.response?.data || 'No response data';
        
        logRobotTask(`❌ ${errorMessage}`);
        logRobotTask(`⚠️ API Response: ${JSON.stringify(responseData)}`);
        
        // Fallback to mission queue if API fails
        logRobotTask('⚠️ API assignment failed, falling back to mission queue...');
        
        // Create a mission using the old approach as fallback
        const missionName = `Zone 104 Complete Workflow (Fallback)`;
        
        // Convert the task structure to mission steps
        const workflowSteps = task.steps.map(step => {
          // For each step, create a move step
          const moveStep = {
            type: 'move',
            params: {
              label: step.poiId,
              // We need to find the point matching this ID
              x: points.find(p => p.id === step.poiId)?.x || 0,
              y: points.find(p => p.id === step.poiId)?.y || 0,
              ori: points.find(p => p.id === step.poiId)?.ori || 0
            }
          };
          
          // If there are step actions, handle them specially
          if (step.stepActs && step.stepActs.length > 0) {
            for (const act of step.stepActs) {
              if (act.actType === 47) {
                return {
                  type: 'jack_up',
                  params: act.actParams || {}
                };
              } else if (act.actType === 48) {
                return {
                  type: 'jack_down',
                  params: act.actParams || {}
                };
              }
            }
          }
          
          return moveStep;
        });
        
        const mission = missionQueue.createMission(missionName, workflowSteps, 'L382502104987ir');
        await missionQueue.startMission(mission.id);
        
        logRobotTask(`✅ Fallback mission created with ID: ${mission.id}`);
        
        // Calculate planning time
        const duration = Date.now() - startTime;
        
        // Return success response with mission ID and fallback note
        return res.status(200).json({
          success: true,
          message: 'Zone 104 workflow initiated successfully (using fallback mechanism)',
          missionId: mission.id,
          steps: workflowSteps.length,
          duration,
          note: 'Using fallback mission queue due to API error: ' + errorMessage
        });
      }
    } catch (error: any) {
      const errorMessage = `Error executing zone-104 workflow: ${error.message}`;
      logRobotTask(`❌ ${errorMessage}`);
      
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
  
  logRobotTask('✅ Registered zone-104 workflow handler');
}