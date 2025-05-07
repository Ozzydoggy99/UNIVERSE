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

  console.log(`🚀 Starting ${uiMode} mission for ${shelfId}`);
  
  // Execute each movement sequentially using the navigate_to action
  const results = [];
  
  for (const point of steps) {
    console.log(`🔄 Moving to point: ${point.id} (${point.x}, ${point.y})`);
    try {
      const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, 
        {
          action: "navigate_to",
          target_x: point.x,
          target_y: point.y
        },
        {
          headers: { "x-api-key": ROBOT_SECRET },
        }
      );
      
      results.push({
        point: point.id,
        status: "success",
        data: moveResponse.data
      });
      
      // Wait for completion before moving to next point - in production code you'd poll status
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error: any) {
      console.error(`❌ Error moving to point ${point.id}:`, error);
      results.push({
        point: point.id,
        status: "error",
        error: error.message || String(error)
      });
      // Continue with the next point even if this one failed
    }
  }

  return {
    mission: `${uiMode}-${shelfPoint.id}-${Date.now()}`,
    status: "completed",
    steps: results
  };
}