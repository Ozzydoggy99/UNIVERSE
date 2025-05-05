import fetch from 'node-fetch';

const ROBOT_API_URL = 'http://47.180.91.99:8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET || '';
const ROBOT_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Secret ${ROBOT_SECRET}`
};

// Define the types for the robot position API response
interface RobotPoseResponse {
  pos: number[];
  ori: number;
  valid: boolean;
}

// This class helps calibrate the robot's position understanding with our calculations
export class RobotPositionCalibrator {
  private serialNumber: string;
  private calibrationOffset = { x: 0, y: 0, theta: 0 };
  private isCalibrated = false;
  
  constructor(serialNumber: string) {
    this.serialNumber = serialNumber;
  }
  
  // Get the robot's current position from the API
  async getRobotPosition(): Promise<{ x: number, y: number, theta: number }> {
    try {
      const response = await fetch(`${ROBOT_API_URL}/api/pose`, {
        method: 'GET',
        headers: ROBOT_HEADERS
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get robot position: ${response.statusText}`);
      }
      
      const data = await response.json() as RobotPoseResponse;
      
      // Extract position data from response
      return {
        x: data.pos && data.pos[0] ? data.pos[0] : 0,
        y: data.pos && data.pos[1] ? data.pos[1] : 0,
        theta: data.ori ?? 0
      };
    } catch (error) {
      console.error('Error getting robot position:', error);
      return { x: 0, y: 0, theta: 0 };
    }
  }
  
  // Calculate the calibration offset based on a known reference point
  async calibratePosition(referencePoint: { x: number, y: number, theta: number }): Promise<boolean> {
    try {
      // Get current robot position from API
      const robotPosition = await this.getRobotPosition();
      
      // Calculate the offset between what we think the position should be and what the robot reports
      this.calibrationOffset = {
        x: referencePoint.x - robotPosition.x,
        y: referencePoint.y - robotPosition.y,
        theta: referencePoint.theta - robotPosition.theta
      };
      
      console.log(`Calibration offset calculated: (${this.calibrationOffset.x}, ${this.calibrationOffset.y}, ${this.calibrationOffset.theta})`);
      
      this.isCalibrated = true;
      return true;
    } catch (error) {
      console.error('Error calibrating position:', error);
      return false;
    }
  }
  
  // Apply the calibration offset to our calculated position
  applyCalibration(position: { x: number, y: number, theta: number }): { x: number, y: number, theta: number } {
    if (!this.isCalibrated) {
      return position;
    }
    
    return {
      x: position.x - this.calibrationOffset.x,
      y: position.y - this.calibrationOffset.y,
      theta: position.theta - this.calibrationOffset.theta
    };
  }
  
  // Apply inverse calibration to convert robot coordinates to our coordinate system
  applyInverseCalibration(robotPosition: { x: number, y: number, theta: number }): { x: number, y: number, theta: number } {
    if (!this.isCalibrated) {
      return robotPosition;
    }
    
    return {
      x: robotPosition.x + this.calibrationOffset.x,
      y: robotPosition.y + this.calibrationOffset.y,
      theta: robotPosition.theta + this.calibrationOffset.theta
    };
  }
  
  // Reset the calibration
  resetCalibration(): void {
    this.calibrationOffset = { x: 0, y: 0, theta: 0 };
    this.isCalibrated = false;
    console.log('Position calibration reset');
  }
  
  // Create precise movement target based on our calculations
  // and adjust it according to the calibration data
  calculatePreciseMovementTarget(
    currentPosition: { x: number, y: number, theta: number },
    direction: 'forward' | 'backward',
    distance: number
  ): { x: number, y: number, theta: number } {
    // Get the current position and orientation
    const { x, y, theta } = currentPosition;
    
    // Calculate the movement delta based on orientation and direction
    const directionMultiplier = direction === 'forward' ? 1 : -1;
    const dx = Math.cos(theta) * distance * directionMultiplier;
    const dy = Math.sin(theta) * distance * directionMultiplier;
    
    // Calculate the target position
    const targetPosition = {
      x: x + dx,
      y: y + dy,
      theta: theta  // Maintain the same orientation
    };
    
    // Apply calibration to the target position if we're calibrated
    return this.applyCalibration(targetPosition);
  }
  
  // Get the current calibration offset
  getCalibrationOffset(): { x: number, y: number, theta: number } {
    return this.calibrationOffset;
  }
  
  // Check if the system is calibrated
  isSystemCalibrated(): boolean {
    return this.isCalibrated;
  }
}

// Factory function to create a calibrator for a specific robot
export function createRobotPositionCalibrator(serialNumber: string): RobotPositionCalibrator {
  return new RobotPositionCalibrator(serialNumber);
}

// Singleton map to store calibrators for different robots
const calibrators = new Map<string, RobotPositionCalibrator>();

// Get calibrator for a specific robot (create if not exists)
export function getRobotCalibrator(serialNumber: string): RobotPositionCalibrator {
  if (!calibrators.has(serialNumber)) {
    calibrators.set(serialNumber, new RobotPositionCalibrator(serialNumber));
  }
  return calibrators.get(serialNumber)!;
}