import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'user' or 'admin'
  templateId: integer("template_id"), // Reference to the user's template
});

// Robot Template Assignments
export const robotTemplateAssignments = pgTable("robot_template_assignments", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull().unique(),
  templateId: integer("template_id").notNull(),
  name: text("name"),  // Robot name
  location: text("location"),  // Where the robot is located
  robotName: text("robot_name"),  // Legacy field
  robotModel: text("robot_model"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Game players
export const gamePlayers = pgTable("game_players", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  username: text("username").notNull(),
  health: integer("health").default(100),
  hunger: integer("hunger").default(0),
  thirst: integer("thirst").default(0),
  lastX: real("last_x").default(0),
  lastY: real("last_y").default(0),
  inventory: text("inventory").default("[]"), // JSON string of inventory items
  createdAt: timestamp("created_at").defaultNow(),
  lastActive: timestamp("last_active").defaultNow(),
});

// Game items
export const gameItems = pgTable("game_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // weapon, food, medicine, tool, etc.
  description: text("description"),
  properties: text("properties").notNull(), // JSON string of item properties
  imageKey: text("image_key"), // Phaser texture key
});

// Game zombies
export const gameZombies = pgTable("game_zombies", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // normal, runner, tank, etc.
  health: integer("health").default(100),
  damage: integer("damage").default(10),
  speed: real("speed").default(1.0),
  x: real("x").notNull(),
  y: real("y").notNull(),
  spawnTime: timestamp("spawn_time").defaultNow(),
});

// UI Templates
export const uiTemplates = pgTable("ui_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  layout: text("layout").notNull(), // Stores the UI layout as a JSON string
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// API Configuration
export const apiConfigs = pgTable("api_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  apiEndpoint: text("api_endpoint").notNull(),
  apiKey: text("api_key").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Robot Status History
export const robotStatusHistory = pgTable("robot_status_history", {
  id: serial("id").primaryKey(),
  robotId: text("robot_id").notNull(),
  status: text("status").notNull(),
  battery: integer("battery"),
  model: text("model"),
  serialNumber: text("serial_number"),
  operationalStatus: text("operational_status"),
  uptime: text("uptime"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Robot Sensor Readings
export const sensorReadings = pgTable("sensor_readings", {
  id: serial("id").primaryKey(),
  robotId: text("robot_id").notNull(),
  temperature: integer("temperature"),
  humidity: integer("humidity"),
  proximity: integer("proximity"),
  light: integer("light"),
  noise: integer("noise"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Robot Position History
export const positionHistory = pgTable("position_history", {
  id: serial("id").primaryKey(),
  robotId: text("robot_id").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  z: integer("z").notNull(),
  orientation: integer("orientation"),
  speed: integer("speed"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Robot Task Queue
export const robotTasks = pgTable("robot_tasks", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull(), // The robot assigned to this task
  templateId: integer("template_id"), // The template this task is associated with
  title: text("title").notNull(), // Short title for the task
  description: text("description"), // Detailed description of the task
  taskType: text("task_type").notNull(), // E.g., 'PICKUP', 'DELIVERY', 'CLEANING', 'PATROL'
  priority: integer("priority").default(0), // Higher number means higher priority
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'
  location: text("location"), // String representation of task location (e.g., "Room 101")
  targetX: integer("target_x"), // Target X coordinate (if applicable)
  targetY: integer("target_y"), // Target Y coordinate (if applicable)
  targetZ: integer("target_z"), // Target Z coordinate (if applicable)
  parameters: text("parameters"), // JSON string of additional parameters (e.g. items to deliver)
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"), // When the task was started
  completedAt: timestamp("completed_at"), // When the task was completed
  createdBy: integer("created_by").references(() => users.id), // User who created the task
});

// User Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  templateId: true,
});

// Template Schemas
export const insertUITemplateSchema = createInsertSchema(uiTemplates).pick({
  name: true,
  description: true,
  layout: true,
  isActive: true,
  createdBy: true,
});

// API Config Schemas
export const insertApiConfigSchema = createInsertSchema(apiConfigs).pick({
  userId: true,
  apiEndpoint: true,
  apiKey: true,
  isActive: true,
});

// Robot Status History Schemas
export const insertRobotStatusHistorySchema = createInsertSchema(robotStatusHistory);

// Sensor Reading Schemas
export const insertSensorReadingSchema = createInsertSchema(sensorReadings);

// Position History Schemas
export const insertPositionHistorySchema = createInsertSchema(positionHistory);

// Robot Task Schemas
export const insertRobotTaskSchema = createInsertSchema(robotTasks).pick({
  serialNumber: true,
  templateId: true,
  title: true,
  description: true,
  taskType: true,
  priority: true,
  status: true,
  location: true,
  targetX: true,
  targetY: true,
  targetZ: true,
  parameters: true,
  createdBy: true,
});

// Robot Template Assignment Schema
export const insertRobotTemplateAssignmentSchema = createInsertSchema(robotTemplateAssignments).pick({
  serialNumber: true,
  templateId: true,
  robotName: true,
  robotModel: true,
  isActive: true,
});

// Game Player Schemas
export const insertGamePlayerSchema = createInsertSchema(gamePlayers).pick({
  userId: true,
  username: true,
  health: true,
  hunger: true,
  thirst: true,
  lastX: true,
  lastY: true,
  inventory: true,
});

// Game Item Schemas
export const insertGameItemSchema = createInsertSchema(gameItems).pick({
  name: true,
  type: true,
  description: true,
  properties: true,
  imageKey: true,
});

// Game Zombie Schemas
export const insertGameZombieSchema = createInsertSchema(gameZombies).pick({
  type: true,
  health: true,
  damage: true,
  speed: true,
  x: true,
  y: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect & { role: string };

export type InsertUITemplate = z.infer<typeof insertUITemplateSchema>;
export type UITemplate = typeof uiTemplates.$inferSelect;

export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type ApiConfig = typeof apiConfigs.$inferSelect;

export type InsertRobotStatusHistory = z.infer<typeof insertRobotStatusHistorySchema>;
export type RobotStatusHistory = typeof robotStatusHistory.$inferSelect;

export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorReading = typeof sensorReadings.$inferSelect;

export type InsertPositionHistory = z.infer<typeof insertPositionHistorySchema>;
export type PositionHistory = typeof positionHistory.$inferSelect;

export type InsertRobotTemplateAssignment = z.infer<typeof insertRobotTemplateAssignmentSchema>;
export type RobotTemplateAssignment = typeof robotTemplateAssignments.$inferSelect;

export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type GamePlayer = typeof gamePlayers.$inferSelect;

export type InsertGameItem = z.infer<typeof insertGameItemSchema>;
export type GameItem = typeof gameItems.$inferSelect;

export type InsertGameZombie = z.infer<typeof insertGameZombieSchema>;
export type GameZombie = typeof gameZombies.$inferSelect;

// Building Floor Maps
export const floorMaps = pgTable("floor_maps", {
  id: serial("id").primaryKey(),
  buildingId: integer("building_id").notNull(), // For buildings with multiple maps
  floorNumber: integer("floor_number").notNull(), // Floor number (e.g., 1, 2, 3, -1 for basement)
  name: text("name").notNull(), // Name of the floor (e.g., "Ground Floor", "Basement")
  mapData: text("map_data").notNull(), // JSON string containing map grid data, obstacles, etc.
  navigationGraph: text("navigation_graph"), // JSON string of navigation nodes and paths
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Elevators
export const elevators = pgTable("elevators", {
  id: serial("id").primaryKey(),
  buildingId: integer("building_id").notNull(), // Building identifier
  name: text("name").notNull(), // Name/identifier for the elevator (e.g., "North Elevator")
  status: text("status").notNull().default("OPERATIONAL"), // 'OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE'
  currentFloor: integer("current_floor"), // Current floor where the elevator is located
  targetFloor: integer("target_floor"), // Floor the elevator is heading to (if moving)
  maxCapacity: integer("max_capacity").default(1), // Maximum number of robots that can be in the elevator at once
  doorLocation: text("door_location").notNull(), // JSON string with entrance coordinates on each floor
  lastMaintenance: timestamp("last_maintenance"), // When the elevator was last maintained
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Elevator Queue (for managing robot access to elevators)
export const elevatorQueue = pgTable("elevator_queue", {
  id: serial("id").primaryKey(),
  elevatorId: integer("elevator_id").references(() => elevators.id).notNull(),
  robotId: text("robot_id").notNull(), // Serial number of the robot requesting elevator
  startFloor: integer("start_floor").notNull(), // Floor where the robot is located
  targetFloor: integer("target_floor").notNull(), // Floor where the robot wants to go
  priority: integer("priority").default(0), // Higher number means higher priority
  status: text("status").notNull().default("WAITING"), // 'WAITING', 'BOARDING', 'IN_TRANSIT', 'EXITING', 'COMPLETED', 'CANCELLED'
  requestedAt: timestamp("requested_at").defaultNow(),
  startedAt: timestamp("started_at"), // When robot entered the elevator
  completedAt: timestamp("completed_at"), // When robot exited at destination
});

// Elevator Maintenance Log
export const elevatorMaintenance = pgTable("elevator_maintenance", {
  id: serial("id").primaryKey(),
  elevatorId: integer("elevator_id").references(() => elevators.id).notNull(),
  maintenanceType: text("maintenance_type").notNull(), // 'SCHEDULED', 'EMERGENCY', 'INSPECTION'
  description: text("description").notNull(),
  technician: text("technician"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("SCHEDULED"), // 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
  notes: text("notes"),
});

// Floor Map Schemas
export const insertFloorMapSchema = createInsertSchema(floorMaps).pick({
  buildingId: true,
  floorNumber: true,
  name: true,
  mapData: true,
  navigationGraph: true,
  isActive: true,
});

// Elevator Schemas
export const insertElevatorSchema = createInsertSchema(elevators).pick({
  buildingId: true,
  name: true,
  status: true,
  currentFloor: true,
  targetFloor: true,
  maxCapacity: true,
  doorLocation: true,
  lastMaintenance: true,
});

// Elevator Queue Schemas
export const insertElevatorQueueSchema = createInsertSchema(elevatorQueue).pick({
  elevatorId: true,
  robotId: true,
  startFloor: true,
  targetFloor: true,
  priority: true,
  status: true,
});

// Elevator Maintenance Schemas
export const insertElevatorMaintenanceSchema = createInsertSchema(elevatorMaintenance).pick({
  elevatorId: true,
  maintenanceType: true,
  description: true,
  technician: true,
  startTime: true,
  endTime: true,
  status: true,
  notes: true,
});

export type InsertRobotTask = z.infer<typeof insertRobotTaskSchema>;
export type RobotTask = typeof robotTasks.$inferSelect;

export type InsertFloorMap = z.infer<typeof insertFloorMapSchema>;
export type FloorMap = typeof floorMaps.$inferSelect;

export type InsertElevator = z.infer<typeof insertElevatorSchema>;
export type Elevator = typeof elevators.$inferSelect;

export type InsertElevatorQueue = z.infer<typeof insertElevatorQueueSchema>;
export type ElevatorQueue = typeof elevatorQueue.$inferSelect;

export type InsertElevatorMaintenance = z.infer<typeof insertElevatorMaintenanceSchema>;
export type ElevatorMaintenance = typeof elevatorMaintenance.$inferSelect;
