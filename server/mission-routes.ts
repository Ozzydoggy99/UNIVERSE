// server/mission-routes.ts
import express from "express";
import axios from "axios";
import { runMission } from "./backend/mission-runner";
import { fetchRobotMapPoints } from "./robot-points-api";
import { Point } from "./types";
import { ROBOT_API_URL, ROBOT_SECRET } from "./robot-constants";

export const missionRouter = express.Router();

// Endpoint for retrieving map points for mission execution
missionRouter.get('/mission-points', async (req, res) => {
  try {
    const points = await fetchRobotMapPoints();
    
    // Group points by floor ID for the frontend to display
    const pointsByFloor: Record<string, Point[]> = {};
    points.forEach(point => {
      const floorId = point.floorId || '1';
      if (!pointsByFloor[floorId]) {
        pointsByFloor[floorId] = [];
      }
      pointsByFloor[floorId].push(point);
    });

    return res.json({ pointsByFloor });
  } catch (err: any) {
    console.error("❌ Error fetching points:", err.message);
    return res.status(500).json({ 
      error: "Failed to fetch map points", 
      details: err.message 
    });
  }
});

// Endpoint for running a mission
missionRouter.post('/mission', async (req, res) => {
  try {
    const { shelfId, uiMode } = req.body;

    if (!shelfId || !uiMode) {
      return res.status(400).json({ error: "Missing shelfId or uiMode" });
    }

    const points = await fetchRobotMapPoints(); // always fetch fresh points

    const result = await runMission({ shelfId, uiMode, points });

    res.json(result);
  } catch (err: any) {
    console.error("❌ Mission error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for sending robot to charging station
missionRouter.post('/go-home', async (req, res) => {
  try {
    const points = await fetchRobotMapPoints();
    const chargingPoint = points.find(p => p.id.toLowerCase() === "charging station");

    if (!chargingPoint) {
      return res.status(404).json({ error: "Charging Station point not found" });
    }

    const headers = { "x-api-key": ROBOT_SECRET };
    const moveRes = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      action: "move_to",
      target_x: chargingPoint.x,
      target_y: chargingPoint.y
    }, { headers });

    return res.json({ success: true, moveId: moveRes.data?.id });
  } catch (err: any) {
    console.error("❌ Go home error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});