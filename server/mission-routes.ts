// server/mission-routes.ts
import express from "express";
import { runMission } from "./backend/mission-runner";
import { fetchRobotMapPoints } from "./robot-points-api";
import { Point } from "./types";

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