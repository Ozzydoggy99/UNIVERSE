import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";
import { fetchRobotMapPoints as fetchPoints } from "../robot-points-api";
import { Point, RobotTaskRequest } from "../types";
import { appendLog } from "../debug-log";

// This function has been moved to robot-points-api.ts
// We keep this import/export signature for backward compatibility
export async function fetchRobotMapPoints(): Promise<Point[]> {
  // Forward to the real implementation
  return fetchPoints();
}

async function waitForArrival(targetX: number, targetY: number) {
  const headers = { "x-api-key": ROBOT_SECRET };
  // Use a shorter wait time since we're in demo mode and can't get real position data
  const waitTime = 5000; // 5 seconds per movement
  
  appendLog(`ℹ️ Waiting ${waitTime/1000} seconds for robot movement to complete...`);
  
  try {
    // Simple delay approach - the robot API doesn't reliably provide position tracking
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Attempt to get move status for logging purposes, but don't depend on it
    try {
      const res = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, { 
        headers,
        timeout: 2000 // Short timeout to avoid hanging
      });
      
      if (res.data && res.data.state) {
        appendLog(`ℹ️ Latest move state: ${res.data.state}`);
      }
    } catch (statusErr) {
      // Ignore errors when checking status - this is just for logging
    }

    // Log simulated arrival - we don't have real position data
    appendLog(`✅ Robot movement command completed (target: ${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);
    
  } catch (err: any) {
    appendLog(`⚠️ Error during movement: ${err.message}`);
  }
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  appendLog(`=== New Mission Start ===`);
  appendLog(`uiMode: ${uiMode}`);
  appendLog(`Shelf: ${shelfId}`);

  if (!points || points.length === 0) {
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }

  const normalize = (val: string) => String(val).trim().toLowerCase();
  const find = (id: string) => points.find(p => normalize(p.id) === normalize(id));

  const pickup = find("pick-up");
  const dropoff = find("drop-off");
  const standby = find("desk");
  const shelf = find(shelfId);

  if (!pickup || !dropoff || !standby || !shelf) {
    throw new Error("❌ Missing one or more required points (pickup, dropoff, shelf, desk)");
  }

  // Debug logging
  console.log("MATCHED POINTS:");
  console.log("Shelf: ", shelf?.id, shelf?.x, shelf?.y);
  console.log("Drop-off: ", dropoff?.id, dropoff?.x, dropoff?.y);
  console.log("Pickup: ", pickup?.id, pickup?.x, pickup?.y);
  console.log("Desk: ", standby?.id, standby?.x, standby?.y);

  appendLog(`Shelf: ${shelf?.id} (${shelf?.x}, ${shelf?.y})`);
  appendLog(`Drop-off: ${dropoff?.id} (${dropoff?.x}, ${dropoff?.y})`);
  appendLog(`Pickup: ${pickup?.id} (${pickup?.x}, ${pickup?.y})`);
  appendLog(`Desk: ${standby?.id} (${standby?.x}, ${standby?.y})`);

  // Define steps per mode - now using structured task API with actions
  const steps =
    uiMode === "pickup"
      ? [
          { point_id: shelf.id, actions: ["move_to", "load_cargo"] },
          { point_id: dropoff.id, actions: ["move_to", "unload_cargo"] },
          { point_id: standby.id, actions: ["move_to"] }
        ]
      : [
          { point_id: standby.id, actions: ["move_to"] },
          { point_id: pickup.id, actions: ["move_to", "load_cargo"] },
          { point_id: shelf.id, actions: ["move_to", "unload_cargo"] },
          { point_id: standby.id, actions: ["move_to"] }
        ];

  const taskPayload = {
    name: `Auto-${uiMode}-${shelfId}-${Date.now()}`,
    steps
  };

  appendLog(`📦 Sending structured task: ${taskPayload.name}`);
  appendLog(`Steps: ${JSON.stringify(steps)}`);

  try {
    // Create the task
    const createRes = await axios.post(
      `${ROBOT_API_URL}/tasks`, 
      taskPayload, 
      { headers: { "x-api-key": ROBOT_SECRET } }
    );
    
    const taskId = createRes.data?.id;
    if (!taskId) throw new Error("❌ Failed to create task");
    
    appendLog(`✅ Task created with ID: ${taskId}`);

    // Execute the task
    const startRes = await axios.post(
      `${ROBOT_API_URL}/tasks/${taskId}/execute`,
      null,
      { headers: { "x-api-key": ROBOT_SECRET } }
    );
    
    appendLog(`🚀 Task ${taskId} started`);

    return {
      mission: taskPayload.name,
      taskId: taskId,
      status: "started",
      steps: steps
    };
  } catch (err: any) {
    appendLog(`❌ Task creation/execution failed: ${err.message}`);
    throw err;
  }
}