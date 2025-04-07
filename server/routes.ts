import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Default API configuration (can be overridden by authentication)
const DEFAULT_API_URL = process.env.VITE_AXBOT_API_URL || "https://api.axbot.com/v1";
let API_KEY = process.env.VITE_AXBOT_API_KEY || "";
let API_ENDPOINT = DEFAULT_API_URL;

export async function registerRoutes(app: Express): Promise<Server> {
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

  // API proxy endpoints
  // Robot Status
  app.get("/api/axbot/status", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to fetch robot status" });
    }
  });

  // Robot Position
  app.get("/api/axbot/position", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to fetch robot position" });
    }
  });

  // Robot Sensor Data
  app.get("/api/axbot/sensors", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to fetch sensor data" });
    }
  });

  // Map Data
  app.get("/api/axbot/map", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to fetch map data" });
    }
  });

  // Robot Control Endpoints
  // Start Robot
  app.post("/api/axbot/control/start", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to start robot" });
    }
  });

  // Stop Robot
  app.post("/api/axbot/control/stop", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to stop robot" });
    }
  });

  // Pause Robot
  app.post("/api/axbot/control/pause", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to pause robot" });
    }
  });

  // Home Robot
  app.post("/api/axbot/control/home", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to home robot" });
    }
  });

  // Calibrate Robot
  app.post("/api/axbot/control/calibrate", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to calibrate robot" });
    }
  });

  // Move Robot
  app.post("/api/axbot/control/move", async (req, res) => {
    try {
      const { direction, speed } = req.body;
      
      if (!direction) {
        return res.status(400).json({ message: "Direction is required" });
      }
      
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
      return res.status(500).json({ message: "Failed to move robot" });
    }
  });

  // Stop Movement
  app.post("/api/axbot/control/move/stop", async (req, res) => {
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
      return res.status(500).json({ message: "Failed to stop movement" });
    }
  });

  // Set Speed
  app.post("/api/axbot/control/speed", async (req, res) => {
    try {
      const { speed } = req.body;
      
      if (speed === undefined) {
        return res.status(400).json({ message: "Speed is required" });
      }
      
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
      return res.status(500).json({ message: "Failed to set speed" });
    }
  });

  // Send Custom Command
  app.post("/api/axbot/control/custom", async (req, res) => {
    try {
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }
      
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
      return res.status(500).json({ message: "Failed to send custom command" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
