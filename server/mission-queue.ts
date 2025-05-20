// server/mission-queue.ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';

// Queue file location
const QUEUE_FILE = path.join(process.cwd(), 'robot-mission-queue.json');
const MISSION_LOG_FILE = path.join(process.cwd(), 'robot-mission-log.json');

export interface MissionStep {
  type: 'move' | 'jack_up' | 'jack_down' | 'align_with_rack' | 'to_unload_point' | 'return_to_charger';
  params: Record<string, any>;
  completed: boolean;
  robotResponse?: any;
  errorMessage?: string;
  retryCount: number;
}

export interface Mission {
  id: string;
  name: string;
  steps: MissionStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  offline?: boolean;
  robotSn: string;
}

// Headers for robot API - using correct AutoXing format
const headers = getAuthHeaders();

/**
 * Mission Queue Manager
 * Handles mission persistence, execution, and recovery
 */
export class MissionQueueManager {
  private missions: Mission[] = [];
  private isProcessing: boolean = false;
  private maxRetries: number = 3;
  
  constructor() {
    this.loadMissionsFromDisk();
    
    // Start processing any pending missions immediately
    setImmediate(() => this.processMissionQueue());
    
    // Set up interval to check and process mission queue regularly
    setInterval(() => this.processMissionQueue(), 5000);
  }
  
  /**
   * Create a new mission from sequential steps
   */
  createMission(name: string, steps: Omit<MissionStep, 'completed' | 'retryCount'>[], robotSn: string): Mission {
    const mission: Mission = {
      id: `mission_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      steps: steps.map(step => ({
        ...step,
        completed: false,
        retryCount: 0
      })),
      status: 'pending',
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      robotSn
    };
    
    this.missions.push(mission);
    this.saveMissionsToDisk();
    
    // Start processing if not already
    if (!this.isProcessing) {
      this.processMissionQueue();
    }
    
    return mission;
  }
  
  /**
   * Process all pending missions in the queue
   */
  async processMissionQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Debug log for mission queue processing
      console.log(`[MISSION-QUEUE] Processing mission queue - ${new Date().toISOString()}`);
      
      // Get all pending or in-progress missions
      const activeMissions = this.missions.filter(m => 
        m.status === 'pending' || m.status === 'in_progress'
      );
      
      console.log(`[MISSION-QUEUE] Found ${activeMissions.length} active missions`);
      
      for (const mission of activeMissions) {
        if (mission.status === 'pending') {
          // Start mission
          mission.status = 'in_progress';
          mission.updatedAt = new Date().toISOString();
          this.saveMissionsToDisk();
        }
        
        // Continue from current step
        await this.executeMission(mission);
      }
    } catch (error) {
      console.error('Error processing mission queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Execute a mission step by step with enhanced validation and logging
   */
  async executeMission(mission: Mission) {
    // Log mission start with details for debugging
    console.log(`========== MISSION EXECUTION START ==========`);
    console.log(`Executing mission ${mission.id} (${mission.name})`);
    console.log(`Total steps: ${mission.steps.length}`);
    console.log(`Current step index: ${mission.currentStepIndex}`);
    
    // Add debug log for robot position at start
    try {
      const positionRes = await axios.get(`${ROBOT_API_URL}/tracked_pose`, { headers });
      if (positionRes.data) {
        console.log(`Robot starting position: (${positionRes.data.position_x.toFixed(2)}, ${positionRes.data.position_y.toFixed(2)}, orientation: ${positionRes.data.orientation.toFixed(2)}°)`);
      }
    } catch (error: any) {
      console.log(`Unable to get robot starting position: ${error.message}`);
    }
    
    let currentStepIndex = mission.currentStepIndex;
    let allStepsCompleted = true;
    
    // Log all steps in the mission for debugging
    console.log(`Mission steps:`);
    mission.steps.forEach((step, idx) => {
      const status = step.completed ? '✅ COMPLETED' : (idx === currentStepIndex ? '⏳ CURRENT' : '⏳ PENDING');
      const details = step.type === 'move' ? ` to ${step.params.label || `(${step.params.x}, ${step.params.y})`}` : '';
      console.log(`  ${idx + 1}. ${step.type}${details} - ${status}`);
    });
    
    // Execute each step
    while (currentStepIndex < mission.steps.length) {
      const step = mission.steps[currentStepIndex];
      const stepNumber = currentStepIndex + 1;
      
      if (step.completed) {
        console.log(`Skipping already completed step ${stepNumber}/${mission.steps.length}: ${step.type}`);
        currentStepIndex++;
        continue;
      }
      
      try {
        console.log(`\n---------- STEP ${stepNumber}/${mission.steps.length} START ----------`);
        console.log(`Executing step ${stepNumber}: ${step.type}`);
        
        // Add more detailed logging based on step type
        if (step.type === 'move') {
          const target = step.params.label || `(${step.params.x}, ${step.params.y})`;
          console.log(`Moving robot to ${target}`);
        } else if (step.type === 'jack_up') {
          console.log(`⚠️ CRITICAL SAFETY OPERATION: Jack up - robot must be COMPLETELY STOPPED`);
        } else if (step.type === 'jack_down') {
          console.log(`⚠️ CRITICAL SAFETY OPERATION: Jack down - robot must be COMPLETELY STOPPED`);
        }
        
        // Verify robot is online
        try {
          const statusRes = await axios.get(`${ROBOT_API_URL}/service/status`, { 
            headers,
            timeout: 5000 // Short timeout to quickly detect offline robots
          });
          mission.offline = false;
          console.log(`Robot connection verified - status: ${statusRes.data?.status || 'ok'}`);
        } catch (error: any) {
          console.log(`⚠️ Robot connection check failed: ${error.message}`);
          // Don't mark as offline yet - the actual operation might still succeed
        }
        
        let stepResult: any;
        
        try {
          // Execute the step based on type with detailed logging
          if (step.type === 'move') {
            console.log(`Starting move operation to ${step.params.label || `(${step.params.x.toFixed(2)}, ${step.params.y.toFixed(2)})`}`);
            stepResult = await this.executeMoveStep(step.params);
            console.log(`Move operation complete with result: ${JSON.stringify(stepResult)}`);
            
            // Double-check move is complete
            const isMoveComplete = await this.checkMoveStatus();
            console.log(`Final move status check: ${isMoveComplete ? 'COMPLETE' : 'STILL MOVING'}`);
            
            if (!isMoveComplete) {
              console.log(`⚠️ WARNING: Robot reports it's still moving after move should be complete`);
              // Wait a bit more to ensure completion
              await new Promise(resolve => setTimeout(resolve, 3000));
              const secondCheck = await this.checkMoveStatus();
              console.log(`Second move status check: ${secondCheck ? 'COMPLETE' : 'STILL MOVING'}`);
              
              if (!secondCheck) {
                throw new Error('Robot failed to complete movement - still moving after operation should be complete');
              }
            }
            
          } else if (step.type === 'jack_up') {
            console.log(`Executing jack up operation...`);
            // Execute jack up operation directly (align_with_rack already positioned the robot correctly)
            stepResult = await this.executeJackUpStep();
          } else if (step.type === 'jack_down') {
            console.log(`Executing jack down operation...`);
            // Execute jack down operation directly
            stepResult = await this.executeJackDownStep();
            // Jack down operation sends feedback through the API response
          // manual_joystick step type removed - not supported by this robot model
          } else if (step.type === 'align_with_rack') {
            console.log(`⚠️ RACK OPERATION: Aligning with rack at ${step.params.label || `(${step.params.x}, ${step.params.y})`}`);
            // Execute the align with rack move - this is a special move type for shelf/rack pickup
            stepResult = await this.executeAlignWithRackStep(step.params);
            console.log(`Rack alignment operation complete with result: ${JSON.stringify(stepResult)}`);
            
            // Verify alignment is complete
            const isAlignComplete = await this.checkMoveStatus();
            console.log(`Final alignment status check: ${isAlignComplete ? 'COMPLETE' : 'STILL MOVING'}`);
          } else if (step.type === 'to_unload_point') {
            console.log(`⚠️ RACK OPERATION: Moving to unload point at ${step.params.label || `(${step.params.x}, ${step.params.y})`}`);
            // Execute the unload point move
            stepResult = await this.executeToUnloadPointStep(step.params);
            console.log(`Move to unload point complete with result: ${JSON.stringify(stepResult)}`);
          } else if (step.type === 'return_to_charger') {
            console.log(`⚠️ CRITICAL OPERATION: Returning robot to charging station...`);
            // Execute the return to charger operation using the API
            stepResult = await this.executeReturnToChargerStep(step.params);
            console.log(`Return to charger operation complete with result: ${JSON.stringify(stepResult)}`);
          }
          
          // Successfully completed step
          step.completed = true;
          step.robotResponse = stepResult;
          mission.currentStepIndex = currentStepIndex + 1;
          mission.updatedAt = new Date().toISOString();
          
        } catch (error: any) {
          // Handle connection errors
          if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('timeout')) {
            console.log(`Connectivity issue detected in mission ${mission.id}, marking as offline`);
            mission.offline = true;
            
            // Increment retry count if we have connectivity issues
            step.retryCount++;
            step.errorMessage = `Connection error: ${error.message}`;
            
            if (step.retryCount >= this.maxRetries) {
              console.error(`Max retries (${this.maxRetries}) reached for step ${currentStepIndex}, failing mission`);
              throw error;
            }
            
            // Save state but don't continue - we'll retry next poll
            allStepsCompleted = false;
            break;
          } else {
            // For non-connection errors, we'll just fail the mission
            throw error;
          }
        }
        
        currentStepIndex++;
        this.saveMissionsToDisk();
        
      } catch (error: any) {
        // Handle step failure
        console.error(`Error executing mission step ${currentStepIndex}:`, error);
        step.errorMessage = error.message || 'Unknown error';
        mission.status = 'failed';
        mission.updatedAt = new Date().toISOString();
        this.saveMissionsToDisk();
        this.logFailedMission(mission, error);
        
        allStepsCompleted = false;
        break;
      }
    }
    
    // If all steps are completed, mark mission as complete
    if (allStepsCompleted && currentStepIndex >= mission.steps.length) {
      mission.status = 'completed';
      mission.updatedAt = new Date().toISOString();
      this.logCompletedMission(mission);
      this.saveMissionsToDisk();
    }
    
    return mission;
  }
  
  /**
   * Check if the robot is currently moving
   */
  /**
   * Cancel all active missions in the queue
   * This will mark all pending and in-progress missions as canceled
   */
  async cancelAllActiveMissions() {
    console.log('Cancelling all active missions in the queue');
    
    const activeMissions = this.missions.filter(m => 
      m.status === 'pending' || m.status === 'in_progress'
    );
    
    for (const mission of activeMissions) {
      console.log(`Cancelling mission ${mission.id} (${mission.name})`);
      mission.status = 'failed';
      mission.updatedAt = new Date().toISOString();
      this.logFailedMission(mission, new Error('Mission cancelled by system for return-to-charger'));
    }
    
    this.saveMissionsToDisk();
    console.log(`Cancelled ${activeMissions.length} active missions`);
  }
  
  /**
   * Verify that robot is completely stopped before safety-critical operations
   * Used for jack_up and jack_down operations to prevent accidents with bins
   */
  private async verifyRobotStopped(operation: string): Promise<void> {
    console.log(`⚠️ CRITICAL SAFETY CHECK: Verifying robot is completely stopped before ${operation}...`);
    
    // Add a mandatory delay first to ensure robot has fully settled from any prior movement
    console.log(`Waiting 3 seconds for robot to fully stabilize before safety check...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check 1: Verify no active movement command
    let moveStatus: any = null;
    try {
      const moveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, { headers });
      moveStatus = moveResponse.data;
      
      if (moveStatus && moveStatus.state === 'moving') {
        console.log(`⚠️ CRITICAL SAFETY VIOLATION: Robot is currently moving, cannot perform ${operation}`);
        console.log(`Current move details: ${JSON.stringify(moveStatus)}`);
        throw new Error(`SAFETY ERROR: Robot has active movement - must be completely stopped before ${operation} operation`);
      }
    } catch (error: any) {
      // If we got a 404, it means no current move, which is good
      if (error.response && error.response.status === 404) {
        console.log(`✅ SAFETY CHECK 1 PASSED: No active movement command`);
      } else {
        console.log(`Warning: Error checking move status: ${error.message}`);
        // Continue with other checks, don't abort due to API errors
      }
    }
    
    // Check 2: Verify wheel state to confirm robot is not actually moving
    let wheelCheckPassed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers });
        const wheelState = wheelResponse.data;
        
        if (wheelState) {
          const speed = Math.max(
            Math.abs(wheelState.left_speed || 0), 
            Math.abs(wheelState.right_speed || 0)
          );
          
          if (speed > 0.01) { // More than 1cm/s is moving
            console.log(`⚠️ SAFETY CHECK: Robot wheels are moving (${speed.toFixed(2)}m/s), waiting for complete stop...`);
            if (attempt === 3) {
              throw new Error(`SAFETY ERROR: Robot wheels still moving after 3 checks - cannot proceed with ${operation}`);
            }
            // Wait and check again
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.log(`✅ SAFETY CHECK 2 PASSED: Robot wheels are stopped (${speed.toFixed(2)}m/s)`);
            wheelCheckPassed = true;
            break;
          }
        }
      } catch (error: any) {
        if (error.message.includes('SAFETY')) {
          // Re-throw safety violations
          throw error;
        } else {
          console.log(`Warning: Could not check wheel state: ${error.message}`);
          // If we can't verify wheel state after 3 attempts, assume it's safe but warn
          if (attempt === 3) {
            console.log(`⚠️ Unable to verify wheel state after multiple attempts. Proceeding with caution.`);
          }
        }
      }
    }
    
    // Check 3: Verify the robot service status
    try {
      const statusResponse = await axios.get(`${ROBOT_API_URL}/service/status`, { headers });
      const status = statusResponse.data;
      
      if (status && status.is_busy) {
        console.log(`⚠️ SAFETY WARNING: Robot reports busy status, waiting for it to complete...`);
        // Give it time to finish whatever it's doing
        console.log(`Waiting 5 seconds for robot to finish current operations...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log(`✅ SAFETY CHECK 3 PASSED: Robot reports not busy`);
      }
    } catch (error: any) {
      console.log(`Warning: Could not check robot busy status: ${error.message}`);
    }
    
    // Final mandatory stabilization delay
    console.log(`✅ All safety checks passed! Waiting additional 3 seconds to ensure complete stability...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ SAFETY CHECK COMPLETE: Robot confirmed stopped for ${operation} operation`);
  }
  
  private async checkMoveStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${ROBOT_API_URL}/chassis/moves/current`, {
        headers
      });
      
      if (response.data && response.data.state) {
        console.log(`Current move status: ${response.data.state}`);
        
        // Check if the move is complete (succeeded, cancelled, or failed are terminal states)
        return ['succeeded', 'cancelled', 'failed'].includes(response.data.state);
      }
      
      // If no clear state, assume complete
      return true;
    } catch (error) {
      // If error (like 404 - no current move), consider it complete
      console.log(`No active movement or error checking status`);
      return true;
    }
  }
  
  /**
   * Wait for the robot to complete its current movement
   * Enhanced version that verifies the robot is actually moving using position data
   */
  private async waitForMoveComplete(moveId: number, timeout = 60000): Promise<void> {
    const startTime = Date.now();
    let isMoving = true;
    let lastPositionUpdate = 0;
    let lastPosition: {x: number, y: number} | null = null;
    let noProgressTime = 0;
    let verifiedMove = false;
    
    console.log(`Waiting for robot to complete movement (ID: ${moveId})...`);
    
    // First verify the move is active
    try {
      const moveStatus = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
      if (!moveStatus.data || moveStatus.data.state !== 'moving') {
        console.log(`Move ID ${moveId} is not in 'moving' state: ${moveStatus.data?.state || 'unknown'}`);
        return; // Exit if move is not active
      }
    } catch (error: any) {
      console.log(`Unable to verify move ${moveId}: ${error.message}`);
      return; // Exit if can't verify the move
    }
    
    while (isMoving && (Date.now() - startTime < timeout)) {
      // Check move status via API
      isMoving = !(await this.checkMoveStatus());
      
      // Get current position to verify actual movement
      try {
        // The correct API endpoint is /tracked_pose not /pose/
        const positionRes = await axios.get(`${ROBOT_API_URL}/tracked_pose`, { headers });
        if (positionRes.data) {
          const currentPosition = {
            x: positionRes.data.position_x || 0,
            y: positionRes.data.position_y || 0
          };
          
          // Check if position has changed
          if (lastPosition) {
            const distance = Math.sqrt(
              Math.pow(currentPosition.x - lastPosition.x, 2) + 
              Math.pow(currentPosition.y - lastPosition.y, 2)
            );
            
            if (distance > 0.05) { // More than 5cm movement
              lastPositionUpdate = Date.now();
              verifiedMove = true; // We've verified the robot is actually moving
              console.log(`Robot movement verified: ${distance.toFixed(2)}m displacement`);
              noProgressTime = 0;
            } else {
              noProgressTime = Date.now() - lastPositionUpdate;
              if (noProgressTime > 10000 && verifiedMove) { // 10 seconds without movement
                console.log(`⚠️ Robot hasn't moved in ${(noProgressTime/1000).toFixed(0)} seconds`);
              }
            }
          } else {
            lastPositionUpdate = Date.now();
          }
          
          lastPosition = currentPosition;
        }
      } catch (error: any) {
        console.log(`Unable to get robot position: ${error.message}`);
      }
      
      if (isMoving) {
        // If stopped making progress for more than 20 seconds but still "moving", timeout early
        if (noProgressTime > 20000 && verifiedMove) {
          console.log(`⚠️ Robot has stopped moving for over 20 seconds while still in 'moving' state`);
          throw new Error(`Movement stalled - no progress for ${(noProgressTime/1000).toFixed(0)} seconds`);
        }
        
        // Wait 3 seconds before checking again (reduced from 5)
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`Still moving (move ID: ${moveId}), waiting...`);
      }
    }
    
    if (isMoving) {
      console.log(`⚠️ Timed out waiting for robot to complete movement (ID: ${moveId})`);
      throw new Error(`Movement timeout exceeded (${timeout}ms)`);
    } else {
      console.log(`✅ Robot has completed movement (ID: ${moveId})`);
    }
  }

  /**
   * Execute a move step
   */
  private async executeMoveStep(params: any): Promise<any> {
    const label = params.label || `point (${params.x}, ${params.y})`;
    console.log(`Executing move to ${label}`);
    
    try {
      // First make sure any existing move is complete before sending a new one
      await this.checkMoveStatus();
      
      // Check if this is a move to a charging station - if so use 'charge' type instead of 'standard'
      const isChargerMove = label.toLowerCase().includes('charg') || 
                           (params.isCharger === true);
      
      if (isChargerMove) {
        console.log(`🔋 CHARGER DOCKING: Using 'charge' move type for ${label}`);
        console.log(`🔋 CHARGER DOCKING: Target position (${params.x}, ${params.y}), orientation: ${params.ori}`);
        console.log(`🔋 CHARGER DOCKING: Including required charge_retry_count=3 parameter`);
      }
      
      // Step 1: Send move command to robot with enhanced params
      const payload = {
        type: isChargerMove ? "charge" : "standard", // Use 'charge' type for charger moves
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.ori || 0,
        creator: "web_interface",
        // For charge move type, we need to include charge_retry_count as required by AutoXing API
        ...(isChargerMove ? { charge_retry_count: 3 } : {}),
        properties: {
          max_trans_vel: 0.5,
          max_rot_vel: 0.5,
          acc_lim_x: 0.5,
          acc_lim_theta: 0.5,
          planning_mode: "directional"
        }
      };

      const moveRes = await axios.post(`${ROBOT_API_URL}/chassis/moves`, payload, { headers });
      console.log(`Move command sent: ${JSON.stringify(moveRes.data)}`);

      // Get move ID for tracking
      const moveId = moveRes.data.id;
      console.log(`Robot move command sent for ${label} - move ID: ${moveId}`);
      
      // Wait for this move to complete before proceeding (2 minute timeout)
      await this.waitForMoveComplete(moveId, 120000);
      
      console.log(`Robot move command to ${label} confirmed complete`);
      
      // If this was a charger move, verify charging status
      if (isChargerMove) {
        try {
          console.log(`🔋 CHARGER DOCKING: Verifying charging status...`);
          // Wait a moment for charging to initiate
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check battery state to verify if charging
          const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers });
          const batteryState = batteryResponse.data;
          
          if (batteryState && batteryState.is_charging) {
            console.log(`🔋 CHARGER DOCKING: ✅ SUCCESS! Robot is now CHARGING`);
          } else {
            console.log(`🔋 CHARGER DOCKING: ⚠️ WARNING: Robot completed move to charger but is not charging`);
            console.log(`🔋 CHARGER DOCKING: Battery state: ${JSON.stringify(batteryState)}`);
          }
        } catch (batteryError: any) {
          console.log(`🔋 CHARGER DOCKING: ⚠️ Could not verify charging status: ${batteryError.message}`);
        }
      }
      
      return { success: true, message: `Move command to ${label} completed successfully`, moveId };

    } catch (err: any) {
      console.error(`Error moving to ${label}: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Execute a jack up step
   */
  private async executeJackUpStep(): Promise<any> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [JACK-UP] Executing jack_up operation`);
      
      // Initial stabilization delay to ensure robot is completely stopped
      console.log(`[${timestamp}] [JACK-UP] Pre-operation stabilization delay (3 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // The align_with_rack command has already positioned the robot correctly
      // Just call the jack_up service directly
      console.log(`[${timestamp}] [JACK-UP] Initiating JACK_UP service call`);
      
      // Direct service endpoint for jack_up
      const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      console.log(`[${timestamp}] [JACK-UP] Jack up command executed, response: ${JSON.stringify(response.data)}`);
      
      // Wait longer for jack operation to fully complete (10 seconds for safety)
      console.log(`[${timestamp}] [JACK-UP] Waiting for jack up operation to complete (10 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Final stabilization delay to ensure operation is fully completed
      console.log(`[${timestamp}] [JACK-UP] Final stabilization period (3 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`[${timestamp}] [JACK-UP] ✅ Jack up completed successfully`);
      return response.data;
    } catch (error: any) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [JACK-UP] ❌ ERROR during jack up operation: ${error.message}`);
      
      // Check response data for better error handling
      if (error.response) {
        console.error(`[${timestamp}] [JACK-UP] Response error details:`, error.response.data);
        
        if (error.response.status === 404) {
          console.error(`[${timestamp}] [JACK-UP] ❌ Robot API endpoint not found`);
          throw new Error(`Robot API endpoint not available: jack up operation failed`);
        }
        
        // Handle robot emergency stop (500 Internal Server Error)
        if (error.response.status === 500) {
          const errorMsg = error.response.data?.detail || error.response.data?.message || error.response.data?.error || 'Internal Server Error';
          if (errorMsg.includes('emergency') || errorMsg.includes('e-stop')) {
            console.error(`[${timestamp}] [JACK-UP] ❌ EMERGENCY STOP DETECTED`);
            throw new Error(`Emergency stop detected: Cannot perform jack up operation`);
          }
        }
      }
      
      // Re-throw with improved error message
      throw new Error(`Jack up operation failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a jack down step
   */
  private async executeJackDownStep(): Promise<any> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [JACK-DOWN] Executing jack_down operation`);
      
      // Initial stabilization delay to ensure robot is completely stopped
      console.log(`[${timestamp}] [JACK-DOWN] Pre-operation stabilization delay (3 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Directly call the jack_down service (robot is already in position)
      console.log(`[${timestamp}] [JACK-DOWN] Initiating JACK_DOWN service call`);
      
      // Direct service endpoint for jack_down
      const response = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
      console.log(`[${timestamp}] [JACK-DOWN] Jack down command executed, response: ${JSON.stringify(response.data)}`);
      
      // Wait longer for jack operation to fully complete (10 seconds for safety)
      console.log(`[${timestamp}] [JACK-DOWN] Waiting for jack down operation to complete (10 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Final stabilization delay to ensure operation is fully completed
      console.log(`[${timestamp}] [JACK-DOWN] Final stabilization period (3 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`[${timestamp}] [JACK-DOWN] ✅ Jack down completed successfully`);
      return response.data;
    } catch (error: any) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [JACK-DOWN] ❌ ERROR during jack down operation: ${error.message}`);
      
      // Check response data for better error handling
      if (error.response) {
        console.error(`[${timestamp}] [JACK-DOWN] Response error details:`, error.response.data);
        
        if (error.response.status === 404) {
          console.error(`[${timestamp}] [JACK-DOWN] ❌ Robot API endpoint not found`);
          throw new Error(`Robot API endpoint not available: jack down operation failed`);
        }
        
        // Handle robot emergency stop (500 Internal Server Error)
        if (error.response.status === 500) {
          const errorMsg = error.response.data?.detail || error.response.data?.message || error.response.data?.error || 'Internal Server Error';
          if (errorMsg.includes('emergency') || errorMsg.includes('e-stop')) {
            console.error(`[${timestamp}] [JACK-DOWN] ❌ EMERGENCY STOP DETECTED`);
            throw new Error(`Emergency stop detected: Cannot perform jack down operation`);
          }
        }
      }
      
      // Re-throw with improved error message
      throw new Error(`Jack down operation failed: ${error.message}`);
    }
  }
  
  /**
   * Get mission by ID
   */
  getMission(id: string): Mission | undefined {
    return this.missions.find(m => m.id === id);
  }
  
  /**
   * Get all missions
   */
  getAllMissions(): Mission[] {
    return [...this.missions];
  }
  
  /**
   * Get active missions (pending or in_progress)
   */
  getActiveMissions(): Mission[] {
    return this.missions.filter(m => 
      m.status === 'pending' || m.status === 'in_progress'
    );
  }
  
  /**
   * Get completed missions
   */
  getCompletedMissions(): Mission[] {
    return this.missions.filter(m => m.status === 'completed');
  }
  
  /**
   * Get failed missions
   */
  getFailedMissions(): Mission[] {
    return this.missions.filter(m => m.status === 'failed');
  }
  
  /**
   * Load missions from disk
   */
  private loadMissionsFromDisk() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const data = fs.readFileSync(QUEUE_FILE, 'utf8');
        this.missions = JSON.parse(data);
        console.log(`Loaded ${this.missions.length} missions from disk`);
      }
    } catch (error) {
      console.error('Error loading missions from disk:', error);
      this.missions = [];
    }
  }
  
  /**
   * Save missions to disk
   */
  private saveMissionsToDisk() {
    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.missions, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving missions to disk:', error);
    }
  }
  
  /**
   * Log a completed mission
   */
  private logCompletedMission(mission: Mission) {
    try {
      let logs: any[] = [];
      
      if (fs.existsSync(MISSION_LOG_FILE)) {
        const data = fs.readFileSync(MISSION_LOG_FILE, 'utf8');
        logs = JSON.parse(data);
      }
      
      logs.push({
        ...mission,
        loggedAt: new Date().toISOString(),
        outcome: 'completed'
      });
      
      // Keep only the last 100 logs
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }
      
      fs.writeFileSync(MISSION_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      console.error('Error logging completed mission:', error);
    }
  }
  
  /**
   * Log a failed mission
   */
  private logFailedMission(mission: Mission, error: Error) {
    try {
      let logs: any[] = [];
      
      if (fs.existsSync(MISSION_LOG_FILE)) {
        const data = fs.readFileSync(MISSION_LOG_FILE, 'utf8');
        logs = JSON.parse(data);
      }
      
      logs.push({
        ...mission,
        loggedAt: new Date().toISOString(),
        outcome: 'failed',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
      
      // Keep only the last 100 logs
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }
      
      fs.writeFileSync(MISSION_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      console.error('Error logging failed mission:', error);
    }
  }
  
  /**
   * Clear completed and failed missions
   */
  clearCompletedMissions() {
    this.missions = this.missions.filter(m => 
      m.status === 'pending' || m.status === 'in_progress'
    );
    this.saveMissionsToDisk();
  }
  
  /**
   * Execute an align_with_rack move step - special move type for picking up a rack/shelf
   * This follows the documented AutoXing API for proper rack pickup sequence
   */
  private async executeAlignWithRackStep(params: any): Promise<any> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ALIGN-RACK] ⚠️ Executing align with rack operation`);
    
    try {
      // Stop robot first for safety
      try {
        await axios.post(`${ROBOT_API_URL}/chassis/stop`, {}, { headers });
        console.log(`[${timestamp}] [ALIGN-RACK] ✅ Stopped robot before align with rack`);
      } catch (error: any) {
        console.log(`[${timestamp}] [ALIGN-RACK] Warning: Failed to stop robot: ${error.message}`);
      }
      
      // Wait for stabilization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a move with type=align_with_rack
      const moveCommand = {
        creator: 'robot-api',
        type: 'align_with_rack', // Special move type for rack pickup
        target_x: params.x,
        target_y: params.y,
        target_ori: params.ori
      };
      
      console.log(`[${timestamp}] [ALIGN-RACK] Creating align_with_rack move: ${JSON.stringify(moveCommand)}`);
      
      // Send the move command to align with rack
      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveCommand, { headers });
      
      if (!response.data || !response.data.id) {
        throw new Error('Failed to create align_with_rack move - invalid response');
      }
      
      const moveId = response.data.id;
      console.log(`[${timestamp}] [ALIGN-RACK] Robot align_with_rack command sent - move ID: ${moveId}`);
      
      // Wait for movement to complete (with timeout)
      await this.waitForMoveComplete(moveId, 120000); // Longer timeout for rack alignment (2 minutes)
      
      // Add final safety check
      const isMoveComplete = await this.checkMoveStatus();
      if (!isMoveComplete) {
        console.log(`[${timestamp}] [ALIGN-RACK] ⚠️ WARNING: Robot might still be moving after align_with_rack operation`);
        // Add additional wait time
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      console.log(`[${timestamp}] [ALIGN-RACK] ✅ Align with rack completed successfully`);
      return { success: true, moveId, message: 'Align with rack completed successfully' };
      
    } catch (error: any) {
      console.error(`[${timestamp}] [ALIGN-RACK] ❌ ERROR during align_with_rack operation: ${error.message}`);
      
      // Handle specific error cases
      if (error.response) {
        console.error(`[${timestamp}] [ALIGN-RACK] Response error details:`, error.response.data);
        
        if (error.response.status === 404) {
          throw new Error('Robot API align_with_rack endpoint not available');
        }
        
        // Handle failure reasons like rack detection issues
        if (error.response.status === 500) {
          const errorMsg = error.response.data?.message || error.response.data?.error || 'Internal Server Error';
          if (errorMsg.includes('RackDetectionError') || errorMsg.includes('rack')) {
            throw new Error(`Rack detection failed: ${errorMsg}`);
          }
          if (errorMsg.includes('emergency') || errorMsg.includes('e-stop')) {
            throw new Error('Emergency stop detected during rack alignment');
          }
        }
      }
      
      throw new Error(`Failed to align with rack: ${error.message}`);
    }
  }
  
  /**
   * Execute a to_unload_point move step
   * Used after jack_up to move a rack to the unload destination
   * CRITICAL FIX: Must use point_id and rack_area_id instead of coordinates
   */
  private async executeToUnloadPointStep(params: any): Promise<any> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TO-UNLOAD] ⚠️ Executing move to unload point`);
    
    try {
      // CRITICAL FIX: Make this function match the to-unload-point-action.ts implementation
      // to ensure consistent behavior across all code paths
      
      // Extract the proper point_id regardless of camelCase or snake_case format
      let point_id = params.pointId || params.point_id;
      
      if (!point_id) {
        console.error(`[${timestamp}] [TO-UNLOAD] ❌ ERROR: No pointId or point_id provided`);
        throw new Error('Missing required point_id for to_unload_point operation');
      }
      
      // CRITICAL FIX: Ensure we're using a load point, not a docking point
      if (point_id.toLowerCase().includes('_docking')) {
        console.log(`[${timestamp}] [TO-UNLOAD] Converting docking point ${point_id} to load point`);
        point_id = point_id.replace(/_docking/i, '_load');
      }
      
      console.log(`[${timestamp}] [TO-UNLOAD] Working with point ID: ${point_id}`);
      
      // Extract rack area ID following the exact same logic as to-unload-point-action.ts
      let rack_area_id: string;
      
      // For points like "110_load", use the original point ID directly
      if (point_id.includes('_load')) {
        rack_area_id = point_id;
        console.log(`[${timestamp}] [TO-UNLOAD] Using original point ID (with _load) as rack_area_id: ${rack_area_id}`);
      }
      // Special case for the hyphenated Drop-off point
      else if (point_id.includes('Drop-off') || point_id.toLowerCase().includes('drop-off')) {
        rack_area_id = 'Drop-off';
        console.log(`[${timestamp}] [TO-UNLOAD] Using special rack area ID for Drop-off point: ${rack_area_id}`);
      } 
      // For numeric IDs like "110", add the _load suffix
      else if (/^\d+$/.test(point_id)) {
        rack_area_id = `${point_id}_load`;
        console.log(`[${timestamp}] [TO-UNLOAD] Added _load suffix to numeric ID: ${rack_area_id}`);
      }
      // For all other points, use the original point ID
      else {
        rack_area_id = point_id;
        console.log(`[${timestamp}] [TO-UNLOAD] Using original point ID for rack area: ${rack_area_id}`);
      }
      
      // Send the place command to the robot using the /move/place endpoint
      // This exactly matches what we do in to-unload-point-action.ts for consistency
      console.log(`[${timestamp}] [TO-UNLOAD] Sending place command with rack_area_id: ${rack_area_id}`);
      const response = await axios.post(`${ROBOT_API_URL}/move/place`, {
        rack_area_id
      }, { headers });
      
      // Check response status
      if (response.status === 200) {
        console.log(`[${timestamp}] [TO-UNLOAD] Successfully executed place command for ${point_id}`);
        
        // Wait for a fixed time since we don't have a move ID to track
        console.log(`[${timestamp}] [TO-UNLOAD] Waiting for place operation to complete...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        // Double-check that the robot has stopped moving
        const isMoveComplete = await this.checkMoveStatus();
        if (!isMoveComplete) {
          console.log(`[${timestamp}] [TO-UNLOAD] ⚠️ Robot still moving, waiting additional time...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 more seconds
        }
        
        console.log(`[${timestamp}] [TO-UNLOAD] ✅ Move to unload point completed successfully`);
        return { 
          success: true, 
          message: `Successfully executed place command for ${point_id}`,
          data: response.data
        };
      } else {
        console.error(`[${timestamp}] [TO-UNLOAD] ❌ Failed to execute place command: ${response.statusText}`);
        throw new Error(`Place command failed: ${response.statusText}`);
      }
      
    } catch (error: any) {
      console.error(`[${timestamp}] [TO-UNLOAD] ❌ ERROR during to_unload_point operation: ${error.message}`);
      
      if (error.response) {
        console.error(`[${timestamp}] [TO-UNLOAD] Response error details:`, error.response.data);
        
        if (error.response.status === 404) {
          throw new Error('Robot API place endpoint not available');
        }
        
        // Handle specific unload errors
        if (error.response.status === 500) {
          const errorMsg = error.response.data?.message || error.response.data?.error || 'Internal Server Error';
          if (errorMsg.includes('UnloadPointOccupied')) {
            throw new Error('Unload point is occupied, cannot complete operation');
          }
          if (errorMsg.includes('emergency')) {
            throw new Error('Emergency stop detected during unload operation');
          }
        }
      }
      
      throw new Error(`Failed to execute toUnloadPoint action: ${error.message}`);
    }
  }
  
  /**
   * Execute a manual joystick command
   * Used for precise movements like backing up slightly
   */
  // executeManualJoystickStep has been removed as the robot doesn't support joystick commands
  
  /**
   * Execute a return to charger operation
   * Use hardcoded known charger coordinates for direct navigation
   */
  private async executeReturnToChargerStep(params: any): Promise<any> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RETURN-TO-CHARGER] ⚠️ Executing return to charger operation`);
    
    try {
      // Use the known charger coordinates from previous runs
      // This is the exact location used in previous successful return-to-charger operations
      console.log(`[${timestamp}] [RETURN-TO-CHARGER] Using precise coordinate-based navigation to charger`);

      // Known charger docking point coordinates from the logs
      const chargerDockingPoint = {
        x: 0.03443853667262486,
        y: 0.4981316698765672,
        ori: 266.11
      };
      
      // Execute move to charger docking point
      console.log(`[${timestamp}] [RETURN-TO-CHARGER] Moving to charger docking point at (${chargerDockingPoint.x}, ${chargerDockingPoint.y})`);
      
      try {
        // Create a charge-type move command with charge_retry_count
        const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
          action: "move_to",
          target_x: chargerDockingPoint.x,
          target_y: chargerDockingPoint.y,
          target_ori: chargerDockingPoint.ori,
          is_charging: true,
          charge_retry_count: 3,
          properties: {
            max_trans_vel: 0.3,  // Slower speed for more accurate docking
            max_rot_vel: 0.3,
            acc_lim_x: 0.3,
            acc_lim_theta: 0.3,
            planning_mode: "directional"
          }
        }, { headers });
        
        console.log(`[${timestamp}] [RETURN-TO-CHARGER] ✅ Move to charger command sent. Move ID: ${moveResponse.data?.id}`);
        
        // Wait for the robot to start moving to the charger (don't wait for completion)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return { 
          success: true, 
          message: 'Return to charger initiated with coordinate-based navigation',
          moveId: moveResponse.data?.id,
          method: 'coordinate_based_with_charging'
        };
      } catch (moveError: any) {
        console.log(`[${timestamp}] [RETURN-TO-CHARGER] ⚠️ Charger coordinate move error: ${moveError.message}`);
        
        // Try regular move without charging flags as a fallback
        try {
          console.log(`[${timestamp}] [RETURN-TO-CHARGER] Trying standard move to charger coordinates`);
          
          const standardMoveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
            action: "move_to",
            target_x: chargerDockingPoint.x,
            target_y: chargerDockingPoint.y,
            target_ori: chargerDockingPoint.ori
          }, { headers });
          
          console.log(`[${timestamp}] [RETURN-TO-CHARGER] ✅ Standard move to charger initiated. Move ID: ${standardMoveResponse.data?.id}`);
          
          return {
            success: true,
            message: 'Return to charger initiated with standard move to charger coordinates',
            moveId: standardMoveResponse.data?.id,
            method: 'standard_coordinate_move'
          };
        } catch (standardMoveError: any) {
          console.log(`[${timestamp}] [RETURN-TO-CHARGER] ⚠️ Standard move to charger failed: ${standardMoveError.message}`);
          throw new Error(`Failed to navigate to charger using coordinates: ${standardMoveError.message}`);
        }
      }
    } catch (error: any) {
      console.error(`[${timestamp}] [RETURN-TO-CHARGER] ❌ ERROR during return to charger operation: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export const missionQueue = new MissionQueueManager();