import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";
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

export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type GamePlayer = typeof gamePlayers.$inferSelect;

export type InsertGameItem = z.infer<typeof insertGameItemSchema>;
export type GameItem = typeof gameItems.$inferSelect;

export type InsertGameZombie = z.infer<typeof insertGameZombieSchema>;
export type GameZombie = typeof gameZombies.$inferSelect;
