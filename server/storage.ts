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
  type GamePlayer,
  type InsertGamePlayer,
  type GameItem,
  type InsertGameItem,
  type GameZombie,
  type InsertGameZombie,
  type RobotTask,
  type InsertRobotTask,
  type FloorMap,
  type InsertFloorMap,
  type Elevator,
  type InsertElevator,
  type ElevatorQueue,
  type InsertElevatorQueue,
  type ElevatorMaintenance,
  type InsertElevatorMaintenance
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { pool } from "./db";

const MemoryStore = createMemoryStore(session);

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
  
  // Session store for auth
  sessionStore: session.Store;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllUsers(): Promise<Map<number, User>> {
    const result = await db.select().from(users);
    const userMap = new Map<number, User>();
    
    for (const user of result) {
      userMap.set(user.id, user);
    }
    
    return userMap;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    return user || undefined;
  }
  
  // UI Template methods
  async createTemplate(template: InsertUITemplate): Promise<UITemplate> {
    const [newTemplate] = await db.insert(uiTemplates).values(template).returning();
    return newTemplate;
  }
  
  async getTemplate(id: number): Promise<UITemplate | undefined> {
    const result = await db.select().from(uiTemplates).where(eq(uiTemplates.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllTemplates(): Promise<UITemplate[]> {
    return await db.select().from(uiTemplates);
  }
  
  async updateTemplate(id: number, updates: Partial<UITemplate>): Promise<UITemplate | undefined> {
    const [template] = await db.update(uiTemplates)
      .set(updates)
      .where(eq(uiTemplates.id, id))
      .returning();
    
    return template || undefined;
  }
  
  async deleteTemplate(id: number): Promise<boolean> {
    const result = await db.delete(uiTemplates)
      .where(eq(uiTemplates.id, id))
      .returning({ id: uiTemplates.id });
    
    return result.length > 0;
  }
  
  // Robot Template Assignment methods
  async createRobotTemplateAssignment(assignment: InsertRobotTemplateAssignment): Promise<RobotTemplateAssignment> {
    const [newAssignment] = await db.insert(robotTemplateAssignments)
      .values(assignment)
      .returning();
    
    return newAssignment;
  }
  
  async getRobotTemplateAssignment(id: number): Promise<RobotTemplateAssignment | undefined> {
    const result = await db.select()
      .from(robotTemplateAssignments)
      .where(eq(robotTemplateAssignments.id, id));
    
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getRobotTemplateAssignmentBySerial(serialNumber: string): Promise<RobotTemplateAssignment | undefined> {
    const result = await db.select()
      .from(robotTemplateAssignments)
      .where(eq(robotTemplateAssignments.serialNumber, serialNumber));
    
    return result.length > 0 ? result[0] : undefined;
  }
  
  async updateRobotTemplateAssignment(id: number, updates: Partial<RobotTemplateAssignment>): Promise<RobotTemplateAssignment | undefined> {
    const [assignment] = await db.update(robotTemplateAssignments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(robotTemplateAssignments.id, id))
      .returning();
    
    return assignment || undefined;
  }
  
  async getAllRobotTemplateAssignments(): Promise<RobotTemplateAssignment[]> {
    return await db.select().from(robotTemplateAssignments);
  }
  
  async deleteRobotTemplateAssignment(id: number): Promise<boolean> {
    const result = await db.delete(robotTemplateAssignments)
      .where(eq(robotTemplateAssignments.id, id))
      .returning({ id: robotTemplateAssignments.id });
    
    return result.length > 0;
  }
  
  // API Config methods
  async getApiConfig(id: number): Promise<ApiConfig | undefined> {
    const result = await db.select().from(apiConfigs).where(eq(apiConfigs.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async saveApiConfig(apiKey: string, apiEndpoint: string): Promise<void> {
    await db.insert(apiConfigs).values({
      userId: 1, // Default to first user
      apiEndpoint,
      apiKey,
      isActive: true
    });
  }
  
  // Robot Status History methods
  async saveRobotStatus(status: any): Promise<void> {
    const statusRecord = {
      robotId: status.serialNumber || "unknown",
      status: status.status || "unknown",
      battery: status.battery || null,
      model: status.model || null,
      serialNumber: status.serialNumber || null,
      operationalStatus: status.operationalStatus || null,
      uptime: status.uptime || null
    };
    
    await db.insert(robotStatusHistory).values(statusRecord);
  }
  
  async getRobotStatusHistory(robotId?: string, limit: number = 100): Promise<RobotStatusHistory[]> {
    let query = db.select().from(robotStatusHistory).orderBy(desc(robotStatusHistory.timestamp)).limit(limit);
    
    if (robotId) {
      query = query.where(eq(robotStatusHistory.robotId, robotId));
    }
    
    return await query;
  }
  
  // Sensor Reading methods
  async saveSensorReading(reading: any): Promise<void> {
    const sensorRecord = {
      robotId: reading.robotId || "unknown",
      temperature: reading.temperature || null,
      humidity: reading.humidity || null,
      proximity: reading.proximity || null,
      light: reading.light || null,
      noise: reading.noise || null
    };
    
    await db.insert(sensorReadings).values(sensorRecord);
  }
  
  async getSensorReadings(robotId?: string, limit: number = 100): Promise<SensorReading[]> {
    let query = db.select().from(sensorReadings).orderBy(desc(sensorReadings.timestamp)).limit(limit);
    
    if (robotId) {
      query = query.where(eq(sensorReadings.robotId, robotId));
    }
    
    return await query;
  }
  
  // Position History methods
  async saveRobotPosition(position: any): Promise<void> {
    const positionRecord = {
      robotId: position.robotId || "unknown",
      x: position.x || 0,
      y: position.y || 0,
      z: position.z || 0,
      orientation: position.orientation || null,
      speed: position.speed || null
    };
    
    await db.insert(positionHistory).values(positionRecord);
  }
  
  async getPositionHistory(robotId?: string, limit: number = 100): Promise<PositionHistory[]> {
    let query = db.select().from(positionHistory).orderBy(desc(positionHistory.timestamp)).limit(limit);
    
    if (robotId) {
      query = query.where(eq(positionHistory.robotId, robotId));
    }
    
    return await query;
  }
  
  // Game Player methods
  async createGamePlayer(player: InsertGamePlayer): Promise<GamePlayer> {
    const [newPlayer] = await db.insert(gamePlayers).values(player).returning();
    return newPlayer;
  }
  
  async getGamePlayer(id: number): Promise<GamePlayer | undefined> {
    const result = await db.select().from(gamePlayers).where(eq(gamePlayers.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getGamePlayerByUserId(userId: number): Promise<GamePlayer | undefined> {
    const result = await db.select().from(gamePlayers).where(eq(gamePlayers.userId, userId));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined> {
    const [player] = await db.update(gamePlayers)
      .set(updates)
      .where(eq(gamePlayers.id, id))
      .returning();
    
    return player || undefined;
  }
  
  async getAllGamePlayers(): Promise<GamePlayer[]> {
    return await db.select().from(gamePlayers);
  }
  
  // Game Item methods
  async createGameItem(item: InsertGameItem): Promise<GameItem> {
    const [newItem] = await db.insert(gameItems).values(item).returning();
    return newItem;
  }
  
  async getGameItem(id: number): Promise<GameItem | undefined> {
    const result = await db.select().from(gameItems).where(eq(gameItems.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllGameItems(): Promise<GameItem[]> {
    return await db.select().from(gameItems);
  }
  
  // Game Zombie methods
  async createGameZombie(zombie: InsertGameZombie): Promise<GameZombie> {
    const [newZombie] = await db.insert(gameZombies).values(zombie).returning();
    return newZombie;
  }
  
  async getGameZombie(id: number): Promise<GameZombie | undefined> {
    const result = await db.select().from(gameZombies).where(eq(gameZombies.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async updateGameZombie(id: number, updates: Partial<GameZombie>): Promise<GameZombie | undefined> {
    const [zombie] = await db.update(gameZombies)
      .set(updates)
      .where(eq(gameZombies.id, id))
      .returning();
    
    return zombie || undefined;
  }
  
  async getAllGameZombies(): Promise<GameZombie[]> {
    return await db.select().from(gameZombies);
  }
  
  async removeGameZombie(id: number): Promise<boolean> {
    const result = await db.delete(gameZombies)
      .where(eq(gameZombies.id, id))
      .returning({ id: gameZombies.id });
    
    return result.length > 0;
  }
  
  // Robot Task Queue methods
  async createRobotTask(task: InsertRobotTask): Promise<RobotTask> {
    const [newTask] = await db.insert(robotTasks).values(task).returning();
    return newTask;
  }
  
  async getRobotTask(id: number): Promise<RobotTask | undefined> {
    const result = await db.select().from(robotTasks).where(eq(robotTasks.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllRobotTasks(): Promise<RobotTask[]> {
    return await db.select().from(robotTasks);
  }
  
  async getRobotTasksBySerialNumber(serialNumber: string): Promise<RobotTask[]> {
    return await db.select().from(robotTasks).where(eq(robotTasks.serialNumber, serialNumber));
  }
  
  async getRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return await db.select().from(robotTasks).where(eq(robotTasks.templateId, templateId));
  }
  
  async getPendingRobotTasks(): Promise<RobotTask[]> {
    return await db.select().from(robotTasks).where(eq(robotTasks.status, "PENDING"));
  }
  
  async getPendingRobotTasksByTemplateId(templateId: number): Promise<RobotTask[]> {
    return await db.select()
      .from(robotTasks)
      .where(and(
        eq(robotTasks.templateId, templateId),
        eq(robotTasks.status, "PENDING")
      ));
  }
  
  async updateRobotTask(id: number, updates: Partial<RobotTask>): Promise<RobotTask | undefined> {
    const [task] = await db.update(robotTasks)
      .set(updates)
      .where(eq(robotTasks.id, id))
      .returning();
    
    return task || undefined;
  }
  
  async updateTaskPriority(id: number, newPriority: number): Promise<RobotTask | undefined> {
    const [task] = await db.update(robotTasks)
      .set({ priority: newPriority })
      .where(eq(robotTasks.id, id))
      .returning();
    
    return task || undefined;
  }
  
  async cancelRobotTask(id: number): Promise<RobotTask | undefined> {
    const [task] = await db.update(robotTasks)
      .set({ 
        status: "CANCELLED",
        completedAt: new Date()
      })
      .where(eq(robotTasks.id, id))
      .returning();
    
    return task || undefined;
  }
  
  async completeRobotTask(id: number): Promise<RobotTask | undefined> {
    const [task] = await db.update(robotTasks)
      .set({ 
        status: "COMPLETED",
        completedAt: new Date()
      })
      .where(eq(robotTasks.id, id))
      .returning();
    
    return task || undefined;
  }
  
  async reorderTasks(taskIds: number[]): Promise<boolean> {
    // In a more complex implementation, we would update priorities here
    // For now, we'll just return true as if it was successful
    return true;
  }
  
  // Floor Map methods
  async createFloorMap(floorMap: InsertFloorMap): Promise<FloorMap> {
    const [newMap] = await db.insert(floorMaps).values(floorMap).returning();
    return newMap;
  }
  
  async getFloorMap(id: number): Promise<FloorMap | undefined> {
    const result = await db.select().from(floorMaps).where(eq(floorMaps.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getFloorMapByBuildingAndFloor(buildingId: number, floorNumber: number): Promise<FloorMap | undefined> {
    const result = await db.select()
      .from(floorMaps)
      .where(and(
        eq(floorMaps.buildingId, buildingId),
        eq(floorMaps.floorNumber, floorNumber)
      ));
    
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllFloorMaps(): Promise<FloorMap[]> {
    return await db.select().from(floorMaps);
  }
  
  async updateFloorMap(id: number, updates: Partial<FloorMap>): Promise<FloorMap | undefined> {
    const [floorMap] = await db.update(floorMaps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(floorMaps.id, id))
      .returning();
    
    return floorMap || undefined;
  }
  
  async deleteFloorMap(id: number): Promise<boolean> {
    const result = await db.delete(floorMaps)
      .where(eq(floorMaps.id, id))
      .returning({ id: floorMaps.id });
    
    return result.length > 0;
  }
  
  // Elevator methods
  async createElevator(elevator: InsertElevator): Promise<Elevator> {
    const [newElevator] = await db.insert(elevators).values(elevator).returning();
    return newElevator;
  }
  
  async getElevator(id: number): Promise<Elevator | undefined> {
    const result = await db.select().from(elevators).where(eq(elevators.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllElevators(): Promise<Elevator[]> {
    return await db.select().from(elevators);
  }
  
  async getElevatorsByBuilding(buildingId: number): Promise<Elevator[]> {
    return await db.select().from(elevators).where(eq(elevators.buildingId, buildingId));
  }
  
  async updateElevator(id: number, updates: Partial<Elevator>): Promise<Elevator | undefined> {
    const [elevator] = await db.update(elevators)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(elevators.id, id))
      .returning();
    
    return elevator || undefined;
  }
  
  async updateElevatorStatus(id: number, status: string): Promise<Elevator | undefined> {
    const [elevator] = await db.update(elevators)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(elevators.id, id))
      .returning();
    
    return elevator || undefined;
  }
  
  // Elevator Queue methods
  async createElevatorQueueEntry(entry: InsertElevatorQueue): Promise<ElevatorQueue> {
    const [newEntry] = await db.insert(elevatorQueue).values(entry).returning();
    return newEntry;
  }
  
  async getElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined> {
    const result = await db.select().from(elevatorQueue).where(eq(elevatorQueue.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getElevatorQueueForElevator(elevatorId: number): Promise<ElevatorQueue[]> {
    return await db.select().from(elevatorQueue).where(eq(elevatorQueue.elevatorId, elevatorId));
  }
  
  async getElevatorQueueForRobot(robotId: string): Promise<ElevatorQueue[]> {
    return await db.select().from(elevatorQueue).where(eq(elevatorQueue.robotId, robotId));
  }
  
  async updateElevatorQueueEntryStatus(id: number, status: string): Promise<ElevatorQueue | undefined> {
    const [entry] = await db.update(elevatorQueue)
      .set({ status })
      .where(eq(elevatorQueue.id, id))
      .returning();
    
    return entry || undefined;
  }
  
  async completeElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined> {
    const [entry] = await db.update(elevatorQueue)
      .set({ 
        status: "COMPLETED",
        completedAt: new Date()
      })
      .where(eq(elevatorQueue.id, id))
      .returning();
    
    return entry || undefined;
  }
  
  // Elevator Maintenance methods
  async createElevatorMaintenance(maintenance: InsertElevatorMaintenance): Promise<ElevatorMaintenance> {
    const [newMaintenance] = await db.insert(elevatorMaintenance).values(maintenance).returning();
    return newMaintenance;
  }
  
  async getElevatorMaintenance(id: number): Promise<ElevatorMaintenance | undefined> {
    const result = await db.select().from(elevatorMaintenance).where(eq(elevatorMaintenance.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getAllElevatorMaintenanceForElevator(elevatorId: number): Promise<ElevatorMaintenance[]> {
    return await db.select().from(elevatorMaintenance).where(eq(elevatorMaintenance.elevatorId, elevatorId));
  }
  
  async updateElevatorMaintenance(id: number, updates: Partial<ElevatorMaintenance>): Promise<ElevatorMaintenance | undefined> {
    const [maintenance] = await db.update(elevatorMaintenance)
      .set(updates)
      .where(eq(elevatorMaintenance.id, id))
      .returning();
    
    return maintenance || undefined;
  }
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
  private floorMaps: Map<number, FloorMap>;
  private elevators: Map<number, Elevator>;
  private elevatorQueue: Map<number, ElevatorQueue>;
  private elevatorMaintenance: Map<number, ElevatorMaintenance>;
  
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
  currentFloorMapId: number;
  currentElevatorId: number;
  currentElevatorQueueId: number;
  currentElevatorMaintenanceId: number;
  
  sessionStore: session.Store;

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
    this.floorMaps = new Map();
    this.elevators = new Map();
    this.elevatorQueue = new Map();
    this.elevatorMaintenance = new Map();
    
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
    this.currentFloorMapId = 1;
    this.currentElevatorId = 1;
    this.currentElevatorQueueId = 1;
    this.currentElevatorMaintenanceId = 1;
    
    // Initialize the session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
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

  // Floor Map methods
  async createFloorMap(floorMap: InsertFloorMap): Promise<FloorMap> {
    const id = this.currentFloorMapId++;
    const newFloorMap: FloorMap = { 
      ...floorMap, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date() 
    };
    this.floorMaps.set(id, newFloorMap);
    return newFloorMap;
  }
  
  async getFloorMap(id: number): Promise<FloorMap | undefined> {
    return this.floorMaps.get(id);
  }

  async getFloorMapByBuildingAndFloor(buildingId: number, floorNumber: number): Promise<FloorMap | undefined> {
    return Array.from(this.floorMaps.values()).find(
      (map) => map.buildingId === buildingId && map.floorNumber === floorNumber
    );
  }
  
  async getAllFloorMaps(): Promise<FloorMap[]> {
    return Array.from(this.floorMaps.values());
  }
  
  async updateFloorMap(id: number, updates: Partial<FloorMap>): Promise<FloorMap | undefined> {
    const floorMap = this.floorMaps.get(id);
    if (!floorMap) return undefined;
    
    const updatedMap = { 
      ...floorMap, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.floorMaps.set(id, updatedMap);
    return updatedMap;
  }
  
  async deleteFloorMap(id: number): Promise<boolean> {
    return this.floorMaps.delete(id);
  }
  
  // Elevator methods
  async createElevator(elevator: InsertElevator): Promise<Elevator> {
    const id = this.currentElevatorId++;
    const newElevator: Elevator = { 
      ...elevator, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date() 
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
    return Array.from(this.elevators.values()).filter(
      (elevator) => elevator.buildingId === buildingId
    );
  }
  
  async updateElevator(id: number, updates: Partial<Elevator>): Promise<Elevator | undefined> {
    const elevator = this.elevators.get(id);
    if (!elevator) return undefined;
    
    const updatedElevator = { 
      ...elevator, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.elevators.set(id, updatedElevator);
    return updatedElevator;
  }
  
  async updateElevatorStatus(id: number, status: string): Promise<Elevator | undefined> {
    const elevator = await this.getElevator(id);
    if (!elevator) return undefined;
    
    return this.updateElevator(id, { status });
  }
  
  // Elevator Queue methods
  async createElevatorQueueEntry(entry: InsertElevatorQueue): Promise<ElevatorQueue> {
    const id = this.currentElevatorQueueId++;
    const newEntry: ElevatorQueue = { 
      ...entry, 
      id, 
      requestedAt: new Date(),
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
      .filter(entry => entry.elevatorId === elevatorId)
      .sort((a, b) => a.priority - b.priority); // Sort by priority (highest first)
  }
  
  async getElevatorQueueForRobot(robotId: string): Promise<ElevatorQueue[]> {
    return Array.from(this.elevatorQueue.values())
      .filter(entry => entry.robotId === robotId)
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime()); // Sort by requested time (oldest first)
  }
  
  async updateElevatorQueueEntryStatus(id: number, status: string): Promise<ElevatorQueue | undefined> {
    const entry = this.elevatorQueue.get(id);
    if (!entry) return undefined;
    
    let updates: Partial<ElevatorQueue> = { status };
    
    // If status is changing to BOARDING, update startedAt
    if (status === 'BOARDING') {
      updates.startedAt = new Date();
    }
    
    // If status is changing to COMPLETED, update completedAt
    if (status === 'COMPLETED') {
      updates.completedAt = new Date();
    }
    
    const updatedEntry = { ...entry, ...updates };
    this.elevatorQueue.set(id, updatedEntry);
    return updatedEntry;
  }
  
  async completeElevatorQueueEntry(id: number): Promise<ElevatorQueue | undefined> {
    return this.updateElevatorQueueEntryStatus(id, 'COMPLETED');
  }
  
  // Elevator Maintenance methods
  async createElevatorMaintenance(maintenance: InsertElevatorMaintenance): Promise<ElevatorMaintenance> {
    const id = this.currentElevatorMaintenanceId++;
    const newMaintenance: ElevatorMaintenance = { 
      ...maintenance, 
      id
    };
    this.elevatorMaintenance.set(id, newMaintenance);
    return newMaintenance;
  }
  
  async getElevatorMaintenance(id: number): Promise<ElevatorMaintenance | undefined> {
    return this.elevatorMaintenance.get(id);
  }
  
  async getAllElevatorMaintenanceForElevator(elevatorId: number): Promise<ElevatorMaintenance[]> {
    return Array.from(this.elevatorMaintenance.values())
      .filter(maint => maint.elevatorId === elevatorId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime()); // Sort by start time (newest first)
  }
  
  async updateElevatorMaintenance(id: number, updates: Partial<ElevatorMaintenance>): Promise<ElevatorMaintenance | undefined> {
    const maintenance = this.elevatorMaintenance.get(id);
    if (!maintenance) return undefined;
    
    const updatedMaintenance = { ...maintenance, ...updates };
    this.elevatorMaintenance.set(id, updatedMaintenance);
    return updatedMaintenance;
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
        );
      
      if (pendingPickups.length > 0) {
        // Get the current robot location from the task that was just completed
        const currentLocation = {
          x: task.targetX || 0,
          y: task.targetY || 0,
          z: task.targetZ || 0,
          floor: this.extractFloorFromLocation(task.location) || 0
        };
        
        // Score tasks based on a combination of priority and proximity
        const scoredTasks = pendingPickups.map(pickup => {
          // Calculate distance score (lower is better)
          const pickupLocation = {
            x: pickup.targetX || 0,
            y: pickup.targetY || 0,
            z: pickup.targetZ || 0,
            floor: this.extractFloorFromLocation(pickup.location) || 0
          };
          
          // Calculate a base distance score
          let distanceScore = Math.sqrt(
            Math.pow(pickupLocation.x - currentLocation.x, 2) + 
            Math.pow(pickupLocation.y - currentLocation.y, 2)
          );
          
          // Heavily penalize floor changes (elevator travel is time-consuming)
          if (pickupLocation.floor !== currentLocation.floor) {
            distanceScore += 1000; // Large penalty for changing floors
          }
          
          // Calculate priority score (higher priority is better)
          const priorityScore = pickup.priority * 100; // Weight priority more heavily
          
          // Final score is a combination (lower is better)
          // This balances distance with priority
          const finalScore = distanceScore - priorityScore;
          
          return {
            task: pickup,
            score: finalScore
          };
        });
        
        // Sort by score (lowest score is best - closest high priority task)
        scoredTasks.sort((a, b) => a.score - b.score);
        
        // Select the best task
        const bestTask = scoredTasks[0].task;
        console.log(`Robot ${task.serialNumber} completed a DROPOFF task, automatically assigning PICKUP task ${bestTask.id}`);
        console.log(`Task selected based on proximity and priority with score: ${scoredTasks[0].score.toFixed(2)}`);
        
        // Update this task to be started immediately after the dropoff
        const optimizedPickup = {
          ...bestTask,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          // Add optional metadata to indicate this was an optimized assignment
          parameters: JSON.stringify({
            ...JSON.parse(bestTask.parameters || '{}'),
            wasOptimizedAssignment: true,
            previousTaskId: task.id,
            optimizationScore: scoredTasks[0].score.toFixed(2),
            distanceFromPrevious: this.calculateDistance(currentLocation, {
              x: bestTask.targetX || 0,
              y: bestTask.targetY || 0,
              z: bestTask.targetZ || 0
            }).toFixed(2)
          })
        };
        
        this.robotTasks.set(bestTask.id, optimizedPickup);
        console.log(`Optimized route: Robot will go directly to PICKUP task instead of returning home`);
      }
    }
    
    return updatedTask;
  }
  
  // Helper method to extract floor number from location string
  private extractFloorFromLocation(location?: string): number | null {
    if (!location) return null;
    
    // Try to extract floor information
    // Common formats: "Floor 3", "3rd Floor", "Building A Floor 2", etc.
    const floorMatch = location.match(/floor\s+(\d+)/i) || location.match(/(\d+)(?:st|nd|rd|th)?\s+floor/i);
    if (floorMatch && floorMatch[1]) {
      return parseInt(floorMatch[1]);
    }
    return null;
  }
  
  // Helper method to calculate distance between two points
  private calculateDistance(point1: {x: number, y: number, z: number}, point2: {x: number, y: number, z: number}): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2) + 
      Math.pow(point2.z - point1.z, 2)
    );
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

// Use DatabaseStorage for persistance
export const storage = new DatabaseStorage();
