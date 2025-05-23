"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertElevatorMaintenanceSchema = exports.insertElevatorQueueSchema = exports.insertElevatorSchema = exports.insertFloorMapSchema = exports.elevatorMaintenance = exports.elevatorQueue = exports.elevators = exports.floorMaps = exports.insertRobotCredentialsSchema = exports.insertGameZombieSchema = exports.insertGameItemSchema = exports.insertGamePlayerSchema = exports.insertRobotTemplateAssignmentSchema = exports.insertRobotTaskSchema = exports.insertPositionHistorySchema = exports.insertSensorReadingSchema = exports.insertRobotStatusHistorySchema = exports.insertApiConfigSchema = exports.insertUITemplateSchema = exports.insertUserSchema = exports.robotCredentials = exports.robotTasks = exports.positionHistory = exports.sensorReadings = exports.robotStatusHistory = exports.apiConfigs = exports.uiTemplates = exports.gameZombies = exports.gameItems = exports.gamePlayers = exports.robotTemplateAssignments = exports.users = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_zod_1 = require("drizzle-zod");
// Users for authentication
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    role: (0, pg_core_1.text)("role").notNull().default("user"), // 'user' or 'admin'
    templateId: (0, pg_core_1.integer)("template_id"), // Reference to the user's template
});
// Robot Template Assignments
exports.robotTemplateAssignments = (0, pg_core_1.pgTable)("robot_template_assignments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serialNumber: (0, pg_core_1.text)("serial_number").notNull().unique(),
    templateId: (0, pg_core_1.integer)("template_id").notNull(),
    name: (0, pg_core_1.text)("name"), // Robot name
    location: (0, pg_core_1.text)("location"), // Where the robot is located
    robotName: (0, pg_core_1.text)("robot_name"), // Legacy field
    robotModel: (0, pg_core_1.text)("robot_model"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Game players
exports.gamePlayers = (0, pg_core_1.pgTable)("game_players", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(function () { return exports.users.id; }),
    username: (0, pg_core_1.text)("username").notNull(),
    health: (0, pg_core_1.integer)("health").default(100),
    hunger: (0, pg_core_1.integer)("hunger").default(0),
    thirst: (0, pg_core_1.integer)("thirst").default(0),
    lastX: (0, pg_core_1.real)("last_x").default(0),
    lastY: (0, pg_core_1.real)("last_y").default(0),
    inventory: (0, pg_core_1.text)("inventory").default("[]"), // JSON string of inventory items
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    lastActive: (0, pg_core_1.timestamp)("last_active").defaultNow(),
});
// Game items
exports.gameItems = (0, pg_core_1.pgTable)("game_items", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // weapon, food, medicine, tool, etc.
    description: (0, pg_core_1.text)("description"),
    properties: (0, pg_core_1.text)("properties").notNull(), // JSON string of item properties
    imageKey: (0, pg_core_1.text)("image_key"), // Phaser texture key
});
// Game zombies
exports.gameZombies = (0, pg_core_1.pgTable)("game_zombies", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    type: (0, pg_core_1.text)("type").notNull(), // normal, runner, tank, etc.
    health: (0, pg_core_1.integer)("health").default(100),
    damage: (0, pg_core_1.integer)("damage").default(10),
    speed: (0, pg_core_1.real)("speed").default(1.0),
    x: (0, pg_core_1.real)("x").notNull(),
    y: (0, pg_core_1.real)("y").notNull(),
    spawnTime: (0, pg_core_1.timestamp)("spawn_time").defaultNow(),
});
// UI Templates
exports.uiTemplates = (0, pg_core_1.pgTable)("ui_templates", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    layout: (0, pg_core_1.text)("layout").notNull(), // Stores the UI layout as a JSON string
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    createdBy: (0, pg_core_1.integer)("created_by").references(function () { return exports.users.id; }),
});
// API Configuration
exports.apiConfigs = (0, pg_core_1.pgTable)("api_configs", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").references(function () { return exports.users.id; }),
    apiEndpoint: (0, pg_core_1.text)("api_endpoint").notNull(),
    apiKey: (0, pg_core_1.text)("api_key").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Robot Status History
exports.robotStatusHistory = (0, pg_core_1.pgTable)("robot_status_history", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    robotId: (0, pg_core_1.text)("robot_id").notNull(),
    status: (0, pg_core_1.text)("status").notNull(),
    battery: (0, pg_core_1.integer)("battery"),
    model: (0, pg_core_1.text)("model"),
    serialNumber: (0, pg_core_1.text)("serial_number"),
    operationalStatus: (0, pg_core_1.text)("operational_status"),
    uptime: (0, pg_core_1.text)("uptime"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
// Robot Sensor Readings
exports.sensorReadings = (0, pg_core_1.pgTable)("sensor_readings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    robotId: (0, pg_core_1.text)("robot_id").notNull(),
    temperature: (0, pg_core_1.integer)("temperature"),
    humidity: (0, pg_core_1.integer)("humidity"),
    proximity: (0, pg_core_1.integer)("proximity"),
    light: (0, pg_core_1.integer)("light"),
    noise: (0, pg_core_1.integer)("noise"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
// Robot Position History
exports.positionHistory = (0, pg_core_1.pgTable)("position_history", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    robotId: (0, pg_core_1.text)("robot_id").notNull(),
    x: (0, pg_core_1.integer)("x").notNull(),
    y: (0, pg_core_1.integer)("y").notNull(),
    z: (0, pg_core_1.integer)("z").notNull(),
    orientation: (0, pg_core_1.integer)("orientation"),
    speed: (0, pg_core_1.integer)("speed"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
});
// Robot Task Queue
exports.robotTasks = (0, pg_core_1.pgTable)("robot_tasks", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serialNumber: (0, pg_core_1.text)("serial_number").notNull(), // The robot assigned to this task
    templateId: (0, pg_core_1.integer)("template_id"), // The template this task is associated with
    title: (0, pg_core_1.text)("title").notNull(), // Short title for the task
    description: (0, pg_core_1.text)("description"), // Detailed description of the task
    taskType: (0, pg_core_1.text)("task_type").notNull(), // E.g., 'PICKUP', 'DELIVERY', 'CLEANING', 'PATROL'
    priority: (0, pg_core_1.integer)("priority").default(0), // Higher number means higher priority
    status: (0, pg_core_1.text)("status").notNull().default("PENDING"), // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'
    location: (0, pg_core_1.text)("location"), // String representation of task location (e.g., "Room 101")
    targetX: (0, pg_core_1.integer)("target_x"), // Target X coordinate (if applicable)
    targetY: (0, pg_core_1.integer)("target_y"), // Target Y coordinate (if applicable)
    targetZ: (0, pg_core_1.integer)("target_z"), // Target Z coordinate (if applicable)
    parameters: (0, pg_core_1.text)("parameters"), // JSON string of additional parameters (e.g. items to deliver)
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    startedAt: (0, pg_core_1.timestamp)("started_at"), // When the task was started
    completedAt: (0, pg_core_1.timestamp)("completed_at"), // When the task was completed
    createdBy: (0, pg_core_1.integer)("created_by").references(function () { return exports.users.id; }), // User who created the task
});
// Robot Credentials
exports.robotCredentials = (0, pg_core_1.pgTable)("robot_credentials", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serialNumber: (0, pg_core_1.text)("serial_number").notNull().unique(),
    ipAddress: (0, pg_core_1.text)("ip_address").notNull(),
    port: (0, pg_core_1.integer)("port").default(8090),
    secret: (0, pg_core_1.text)("secret").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// User Schemas
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).pick({
    username: true,
    password: true,
    role: true,
    templateId: true,
});
// Template Schemas
exports.insertUITemplateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.uiTemplates).pick({
    name: true,
    description: true,
    layout: true,
    isActive: true,
    createdBy: true,
});
// API Config Schemas
exports.insertApiConfigSchema = (0, drizzle_zod_1.createInsertSchema)(exports.apiConfigs).pick({
    userId: true,
    apiEndpoint: true,
    apiKey: true,
    isActive: true,
});
// Robot Status History Schemas
exports.insertRobotStatusHistorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.robotStatusHistory);
// Sensor Reading Schemas
exports.insertSensorReadingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.sensorReadings);
// Position History Schemas
exports.insertPositionHistorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.positionHistory);
// Robot Task Schemas
exports.insertRobotTaskSchema = (0, drizzle_zod_1.createInsertSchema)(exports.robotTasks).pick({
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
exports.insertRobotTemplateAssignmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.robotTemplateAssignments).pick({
    serialNumber: true,
    templateId: true,
    name: true,
    location: true,
    robotName: true,
    robotModel: true,
    isActive: true,
});
// Game Player Schemas
exports.insertGamePlayerSchema = (0, drizzle_zod_1.createInsertSchema)(exports.gamePlayers).pick({
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
exports.insertGameItemSchema = (0, drizzle_zod_1.createInsertSchema)(exports.gameItems).pick({
    name: true,
    type: true,
    description: true,
    properties: true,
    imageKey: true,
});
// Game Zombie Schemas
exports.insertGameZombieSchema = (0, drizzle_zod_1.createInsertSchema)(exports.gameZombies).pick({
    type: true,
    health: true,
    damage: true,
    speed: true,
    x: true,
    y: true,
});
// Robot Credentials Schema
exports.insertRobotCredentialsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.robotCredentials).pick({
    serialNumber: true,
    ipAddress: true,
    port: true,
    secret: true,
    isActive: true,
});
// Building Floor Maps
exports.floorMaps = (0, pg_core_1.pgTable)("floor_maps", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    buildingId: (0, pg_core_1.integer)("building_id").notNull(), // For buildings with multiple maps
    floorNumber: (0, pg_core_1.integer)("floor_number").notNull(), // Floor number (e.g., 1, 2, 3, -1 for basement)
    name: (0, pg_core_1.text)("name").notNull(), // Name of the floor (e.g., "Ground Floor", "Basement")
    mapData: (0, pg_core_1.text)("map_data").notNull(), // JSON string containing map grid data, obstacles, etc.
    navigationGraph: (0, pg_core_1.text)("navigation_graph"), // JSON string of navigation nodes and paths
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
});
// Elevators
exports.elevators = (0, pg_core_1.pgTable)("elevators", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    buildingId: (0, pg_core_1.integer)("building_id").notNull(), // Building identifier
    name: (0, pg_core_1.text)("name").notNull(), // Name/identifier for the elevator (e.g., "North Elevator")
    status: (0, pg_core_1.text)("status").notNull().default("OPERATIONAL"), // 'OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE'
    currentFloor: (0, pg_core_1.integer)("current_floor"), // Current floor where the elevator is located
    targetFloor: (0, pg_core_1.integer)("target_floor"), // Floor the elevator is heading to (if moving)
    maxCapacity: (0, pg_core_1.integer)("max_capacity").default(1), // Maximum number of robots that can be in the elevator at once
    doorLocation: (0, pg_core_1.text)("door_location").notNull(), // JSON string with entrance coordinates on each floor
    lastMaintenance: (0, pg_core_1.timestamp)("last_maintenance"), // When the elevator was last maintained
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Elevator Queue (for managing robot access to elevators)
exports.elevatorQueue = (0, pg_core_1.pgTable)("elevator_queue", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    elevatorId: (0, pg_core_1.integer)("elevator_id").references(function () { return exports.elevators.id; }).notNull(),
    robotId: (0, pg_core_1.text)("robot_id").notNull(), // Serial number of the robot requesting elevator
    startFloor: (0, pg_core_1.integer)("start_floor").notNull(), // Floor where the robot is located
    targetFloor: (0, pg_core_1.integer)("target_floor").notNull(), // Floor where the robot wants to go
    priority: (0, pg_core_1.integer)("priority").default(0), // Higher number means higher priority
    status: (0, pg_core_1.text)("status").notNull().default("WAITING"), // 'WAITING', 'BOARDING', 'IN_TRANSIT', 'EXITING', 'COMPLETED', 'CANCELLED'
    requestedAt: (0, pg_core_1.timestamp)("requested_at").defaultNow(),
    startedAt: (0, pg_core_1.timestamp)("started_at"), // When robot entered the elevator
    completedAt: (0, pg_core_1.timestamp)("completed_at"), // When robot exited at destination
});
// Elevator Maintenance Log
exports.elevatorMaintenance = (0, pg_core_1.pgTable)("elevator_maintenance", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    elevatorId: (0, pg_core_1.integer)("elevator_id").references(function () { return exports.elevators.id; }).notNull(),
    maintenanceType: (0, pg_core_1.text)("maintenance_type").notNull(), // 'SCHEDULED', 'EMERGENCY', 'INSPECTION'
    description: (0, pg_core_1.text)("description").notNull(),
    technician: (0, pg_core_1.text)("technician"),
    startTime: (0, pg_core_1.timestamp)("start_time").notNull(),
    endTime: (0, pg_core_1.timestamp)("end_time"),
    status: (0, pg_core_1.text)("status").notNull().default("SCHEDULED"), // 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    notes: (0, pg_core_1.text)("notes"),
});
// Floor Map Schemas
exports.insertFloorMapSchema = (0, drizzle_zod_1.createInsertSchema)(exports.floorMaps).pick({
    buildingId: true,
    floorNumber: true,
    name: true,
    mapData: true,
    navigationGraph: true,
    isActive: true,
});
// Elevator Schemas
exports.insertElevatorSchema = (0, drizzle_zod_1.createInsertSchema)(exports.elevators).pick({
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
exports.insertElevatorQueueSchema = (0, drizzle_zod_1.createInsertSchema)(exports.elevatorQueue).pick({
    elevatorId: true,
    robotId: true,
    startFloor: true,
    targetFloor: true,
    priority: true,
    status: true,
});
// Elevator Maintenance Schemas
exports.insertElevatorMaintenanceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.elevatorMaintenance).pick({
    elevatorId: true,
    maintenanceType: true,
    description: true,
    technician: true,
    startTime: true,
    endTime: true,
    status: true,
    notes: true,
});
