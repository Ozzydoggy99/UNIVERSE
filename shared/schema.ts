import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
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

// Box Map Points - Maps box numbers to coordinates on the floor map
export const boxMapPoints = pgTable("box_map_points", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull(), // 'laundry' or 'trash'
  floor: integer("floor").notNull(),
  unitNumber: integer("unit_number").notNull(),
  xCoordinate: integer("x_coordinate").notNull(),
  yCoordinate: integer("y_coordinate").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
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

// Box Map Point Schemas
export const insertBoxMapPointSchema = createInsertSchema(boxMapPoints).pick({
  serviceType: true,
  floor: true,
  unitNumber: true,
  xCoordinate: true,
  yCoordinate: true,
  description: true,
  createdBy: true,
});

// Robot Status History Schemas
export const insertRobotStatusHistorySchema = createInsertSchema(robotStatusHistory);

// Sensor Reading Schemas
export const insertSensorReadingSchema = createInsertSchema(sensorReadings);

// Position History Schemas
export const insertPositionHistorySchema = createInsertSchema(positionHistory);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUITemplate = z.infer<typeof insertUITemplateSchema>;
export type UITemplate = typeof uiTemplates.$inferSelect;

export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type ApiConfig = typeof apiConfigs.$inferSelect;

export type InsertBoxMapPoint = z.infer<typeof insertBoxMapPointSchema>;
export type BoxMapPoint = typeof boxMapPoints.$inferSelect;

export type InsertRobotStatusHistory = z.infer<typeof insertRobotStatusHistorySchema>;
export type RobotStatusHistory = typeof robotStatusHistory.$inferSelect;

export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorReading = typeof sensorReadings.$inferSelect;

export type InsertPositionHistory = z.infer<typeof insertPositionHistorySchema>;
export type PositionHistory = typeof positionHistory.$inferSelect;
