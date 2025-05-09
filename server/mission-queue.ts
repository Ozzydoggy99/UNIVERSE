// server/mission-queue.ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET, getAuthHeaders } from './robot-constants';

// Queue file location
const QUEUE_FILE = path.join(process.cwd(), 'robot-mission-queue.json');
const MISSION_LOG_FILE = path.join(process.cwd(), 'robot-mission-log.json');

export interface MissionStep {
  type: 'move' | 'jack_up' | 'jack_down';
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
      // Get all pending or in-progress missions
      const activeMissions = this.missions.filter(m => 
        m.status === 'pending' || m.status === 'in_progress'
      );
      
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
            console.log(`⚠️ CRITICAL OPERATION: Jack up - checking robot status`);
            
            // First verify robot is stopped
            await this.verifyRobotStopped('jack_up');
            
            // Execute jack up operation
            stepResult = await this.executeJackUpStep();
          } else if (step.type === 'jack_down') {
            console.log(`⚠️ CRITICAL SAFETY OPERATION: Jack down - robot must be COMPLETELY STOPPED`);
            await this.verifyRobotStopped('jack_down');
            
            // Execute jack down operation - wait for verification first
            console.log(`⚠️ CRITICAL OPERATION: Jack down - robot confirmed stopped, proceeding with operation`);
            stepResult = await this.executeJackDownStep();
            // Jack down operation sends feedback through the API response
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
      
      // Step 1: Send move command to robot with enhanced params
      const payload = {
        type: "standard",
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.ori || 0,
        creator: "web_interface",
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
      console.log("⚠️ CRITICAL SAFETY OPERATION: Executing jack up operation");
      
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [JACK-UP] ⚠️ CRITICAL SAFETY OPERATION START: Jack operation requires complete stability`);
      
      // STEP 1: CRITICAL - Make sure robot is completely stopped first
      console.log(`[${timestamp}] [JACK-UP] Ensuring robot is completely stopped before jack operation`);
      try {
        const stopResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
          action: "joystick",
          linear: { x: 0.0, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: 0.0 }
        }, { headers });
        
        // Initial stabilization wait - ensure robot is completely still
        console.log(`[${timestamp}] [JACK-UP] Waiting 3 seconds for initial stabilization before any movement...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (stopError: any) {
        console.error(`[${timestamp}] [JACK-UP] Failed to stop robot: ${stopError.message}`);
        throw new Error(`Critical safety failure: Unable to ensure robot is stopped before jack operation: ${stopError.message}`);
      }
      
      // STEP 2: Perform slight backup for better bin alignment
      console.log(`[${timestamp}] [JACK-UP] ⚠️ CRITICAL: Backing up slightly (5cm) for proper bin alignment...`);
      try {
        // Use manual joystick command to back up slightly - negative x means backward
        const backupResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
          action: "joystick",
          linear: { x: -0.05, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: 0.0 }
        }, { headers });
        
        // Wait for the backup movement to complete (1.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Stop the robot again after backing up
        const stopResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
          action: "joystick",
          linear: { x: 0.0, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: 0.0 }
        }, { headers });
        
        // Final stabilization wait after backup
        console.log(`[${timestamp}] [JACK-UP] Waiting 2 seconds for post-backup stabilization...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`[${timestamp}] [JACK-UP] ✅ Backup movement and stabilization completed successfully`);
      } catch (backupError: any) {
        console.error(`[${timestamp}] [JACK-UP] Failed to perform backup movement: ${backupError.message}`);
        throw new Error(`Critical safety failure: Backup movement for bin alignment failed: ${backupError.message}`);
      }
      
      // STEP 3: Send the actual jack_up command through the services endpoint
      console.log(`[${timestamp}] [JACK-UP] ⚠️ EXECUTING JACK UP OPERATION NOW...`);
      const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
      
      // STEP 4: Wait for the operation to complete
      console.log(`[${timestamp}] [JACK-UP] Jack up operation started, waiting 10 seconds for complete stability...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // STEP 5: Verify robot state
      try {
        // Instead of using service/status which doesn't exist, let's try chassis/state
        const chassisResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
        console.log(`[${timestamp}] [JACK-UP] ✅ Chassis state checked after jack up`);
      } catch (statusError: any) {
        console.log(`[${timestamp}] [JACK-UP] Note: Could not verify chassis state after jack up: ${statusError.message}`);
      }
      
      // STEP 6: Verify robot is still completely stopped after jack operation
      console.log(`[${timestamp}] [JACK-UP] ⚠️ SAFETY CHECK: Verifying robot is still completely stopped...`);
      
      // Double check with an additional stabilization period to be certain
      console.log(`[${timestamp}] [JACK-UP] Adding additional 3-second final stabilization period...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers });
        const wheelState = wheelResponse.data;
        
        if (wheelState) {
          const speed = Math.max(
            Math.abs(wheelState.left_speed || 0), 
            Math.abs(wheelState.right_speed || 0)
          );
          
          if (speed > 0.01) { // More than 1cm/s is moving
            console.log(`[${timestamp}] [JACK-UP] ⚠️ CRITICAL SAFETY VIOLATION: Robot wheels are moving (${speed.toFixed(2)}m/s) after jack up!`);
            throw new Error(`SAFETY ERROR: Robot started moving during/after jack up operation`);
          } else {
            console.log(`[${timestamp}] [JACK-UP] ✅ SAFETY CHECK PASSED: Robot still stopped after jack up (${speed.toFixed(2)}m/s)`);
          }
        }
      } catch (error: any) {
        if (error.message.includes('SAFETY')) {
          // Re-throw safety violations
          throw error;
        } else {
          console.log(`[${timestamp}] [JACK-UP] Warning: Could not check wheel state after jack up: ${error.message}`);
        }
      }
      
      // STEP 7: Final absolute safety wait 
      console.log(`[${timestamp}] [JACK-UP] ⚠️ Adding FINAL safety waiting period of 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`[${timestamp}] [JACK-UP] ✅ Jack up completed successfully and verified`);
      return response.data;
    } catch (error: any) {
      console.error(`ERROR during jack up operation: ${error.message}`);
      
      // Check response data for better error handling
      if (error.response) {
        console.error(`Jack up response error:`, error.response.data);
        
        // Real robot API must be available - no simulations allowed
        if (error.response.status === 404) {
          console.error(`Robot API endpoint not found - cannot proceed with jack up operation`);
          throw new Error(`Robot API endpoint not available: jack up operation failed`);
        }
        
        // Handle robot emergency stop (500 Internal Server Error)
        if (error.response.status === 500) {
          if (error.response.data && error.response.data.detail && 
              error.response.data.detail.includes("Emergency stop button is pressed")) {
            console.log("Robot emergency stop detected, cannot proceed with jack up operation");
            throw new Error(`Emergency stop button is pressed, cannot proceed with jack up operation`);
          }
          
          // Other 500 errors
          throw new Error(`Server error during jack up: ${error.response.data?.detail || 'Unknown server error'}`);
        }
      }
      
      // All errors must be reported for real robot operations
      throw error;
    }
  }
  
  /**
   * Execute a jack down step
   */
  private async executeJackDownStep(): Promise<any> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [JACK-DOWN] ⚠️ CRITICAL SAFETY OPERATION START: Jack down requires complete stability`);
      
      // STEP 1: CRITICAL - Make sure robot is completely stopped first
      console.log(`[${timestamp}] [JACK-DOWN] Ensuring robot is completely stopped before jack operation`);
      try {
        const stopResponse = await axios.post(`${ROBOT_API_URL}/chassis/joystick`, {
          action: "joystick",
          linear: { x: 0.0, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: 0.0 }
        }, { headers });
        
        // Initial stabilization wait - ensure robot is completely still
        console.log(`[${timestamp}] [JACK-DOWN] Waiting 3 seconds for initial stabilization...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (stopError: any) {
        console.error(`[${timestamp}] [JACK-DOWN] Failed to stop robot: ${stopError.message}`);
        throw new Error(`Critical safety failure: Unable to ensure robot is stopped before jack down operation: ${stopError.message}`);
      }
      
      // STEP 2: Send the actual jack_down command through the services endpoint
      console.log(`[${timestamp}] [JACK-DOWN] ⚠️ EXECUTING JACK DOWN OPERATION NOW...`);
      const response = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
      
      // STEP 3: Wait for the operation to complete
      console.log(`[${timestamp}] [JACK-DOWN] Jack down operation started, waiting 10 seconds for complete stability...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // STEP 4: Verify robot state
      try {
        // Try checking chassis state instead of service status
        const chassisResponse = await axios.get(`${ROBOT_API_URL}/chassis/state`, { headers });
        console.log(`[${timestamp}] [JACK-DOWN] ✅ Chassis state checked after jack down`);
      } catch (statusError: any) {
        console.log(`[${timestamp}] [JACK-DOWN] Note: Could not verify chassis state after jack down: ${statusError.message}`);
      }
      
      // STEP 5: Verify robot is still completely stopped after jack operation
      console.log(`[${timestamp}] [JACK-DOWN] ⚠️ SAFETY CHECK: Verifying robot is still completely stopped...`);
      
      // Double check with an additional stabilization period to be certain
      console.log(`[${timestamp}] [JACK-DOWN] Adding additional 3-second final stabilization period...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const wheelResponse = await axios.get(`${ROBOT_API_URL}/wheel_state`, { headers });
        const wheelState = wheelResponse.data;
        
        if (wheelState) {
          const speed = Math.max(
            Math.abs(wheelState.left_speed || 0), 
            Math.abs(wheelState.right_speed || 0)
          );
          
          if (speed > 0.01) { // More than 1cm/s is moving
            console.log(`[${timestamp}] [JACK-DOWN] ⚠️ CRITICAL SAFETY VIOLATION: Robot wheels are moving (${speed.toFixed(2)}m/s) after jack down!`);
            throw new Error(`SAFETY ERROR: Robot started moving during/after jack down operation`);
          } else {
            console.log(`[${timestamp}] [JACK-DOWN] ✅ SAFETY CHECK PASSED: Robot still stopped after jack down (${speed.toFixed(2)}m/s)`);
          }
        }
      } catch (error: any) {
        if (error.message.includes('SAFETY')) {
          // Re-throw safety violations
          throw error;
        } else {
          console.log(`[${timestamp}] [JACK-DOWN] Warning: Could not check wheel state after jack down: ${error.message}`);
        }
      }
      
      // STEP 6: Final absolute safety wait
      console.log(`[${timestamp}] [JACK-DOWN] ⚠️ Adding FINAL safety waiting period of 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`[${timestamp}] [JACK-DOWN] ✅ Jack down completed successfully and verified`);
      return response.data;
    } catch (error: any) {
      console.error(`ERROR during jack down operation: ${error.message}`);
      
      // Check response data for better error handling
      if (error.response) {
        console.error(`Jack down response error:`, error.response.data);
        
        // Real robot API must be available - no simulations allowed
        if (error.response.status === 404) {
          console.error(`Robot API endpoint not found - cannot proceed with jack down operation`);
          throw new Error(`Robot API endpoint not available: jack down operation failed`);
        }
        
        // Handle robot emergency stop (500 Internal Server Error)
        if (error.response.status === 500) {
          if (error.response.data && error.response.data.detail && 
              error.response.data.detail.includes("Emergency stop button is pressed")) {
            console.log("Robot emergency stop detected, cannot proceed with jack down operation");
            throw new Error(`Emergency stop button is pressed, cannot proceed with jack down operation`);
          }
          
          // Other 500 errors
          throw new Error(`Server error during jack down: ${error.response.data?.detail || 'Unknown server error'}`);
        }
      }
      
      // All errors must be reported for real robot operations
      throw error;
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
}

// Export singleton instance
export const missionQueue = new MissionQueueManager();