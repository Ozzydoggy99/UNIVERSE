/**
 * Robot Position Tracker
 * 
 * This module creates a singleton that tracks the robot's position data
 * received from the WebSocket connection. It provides methods to get
 * the latest position data without having to query REST endpoints.
 */

import { EventEmitter } from 'events';

interface RobotPosition {
  x: number;
  y: number;
  theta: number;
  timestamp: number;
}

class RobotPositionTracker extends EventEmitter {
  private static instance: RobotPositionTracker;
  private latestPosition: RobotPosition | null = null;
  private positionHistory: RobotPosition[] = [];
  private readonly maxHistoryLength = 100;
  
  private constructor() {
    super();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): RobotPositionTracker {
    if (!RobotPositionTracker.instance) {
      RobotPositionTracker.instance = new RobotPositionTracker();
    }
    return RobotPositionTracker.instance;
  }
  
  /**
   * Update the robot's position
   */
  public updatePosition(position: RobotPosition): void {
    this.latestPosition = {
      ...position,
      timestamp: position.timestamp || Date.now()
    };
    
    // Add to history and trim if needed
    this.positionHistory.push(this.latestPosition);
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }
    
    // Emit position update event
    this.emit('position', this.latestPosition);
    
    // Log at most every 10 positions to avoid spamming
    if (this.positionHistory.length % 10 === 0) {
      console.log(`[Position Tracker] Updated robot position: (${this.latestPosition.x.toFixed(2)}, ${this.latestPosition.y.toFixed(2)}, orientation: ${this.latestPosition.theta.toFixed(2)})`);
    }
  }
  
  /**
   * Get the latest position data
   */
  public getLatestPosition(): RobotPosition | null {
    return this.latestPosition;
  }
  
  /**
   * Get position history
   */
  public getPositionHistory(): RobotPosition[] {
    return [...this.positionHistory];
  }
  
  /**
   * Check if we have valid position data
   */
  public hasPosition(): boolean {
    return this.latestPosition !== null;
  }
  
  /**
   * Calculate the distance from current position to a target point
   */
  public distanceTo(targetX: number, targetY: number): number | null {
    if (!this.latestPosition) return null;
    
    const dx = this.latestPosition.x - targetX;
    const dy = this.latestPosition.y - targetY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Check if the position is recent (within last 10 seconds)
   */
  public hasRecentPosition(): boolean {
    if (!this.latestPosition) return false;
    
    const now = Date.now();
    const positionAge = now - this.latestPosition.timestamp;
    return positionAge < 10000; // Less than 10 seconds old
  }
}

// Export the singleton
export const robotPositionTracker = RobotPositionTracker.getInstance();