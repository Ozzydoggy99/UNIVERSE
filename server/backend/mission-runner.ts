import axios from "axios";
import { getRobotSecretKey, getRobotUrl } from "../robot-constants";
import { RobotTaskRequest } from "../types";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  floorId?: string;
}

export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = { "x-api-key": getRobotSecretKey() };

  // Get first available map
  const mapsRes = await axios.get(`${getRobotUrl()}/maps/`, { headers });
  const maps = mapsRes.data || [];
  const activeMap = maps[0];

  if (!activeMap) throw new Error("❌ No map found");

  console.log("🗺️ Found active map:", activeMap.name || activeMap.map_name);

  // Extract floor ID from map name if available
  const rawName = activeMap.name || activeMap.map_name || "";
  const floorMatch = rawName.match(/^(\d+)/);
  const floorId = floorMatch ? floorMatch[1] : "1";

  const mapRes = await axios.get(`${getRobotUrl()}/maps/${activeMap.id}`, { headers });
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

export async function runMission(request: RobotTaskRequest, pointsFromUI?: Point[]): Promise<any> {
  const { uiMode, shelfId } = request;
  const robotURL = getRobotUrl();
  const secret = getRobotSecretKey();

  console.log("🔧 Running mission with:", { uiMode, shelfId });

  // 1. Fetch map and points
  const mapRes = await axios.get(`${robotURL}/maps/`, {
    headers: { "x-api-key": secret },
  });
  const maps = mapRes.data;
  const activeMap = maps?.[0]; // use the only map or default
  if (!activeMap) throw new Error("No maps found on robot");

  const mapId = activeMap.id;
  const mapDetail = await axios.get(`${robotURL}/maps/${mapId}`, {
    headers: { "x-api-key": secret },
  });

  const overlays = Array.isArray(mapDetail.data.overlays) ? mapDetail.data.overlays : [];
  
  // Extract points data from the overlays
  // The API response may have points directly in overlay or in overlay.point
  const points = overlays
    .filter((o: any) => o.type === "Label")
    .map((o: any) => {
      // If the overlay has a point property, use it; otherwise use the overlay itself
      const point = o.point || o;
      return {
        id: point.text || point.id,
        x: point.x,
        y: point.y,
        ori: point.orientation || point.ori || 0
      };
    })
    .filter((p: any) => p.id); // Filter out any points without an ID

  // Debug point data
  console.log(`📍 Found ${points.length} map points`);
  
  const normalized = (str: string) => String(str || "").trim().toLowerCase();

  const shelf = points.find((p: any) => normalized(p.id) === normalized(shelfId));
  const pickup = points.find((p: any) => normalized(p.id).includes("pick"));
  const dropoff = points.find((p: any) => normalized(p.id).includes("drop"));
  const standby = points.find((p: any) => normalized(p.id).includes("desk") || normalized(p.id).includes("standby"));

  if (!shelf) throw new Error(`❌ Shelf point "${shelfId}" not found`);
  if (!pickup) throw new Error(`❌ Pickup point not found`);
  if (!dropoff) throw new Error(`❌ Dropoff point not found`);
  if (!standby) throw new Error(`❌ Standby point not found`);

  // 2. Build path list based on uiMode
  const pathList =
    uiMode === "pickup"
      ? [pickup.id, shelf.id, standby.id]
      : [shelf.id, dropoff.id, standby.id];

  // 3. Create task
  const createTaskRes = await axios.post(
    `${robotURL}/tasks`,
    {
      name: `AutoTask_${Date.now()}`,
      map_id: mapId,
      path: pathList,
    },
    { headers: { "x-api-key": secret } }
  );

  const taskId = createTaskRes.data?.id;
  if (!taskId) throw new Error("❌ Failed to create task");

  // 4. Run task
  const execRes = await axios.post(
    `${robotURL}/tasks/${taskId}/execute`,
    {},
    { headers: { "x-api-key": secret } }
  );

  return { taskId, status: execRes.status, message: "✅ Mission launched" };
}