// server/mission-queue.ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';

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

// Headers for robot API
const headers = { 'x-api-key': ROBOT_SECRET };

/**
 * Mission Queue Manager
 * Handles mission persistence, execution, and recovery
 */
class MissionQueueManager {
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
   * Execute a mission step by step
   */
  async executeMission(mission: Mission) {
    console.log(`Executing mission ${mission.id} (${mission.name})`);
    
    let currentStepIndex = mission.currentStepIndex;
    let allStepsCompleted = true;
    
    while (currentStepIndex < mission.steps.length) {
      const step = mission.steps[currentStepIndex];
      
      if (step.completed) {
        currentStepIndex++;
        continue;
      }
      
      try {
        console.log(`Executing step ${currentStepIndex + 1}/${mission.steps.length}: ${step.type}`);
        
        // Try to detect if we're offline
        mission.offline = false;
        let stepResult: any;
        
        try {
          // Execute the step based on type
          if (step.type === 'move') {
            stepResult = await this.executeMoveStep(step.params);
          } else if (step.type === 'jack_up') {
            stepResult = await this.executeJackUpStep();
          } else if (step.type === 'jack_down') {
            stepResult = await this.executeJackDownStep();
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
   * Execute a move step
   */
  private async executeMoveStep(params: any): Promise<any> {
    const moveParams = {
      action: 'move_to',
      target_x: params.x,
      target_y: params.y,
      target_ori: params.ori || 0
    };
    
    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, moveParams, { headers });
    
    // If move started successfully, poll until complete or timeout
    if (response.data && response.data.id) {
      const moveId = response.data.id;
      return await this.waitForMoveCompletion(moveId);
    }
    
    return response.data;
  }
  
  /**
   * Wait for move to complete
   */
  private async waitForMoveCompletion(moveId: string, timeoutMs: number = 120000): Promise<any> {
    const startTime = Date.now();
    
    // Poll until move is complete
    while (true) {
      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Move timeout after ${timeoutMs}ms`);
      }
      
      // Get move status
      const response = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
      const moveStatus = response.data;
      
      // If move is complete (not in 'moving' state)
      if (moveStatus.state !== 'moving') {
        // If move failed, throw error
        if (moveStatus.state === 'failed') {
          throw new Error(`Move failed: ${moveStatus.fail_reason_str || 'Unknown reason'}`);
        }
        
        // Move succeeded, return data
        return moveStatus;
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  /**
   * Execute a jack up step
   */
  private async executeJackUpStep(): Promise<any> {
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_up`, {}, { headers });
    return response.data;
  }
  
  /**
   * Execute a jack down step
   */
  private async executeJackDownStep(): Promise<any> {
    const response = await axios.post(`${ROBOT_API_URL}/services/jack_down`, {}, { headers });
    return response.data;
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