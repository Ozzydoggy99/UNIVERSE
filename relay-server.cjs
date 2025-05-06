// relay-server.cjs - CommonJS version for compatibility

const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const ROBOT_WS = "ws://47.180.91.99/websocket/robot/L382502104987ir/pose"; // Robot endpoint with public IP

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws/pose" });

wss.on("connection", (clientSocket) => {
  console.log("[Relay] Client connected");

  const robotSocket = new WebSocket(ROBOT_WS);

  robotSocket.on("open", () => {
    console.log("[Relay] Connected to robot WebSocket");
  });

  robotSocket.on("message", (data) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      console.log("[Relay] Forwarding robot data:", data.toString());
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