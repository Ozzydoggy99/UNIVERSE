import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";
import { Point, RobotTaskRequest } from "../types";

// RobotTaskRequest is now imported from ../types

export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = { "x-api-key": ROBOT_SECRET };

  // Get first available map
  const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
  const maps = mapsRes.data || [];
  const activeMap = maps[0];

  if (!activeMap) throw new Error("❌ No map found");

  console.log("🗺️ Found active map:", activeMap.name || activeMap.map_name);

  // Extract floor ID from map name if available
  const rawName = activeMap.name || activeMap.map_name || "";
  const floorMatch = rawName.match(/^(\d+)/);
  const floorId = floorMatch ? floorMatch[1] : "1";

  const mapRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
  const overlays = Array.isArray(mapRes.data?.overlays) ? mapRes.data.overlays : [];

  // Extract and normalize point data from overlays
  const points = overlays
    .filter((o: any) => o.type === "Label")
    .map((o: any) => {
      // Points may be directly in the overlay or nested in a point property
      const point = o.point || o;
      const id = point.text?.trim() || point.id || "";
      
      return {
        id,
        description: id, // Use ID as description for better debugging
        x: point.x,
        y: point.y,
        ori: point.orientation || point.ori || 0,
        floorId,
      };
    })
    .filter((p: Point) => p.id); // Filter out any points without an ID
    
  // Debug output of the actual overlay structure for better understanding
  if (overlays.length > 0) {
    console.log("Sample overlay structure:", JSON.stringify(overlays[0]));
  }

  console.log(`📍 Found ${points.length} map points with floor ID ${floorId}:`, 
    points.map((p: Point) => `"${p.id}"`).join(", "));

  return points;
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  if (!points || points.length === 0) {
    // If points aren't provided, fetch them directly
    console.log("No points provided, fetching from robot...");
    points = await fetchRobotMapPoints();
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