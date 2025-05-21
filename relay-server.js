// relay-server.js

// Use CommonJS requires for compatibility
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const ROBOT_SERIAL = "L382502104987ir";
const ROBOT_IP = process.env.ROBOT_IP || "47.180.91.99";
const ROBOT_SECRET = process.env.ROBOT_SECRET || process.env.ROBOT_SECRET_KEY || "";
const ROBOT_WS = `ws://${ROBOT_IP}:8090/ws/v2`; // Updated WebSocket endpoint

const app = express();
const server = http.createServer(app);

// Create WebSocket server with proper error handling
const wss = new WebSocket.Server({ 
  server, 
  path: "/ws/pose",
  clientTracking: true
});

// Handle WebSocket server errors
wss.on('error', (error) => {
  console.error('[Relay] WebSocket server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.log('[Relay] WebSocket port is already in use, will use the HTTP server port');
  }
});

// Store active robot connections
const robotConnections = new Map();

wss.on("connection", (clientSocket) => {
  console.log("[Relay] Client connected");
  
  // Generate unique ID for this connection
  const connectionId = Date.now().toString();
  
  // Create robot WebSocket connection with proper authentication
  const robotSocket = new WebSocket(ROBOT_WS, {
    headers: {
      "x-api-key": ROBOT_SECRET
    }
  });

  // Store the connection
  robotConnections.set(connectionId, { clientSocket, robotSocket });

  // Handle robot WebSocket connection
  robotSocket.on("open", () => {
    console.log("[Relay] Connected to robot WebSocket");
    
    // Subscribe to required topics
    try {
      robotSocket.send(JSON.stringify({
        command: "enable_topics",
        topics: [
          "/tracked_pose",         // Robot position
          "/battery_state",        // Battery information
          "/wheel_state",          // Wheel status
          "/slam/state",           // SLAM status
          "/map",                  // Map data
          "/scan",                 // 2D LiDAR data
          "/scan_matched_points2", // 3D LiDAR point cloud
          "/lidar/scan"            // Alternative LiDAR path
        ]
      }));
      console.log("[Relay] Subscribed to robot topics");
    } catch (error) {
      console.error("[Relay] Error subscribing to topics:", error);
    }

    // Notify client of successful connection
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: 'Connected to robot WebSocket'
      }));
    }
  });

  // Handle messages from robot
  robotSocket.on("message", (data) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        // Parse the data to validate it
        const parsedData = JSON.parse(data.toString());
        
        // Forward the data to the client
        clientSocket.send(data);
      } catch (error) {
        console.error("[Relay] Error processing robot message:", error);
      }
    }
  });

  // Handle robot WebSocket errors
  robotSocket.on("error", (error) => {
    console.error("[Relay] Robot WebSocket error:", error);
    
    // Notify client of error
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'Robot connection error',
        error: error.message
      }));
    }
  });

  // Handle robot WebSocket closure
  robotSocket.on("close", (code, reason) => {
    console.log(`[Relay] Robot WebSocket closed: ${code} - ${reason}`);
    
    // Notify client of disconnection
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'connection',
        status: 'disconnected',
        code,
        reason: reason.toString()
      }));
    }
    
    // Clean up the connection
    robotConnections.delete(connectionId);
  });

  // Handle client disconnection
  clientSocket.on("close", () => {
    console.log("[Relay] Client disconnected");
    
    // Clean up robot connection
    const connection = robotConnections.get(connectionId);
    if (connection && connection.robotSocket.readyState === WebSocket.OPEN) {
      connection.robotSocket.close();
    }
    robotConnections.delete(connectionId);
  });

  // Handle client errors
  clientSocket.on("error", (error) => {
    console.error("[Relay] Client WebSocket error:", error);
  });
});

app.get("/", (req, res) => {
  res.send("Robot WebSocket Relay Server is running. Connect to /ws/pose for robot position data.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Relay] Server running on port ${PORT}`);
});