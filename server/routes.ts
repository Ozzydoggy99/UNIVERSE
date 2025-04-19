import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import dotenv from "dotenv";
import { setupAuth } from "./auth";
import { registerAdminRoutes } from "./admin-routes"; 
import { registerRobotApiRoutes } from "./robot-api";
import { registerMockAssistantRoutes } from "./mock-assistant";
import { z } from "zod";
import { 
  User, 
  InsertGamePlayer, 
  InsertGameItem, 
  InsertGameZombie,
  InsertRobotTask,
  RobotTask,
  insertRobotTemplateAssignmentSchema,
  insertRobotTaskSchema
} from "../shared/schema";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

// Helper function to format Zod validation errors
function formatZodError(error: z.ZodError): string {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}

// Default API configuration (can be overridden by authentication)
const DEFAULT_API_URL = process.env.VITE_AXBOT_API_URL || "https://api.axbot.com/v1";
let API_KEY = process.env.VITE_AXBOT_API_KEY || "";
let API_ENDPOINT = DEFAULT_API_URL;

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  await setupAuth(app);
  
  // Register server-side admin routes
  registerAdminRoutes(app);
  
  // Register robot API routes
  registerRobotApiRoutes(app);
  
  // Register mock assistant routes for development
  registerMockAssistantRoutes(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates
  const wssRobotTasks = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/robot-tasks' 
  });
  
  // Task update broadcast function
  const broadcastTaskUpdate = (task: RobotTask) => {
    wssRobotTasks.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && (client as any).subscribed) {
        client.send(JSON.stringify({
          type: 'task_update',
          task
        }));
      }
    });
  };
  
  // Handle WebSocket connections for robot task updates
  wssRobotTasks.on('connection', (ws) => {
    console.log('WebSocket client connected to robot tasks');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received robot task message:', data);
        
        // Handle different message types
        if (data.type === 'subscribe') {
          // Client subscribing to updates
          (ws as any).subscribed = true;
          ws.send(JSON.stringify({ 
            type: 'subscribed', 
            message: 'Successfully subscribed to robot task updates' 
          }));
        }
      } catch (error) {
        console.error('WebSocket message error for robot tasks:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected from robot tasks');
    });
  });
  // Authentication endpoint
  app.post("/api/authenticate", async (req, res) => {
    try {
      const { apiKey, apiEndpoint } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }
      
      // Test the API connection with the provided key
      const testEndpoint = apiEndpoint || DEFAULT_API_URL;
      
      try {
        // Make a test request to verify the API key
        const response = await axios.get(`${testEndpoint}/status`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        });
        
        // If the request was successful, store the API key and endpoint
        API_KEY = apiKey;
        API_ENDPOINT = testEndpoint;
        
        // Store the configuration in the database (if remember is true)
        if (req.body.rememberConnection) {
          await storage.saveApiConfig(apiKey, testEndpoint);
        }
        
        return res.status(200).json({ message: "Authentication successful" });
      } catch (error) {
        console.error("API authentication error:", error);
        return res.status(401).json({ message: "Invalid API key or endpoint" });
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Fallback data for when the API is unavailable
  const FALLBACK_STATUS = {
    model: "AxBot 2000",
    serialNumber: "AX-2000-DEMO",
    battery: 85,
    status: "online",
    operationalStatus: "idle",
    uptime: "1d 4h 32m",
    messages: [
      { timestamp: new Date().toISOString(), text: "System running in demo mode" }
    ]
  };

  const FALLBACK_POSITION = {
    x: 120,
    y: 80,
    z: 0,
    orientation: 90,
    speed: 0,
    currentTask: "Waiting for commands",
    destination: { x: 120, y: 80, z: 0 },
    distanceToTarget: 0
  };

  const FALLBACK_SENSOR_DATA = {
    temperature: 23.5,
    humidity: 48,
    proximity: 100,
    light: 75,
    noise: 32
  };

  const FALLBACK_MAP_DATA = {
    grid: [],
    obstacles: [
      { x: 50, y: 50, z: 0 },
      { x: 150, y: 100, z: 0 }
    ],
    paths: [
      { 
        points: [
          { x: 10, y: 10, z: 0 },
          { x: 100, y: 100, z: 0 }
        ],
        status: "completed"
      }
    ]
  };

  // User endpoints
  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view all users" });
      }
      
      // Get all users from database
      const users = Array.from((await storage.getAllUsers()).values()).map(user => {
        // Don't return passwords
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Error fetching users" });
    }
  });
  
  // UI Template endpoints
  // Get all templates
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      return res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      return res.status(500).json({ message: "Error fetching templates" });
    }
  });
  
  // Get template by ID
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      return res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      return res.status(500).json({ message: "Error fetching template" });
    }
  });
  
  // Create template
  app.post("/api/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create templates" });
      }
      
      const newTemplate = await storage.createTemplate(req.body);
      return res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Error creating template:", error);
      return res.status(500).json({ message: "Error creating template" });
    }
  });
  
  // Update template
  app.put("/api/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update templates" });
      }
      
      const id = parseInt(req.params.id);
      const template = await storage.updateTemplate(id, req.body);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      return res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      return res.status(500).json({ message: "Error updating template" });
    }
  });
  
  // Delete template
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete templates" });
      }
      
      const id = parseInt(req.params.id);
      const success = await storage.deleteTemplate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      return res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting template:", error);
      return res.status(500).json({ message: "Error deleting template" });
    }
  });
  
  // Update user's template assignment
  app.put("/api/users/:id/template", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update user templates" });
      }
      
      const userId = parseInt(req.params.id);
      const { templateId } = req.body;
      
      if (templateId === undefined) {
        return res.status(400).json({ message: "Template ID is required" });
      }
      
      const user = await storage.updateUser(userId, { templateId });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json(user);
    } catch (error) {
      console.error("Error updating user's template:", error);
      return res.status(500).json({ message: "Error updating user's template" });
    }
  });
  
  // Robot Template Assignment endpoints
  // Get all robot template assignments
  app.get("/api/robot-assignments", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view robot template assignments" });
      }
      
      const assignments = await storage.getAllRobotTemplateAssignments();
      return res.json(assignments);
    } catch (error) {
      console.error("Error fetching robot assignments:", error);
      return res.status(500).json({ message: "Error fetching robot assignments" });
    }
  });
  
  // Get robot assignment by ID
  app.get("/api/robot-assignments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view robot template assignments" });
      }
      
      const id = parseInt(req.params.id);
      const assignment = await storage.getRobotTemplateAssignment(id);
      
      if (!assignment) {
        return res.status(404).json({ message: "Robot template assignment not found" });
      }
      
      return res.json(assignment);
    } catch (error) {
      console.error("Error fetching robot assignment:", error);
      return res.status(500).json({ message: "Error fetching robot assignment" });
    }
  });
  
  // Get robot assignment by serial number
  app.get("/api/robot-assignments/serial/:serialNumber", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view robot template assignments" });
      }
      
      const serialNumber = req.params.serialNumber;
      if (!serialNumber) {
        return res.status(400).json({ message: "Serial number is required" });
      }
      
      const assignment = await storage.getRobotTemplateAssignmentBySerial(serialNumber);
      if (!assignment) {
        return res.status(404).json({ message: "Robot template assignment not found" });
      }
      
      return res.json(assignment);
    } catch (error) {
      console.error("Error fetching robot assignment by serial:", error);
      return res.status(500).json({ message: "Error fetching robot assignment" });
    }
  });
  
  // Create robot template assignment
  app.post("/api/robot-assignments", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create robot template assignments" });
      }
      
      try {
        const assignmentData = insertRobotTemplateAssignmentSchema.parse(req.body);
        
        // Check if robot with this serial number already has an assignment
        const existingAssignment = await storage.getRobotTemplateAssignmentBySerial(assignmentData.serialNumber);
        if (existingAssignment) {
          return res.status(409).json({ message: "A robot with this serial number already has a template assigned" });
        }
        
        // Check if the template exists
        const template = await storage.getTemplate(assignmentData.templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
        
        const newAssignment = await storage.createRobotTemplateAssignment(assignmentData);
        return res.status(201).json(newAssignment);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: formatZodError(error) });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error creating robot assignment:", error);
      return res.status(500).json({ message: "Error creating robot template assignment" });
    }
  });
  
  // Update robot template assignment
  app.put("/api/robot-assignments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update robot template assignments" });
      }
      
      const id = parseInt(req.params.id);
      
      // Make sure the assignment exists
      const existingAssignment = await storage.getRobotTemplateAssignment(id);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Robot template assignment not found" });
      }
      
      try {
        // Validate and update
        const updateData = insertRobotTemplateAssignmentSchema.partial().parse(req.body);
        
        // If updating serialNumber, make sure it's not already used by another assignment
        if (updateData.serialNumber && updateData.serialNumber !== existingAssignment.serialNumber) {
          const serialExists = await storage.getRobotTemplateAssignmentBySerial(updateData.serialNumber);
          if (serialExists && serialExists.id !== id) {
            return res.status(409).json({ message: "A robot with this serial number already has a template assigned" });
          }
        }
        
        // If updating templateId, make sure the template exists
        if (updateData.templateId) {
          const template = await storage.getTemplate(updateData.templateId);
          if (!template) {
            return res.status(404).json({ message: "Template not found" });
          }
        }
        
        const updatedAssignment = await storage.updateRobotTemplateAssignment(id, updateData);
        return res.json(updatedAssignment);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: formatZodError(error) });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error updating robot assignment:", error);
      return res.status(500).json({ message: "Error updating robot template assignment" });
    }
  });
  
  // Delete robot template assignment
  app.delete("/api/robot-assignments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete robot template assignments" });
      }
      
      const id = parseInt(req.params.id);
      const result = await storage.deleteRobotTemplateAssignment(id);
      
      if (!result) {
        return res.status(404).json({ message: "Robot template assignment not found" });
      }
      
      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting robot assignment:", error);
      return res.status(500).json({ message: "Error deleting robot template assignment" });
    }
  });

  // Robot Task Queue endpoints
  // Get all tasks
  app.get("/api/robot-tasks", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can view all robot tasks" });
      }
      
      const tasks = await storage.getAllRobotTasks();
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching robot tasks:", error);
      return res.status(500).json({ message: "Error fetching robot tasks" });
    }
  });

  // Get pending tasks
  app.get("/api/robot-tasks/pending", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const tasks = await storage.getPendingRobotTasks();
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching pending tasks:", error);
      return res.status(500).json({ message: "Error fetching pending tasks" });
    }
  });

  // Get tasks for specific robot
  app.get("/api/robot-tasks/robot/:serialNumber", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const serialNumber = req.params.serialNumber;
      const tasks = await storage.getRobotTasksBySerialNumber(serialNumber);
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching robot tasks:", error);
      return res.status(500).json({ message: "Error fetching robot tasks" });
    }
  });

  // Get task by ID
  app.get("/api/robot-tasks/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const id = parseInt(req.params.id);
      const task = await storage.getRobotTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      return res.status(500).json({ message: "Error fetching task" });
    }
  });

  // Create task
  app.post("/api/robot-tasks", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      try {
        // Validate task data
        const validatedTaskData = insertRobotTaskSchema.parse(req.body);
        
        // Add the user ID who created the task
        const taskData = {
          ...validatedTaskData,
          createdBy: req.user.id
        };
        
        const newTask = await storage.createRobotTask(taskData);
        return res.status(201).json(newTask);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: formatZodError(error) });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error creating task:", error);
      return res.status(500).json({ message: "Error creating task" });
    }
  });

  // Update task
  app.put("/api/robot-tasks/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const id = parseInt(req.params.id);
      const task = await storage.getRobotTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only admin or the creator can update tasks
      if (req.user.role !== 'admin' && task.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You can only update tasks you created" });
      }
      
      const updatedTask = await storage.updateRobotTask(id, req.body);
      return res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      return res.status(500).json({ message: "Error updating task" });
    }
  });

  // Update task priority
  app.put("/api/robot-tasks/:id/priority", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const id = parseInt(req.params.id);
      const { priority } = req.body;
      
      if (priority === undefined || typeof priority !== 'number') {
        return res.status(400).json({ message: "Priority must be a number" });
      }
      
      const task = await storage.getRobotTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only admin or the creator can update task priority
      if (req.user.role !== 'admin' && task.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You can only update tasks you created" });
      }
      
      const updatedTask = await storage.updateTaskPriority(id, priority);
      return res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task priority:", error);
      return res.status(500).json({ message: "Error updating task priority" });
    }
  });

  // Cancel task
  app.put("/api/robot-tasks/:id/cancel", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const id = parseInt(req.params.id);
      const task = await storage.getRobotTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only admin or the creator can cancel tasks
      if (req.user.role !== 'admin' && task.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You can only cancel tasks you created" });
      }
      
      const cancelledTask = await storage.cancelRobotTask(id);
      return res.json(cancelledTask);
    } catch (error) {
      console.error("Error cancelling task:", error);
      return res.status(500).json({ message: "Error cancelling task" });
    }
  });

  // Complete task (usually called by the robot or admin)
  app.put("/api/robot-tasks/:id/complete", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can mark tasks as completed" });
      }
      
      const id = parseInt(req.params.id);
      const task = await storage.getRobotTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const completedTask = await storage.completeRobotTask(id);
      return res.json(completedTask);
    } catch (error) {
      console.error("Error completing task:", error);
      return res.status(500).json({ message: "Error completing task" });
    }
  });

  // Reorder tasks
  app.post("/api/robot-tasks/reorder", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can reorder tasks" });
      }
      
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array of task IDs" });
      }
      
      const success = await storage.reorderTasks(taskIds);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to reorder tasks" });
      }
      
      return res.json({ message: "Tasks reordered successfully" });
    } catch (error) {
      console.error("Error reordering tasks:", error);
      return res.status(500).json({ message: "Error reordering tasks" });
    }
  });

  // API proxy endpoints
  // Demo mode indicator
  const isDemoMode = !API_KEY || !API_ENDPOINT || API_KEY === '' || API_ENDPOINT === '';

  // Robot Status
  app.get("/api/axbot/status", async (req, res) => {
    // If in demo mode or missing credentials, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot status");
      await storage.saveRobotStatus(FALLBACK_STATUS);
      return res.json(FALLBACK_STATUS);
    }

    try {
      const response = await axios.get(`${API_ENDPOINT}/status`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      // Store the status in history
      await storage.saveRobotStatus(response.data);
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error fetching robot status:", error);
      
      // Return fallback data
      await storage.saveRobotStatus(FALLBACK_STATUS);
      return res.json(FALLBACK_STATUS);
    }
  });

  // Robot Position
  app.get("/api/axbot/position", async (req, res) => {
    // If in demo mode or missing credentials, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot position");
      await storage.saveRobotPosition(FALLBACK_POSITION);
      return res.json(FALLBACK_POSITION);
    }

    try {
      const response = await axios.get(`${API_ENDPOINT}/position`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      // Store the position in history
      await storage.saveRobotPosition(response.data);
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error fetching robot position:", error);
      
      // Return fallback data
      await storage.saveRobotPosition(FALLBACK_POSITION);
      return res.json(FALLBACK_POSITION);
    }
  });

  // Robot Sensor Data
  app.get("/api/axbot/sensors", async (req, res) => {
    // If in demo mode or missing credentials, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot sensors");
      await storage.saveSensorReading(FALLBACK_SENSOR_DATA);
      return res.json(FALLBACK_SENSOR_DATA);
    }

    try {
      const response = await axios.get(`${API_ENDPOINT}/sensors`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      // Store the sensor data in history
      await storage.saveSensorReading(response.data);
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error fetching sensor data:", error);
      
      // Return fallback data
      await storage.saveSensorReading(FALLBACK_SENSOR_DATA);
      return res.json(FALLBACK_SENSOR_DATA);
    }
  });

  // Map Data
  app.get("/api/axbot/map", async (req, res) => {
    // If in demo mode or missing credentials, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for map data");
      return res.json(FALLBACK_MAP_DATA);
    }

    try {
      const response = await axios.get(`${API_ENDPOINT}/map`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error fetching map data:", error);
      
      // Return fallback data
      return res.json(FALLBACK_MAP_DATA);
    }
  });

  // Robot Control Endpoints
  // Fallback success response for control operations
  const FALLBACK_CONTROL_RESPONSE = {
    success: true,
    message: "Command processed successfully (Demo Mode)"
  };

  // Start Robot
  app.post("/api/axbot/control/start", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot start command");
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/start`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error starting robot:", error);
      // Return fallback data
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }
  });

  // Stop Robot
  app.post("/api/axbot/control/stop", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot stop command");
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/stop`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error stopping robot:", error);
      // Return fallback data
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }
  });

  // Pause Robot
  app.post("/api/axbot/control/pause", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot pause command");
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/pause`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error pausing robot:", error);
      // Return fallback data
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }
  });

  // Home Robot
  app.post("/api/axbot/control/home", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot home command");
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/home`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error homing robot:", error);
      // Return fallback data
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }
  });

  // Calibrate Robot
  app.post("/api/axbot/control/calibrate", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot calibrate command");
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/calibrate`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error calibrating robot:", error);
      // Return fallback data
      return res.json(FALLBACK_CONTROL_RESPONSE);
    }
  });

  // Move Robot
  app.post("/api/axbot/control/move", async (req, res) => {
    const { direction, speed } = req.body;
    
    if (!direction) {
      return res.status(400).json({ message: "Direction is required" });
    }
    
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log(`Using demo mode for robot move command: ${direction}`);
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Moving ${direction} (Demo Mode)`
      });
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/move`, {
        direction,
        speed: speed || 50
      }, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error moving robot:", error);
      // Return fallback data with direction information
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Moving ${direction} (Demo Mode)`
      });
    }
  });

  // Stop Movement
  app.post("/api/axbot/control/move/stop", async (req, res) => {
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log("Using demo mode for robot stop movement command");
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: "Movement stopped (Demo Mode)"
      });
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/move/stop`, {}, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error stopping movement:", error);
      // Return fallback data
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: "Movement stopped (Demo Mode)"
      });
    }
  });

  // Set Speed
  app.post("/api/axbot/control/speed", async (req, res) => {
    const { speed } = req.body;
    
    if (speed === undefined) {
      return res.status(400).json({ message: "Speed is required" });
    }
    
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log(`Using demo mode for robot set speed command: ${speed}`);
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Speed set to ${speed} (Demo Mode)`
      });
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/speed`, {
        speed
      }, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error setting speed:", error);
      // Return fallback data with speed information
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Speed set to ${speed} (Demo Mode)`
      });
    }
  });

  // Send Custom Command
  app.post("/api/axbot/control/custom", async (req, res) => {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ message: "Command is required" });
    }
    
    // If in demo mode, immediately return fallback data
    if (isDemoMode) {
      console.log(`Using demo mode for robot custom command: ${command}`);
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Custom command '${command}' executed (Demo Mode)`
      });
    }

    try {
      const response = await axios.post(`${API_ENDPOINT}/control/custom`, {
        command
      }, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      
      return res.json(response.data);
    } catch (error) {
      console.error("Error sending custom command:", error);
      // Return fallback data with command information
      return res.json({
        ...FALLBACK_CONTROL_RESPONSE,
        message: `Custom command '${command}' executed (Demo Mode)`
      });
    }
  });

  // Game API Endpoints

  // Game Players
  app.get("/api/game/players", async (req, res) => {
    try {
      const players = await storage.getAllGamePlayers();
      return res.json(players);
    } catch (error) {
      console.error("Error fetching game players:", error);
      return res.status(500).json({ message: "Error fetching game players" });
    }
  });

  app.get("/api/game/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const player = await storage.getGamePlayer(id);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      return res.json(player);
    } catch (error) {
      console.error("Error fetching game player:", error);
      return res.status(500).json({ message: "Error fetching game player" });
    }
  });

  app.post("/api/game/players", async (req, res) => {
    try {
      const playerData: InsertGamePlayer = req.body;
      
      if (!playerData.userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const newPlayer = await storage.createGamePlayer(playerData);
      return res.status(201).json(newPlayer);
    } catch (error) {
      console.error("Error creating game player:", error);
      return res.status(500).json({ message: "Error creating game player" });
    }
  });

  app.put("/api/game/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const player = await storage.updateGamePlayer(id, updates);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      return res.json(player);
    } catch (error) {
      console.error("Error updating game player:", error);
      return res.status(500).json({ message: "Error updating game player" });
    }
  });

  // Game Items
  app.get("/api/game/items", async (req, res) => {
    try {
      const items = await storage.getAllGameItems();
      return res.json(items);
    } catch (error) {
      console.error("Error fetching game items:", error);
      return res.status(500).json({ message: "Error fetching game items" });
    }
  });

  app.get("/api/game/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getGameItem(id);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      return res.json(item);
    } catch (error) {
      console.error("Error fetching game item:", error);
      return res.status(500).json({ message: "Error fetching game item" });
    }
  });

  app.post("/api/game/items", async (req, res) => {
    try {
      const itemData: InsertGameItem = req.body;
      
      if (!itemData.name || !itemData.type) {
        return res.status(400).json({ message: "Name and type are required for items" });
      }
      
      const newItem = await storage.createGameItem(itemData);
      return res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating game item:", error);
      return res.status(500).json({ message: "Error creating game item" });
    }
  });

  // Game Zombies
  app.get("/api/game/zombies", async (req, res) => {
    try {
      const zombies = await storage.getAllGameZombies();
      return res.json(zombies);
    } catch (error) {
      console.error("Error fetching game zombies:", error);
      return res.status(500).json({ message: "Error fetching game zombies" });
    }
  });

  app.get("/api/game/zombies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const zombie = await storage.getGameZombie(id);
      
      if (!zombie) {
        return res.status(404).json({ message: "Zombie not found" });
      }
      
      return res.json(zombie);
    } catch (error) {
      console.error("Error fetching game zombie:", error);
      return res.status(500).json({ message: "Error fetching game zombie" });
    }
  });

  app.post("/api/game/zombies", async (req, res) => {
    try {
      const zombieData: InsertGameZombie = req.body;
      
      if (zombieData.x === undefined || zombieData.y === undefined) {
        return res.status(400).json({ message: "Zombie position (x, y) is required" });
      }
      
      const newZombie = await storage.createGameZombie(zombieData);
      return res.status(201).json(newZombie);
    } catch (error) {
      console.error("Error creating game zombie:", error);
      return res.status(500).json({ message: "Error creating game zombie" });
    }
  });

  app.put("/api/game/zombies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const zombie = await storage.updateGameZombie(id, updates);
      
      if (!zombie) {
        return res.status(404).json({ message: "Zombie not found" });
      }
      
      return res.json(zombie);
    } catch (error) {
      console.error("Error updating game zombie:", error);
      return res.status(500).json({ message: "Error updating game zombie" });
    }
  });

  app.delete("/api/game/zombies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.removeGameZombie(id);
      
      if (!success) {
        return res.status(404).json({ message: "Zombie not found" });
      }
      
      return res.json({ message: "Zombie removed successfully" });
    } catch (error) {
      console.error("Error removing game zombie:", error);
      return res.status(500).json({ message: "Error removing game zombie" });
    }
  });

  // Set up WebSocket server for real-time game updates with a specific path
  // Using a specific path to avoid conflicts with Vite's WebSocket server
  const wssGame = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/game'
  });
  
  wssGame.on('connection', (ws) => {
    console.log('New WebSocket game client connected');
    
    // Send initial game state
    const sendGameState = async () => {
      try {
        const players = await storage.getAllGamePlayers();
        const zombies = await storage.getAllGameZombies();
        const items = await storage.getAllGameItems();
        
        const gameState = {
          type: 'game_state',
          data: {
            players,
            zombies,
            items
          }
        };
        
        ws.send(JSON.stringify(gameState));
      } catch (error) {
        console.error('Error sending game state:', error);
      }
    };
    
    // Send initial state
    sendGameState();
    
    // Handle incoming messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'player_update') {
          // Update player position
          if (data.playerId && (data.x !== undefined || data.y !== undefined)) {
            const player = await storage.getGamePlayer(data.playerId);
            
            if (player) {
              const updates: any = {};
              
              if (data.x !== undefined) updates.x = data.x;
              if (data.y !== undefined) updates.y = data.y;
              if (data.direction !== undefined) updates.direction = data.direction;
              if (data.health !== undefined) updates.health = data.health;
              
              const updatedPlayer = await storage.updateGamePlayer(data.playerId, updates);
              
              // Broadcast the update to all clients
              wssGame.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'player_updated',
                    data: updatedPlayer
                  }));
                }
              });
            }
          }
        } else if (data.type === 'zombie_update') {
          // Update zombie position
          if (data.zombieId && (data.x !== undefined || data.y !== undefined)) {
            const zombie = await storage.getGameZombie(data.zombieId);
            
            if (zombie) {
              const updates: any = {};
              
              if (data.x !== undefined) updates.x = data.x;
              if (data.y !== undefined) updates.y = data.y;
              if (data.health !== undefined) updates.health = data.health;
              
              const updatedZombie = await storage.updateGameZombie(data.zombieId, updates);
              
              // Broadcast the update to all clients
              wss.clients.forEach((client) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                  client.send(JSON.stringify({
                    type: 'zombie_updated',
                    data: updatedZombie
                  }));
                }
              });
            }
          }
        } else if (data.type === 'player_attack') {
          // Handle player attacking zombies
          if (data.playerId && data.zombieId) {
            const zombie = await storage.getGameZombie(data.zombieId);
            
            if (zombie) {
              // Reduce zombie health
              const newHealth = (zombie.health || 100) - (data.damage || 10);
              
              if (newHealth <= 0) {
                // Zombie is defeated
                await storage.removeGameZombie(data.zombieId);
                
                // Broadcast zombie defeat
                wssGame.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'zombie_defeated',
                      data: { zombieId: data.zombieId, killedBy: data.playerId }
                    }));
                  }
                });
              } else {
                // Update zombie health
                const updatedZombie = await storage.updateGameZombie(data.zombieId, { health: newHealth });
                
                // Broadcast the update
                wssGame.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'zombie_damaged',
                      data: updatedZombie
                    }));
                  }
                });
              }
            }
          }
        } else if (data.type === 'spawn_zombie') {
          // Handle spawning a new zombie
          if (data.x !== undefined && data.y !== undefined) {
            const newZombie = await storage.createGameZombie({
              x: data.x,
              y: data.y,
              health: data.health || 100,
              speed: data.speed || 1,
              damage: data.damage || 10,
              type: data.type || 'standard'
            });
            
            // Broadcast new zombie
            wssGame.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'zombie_spawned',
                  data: newZombie
                }));
              }
            });
          }
        }
        
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnections
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return httpServer;
}
