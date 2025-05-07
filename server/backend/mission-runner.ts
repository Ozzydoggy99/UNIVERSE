import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";
import { Point, RobotTaskRequest } from "../types";

interface RobotTaskRequest {
  shelfId: string;
  uiMode: "pickup" | "dropoff";
  points: Point[];
}

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
      return {
        id: point.text?.trim() || point.id,
        x: point.x,
        y: point.y,
        ori: point.orientation || point.ori || 0,
        floorId,
      };
    })
    .filter((p: any) => p.id); // Filter out any points without an ID

  console.log(`📍 Found ${points.length} map points with floor ID ${floorId}:`, 
    points.map(p => `"${p.id}"`).join(", "));

  return points;
}

export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  const normalize = (val: string) => String(val).trim().toLowerCase();

  const pickupPoint = points.find(p => normalize(p.id) === "pick-up");
  const dropoffPoint = points.find(p => normalize(p.id) === "drop-off");
  const standbyPoint = points.find(p => normalize(p.id) === "desk");
  const shelfPoint = points.find(p => normalize(p.id) === normalize(shelfId));

  if (!pickupPoint || !dropoffPoint || !standbyPoint || !shelfPoint) {
    throw new Error("❌ One or more required points not found.");
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
    headers: { "x-api-key": ROBOT_SECRET_KEY },
  });

  const missionId = createRes.data?.id;
  if (!missionId) throw new Error("❌ Failed to create mission");

  console.log("🚀 Starting mission ID:", missionId);
  const startRes = await axios.post(`${ROBOT_API_URL}/missions/${missionId}/start`, null, {
    headers: { "x-api-key": ROBOT_SECRET_KEY },
  });

  return startRes.data;
}