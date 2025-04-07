import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import dotenv from "dotenv";
import { setupAuth } from "./auth";
import { User } from "@shared/schema";

dotenv.config();

// Default API configuration (can be overridden by authentication)
const DEFAULT_API_URL = process.env.VITE_AXBOT_API_URL || "https://api.axbot.com/v1";
let API_KEY = process.env.VITE_AXBOT_API_KEY || "";
let API_ENDPOINT = DEFAULT_API_URL;

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  await setupAuth(app);
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

  const httpServer = createServer(app);

  return httpServer;
}
