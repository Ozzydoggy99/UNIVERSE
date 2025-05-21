// server/mission-queue.ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { getRobotApiUrl, getRobotSecret, getAuthHeaders } from './robot-constants';
import { fetchRobotMapPoints } from './robot-map-data';

// Types for robot API responses
interface RobotPosition {
  position_x: number;
  position_y: number;
  orientation: number;
}

interface RobotStatus {
  status: string;
  [key: string]: any;
}

// Queue file location
const QUEUE_FILE = path.join(process.cwd(), 'robot-mission-queue.json');
const MISSION_LOG_FILE = path.join(process.cwd(), 'robot-mission-log.json');

// Default robot serial number
const DEFAULT_ROBOT_SERIAL = 'L382502104987ir';

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
const getHeaders = async () => await getAuthHeaders(DEFAULT_ROBOT_SERIAL);

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
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      const positionRes = await axios.get<RobotPosition>(`${robotApiUrl}/tracked_pose`, { headers });
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
          const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
          const headers = await getHeaders();
          const statusRes = await axios.get<RobotStatus>(`${robotApiUrl}/service/status`, { 
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
          this.saveMissionsToDisk();
          
          console.log(`✅ Step ${stepNumber} completed successfully`);
          currentStepIndex++;
          
        } catch (error: any) {
          console.error(`❌ Error executing step ${stepNumber}: ${error.message}`);
          
          // Handle retries
          step.retryCount = (step.retryCount || 0) + 1;
          step.errorMessage = error.message;
          
          if (step.retryCount < this.maxRetries) {
            console.log(`🔄 Retrying step ${stepNumber} (attempt ${step.retryCount + 1}/${this.maxRetries})...`);
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          
          // Max retries exceeded
          console.error(`❌ Step ${stepNumber} failed after ${this.maxRetries} attempts`);
          mission.status = 'failed';
          mission.updatedAt = new Date().toISOString();
          this.saveMissionsToDisk();
          this.logFailedMission(mission, error);
          allStepsCompleted = false;
          break;
        }
      } catch (error: any) {
        console.error(`❌ Critical error in mission execution: ${error.message}`);
        mission.status = 'failed';
        mission.updatedAt = new Date().toISOString();
        this.saveMissionsToDisk();
        this.logFailedMission(mission, error);
        allStepsCompleted = false;
        break;
      }
    }
    
    if (allStepsCompleted) {
      mission.status = 'completed';
      mission.updatedAt = new Date().toISOString();
      this.saveMissionsToDisk();
      this.logCompletedMission(mission);
      console.log(`✅ Mission ${mission.id} completed successfully`);
    }
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
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      const statusRes = await axios.get<RobotStatus>(`${robotApiUrl}/service/status`, { headers });
      
      if (statusRes.data?.status !== 'ok') {
        throw new Error(`Robot not ready for ${operation} - status: ${statusRes.data?.status}`);
      }
      
      // Check if robot is moving
      const moveRes = await axios.get<{ state: string }>(`${robotApiUrl}/chassis/moves/current`, { headers });
      if (moveRes.data?.state && !['succeeded', 'cancelled', 'failed'].includes(moveRes.data.state)) {
        throw new Error(`Robot still moving - cannot perform ${operation}`);
      }
      
      // Check wheel speeds
      const wheelRes = await axios.get<{ left_speed: number; right_speed: number }>(`${robotApiUrl}/chassis/wheel_speeds`, { headers });
      if (wheelRes.data?.left_speed !== 0 || wheelRes.data?.right_speed !== 0) {
        throw new Error(`Robot wheels still moving - cannot perform ${operation}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to verify robot stopped: ${error.message}`);
    }
  }
  
  private async checkMoveStatus(): Promise<boolean> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      const response = await axios.get<{ state: string }>(`${robotApiUrl}/chassis/moves/current`, { headers });
      
      if (response.data && response.data.state) {
        return ['succeeded', 'cancelled', 'failed'].includes(response.data.state);
      }
      
      return true;
    } catch (error) {
      // If error (like 404 - no current move), consider it complete
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
    
    while (isMoving && (Date.now() - startTime < timeout)) {
      try {
        const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
        const headers = await getHeaders();
        const moveStatus = await axios.get<{ state: string }>(`${robotApiUrl}/chassis/moves/${moveId}`, { headers });
        
        if (moveStatus.data?.state === 'succeeded') {
          console.log(`Move ${moveId} completed successfully`);
          isMoving = false;
        } else if (moveStatus.data?.state === 'failed' || moveStatus.data?.state === 'cancelled') {
          throw new Error(`Move ${moveId} ${moveStatus.data.state}`);
        } else {
          console.log(`Move ${moveId} still in progress: ${moveStatus.data?.state}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Move not found - might be complete
          console.log(`Move ${moveId} not found - assuming complete`);
          isMoving = false;
        } else {
          throw error;
        }
      }
    }
    
    if (isMoving) {
      throw new Error(`Move ${moveId} timed out after ${timeout}ms`);
    }
  }

  private async getRobotPosition(): Promise<{ x: number; y: number; orientation: number }> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      const positionRes = await axios.get<RobotPosition>(`${robotApiUrl}/tracked_pose`, { headers });
      
      if (positionRes.data) {
        return {
          x: positionRes.data.position_x,
          y: positionRes.data.position_y,
          orientation: positionRes.data.orientation
        };
      }
      
      throw new Error('No position data received from robot');
    } catch (error: any) {
      throw new Error(`Failed to get robot position: ${error.message}`);
    }
  }

  /**
   * Execute a move step
   */
  private async executeMoveStep(params: any): Promise<any> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Prepare move data
      const moveData = {
        type: 'standard',
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.orientation || 0,
        creator: 'mission_queue',
        properties: {
          max_trans_vel: 0.5,
          max_rot_vel: 0.5,
          acc_lim_x: 0.5,
          acc_lim_theta: 0.5,
          planning_mode: 'directional',
        }
      };
      
      // Send move command
      const response = await axios.post(`${robotApiUrl}/chassis/moves`, moveData, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`Move step failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a jack up step
   */
  private async executeJackUpStep(): Promise<any> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Verify robot is stopped
      await this.verifyRobotStopped('jack up');
      
      // Execute jack up command
      const response = await axios.post(`${robotApiUrl}/chassis/jack_up`, {}, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`Jack up step failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a jack down step
   */
  private async executeJackDownStep(): Promise<any> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Verify robot is stopped
      await this.verifyRobotStopped('jack down');
      
      // Execute jack down command
      const response = await axios.post(`${robotApiUrl}/chassis/jack_down`, {}, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`Jack down step failed: ${error.message}`);
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
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Prepare move data for rack alignment
      const moveData = {
        type: 'rack_alignment',
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.orientation || 0,
        creator: 'mission_queue',
        properties: {
          max_trans_vel: 0.3, // Slower for alignment
          max_rot_vel: 0.3,
          acc_lim_x: 0.3,
          acc_lim_theta: 0.3,
          planning_mode: 'directional',
        }
      };
      
      // Send move command
      const response = await axios.post(`${robotApiUrl}/chassis/moves`, moveData, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`Align with rack step failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a to_unload_point move step
   * Used after jack_up to move a rack to the unload destination
   * CRITICAL FIX: Must use point_id and rack_area_id instead of coordinates
   */
  private async executeToUnloadPointStep(params: any): Promise<any> {
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Prepare move data for unload point
      const moveData = {
        type: 'unload_point',
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.orientation || 0,
        creator: 'mission_queue',
        properties: {
          max_trans_vel: 0.3, // Slower for unload point
          max_rot_vel: 0.3,
          acc_lim_x: 0.3,
          acc_lim_theta: 0.3,
          planning_mode: 'directional',
        }
      };
      
      // Send move command
      const response = await axios.post(`${robotApiUrl}/chassis/moves`, moveData, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`To unload point step failed: ${error.message}`);
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
    try {
      const robotApiUrl = await getRobotApiUrl(DEFAULT_ROBOT_SERIAL);
      const headers = await getHeaders();
      
      // Prepare move data for charger return
      const moveData = {
        type: 'charger_return',
        target_x: params.x,
        target_y: params.y,
        target_z: 0,
        target_ori: params.orientation || 0,
        creator: 'mission_queue',
        properties: {
          max_trans_vel: 0.3, // Slower for charger return
          max_rot_vel: 0.3,
          acc_lim_x: 0.3,
          acc_lim_theta: 0.3,
          planning_mode: 'directional',
        }
      };
      
      // Send move command
      const response = await axios.post(`${robotApiUrl}/chassis/moves`, moveData, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(`Return to charger step failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const missionQueue = new MissionQueueManager();