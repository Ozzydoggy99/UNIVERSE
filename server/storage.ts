import { 
  users, 
  apiConfigs, 
  robotStatusHistory, 
  sensorReadings, 
  positionHistory,
  type User, 
  type InsertUser, 
  type ApiConfig, 
  type RobotStatusHistory, 
  type SensorReading, 
  type PositionHistory
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // API Config methods
  getApiConfig(id: number): Promise<ApiConfig | undefined>;
  saveApiConfig(apiKey: string, apiEndpoint: string): Promise<void>;
  
  // Robot history methods
  saveRobotStatus(status: any): Promise<void>;
  getRobotStatusHistory(robotId?: string, limit?: number): Promise<RobotStatusHistory[]>;
  
  // Sensor methods
  saveSensorReading(reading: any): Promise<void>;
  getSensorReadings(robotId?: string, limit?: number): Promise<SensorReading[]>;
  
  // Position methods
  saveRobotPosition(position: any): Promise<void>;
  getPositionHistory(robotId?: string, limit?: number): Promise<PositionHistory[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private apiConfigs: Map<number, ApiConfig>;
  private robotStatusHistory: RobotStatusHistory[];
  private sensorReadings: SensorReading[];
  private positionHistory: PositionHistory[];
  
  currentId: number;
  currentApiConfigId: number;
  currentStatusHistoryId: number;
  currentSensorReadingId: number;
  currentPositionHistoryId: number;

  constructor() {
    this.users = new Map();
    this.apiConfigs = new Map();
    this.robotStatusHistory = [];
    this.sensorReadings = [];
    this.positionHistory = [];
    
    this.currentId = 1;
    this.currentApiConfigId = 1;
    this.currentStatusHistoryId = 1;
    this.currentSensorReadingId = 1;
    this.currentPositionHistoryId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // API Config methods
  async getApiConfig(id: number): Promise<ApiConfig | undefined> {
    return this.apiConfigs.get(id);
  }
  
  async saveApiConfig(apiKey: string, apiEndpoint: string): Promise<void> {
    // For simplicity, just create a new config
    const id = this.currentApiConfigId++;
    
    const config: ApiConfig = {
      id,
      userId: 1, // Default to first user
      apiEndpoint,
      apiKey,
      isActive: true,
      createdAt: new Date()
    };
    
    this.apiConfigs.set(id, config);
  }
  
  // Robot Status History methods
  async saveRobotStatus(status: any): Promise<void> {
    // Extract relevant fields from the status data
    const id = this.currentStatusHistoryId++;
    
    const statusRecord: RobotStatusHistory = {
      id,
      robotId: status.serialNumber || "unknown",
      status: status.status || "unknown",
      battery: status.battery || null,
      model: status.model || null,
      serialNumber: status.serialNumber || null,
      operationalStatus: status.operationalStatus || null,
      uptime: status.uptime || null,
      timestamp: new Date()
    };
    
    this.robotStatusHistory.push(statusRecord);
    
    // Keep only the most recent records
    if (this.robotStatusHistory.length > 1000) {
      this.robotStatusHistory = this.robotStatusHistory.slice(-1000);
    }
  }
  
  async getRobotStatusHistory(robotId?: string, limit: number = 100): Promise<RobotStatusHistory[]> {
    let result = [...this.robotStatusHistory];
    
    if (robotId) {
      result = result.filter(status => status.robotId === robotId);
    }
    
    // Sort by timestamp (newest first)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return result.slice(0, limit);
  }
  
  // Sensor Reading methods
  async saveSensorReading(reading: any): Promise<void> {
    const id = this.currentSensorReadingId++;
    
    const sensorRecord: SensorReading = {
      id,
      robotId: reading.robotId || "unknown",
      temperature: reading.temperature || null,
      humidity: reading.humidity || null,
      proximity: reading.proximity || null,
      light: reading.light || null,
      noise: reading.noise || null,
      timestamp: new Date()
    };
    
    this.sensorReadings.push(sensorRecord);
    
    // Keep only the most recent records
    if (this.sensorReadings.length > 1000) {
      this.sensorReadings = this.sensorReadings.slice(-1000);
    }
  }
  
  async getSensorReadings(robotId?: string, limit: number = 100): Promise<SensorReading[]> {
    let result = [...this.sensorReadings];
    
    if (robotId) {
      result = result.filter(reading => reading.robotId === robotId);
    }
    
    // Sort by timestamp (newest first)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return result.slice(0, limit);
  }
  
  // Position History methods
  async saveRobotPosition(position: any): Promise<void> {
    const id = this.currentPositionHistoryId++;
    
    const positionRecord: PositionHistory = {
      id,
      robotId: position.robotId || "unknown",
      x: position.x || 0,
      y: position.y || 0,
      z: position.z || 0,
      orientation: position.orientation || null,
      speed: position.speed || null,
      timestamp: new Date()
    };
    
    this.positionHistory.push(positionRecord);
    
    // Keep only the most recent records
    if (this.positionHistory.length > 1000) {
      this.positionHistory = this.positionHistory.slice(-1000);
    }
  }
  
  async getPositionHistory(robotId?: string, limit: number = 100): Promise<PositionHistory[]> {
    let result = [...this.positionHistory];
    
    if (robotId) {
      result = result.filter(position => position.robotId === robotId);
    }
    
    // Sort by timestamp (newest first)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return result.slice(0, limit);
  }
}

export const storage = new MemStorage();
