import { 
  users, 
  apiConfigs, 
  robotStatusHistory, 
  sensorReadings, 
  positionHistory,
  uiTemplates,
  gamePlayers,
  gameItems,
  gameZombies,
  robotTemplateAssignments,
  robotTasks,
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
  type GamePlayer,
  type InsertGamePlayer,
  type GameItem,
  type InsertGameItem,
  type GameZombie,
  type InsertGameZombie,
  type RobotTask,
  type InsertRobotTask
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<Map<number, User>>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // UI Template methods
  createTemplate(template: InsertUITemplate): Promise<UITemplate>;
  getTemplate(id: number): Promise<UITemplate | undefined>;
  getAllTemplates(): Promise<UITemplate[]>;
  updateTemplate(id: number, updates: Partial<UITemplate>): Promise<UITemplate | undefined>;
  deleteTemplate(id: number): Promise<boolean>;
  
  // Robot Template Assignment methods
  createRobotTemplateAssignment(assignment: InsertRobotTemplateAssignment): Promise<RobotTemplateAssignment>;
  getRobotTemplateAssignment(id: number): Promise<RobotTemplateAssignment | undefined>;
  getRobotTemplateAssignmentBySerial(serialNumber: string): Promise<RobotTemplateAssignment | undefined>;
  updateRobotTemplateAssignment(id: number, updates: Partial<RobotTemplateAssignment>): Promise<RobotTemplateAssignment | undefined>;
  getAllRobotTemplateAssignments(): Promise<RobotTemplateAssignment[]>;
  deleteRobotTemplateAssignment(id: number): Promise<boolean>;
  
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
  
  // Game Player methods
  createGamePlayer(player: InsertGamePlayer): Promise<GamePlayer>;
  getGamePlayer(id: number): Promise<GamePlayer | undefined>;
  getGamePlayerByUserId(userId: number): Promise<GamePlayer | undefined>;
  updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined>;
  getAllGamePlayers(): Promise<GamePlayer[]>;
  
  // Game Item methods
  createGameItem(item: InsertGameItem): Promise<GameItem>;
  getGameItem(id: number): Promise<GameItem | undefined>;
  getAllGameItems(): Promise<GameItem[]>;
  
  // Game Zombie methods
  createGameZombie(zombie: InsertGameZombie): Promise<GameZombie>;
  getGameZombie(id: number): Promise<GameZombie | undefined>;
  updateGameZombie(id: number, updates: Partial<GameZombie>): Promise<GameZombie | undefined>;
  getAllGameZombies(): Promise<GameZombie[]>;
  removeGameZombie(id: number): Promise<boolean>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private apiConfigs: Map<number, ApiConfig>;
  private uiTemplates: Map<number, UITemplate>;
  private robotTemplateAssignments: Map<number, RobotTemplateAssignment>;
  private robotStatusHistory: RobotStatusHistory[];
  private sensorReadings: SensorReading[];
  private positionHistory: PositionHistory[];
  private gamePlayers: Map<number, GamePlayer>;
  private gameItems: Map<number, GameItem>;
  private gameZombies: Map<number, GameZombie>;
  private robotTasks: Map<number, RobotTask>;
  
  currentId: number;
  currentApiConfigId: number;
  currentTemplateId: number;
  currentRobotTemplateAssignmentId: number;
  currentStatusHistoryId: number;
  currentSensorReadingId: number;
  currentPositionHistoryId: number;
  currentGamePlayerId: number;
  currentGameItemId: number;
  currentGameZombieId: number;
  currentRobotTaskId: number;

  constructor() {
    this.users = new Map();
    this.apiConfigs = new Map();
    this.uiTemplates = new Map();
    this.robotTemplateAssignments = new Map();
    this.robotStatusHistory = [];
    this.sensorReadings = [];
    this.positionHistory = [];
    this.gamePlayers = new Map();
    this.gameItems = new Map();
    this.gameZombies = new Map();
    this.robotTasks = new Map();
    
    this.currentId = 1;
    this.currentApiConfigId = 1;
    this.currentTemplateId = 1;
    this.currentRobotTemplateAssignmentId = 1;
    this.currentStatusHistoryId = 1;
    this.currentSensorReadingId = 1;
    this.currentPositionHistoryId = 1;
    this.currentGamePlayerId = 1;
    this.currentGameItemId = 1;
    this.currentGameZombieId = 1;
    this.currentRobotTaskId = 1;
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
  
  async getAllUsers(): Promise<Map<number, User>> {
    return this.users;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // UI Template methods
  async createTemplate(template: InsertUITemplate): Promise<UITemplate> {
    const id = this.currentTemplateId++;
    const newTemplate: UITemplate = { ...template, id, createdAt: new Date() };
    this.uiTemplates.set(id, newTemplate);
    return newTemplate;
  }
  
  async getTemplate(id: number): Promise<UITemplate | undefined> {
    return this.uiTemplates.get(id);
  }
  
  async getAllTemplates(): Promise<UITemplate[]> {
    return Array.from(this.uiTemplates.values());
  }
  
  async updateTemplate(id: number, updates: Partial<UITemplate>): Promise<UITemplate | undefined> {
    const template = this.uiTemplates.get(id);
    if (!template) return undefined;
    
    const updatedTemplate = { ...template, ...updates };
    this.uiTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }
  
  async deleteTemplate(id: number): Promise<boolean> {
    return this.uiTemplates.delete(id);
  }
  
  // Robot Template Assignment methods
  async createRobotTemplateAssignment(assignment: InsertRobotTemplateAssignment): Promise<RobotTemplateAssignment> {
    const id = this.currentRobotTemplateAssignmentId++;
    const newAssignment: RobotTemplateAssignment = { 
      ...assignment, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date() 
    };
    this.robotTemplateAssignments.set(id, newAssignment);
    return newAssignment;
  }
  
  async getRobotTemplateAssignment(id: number): Promise<RobotTemplateAssignment | undefined> {
    return this.robotTemplateAssignments.get(id);
  }
  
  async getRobotTemplateAssignmentBySerial(serialNumber: string): Promise<RobotTemplateAssignment | undefined> {
    return Array.from(this.robotTemplateAssignments.values()).find(
      (assignment) => assignment.serialNumber === serialNumber
    );
  }
  
  async updateRobotTemplateAssignment(id: number, updates: Partial<RobotTemplateAssignment>): Promise<RobotTemplateAssignment | undefined> {
    const assignment = this.robotTemplateAssignments.get(id);
    if (!assignment) return undefined;
    
    const updatedAssignment = { 
      ...assignment, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.robotTemplateAssignments.set(id, updatedAssignment);
    return updatedAssignment;
  }
  
  async getAllRobotTemplateAssignments(): Promise<RobotTemplateAssignment[]> {
    return Array.from(this.robotTemplateAssignments.values());
  }
  
  async deleteRobotTemplateAssignment(id: number): Promise<boolean> {
    return this.robotTemplateAssignments.delete(id);
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
  
  // Game Player methods
  async createGamePlayer(player: InsertGamePlayer): Promise<GamePlayer> {
    const id = this.currentGamePlayerId++;
    const newPlayer: GamePlayer = { 
      ...player, 
      id, 
      createdAt: new Date(), 
      lastActive: new Date() 
    };
    this.gamePlayers.set(id, newPlayer);
    return newPlayer;
  }
  
  async getGamePlayer(id: number): Promise<GamePlayer | undefined> {
    return this.gamePlayers.get(id);
  }
  
  async getGamePlayerByUserId(userId: number): Promise<GamePlayer | undefined> {
    return Array.from(this.gamePlayers.values()).find(
      (player) => player.userId === userId
    );
  }
  
  async updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined> {
    const player = this.gamePlayers.get(id);
    if (!player) return undefined;
    
    const updatedPlayer = { ...player, ...updates, lastActive: new Date() };
    this.gamePlayers.set(id, updatedPlayer);
    return updatedPlayer;
  }
  
  async getAllGamePlayers(): Promise<GamePlayer[]> {
    return Array.from(this.gamePlayers.values());
  }
  
  // Game Item methods
  async createGameItem(item: InsertGameItem): Promise<GameItem> {
    const id = this.currentGameItemId++;
    const newItem: GameItem = { ...item, id };
    this.gameItems.set(id, newItem);
    return newItem;
  }
  
  async getGameItem(id: number): Promise<GameItem | undefined> {
    return this.gameItems.get(id);
  }
  
  async getAllGameItems(): Promise<GameItem[]> {
    return Array.from(this.gameItems.values());
  }
  
  // Game Zombie methods
  async createGameZombie(zombie: InsertGameZombie): Promise<GameZombie> {
    const id = this.currentGameZombieId++;
    const newZombie: GameZombie = { ...zombie, id, spawnTime: new Date() };
    this.gameZombies.set(id, newZombie);
    return newZombie;
  }
  
  async getGameZombie(id: number): Promise<GameZombie | undefined> {
    return this.gameZombies.get(id);
  }
  
  async updateGameZombie(id: number, updates: Partial<GameZombie>): Promise<GameZombie | undefined> {
    const zombie = this.gameZombies.get(id);
    if (!zombie) return undefined;
    
    const updatedZombie = { ...zombie, ...updates };
    this.gameZombies.set(id, updatedZombie);
    return updatedZombie;
  }
  
  async getAllGameZombies(): Promise<GameZombie[]> {
    return Array.from(this.gameZombies.values());
  }
  
  async removeGameZombie(id: number): Promise<boolean> {
    return this.gameZombies.delete(id);
  }

  // Robot Task Queue methods
  async createRobotTask(task: InsertRobotTask): Promise<RobotTask> {
    const id = this.currentRobotTaskId++;
    const newTask: RobotTask = { 
      ...task, 
      id, 
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
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
      .filter(task => task.serialNumber === serialNumber)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }
  
  async getRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.templateId === templateId)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  async getPendingRobotTasks(): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.status === 'PENDING')
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }
  
  async getPendingRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return Array.from(this.robotTasks.values())
      .filter(task => task.status === 'PENDING' && task.templateId === templateId)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  async updateRobotTask(id: number, updates: Partial<RobotTask>): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }

  async updateTaskPriority(id: number, newPriority: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, priority: newPriority };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }

  async cancelRobotTask(id: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { 
      ...task, 
      status: 'CANCELLED',
      completedAt: new Date()
    };
    this.robotTasks.set(id, updatedTask);
    return updatedTask;
  }

  async completeRobotTask(id: number): Promise<RobotTask | undefined> {
    const task = this.robotTasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { 
      ...task, 
      status: 'COMPLETED',
      completedAt: new Date()
    };
    this.robotTasks.set(id, updatedTask);
    
    // Check if this was a DROPOFF task and optimize for subsequent pickups
    if (task.taskType === 'DROPOFF') {
      // Find all pending pickup tasks for the same robot
      const pendingPickups = Array.from(this.robotTasks.values())
        .filter(t => 
          t.status === 'PENDING' && 
          t.serialNumber === task.serialNumber && 
          t.taskType === 'PICKUP'
        )
        .sort((a, b) => b.priority - a.priority); // Sort by priority
      
      if (pendingPickups.length > 0) {
        // If there are pending pickups, automatically assign the highest priority one
        const nextPickup = pendingPickups[0];
        console.log(`Robot ${task.serialNumber} completed a DROPOFF task, automatically assigning PICKUP task ${nextPickup.id}`);
        
        // Update this task to be started immediately after the dropoff
        const optimizedPickup = {
          ...nextPickup,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          // Add optional metadata to indicate this was an optimized assignment
          parameters: JSON.stringify({
            ...JSON.parse(nextPickup.parameters || '{}'),
            wasOptimizedAssignment: true,
            previousTaskId: task.id
          })
        };
        
        this.robotTasks.set(nextPickup.id, optimizedPickup);
        console.log(`Optimized route: Robot will go directly to PICKUP task instead of returning home`);
      }
    }
    
    return updatedTask;
  }

  async reorderTasks(taskIds: number[]): Promise<boolean> {
    try {
      // Update priority based on the order in taskIds (first has highest priority)
      let priority = taskIds.length;
      for (const id of taskIds) {
        const task = this.robotTasks.get(id);
        if (task && task.status === 'PENDING') {
          this.updateTaskPriority(id, priority);
          priority--;
        }
      }
      return true;
    } catch (error) {
      console.error('Error reordering tasks:', error);
      return false;
    }
  }
}

export const storage = new MemStorage();
