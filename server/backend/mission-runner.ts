import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";
import { Point, RobotTaskRequest } from "../types";
import { fetchRobotMapPoints as fetchPoints } from "../robot-points-api";

// This function has been moved to robot-points-api.ts
// We keep this import/export signature for backward compatibility
export async function fetchRobotMapPoints(): Promise<Point[]> {
  // Forward to the real implementation
  return fetchPoints();
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  if (!points || points.length === 0) {
    // If points aren't provided, fetch them from the robot-points-api
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }

  console.log(`📝 Total points available: ${points.length}`);
  console.log(`🔍 Looking for: pickup/pick-up, dropoff/drop-off, desk, and ${shelfId}`);
  
  const normalize = (val: string) => String(val || "").trim().toLowerCase();

  // Improved case-insensitive matching with better logging
  const pickupPoint = points.find(p => {
    const id = normalize(p.id);
    return id === "pick-up" || id === "pickup" || id === "pick up";
  });
  console.log("Pickup point found:", pickupPoint?.id);

  const dropoffPoint = points.find(p => {
    const id = normalize(p.id);
    return id === "drop-off" || id === "dropoff" || id === "drop off";
  });
  console.log("Dropoff point found:", dropoffPoint?.id);

  const standbyPoint = points.find(p => normalize(p.id) === "desk");
  console.log("Standby point found:", standbyPoint?.id);

  const shelfPoint = points.find(p => normalize(p.id) === normalize(shelfId));
  console.log("Shelf point found:", shelfPoint?.id);
  
  console.log("Available point IDs:", points.map(p => p.id));

  if (!pickupPoint || !dropoffPoint || !standbyPoint || !shelfPoint) {
    throw new Error(`❌ One or more required points not found. Looking for: pick-up, drop-off, desk, and ${shelfId}`);
  }

  const steps = uiMode === "pickup"
    ? [pickupPoint, shelfPoint, standbyPoint]
    : [shelfPoint, dropoffPoint, standbyPoint];

  const mission = {
    name: `Auto-${uiMode}-${shelfPoint.id}-${Date.now()}`,
    tasks: steps.map(p => ({
      action: "goto_point",
      args: { point_id: p.id },
    })),
  };

  console.log("📥 Creating mission:", mission.name);
  const createRes = await axios.post(`${ROBOT_API_URL}/missions`, mission, {
    headers: { "x-api-key": ROBOT_SECRET },
  });

  const missionId = createRes.data?.id;
  if (!missionId) throw new Error("❌ Failed to create mission");

  console.log("🚀 Starting mission ID:", missionId);
  const startRes = await axios.post(`${ROBOT_API_URL}/missions/${missionId}/start`, null, {
    headers: { "x-api-key": ROBOT_SECRET },
  });

  return startRes.data;
}