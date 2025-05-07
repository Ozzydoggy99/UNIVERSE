// server/mission-routes.ts
import { Request, Response, Router } from "express";
import { runMission } from "./backend/mission-runner";
import { fetchRobotMapPoints } from "./robot-points-api";
import { RobotTaskRequest } from "./types";

export const missionRouter = Router();

// Endpoint for retrieving map points for mission execution
missionRouter.get('/mission-points', async (req: Request, res: Response) => {
  try {
    const points = await fetchRobotMapPoints();
    
    // Group points by floor ID for the frontend to display
    const pointsByFloor: Record<string, any[]> = {};
    points.forEach(point => {
      const floorId = point.floorId || '1';
      if (!pointsByFloor[floorId]) {
        pointsByFloor[floorId] = [];
      }
      pointsByFloor[floorId].push(point);
    });

    return res.json({ pointsByFloor });
  } catch (error: any) {
    console.error("❌ Error fetching points:", error);
    return res.status(500).json({ 
      error: "Failed to fetch map points", 
      details: error.message 
    });
  }
});

// Endpoint for running a mission
missionRouter.post('/mission', async (req: Request, res: Response) => {
  try {
    const { uiMode, shelfId } = req.body;
    
    if (!uiMode || !shelfId) {
      return res.status(400).json({ error: "Missing required parameters: uiMode and shelfId" });
    }

    console.log(`📢 Received mission request - Mode: ${uiMode}, Shelf ID: ${shelfId}`);
    
    // Fetch points to use for the mission
    const points = await fetchRobotMapPoints();
    
    // Log the available points to help diagnose any issues
    console.log("🧾 Available points for mission:", points.map(p => `"${p.id}"`).join(", "));
    
    // Execute the mission with the fetched points
    const result = await runMission({ uiMode, shelfId, points });
    
    return res.json({ 
      success: true, 
      message: `Mission started for ${uiMode} mode to shelf ${shelfId}`,
      result 
    });
  } catch (error: any) {
    console.error("🚨 Error executing mission:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to execute mission" 
    });
  }
});