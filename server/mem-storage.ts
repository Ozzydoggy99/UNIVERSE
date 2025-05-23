import { 
  users, 
  apiConfigs, 
  robotStatusHistory, 
  sensorReadings, 
  positionHistory,
  uiTemplates,
  robotTemplateAssignments,
  robotTasks,
  floorMaps,
  elevators,
  elevatorQueue,
  elevatorMaintenance,
  type User, 
  type InsertUser, 
  type ApiConfig, 
  type RobotStatusHistory, 
  type SensorReading, 
  type PositionHistory,
  type UITemplate,
  type InsertUITemplate,
  type RobotTemplateAssignment,
  type InsertRobotTemplateAssignment,
  type RobotTask,
  type InsertRobotTask,
  type FloorMap,
  type InsertFloorMap,
  type Elevator,
  type InsertElevator,
  type ElevatorQueue,
  type InsertElevatorQueue,
  type ElevatorMaintenance,
  type InsertElevatorMaintenance,
  Robot,
  Template
} from "../shared/schema.js";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | null>;
  
  // UI Template methods
  getAllTemplates(): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | null>;
  createTemplate(data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template>;
  updateTemplate(id: number, data: Partial<Template>): Promise<Template | null>;
  deleteTemplate(id: number): Promise<boolean>;
  
  // Robot Template Assignment methods
  getAllRobotTemplateAssignments(): Promise<RobotTemplateAssignment[]>;
  
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
  
  // Robot Task Queue methods
  createRobotTask(task: InsertRobotTask): Promise<RobotTask>;
  getRobotTask(id: number): Promise<RobotTask | undefined>;
  getAllRobotTasks(): Promise<RobotTask[]>;
  getRobotTasksBySerialNumber(serialNumber: string): Promise<RobotTask[]>;
  getRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]>;
  getPendingRobotTasks(): Promise<RobotTask[]>;
  getPendingRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]>;
  updateRobotTask(id: number, updates: Partial<RobotTask>): Promise<RobotTask | undefined>;
  updateTaskPriority(id: number, newPriority: number): Promise<RobotTask | undefined>;
  cancelRobotTask(id: number): Promise<RobotTask | undefined>;
  completeRobotTask(id: number): Promise<RobotTask | undefined>;
  reorderTasks(taskIds: number[]): Promise<boolean>;
  
  // Floor Map methods
  createFloorMap(floorMap: InsertFloorMap): Promise<FloorMap>;
  getFloorMap(id: number): Promise<FloorMap | undefined>;
  getFloorMapByBuildingAndFloor(buildingId: number, floorNumber: number): Promise<FloorMap | undefined>;
  getAllFloorMaps(): Promise<FloorMap[]>;
  updateFloorMap(id: number, updates: Partial<FloorMap>): Promise<FloorMap | undefined>;
  deleteFloorMap(id: number): Promise<boolean>;
  
  // Elevator methods
  createElevator(elevator: InsertElevator): Promise<Elevator>;
  getElevator(id: number): Promise<Elevator | undefined>;
  getAllElevators(): Promise<Elevator[]>;
  getElevatorsByBuilding(buildingId: number): Promise<Elevator[]>;
  updateElevator(id: number, updates: Partial<Elevator>): Promise<Elevator | undefined>;
  updateElevatorStatus(id: number, status: string): Promise<Elevator | undefined>;
  
  // Elevator Queue methods
  createElevatorQueueEntry(entry: InsertElevatorQueue): Promise<ElevatorQueue>;
  getElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined>;
  getElevatorQueueForElevator(elevatorId: number): Promise<ElevatorQueue[]>;
  getElevatorQueueForRobot(robotId: string): Promise<ElevatorQueue[]>;
  updateElevatorQueueEntryStatus(id: number, status: string): Promise<ElevatorQueue | undefined>;
  completeElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined>;
  
  // Elevator Maintenance methods
  createElevatorMaintenance(maintenance: InsertElevatorMaintenance): Promise<ElevatorMaintenance>;
  getElevatorMaintenance(id: number): Promise<ElevatorMaintenance | undefined>;
  getAllElevatorMaintenanceForElevator(elevatorId: number): Promise<ElevatorMaintenance[]>;
  updateElevatorMaintenance(id: number, updates: Partial<ElevatorMaintenance>): Promise<ElevatorMaintenance | undefined>;
  
  // Robot capabilities methods
  storeRobotCapabilities(robotId: string, capabilities: any): Promise<void>;
  getRobotCapabilities(robotId: string): Promise<any | undefined>;
  
  // Session store for auth
  sessionStore: session.Store;

  // Robot methods
  saveRobot(robot: Robot): Promise<void>;
  getRobotBySerialNumber(serialNumber: string): Promise<Robot | null>;
  getRobots(): Promise<Robot[]>;
  deleteRobot(serialNumber: string): Promise<void>;
}

// In-memory implementation
export class MemStorage implements IStorage {
  sessionStore: session.Store;
  private users = new Map<number, User>();
  private templates = new Map<number, Template>();
  private robotTemplateAssignments = new Map<number, RobotTemplateAssignment>();
  private apiConfigs = new Map<number, ApiConfig>();
  private robotStatusHistory = new Map<string, RobotStatusHistory[]>();
  private sensorReadings = new Map<string, SensorReading[]>();
  private positionHistory = new Map<string, PositionHistory[]>();
  private robotTasks = new Map<number, RobotTask>();
  private floorMaps = new Map<number, FloorMap>();
  private elevators = new Map<number, Elevator>();
  private elevatorQueue = new Map<number, ElevatorQueue>();
  private elevatorMaintenance = new Map<number, ElevatorMaintenance>();
  private robotCapabilities = new Map<string, any>();
  private robots: Map<string, Robot> = new Map();
  
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Add a default admin user
    this.users.set(1, {
      id: 1,
      username: 'admin',
      password: '$2b$10$rqUAABZz.aCcYqpLKIQF1eOmVBH5lkY0a3hj74qNxbJwGjvnB1OMS', // 'password'
      role: 'admin',
      templateId: null
    });
  }
  
  // User methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUser(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.users.size + 1;
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role || 'user',
      templateId: insertUser.templateId || null
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // UI Template methods
  async getAllTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }
  
  async getTemplate(id: number): Promise<Template | null> {
    return this.templates.get(id) || null;
  }
  
  async createTemplate(data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const id = this.templates.size + 1;
    const now = new Date();
    const template: Template = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    };
    this.templates.set(id, template);
    return template;
  }
  
  async updateTemplate(id: number, data: Partial<Template>): Promise<Template | null> {
    const template = this.templates.get(id);
    if (!template) return null;
    
    const updatedTemplate: Template = {
      ...template,
      ...data,
      updatedAt: new Date()
    };
    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }
  
  async deleteTemplate(id: number): Promise<boolean> {
    return this.templates.delete(id);
  }
  
  // Robot Template Assignment methods
  async getAllRobotTemplateAssignments(): Promise<RobotTemplateAssignment[]> {
    return Array.from(this.robotTemplateAssignments.values());
  }
  
  // API Config methods
  async getApiConfig(id: number): Promise<ApiConfig | undefined> {
    return this.apiConfigs.get(id);
  }
  
  async saveApiConfig(apiKey: string, apiEndpoint: string): Promise<void> {
    const id = this.apiConfigs.size + 1;
    this.apiConfigs.set(id, {
      id,
      userId: 1,
      apiEndpoint,
      apiKey,
      isActive: true,
      createdAt: new Date()
    });
  }
  
  // Robot history methods
  async saveRobotStatus(status: any): Promise<void> {
    const robotId = status.serialNumber || "unknown";
    const statusRecord: RobotStatusHistory = {
      id: Date.now(),
      robotId: robotId,
      status: status.status || "unknown",
      battery: status.battery || null,
      model: status.model || null,
      serialNumber: status.serialNumber || null,
      operationalStatus: status.operationalStatus || null,
      uptime: status.uptime || null,
      timestamp: new Date()
    };
    
    if (!this.robotStatusHistory.has(robotId)) {
      this.robotStatusHistory.set(robotId, []);
    }
    
    const history = this.robotStatusHistory.get(robotId)!;
    history.unshift(statusRecord);
    
    // Keep only the last 100 records
    if (history.length > 100) {
      history.length = 100;
    }
  }
  
  async getRobotStatusHistory(robotId?: string, limit: number = 100): Promise<RobotStatusHistory[]> {
    if (robotId) {
      const history = this.robotStatusHistory.get(robotId) || [];
      return history.slice(0, limit);
    } else {
      const allHistory: RobotStatusHistory[] = [];
      for (const history of Array.from(this.robotStatusHistory.values())) {
        allHistory.push(...history);
      }
      
      // Sort by timestamp (newest first)
      allHistory.sort((a, b) => {
        const timeA = a.timestamp?.getTime() ?? 0;
        const timeB = b.timestamp?.getTime() ?? 0;
        return timeB - timeA;
      });
      
      return allHistory.slice(0, limit);
    }
  }
  
  // Sensor Reading methods
  async saveSensorReading(reading: any): Promise<void> {
    const robotId = reading.robotId || "unknown";
    const sensorRecord: SensorReading = {
      id: Date.now(),
      robotId: robotId,
      temperature: reading.temperature || null,
      humidity: reading.humidity || null,
      proximity: reading.proximity || null,
      light: reading.light || null,
      noise: reading.noise || null,
      timestamp: new Date()
    };
    
    if (!this.sensorReadings.has(robotId)) {
      this.sensorReadings.set(robotId, []);
    }
    
    const readings = this.sensorReadings.get(robotId)!;
    readings.unshift(sensorRecord);
    
    // Keep only the last 100 records
    if (readings.length > 100) {
      readings.length = 100;
    }
  }
  
  async getSensorReadings(robotId?: string, limit: number = 100): Promise<SensorReading[]> {
    if (robotId) {
      const readings = this.sensorReadings.get(robotId) || [];
      return readings.slice(0, limit);
    } else {
      const allReadings: SensorReading[] = [];
      for (const readings of Array.from(this.sensorReadings.values())) {
        allReadings.push(...readings);
      }
      
      // Sort by timestamp (newest first)
      allReadings.sort((a, b) => {
        const timeA = a.timestamp?.getTime() ?? 0;
        const timeB = b.timestamp?.getTime() ?? 0;
        return timeB - timeA;
      });
      
      return allReadings.slice(0, limit);
    }
  }
  
  // Position History methods
  async saveRobotPosition(position: any): Promise<void> {
    const robotId = position.robotId || "unknown";
    const positionRecord: PositionHistory = {
      id: Date.now(),
      robotId: robotId,
      x: position.x || 0,
      y: position.y || 0,
      z: position.z || 0,
      orientation: position.orientation || null,
      speed: position.speed || null,
      timestamp: new Date()
    };
    
    if (!this.positionHistory.has(robotId)) {
      this.positionHistory.set(robotId, []);
    }
    
    const history = this.positionHistory.get(robotId)!;
    history.unshift(positionRecord);
    
    // Keep only the last 100 records
    if (history.length > 100) {
      history.length = 100;
    }
  }
  
  async getPositionHistory(robotId?: string, limit: number = 100): Promise<PositionHistory[]> {
    if (robotId) {
      const history = this.positionHistory.get(robotId) || [];
      return history.slice(0, limit);
    } else {
      const allHistory: PositionHistory[] = [];
      for (const history of Array.from(this.positionHistory.values())) {
        allHistory.push(...history);
      }
      
      // Sort by timestamp (newest first)
      allHistory.sort((a, b) => {
        const timeA = a.timestamp?.getTime() ?? 0;
        const timeB = b.timestamp?.getTime() ?? 0;
        return timeB - timeA;
      });
      
      return allHistory.slice(0, limit);
    }
  }
  
  // Robot Task methods
  async createRobotTask(task: InsertRobotTask): Promise<RobotTask> {
    const id = this.robotTasks.size + 1;
    const now = new Date();
    const newTask: RobotTask = {
      id,
      serialNumber: task.serialNumber,
      templateId: task.templateId || null,
      title: task.title,
      taskType: task.taskType,
      status: task.status || 'PENDING',
      description: task.description || null,
      location: task.location || null,
      targetX: task.targetX || null,
      targetY: task.targetY || null,
      targetZ: task.targetZ || null,
      parameters: task.parameters || null,
      priority: task.priority || null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      createdBy: task.createdBy || null
    };
    this.robotTasks.set(id, newTask);
    return newTask;
  }
  
  async getRobotTask(id: number): Promise<RobotTask | undefined> {
    return this.robotTasks.get(id);
  }
  
  async getAllRobotTasks(): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values());
  }
  
  async getRobotTasksBySerialNumber(serialNumber: string): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.serialNumber === serialNumber);
  }
  
  async getRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.templateId === templateId);
  }
  
  async getPendingRobotTasks(): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.status === 'PENDING');
  }
  
  async getPendingRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.status === 'PENDING' && task.templateId === templateId);
  }
  
  async updateRobotTask(id: number, updates: Partial<RobotTask>): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) {
      return undefined;
    }
    
    const updatedTask = { ...task, ...updates };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }
  
  async updateTaskPriority(id: number, newPriority: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) {
      return undefined;
    }
    
    const updatedTask = { ...task, priority: newPriority };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }
  
  async cancelRobotTask(id: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) {
      return undefined;
    }
    
    const updatedTask = { ...task, status: 'CANCELLED' };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }
  
  async completeRobotTask(id: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) {
      return undefined;
    }
    
    const updatedTask = { ...task, status: 'COMPLETED', completedAt: new Date() };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }
  
  async reorderTasks(taskIds: number[]): Promise<boolean> {
    // This is just a stub method since we're in memory
    return true;
  }
  
  // Floor map methods
  async createFloorMap(floorMap: InsertFloorMap): Promise<FloorMap> {
    const id = this.floorMaps.size + 1;
    const now = new Date();
    const newFloorMap: FloorMap = {
      id,
      name: floorMap.name,
      buildingId: floorMap.buildingId,
      floorNumber: floorMap.floorNumber,
      mapData: floorMap.mapData,
      navigationGraph: floorMap.navigationGraph || null,
      isActive: floorMap.isActive || null,
      createdAt: now,
      updatedAt: now
    };
    this.floorMaps.set(id, newFloorMap);
    return newFloorMap;
  }
  
  async getFloorMap(id: number): Promise<FloorMap | undefined> {
    return this.floorMaps.get(id);
  }
  
  async getFloorMapByBuildingAndFloor(buildingId: number, floorNumber: number): Promise<FloorMap | undefined> {
    for (const floorMap of Array.from(this.floorMaps.values())) {
      if (floorMap.buildingId === buildingId && floorMap.floorNumber === floorNumber) {
        return floorMap;
      }
    }
    return undefined;
  }
  
  async getAllFloorMaps(): Promise<FloorMap[]> {
    return Array.from(this.floorMaps.values());
  }
  
  async updateFloorMap(id: number, updates: Partial<FloorMap>): Promise<FloorMap | undefined> {
    const floorMap = this.floorMaps.get(id);
    if (!floorMap) {
      return undefined;
    }
    
    const updatedFloorMap = { ...floorMap, ...updates, updatedAt: new Date() };
    this.floorMaps.set(id, updatedFloorMap);
    return updatedFloorMap;
  }
  
  async deleteFloorMap(id: number): Promise<boolean> {
    return this.floorMaps.delete(id);
  }
  
  // Elevator methods
  async createElevator(elevator: InsertElevator): Promise<Elevator> {
    const id = this.elevators.size + 1;
    const now = new Date();
    const newElevator: Elevator = {
      id,
      name: elevator.name,
      buildingId: elevator.buildingId,
      doorLocation: elevator.doorLocation,
      status: elevator.status || 'OPERATIONAL',
      currentFloor: elevator.currentFloor || null,
      targetFloor: elevator.targetFloor || null,
      maxCapacity: elevator.maxCapacity || null,
      lastMaintenance: elevator.lastMaintenance || null,
      createdAt: now,
      updatedAt: now
    };
    this.elevators.set(id, newElevator);
    return newElevator;
  }
  
  async getElevator(id: number): Promise<Elevator | undefined> {
    return this.elevators.get(id);
  }
  
  async getAllElevators(): Promise<Elevator[]> {
    return Array.from(this.elevators.values());
  }
  
  async getElevatorsByBuilding(buildingId: number): Promise<Elevator[]> {
    return Array.from(this.elevators.values())
      .filter(elevator => elevator.buildingId === buildingId);
  }
  
  async updateElevator(id: number, updates: Partial<Elevator>): Promise<Elevator | undefined> {
    const elevator = this.elevators.get(id);
    if (!elevator) {
      return undefined;
    }
    
    const updatedElevator = { ...elevator, ...updates, updatedAt: new Date() };
    this.elevators.set(id, updatedElevator);
    return updatedElevator;
  }
  
  async updateElevatorStatus(id: number, status: string): Promise<Elevator | undefined> {
    const elevator = this.elevators.get(id);
    if (!elevator) {
      return undefined;
    }
    
    const updatedElevator = { ...elevator, status, updatedAt: new Date() };
    this.elevators.set(id, updatedElevator);
    return updatedElevator;
  }
  
  // Elevator Queue methods
  async createElevatorQueueEntry(entry: InsertElevatorQueue): Promise<ElevatorQueue> {
    const id = this.elevatorQueue.size + 1;
    const now = new Date();
    const newEntry: ElevatorQueue = {
      id,
      elevatorId: entry.elevatorId,
      robotId: entry.robotId,
      startFloor: entry.startFloor,
      targetFloor: entry.targetFloor,
      status: entry.status || 'WAITING',
      priority: entry.priority || null,
      requestedAt: now,
      startedAt: null,
      completedAt: null
    };
    this.elevatorQueue.set(id, newEntry);
    return newEntry;
  }
  
  async getElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined> {
    return this.elevatorQueue.get(id);
  }
  
  async getElevatorQueueForElevator(elevatorId: number): Promise<ElevatorQueue[]> {
    return Array.from(this.elevatorQueue.values())
      .filter(entry => entry.elevatorId === elevatorId);
  }
  
  async getElevatorQueueForRobot(robotId: string): Promise<ElevatorQueue[]> {
    return Array.from(this.elevatorQueue.values())
      .filter(entry => entry.robotId === robotId);
  }
  
  async updateElevatorQueueEntryStatus(id: number, status: string): Promise<ElevatorQueue | undefined> {
    const entry = this.elevatorQueue.get(id);
    if (!entry) {
      return undefined;
    }
    
    const updatedEntry = { ...entry, status };
    this.elevatorQueue.set(id, updatedEntry);
    return updatedEntry;
  }
  
  async completeElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined> {
    const entry = this.elevatorQueue.get(id);
    if (!entry) {
      return undefined;
    }
    
    const updatedEntry = { ...entry, status: 'COMPLETED', completedAt: new Date() };
    this.elevatorQueue.set(id, updatedEntry);
    return updatedEntry;
  }
  
  // Elevator Maintenance methods
  async createElevatorMaintenance(maintenance: InsertElevatorMaintenance): Promise<ElevatorMaintenance> {
    const id = this.elevatorMaintenance.size + 1;
    const newMaintenance: ElevatorMaintenance = {
      id,
      elevatorId: maintenance.elevatorId,
      maintenanceType: maintenance.maintenanceType,
      description: maintenance.description,
      technician: maintenance.technician || null,
      startTime: maintenance.startTime,
      endTime: maintenance.endTime || null,
      status: maintenance.status || 'SCHEDULED',
      notes: maintenance.notes || null
    };
    this.elevatorMaintenance.set(id, newMaintenance);
    return newMaintenance;
  }
  
  async getElevatorMaintenance(id: number): Promise<ElevatorMaintenance | undefined> {
    return this.elevatorMaintenance.get(id);
  }
  
  async getAllElevatorMaintenanceForElevator(elevatorId: number): Promise<ElevatorMaintenance[]> {
    return Array.from(this.elevatorMaintenance.values())
      .filter(maintenance => maintenance.elevatorId === elevatorId);
  }
  
  async updateElevatorMaintenance(id: number, updates: Partial<ElevatorMaintenance>): Promise<ElevatorMaintenance | undefined> {
    const maintenance = this.elevatorMaintenance.get(id);
    if (!maintenance) {
      return undefined;
    }
    
    const updatedMaintenance = { ...maintenance, ...updates };
    this.elevatorMaintenance.set(id, updatedMaintenance);
    return updatedMaintenance;
  }
  
  // Robot Capabilities methods
  async storeRobotCapabilities(robotId: string, capabilities: any): Promise<void> {
    this.robotCapabilities.set(robotId, {
      ...capabilities,
      lastUpdated: new Date()
    });
  }
  
  async getRobotCapabilities(robotId: string): Promise<any | undefined> {
    return this.robotCapabilities.get(robotId);
  }
  
  async clearRobotCapabilities(robotId: string): Promise<void> {
    this.robotCapabilities.delete(robotId);
  }

  // Robot methods
  async saveRobot(robot: Robot): Promise<void> {
    this.robots.set(robot.serialNumber, robot);
  }

  async getRobotBySerialNumber(serialNumber: string): Promise<Robot | null> {
    return this.robots.get(serialNumber) || null;
  }

  async getRobots(): Promise<Robot[]> {
    return Array.from(this.robots.values());
  }

  async deleteRobot(serialNumber: string): Promise<void> {
    this.robots.delete(serialNumber);
  }
}

export const storage = new MemStorage();