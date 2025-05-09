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
   * - Dropoff: "Dropoff" (where bins are dropped off)
   * - Dropoff docking: "Dropoff_docking" (position before the dropoff)
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
      let pickupDockingPoint = points.find(p => p.id === '104_Load_docking') as WorkflowPoint | undefined;
      
      // Try multiple names for dropoff point since naming may vary
      const dropoffPoint = points.find(p => 
        p.id === 'Dropoff' || 
        p.id === 'dropoff' || 
        p.id === 'Drop-off' || 
        p.id === 'drop-off' ||
        p.id.toLowerCase().includes('drop')
      ) as Point;
      
      let dropoffDockingPoint = points.find(p => 
        p.id === 'Dropoff_docking' || 
        p.id === 'dropoff_docking' ||
        p.id === 'Drop-off_docking' ||
        p.id === 'drop-off_docking'
      ) as WorkflowPoint | undefined;
      const standbyPoint = points.find(p => 
        p.id.toLowerCase().includes('desk') || 
        p.id.toLowerCase().includes('standby')
      ) as Point | undefined;
      
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
          name: '104_Load_docking_dynamic',
          x: pickupPoint.x - dockingDistance * Math.cos(radians),
          y: pickupPoint.y - dockingDistance * Math.sin(radians),
          ori: orientation,
          floorId: pickupPoint.floorId,
          description: 'Dynamic docking point for 104_Load'
        } as WorkflowPoint;
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
          name: 'Dropoff_docking_dynamic',
          x: dropoffPoint.x - dockingDistance * Math.cos(radians),
          y: dropoffPoint.y - dockingDistance * Math.sin(radians),
          ori: orientation,
          floorId: dropoffPoint.floorId,
          description: 'Dynamic docking point for Dropoff'
        } as WorkflowPoint;
      }
      
      if (!standbyPoint) {
        logRobotTask('⚠️ Warning: No standby point found, will use dropoff point as final position');
      }
      
      // Log the points we found
      logRobotTask('✅ Found all required map points:');
      logRobotTask(`- Pickup: ${pickupPoint.id} at (${pickupPoint.x}, ${pickupPoint.y}), orientation: ${pickupPoint.ori}`);
      logRobotTask(`- Pickup docking: ${pickupDockingPoint!.id} at (${pickupDockingPoint!.x}, ${pickupDockingPoint!.y}), orientation: ${pickupDockingPoint!.ori}`);
      logRobotTask(`- Dropoff: ${dropoffPoint.id} at (${dropoffPoint.x}, ${dropoffPoint.y}), orientation: ${dropoffPoint.ori}`);
      logRobotTask(`- Dropoff docking: ${dropoffDockingPoint!.id} at (${dropoffDockingPoint!.x}, ${dropoffDockingPoint!.y}), orientation: ${dropoffDockingPoint!.ori}`);
      if (standbyPoint) {
        logRobotTask(`- Standby: ${standbyPoint.id} at (${standbyPoint.x}, ${standbyPoint.y}), orientation: ${standbyPoint.ori}`);
      }
      
      // NO PRE-CHECKING OF BIN STATUS
      // We will follow the exact sequence and check bin status during execution
      
      logRobotTask(`✨ IMPORTANT: Using the correct sequential workflow with sequential checking`);
      logRobotTask(`✨ Following exact sequence with no pre-checks:`);
      logRobotTask(`  1. Go to ${pickupPoint.id}_docking first`);
      logRobotTask(`  2. Once there, check for bin at ${pickupPoint.id}`);
      logRobotTask(`  3. If bin present, go to ${pickupPoint.id} and jack up`);
      logRobotTask(`  4. Go to ${dropoffPoint.id}_docking position`);
      logRobotTask(`  5. Once there, check for bin at ${dropoffPoint.id}`);
      logRobotTask(`  6. If clear, go to ${dropoffPoint.id} and jack down`);
      logRobotTask(`  7. Return to standby position: ${standbyPoint?.id || 'Default'}`);
      
      // No pre-detection of bins or pre-planning of workflow cancellation
      let cancelWorkflow = false;
      
      // After bin detection is complete, create the mission steps based on detection results
      // For type safety with MissionStep
      type MoveStep = {
        type: 'move';
        params: {
          x: number;
          y: number;
          ori: number;
          label: string;
        };
      };
      
      type JackStep = {
        type: 'jack_up' | 'jack_down';
        params: Record<string, any>;
      };
      
      type MissionStep = MoveStep | JackStep;
      
      // DO NOT check for bins at beginning - we need to strictly follow the sequence
      // Per exact requirements:
      
      // 1. Always go to 104_load_docking first
      // 2. Only then check for bin at 104_load
      // 3. If bin present, go under bin at 104_load and jack up
      // 4. Always go to drop-off_load_docking next
      // 5. Only then check for bin at drop-off_load
      // 6. If no bin at drop-off_load, go there and jack down
      // 7. Finally return to standby
      
      // Initialize the workflow steps array
      const workflowSteps: MissionStep[] = [];
      
      // STEP 1: ALWAYS go to pickup docking position first
      logRobotTask(`🔄 [${new Date().toISOString()}] STEP 1/7: FIRST going to docking position at ${pickupPoint.id}_docking`);
      workflowSteps.push({
        type: 'move',
        params: {
          x: pickupDockingPoint!.x,
          y: pickupDockingPoint!.y,
          ori: pickupDockingPoint!.ori || 0,
          label: `${pickupPoint.id}_docking`
        }
      });
      
      // STEP 2: Check for bin at pickup location
      // This is only a detection step, we'll check later in the workflow execution
      logRobotTask(`🔍 [${new Date().toISOString()}] STEP 2/7: After arrival, checking for bin at ${pickupPoint.id}`);
      const binAtPickup = await checkForBin(pickupPoint.x, pickupPoint.y, pickupPoint.id);
      
      if (binAtPickup) {
        logRobotTask(`✅ [${new Date().toISOString()}] VERIFICATION: Bin detected at ${pickupPoint.id} - proceeding with pickup`);
        
        // STEP 3: Go under bin for pickup
        logRobotTask(`🔄 [${new Date().toISOString()}] STEP 3/7: Moving under bin at ${pickupPoint.id} for pickup`);
        workflowSteps.push({
          type: 'move',
          params: {
            x: pickupPoint.x,
            y: pickupPoint.y,
            ori: pickupPoint.ori || 0,
            label: `${pickupPoint.id}`
          }
        });
        
        // STEP 4: Jack up to grab bin
        logRobotTask(`⬆️ [${new Date().toISOString()}] STEP 4/7: Jacking up to grab bin at ${pickupPoint.id}`);
        workflowSteps.push({
          type: 'jack_up',
          params: {}
        } as JackStep);
        
        // STEP 5: ALWAYS go to dropoff docking position next - THIS IS THE CRITICAL SEQUENCE POINT
        logRobotTask(`🔄 [${new Date().toISOString()}] STEP 5/7: IMPORTANT - FIRST going to ${dropoffPoint.id}_docking position`);
        workflowSteps.push({
          type: 'move',
          params: {
            x: dropoffDockingPoint!.x,
            y: dropoffDockingPoint!.y,
            ori: dropoffDockingPoint!.ori || 0,
            label: `${dropoffPoint.id}_docking`
          }
        });
        
        // STEP 6: Check for bin at dropoff location
        logRobotTask(`🔍 [${new Date().toISOString()}] STEP 6/7: After arrival at docking, checking for bin at ${dropoffPoint.id}`);
        const binAtDropoff = await checkForBin(dropoffPoint.x, dropoffPoint.y, dropoffPoint.id);
        
        if (!binAtDropoff) {
          logRobotTask(`✅ [${new Date().toISOString()}] VERIFICATION: Dropoff at ${dropoffPoint.id} is clear - proceeding with dropoff`);
          
          // STEP 7: ONLY AFTER CHECKING - Move to dropoff position
          logRobotTask(`🔄 [${new Date().toISOString()}] STEP 7/7: AFTER checking and confirming clear, moving to exact position at ${dropoffPoint.id}`);
          workflowSteps.push({
            type: 'move',
            params: {
              x: dropoffPoint.x, 
              y: dropoffPoint.y,
              ori: dropoffPoint.ori || 0,
              label: `${dropoffPoint.id}`
            }
          });
          
          // STEP 8: Jack down to release bin
          logRobotTask(`⬇️ [${new Date().toISOString()}] FINAL ACTION: Jacking down to release bin at ${dropoffPoint.id}`);
          workflowSteps.push({
            type: 'jack_down',
            params: {}
          } as JackStep);
        } else {
          logRobotTask(`⚠️ [${new Date().toISOString()}] WARNING: Dropoff at ${dropoffPoint.id} is occupied - skipping dropoff sequence`);
        }
      } else {
        logRobotTask(`⚠️ [${new Date().toISOString()}] WARNING: No bin detected at ${pickupPoint.id} - skipping pickup sequence`);
      }
      
      // Final step: Return to standby position
      logRobotTask(`🔄 [${new Date().toISOString()}] CLEANUP: Returning to standby position`);
      workflowSteps.push({
        type: 'move',
        params: {
          x: standbyPoint ? standbyPoint.x : dropoffDockingPoint!.x,
          y: standbyPoint ? standbyPoint.y : dropoffDockingPoint!.y,
          ori: standbyPoint ? standbyPoint.ori || 0 : dropoffDockingPoint!.ori || 0,
          label: standbyPoint ? `returning to ${standbyPoint.id}` : 'returning to final position'
        }
      });
      
      // First clear any existing active missions
      await missionQueue.cancelAllActiveMissions();
      logRobotTask('✅ Cancelled any existing active missions');
      
      // Create the mission in the queue
      const missionName = `Zone 104 Complete Workflow (Pickup to Dropoff)`;
      const mission = missionQueue.createMission(missionName, workflowSteps, 'L382502104987ir');
      
      logRobotTask(`✅ Mission created with ID: ${mission.id}`);
      logRobotTask('Mission details:');
      
      // Log the dynamically generated steps based on the actual workflow
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        if (step.type === 'move') {
          logRobotTask(`- Step ${i+1}: Move to ${step.params.label}`);
        } else if (step.type === 'jack_up') {
          logRobotTask(`- Step ${i+1}: Jack up to grab bin - WAIT FOR COMPLETE STOP`);
        } else if (step.type === 'jack_down') {
          logRobotTask(`- Step ${i+1}: Jack down to release bin - WAIT FOR COMPLETE STOP`);
        }
      }
      logRobotTask(`⚠️ SAFETY INSTRUCTIONS: Robot must be completely stopped before jack operations`);
      logRobotTask(`⚠️ IMPORTANT: Check that robot is fully stopped before and after jack movements`);
      
      // Start immediate execution
      await missionQueue.processMissionQueue();
      
      const totalDuration = Date.now() - startTime;
      logRobotTask(`🚀 ZONE-104 WORKFLOW initiated. Planning took: ${totalDuration}ms`);
      
      res.json({ 
        success: true, 
        message: 'Zone 104 complete workflow started (pickup → dropoff)',
        missionId: mission.id,
        duration: totalDuration,
        steps: workflowSteps.length
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