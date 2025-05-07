// server/mission-routes.ts
import { Request, Response, Router } from "express";
import { runMission } from "./backend/mission-runner";

// Define the interface for the request body
interface RobotTaskRequest {
  mode: "pickup" | "dropoff";
  shelfId: string;
}

// Create a router for mission-related endpoints
const missionRouter = Router();

/**
 * Endpoint to run a robot task
 * POST /api/mission
 * Body: { uiMode: "pickup" | "dropoff", shelfId: string }
 */
missionRouter.post("/mission", async (req: Request, res: Response) => {
  try {
    console.log('👉 Starting robot task with request:', req.body);
    const { uiMode, shelfId } = req.body;
    
    // Validate request parameters
    if (!uiMode || !["pickup", "dropoff"].includes(uiMode)) {
      console.log('❌ Invalid uiMode:', uiMode);
      return res.status(400).json({ 
        success: false, 
        error: "Invalid uiMode. Must be 'pickup' or 'dropoff'." 
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

export default missionRouter;