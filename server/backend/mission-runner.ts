import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  floorId?: string;
}

interface MissionParams {
  uiMode: "pickup" | "dropoff";
  shelfId: string;
}

export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = { "x-api-key": ROBOT_SECRET };

  // Get first available map
  const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
  const maps = mapsRes.data || [];
  const activeMap = maps[0];

  if (!activeMap) throw new Error("❌ No map found");

  const rawName = activeMap.name || activeMap.map_name || "";
  const floorMatch = rawName.match(/^(\d+)/);
  const floorId = floorMatch ? floorMatch[1] : "1";

  const mapRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
  const overlays = Array.isArray(mapRes.data?.overlays) ? mapRes.data.overlays : [];

  return overlays
    .filter((o: any) => o.type === "Label")
    .map((o: any) => ({
      id: o.text?.trim(),
      x: o.x,
      y: o.y,
      ori: o.orientation ?? 0,
      floorId,
    }));
}

export async function runMission({ uiMode, shelfId }: MissionParams, providedPoints?: Point[]): Promise<string> {
  // Use provided points if available, otherwise fetch fresh points
  const points = providedPoints || await fetchRobotMapPoints();

  const normalizedShelfId = String(shelfId).trim().toLowerCase();
  const shelf = points.find(p => String(p.id).trim().toLowerCase() === normalizedShelfId);

  console.log("🧾 Requested shelfId:", normalizedShelfId);
  console.log("🧾 Available points:", points.map(p => `"${p.id}"`).join(", "));

  if (!shelf) throw new Error(`Shelf point "${shelfId}" not found`);

  const standby = points.find(p => {
    const id = p.id.toLowerCase();
    return id.includes("standby") || id.includes("desk") || id.includes("charging");
  });

  const pickup = points.find(p => p.id.toLowerCase().includes("pick"));
  const dropoff = points.find(p => p.id.toLowerCase().includes("drop"));

  const from = uiMode === "pickup" ? shelf : pickup;
  const to = uiMode === "pickup" ? dropoff : shelf;

  if (!from || !to || !standby) {
    throw new Error(`Missing critical points: from=${from?.id}, to=${to?.id}, standby=${standby?.id}`);
  }

  const payload = {
    fromId: from.id,
    toId: to.id,
    returnId: standby.id,
  };

  console.log("🚀 Sending mission:", payload);

  const res = await axios.post(`${ROBOT_API_URL}/missions/run`, payload, {
    headers: { "x-api-key": ROBOT_SECRET }
  });

  return res.data?.status || "Mission sent.";
}