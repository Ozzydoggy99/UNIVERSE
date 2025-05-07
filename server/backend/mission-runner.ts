import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";
import { fetchRobotMapPoints as fetchPoints } from "../robot-points-api";
import { Point, RobotTaskRequest } from "../types";

// This function has been moved to robot-points-api.ts
// We keep this import/export signature for backward compatibility
export async function fetchRobotMapPoints(): Promise<Point[]> {
  // Forward to the real implementation
  return fetchPoints();
}

function normalize(id: string | number) {
  return String(id).trim().toLowerCase();
}

async function sendMoveTo(point: Point) {
  console.log("➡️ Sending robot to:", point.id, "at", point.x, point.y);
  
  const movePayload = {
    action: "move_to",
    target_x: point.x,
    target_y: point.y,
  };

  const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, movePayload, {
    headers: { "x-api-key": ROBOT_SECRET },
  });

  return response.data;
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  console.log("[DEBUG] Incoming runMission payload:", { uiMode, shelfId });
  
  if (!points || points.length === 0) {
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }
  
  console.log("[DEBUG] Points available:", points.map(p => p.id));
  console.log(`🧾 Starting mission: ${uiMode} to shelf ${shelfId}`);
  
  const shelf = points.find(p => normalize(p.id) === normalize(shelfId));
  const dropoff = points.find(p => normalize(p.id) === "drop-off");
  const pickup = points.find(p => normalize(p.id) === "pick-up");
  const standby = points.find(p => normalize(p.id) === "desk");

  if (!shelf || !dropoff || !pickup || !standby) {
    throw new Error("❌ Required point(s) not found (shelf/drop-off/pick-up/desk)");
  }

  const steps = [];

  if (uiMode === "pickup") {
    steps.push(shelf);     // go to shelf
    steps.push(dropoff);   // deliver to drop-off
  } else {
    steps.push(standby);   // start from standby
    steps.push(pickup);    // get bin from pick-up
    steps.push(shelf);     // deliver to shelf
  }

  steps.push(standby);     // return to standby

  const executed = [];

  for (const point of steps) {
    console.log(`➡️ Moving to ${point.id}...`);
    const result = await sendMoveTo(point);
    executed.push({ to: point.id, moveId: result.id });
  }

  return {
    mission: `${uiMode}-${shelfId}-${Date.now()}`,
    status: "complete",
    executed,
  };
}