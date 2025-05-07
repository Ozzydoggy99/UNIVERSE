// server/mission-routes.ts
import { Request, Response, Router } from "express";
import { runMission } from "./backend/mission-runner";
import { fetchRobotMapPoints } from './robot-points-api'; // Make sure this is already imported
import { RobotTaskRequest } from './types';

// Create a router for mission-related endpoints
export const missionRouter = Router();

/**
 * Endpoint to run a robot task
 * POST /api/robot-task
 * Body: { mode: "pickup" | "dropoff", shelfId: string }
 */
missionRouter.post("/robot-task", async (req: Request, res: Response) => {
  try {
    console.log('👉 Starting robot task with request:', req.body);
    const { mode, shelfId } = req.body;
    const uiMode = mode; // Convert to uiMode for task request
    
    // Validate request parameters
    if (!mode || !["pickup", "dropoff"].includes(mode)) {
      console.log('❌ Invalid mode:', mode);
      return res.status(400).json({ 
        success: false, 
        error: "Invalid mode. Must be 'pickup' or 'dropoff'." 
      });
    }
    
    if (!shelfId) {
      console.log('❌ Missing shelfId');
      return res.status(400).json({ 
        success: false, 
        error: "Missing shelfId parameter." 
      });
    }

    console.log('✓ Parameters validated, running mission with:', { mode, shelfId });
    
    // Run the mission
    await runMission({ uiMode: mode, shelfId });
    
    console.log('✅ Mission completed successfully');
    
    // Return success response
    res.json({ 
      success: true,
      message: `Mission ${mode} completed successfully for shelf ${shelfId}`
    });
  } catch (err: any) {
    console.error("❌ Error running robot task:", err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

/**
 * Endpoint to get mission status (placeholder for future implementation)
 * GET /api/robot-task/status
 */
missionRouter.get("/robot-task/status", async (req: Request, res: Response) => {
  // This could be expanded to return the current status of any active mission
  res.json({ 
    success: true,
    status: "No active mission" 
  });
});

/**
 * Direct mission endpoint with improved point handling
 * POST /api/
 * Body: { uiMode: "pickup" | "dropoff", shelfId: string }
 */
missionRouter.post('/', async (req, res) => {
  try {
    const { uiMode, shelfId } = req.body;
    console.log("📥 Received request:", { uiMode, shelfId });

    // ✅ Fetch fresh points from the robot here
    const points = await fetchRobotMapPoints();

    // ✅ Debug output to confirm data is coming through
    console.log("🧾 Points passed to mission-runner:", points.map(p => `"${p.id}"`).join(", "));

    const result = await runMission({ uiMode, shelfId }, points);
    res.json(result);
  } catch (err: any) {
    console.error("❌ Error running robot task:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint for mission API following the new suggested implementation
 * POST /api/mission
 * Body: { uiMode: "pickup" | "dropoff", shelfId: string }
 */
missionRouter.post("/api/mission", async (req, res) => {
  try {
    const { uiMode, shelfId } = req.body;

    if (!uiMode || !shelfId) {
      return res.status(400).json({ error: "Missing uiMode or shelfId" });
    }

    // Optional: fetch points ahead of time if needed
    const points = await fetchRobotMapPoints();

    const result = await runMission({ uiMode, shelfId }, points);
    res.json(result);
  } catch (err: any) {
    console.error("❌ Error launching mission:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// Export missionRouter through named export at the top of the file