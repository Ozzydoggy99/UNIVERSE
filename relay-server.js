// relay-server.js

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const ROBOT_SERIAL = "L382502104987ir";
const ROBOT_IP = process.env.ROBOT_IP || "47.180.91.99";
const ROBOT_SECRET = process.env.ROBOT_SECRET || process.env.ROBOT_SECRET_KEY || "";
// Based on error messages, the correct endpoint might be just '/ws' instead of '/ws/v2/topics'
const ROBOT_WS = `ws://${ROBOT_IP}:8090/ws`; // Updated WebSocket endpoint

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws/pose" });

wss.on("connection", (clientSocket) => {
  console.log("[Relay] Client connected");

  // Use consistent authentication method with x-api-key header
  const robotSocket = new WebSocket(ROBOT_WS, {
    headers: {
      "x-api-key": ROBOT_SECRET
    }
  });

  robotSocket.on("open", () => {
    console.log("[Relay] Connected to robot WebSocket");
    // Subscribe to tracked pose topic
    robotSocket.send(JSON.stringify({
      command: "enable_topics",
      topics: ["/tracked_pose", "/battery_state", "/wheel_state", "/slam/state"]
    }));
    console.log("[Relay] Subscribed to essential robot topics");
  });

  robotSocket.on("message", (data) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      console.log("[Relay] Forwarding robot data:", data.toString().substring(0, 100) + "...");
      clientSocket.send(data);
    }
  });

  robotSocket.on("error", (err) => {
    console.error("[Relay] Robot WebSocket error:", err);
  });

  robotSocket.on("close", () => {
    console.log("[Relay] Robot WebSocket closed");
  });

  clientSocket.on("close", () => {
    console.log("[Relay] Client disconnected");
    robotSocket.close();
  });
});

app.get("/", (req, res) => {
  res.send("Robot WebSocket Relay Server is running. Connect to /ws/pose for robot position data.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
});