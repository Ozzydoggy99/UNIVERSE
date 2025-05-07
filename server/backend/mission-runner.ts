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

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  const normalize = (val: string) => String(val).trim().toLowerCase();

  console.log("[DEBUG] Incoming runMission payload:", { uiMode, shelfId });
  
  if (!points || points.length === 0) {
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }
  
  console.log("[DEBUG] Points available:", points.map(p => p.id));
  console.log(`🧾 Starting mission: ${uiMode} to shelf ${shelfId}`);

  const pickup = points.find(p => normalize(p.id) === "pick-up");
  const dropoff = points.find(p => normalize(p.id) === "drop-off");
  const standby = points.find(p => normalize(p.id) === "desk");
  const shelf = points.find(p => normalize(p.id) === normalize(shelfId));

  if (!pickup || !dropoff || !standby || !shelf) {
    throw new Error("❌ One or more required points (pickup/dropoff/desk/shelf) not found.");
  }

  const steps: Point[] = [];

  if (uiMode === "pickup") {
    steps.push(shelf);    // ✅ go to shelf
    steps.push(dropoff);  // ✅ drop at dropoff
  } else {
    steps.push(standby);  // ✅ start from desk
    steps.push(pickup);   // ✅ get bin from pickup
    steps.push(shelf);    // ✅ deliver to shelf
  }

  steps.push(standby);    // ✅ always return to standby

  const executed = [];

  for (const point of steps) {
    console.log(`➡️ Moving to ${point.id} at (${point.x}, ${point.y})`);
    const result = await axios.post(`${ROBOT_API_URL}/chassis/moves`, {
      action: "move_to",
      target_x: point.x,
      target_y: point.y,
    }, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    console.log(`✅ Move to ${point.id} acknowledged:`, result.data);
    executed.push({ to: point.id, result: result.data });
  }

  return {
    mission: `${uiMode}-${shelfId}-${Date.now()}`,
    status: "complete",
    executed,
  };
}