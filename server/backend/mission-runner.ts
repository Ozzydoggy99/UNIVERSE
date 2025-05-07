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
  const normalize = (val: string) => String(val).trim().toLowerCase();

  if (!points || points.length === 0) {
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }

  const pickup = points.find(p => normalize(p.id) === "pick-up");
  const dropoff = points.find(p => normalize(p.id) === "drop-off");
  const standby = points.find(p => normalize(p.id) === "desk");
  const shelf = points.find(p => normalize(p.id) === normalize(shelfId));

  console.log("MATCHED POINTS:");
  console.log("Shelf: ", shelf?.id, shelf?.x, shelf?.y);
  console.log("Drop-off: ", dropoff?.id, dropoff?.x, dropoff?.y);
  console.log("Pickup: ", pickup?.id, pickup?.x, pickup?.y);
  console.log("Desk: ", standby?.id, standby?.x, standby?.y);

  if (!pickup || !dropoff || !standby || !shelf) {
    throw new Error("❌ One or more required points (pickup/dropoff/desk/shelf) not found.");
  }

  appendLog("=== New Mission Start ===");
  appendLog(`uiMode: ${uiMode}`);
  appendLog(`Shelf: ${shelf?.id} (${shelf?.x}, ${shelf?.y})`);
  appendLog(`Drop-off: ${dropoff?.id} (${dropoff?.x}, ${dropoff?.y})`);
  appendLog(`Pickup: ${pickup?.id} (${pickup?.x}, ${pickup?.y})`);
  appendLog(`Desk: ${standby?.id} (${standby?.x}, ${standby?.y})`);

  const steps: Point[] = [];

  if (uiMode === "pickup") {
    steps.push(shelf);
    steps.push(dropoff);
  } else {
    steps.push(standby);
    steps.push(pickup);
    steps.push(shelf);
  }

  steps.push(standby);
  
  const executed = [];

  for (const point of steps) {
    appendLog(`➡️ Sending robot to: ${point.id} (${point.x}, ${point.y})`);
    
    try {
      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
        action: "move_to",
        target_x: point.x,
        target_y: point.y,
      }, {
        headers: { "x-api-key": ROBOT_SECRET },
      });

      appendLog(`✅ Move to ${point.id} acknowledged with: ${JSON.stringify(response.data)}`);
      console.log(`✅ Move to ${point.id} succeeded:`, response.data);
      executed.push({ to: point.id, result: response.data });
      
      await waitForArrival(point.x, point.y);
      
    } catch (err: any) {
      appendLog(`❌ Move failed to ${point.id}: ${err.message}`);
      throw err;
    }
  }

  return {
    mission: `${uiMode}-${shelfId}-${Date.now()}`,
    status: "complete",
    executed,
  };
}