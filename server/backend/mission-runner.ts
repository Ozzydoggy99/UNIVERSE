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

export async function runMission({ uiMode, shelfId }: MissionParams): Promise<string> {
  const points = await fetchRobotMapPoints();

  console.log("🧾 Matching shelf ID:", shelfId);
  console.log("🧾 All point IDs:", points.map(p => `"${p.id}"`).join(", "));

  const shelf = points.find(p => p.id?.trim() === String(shelfId).trim());
  if (!shelf) throw new Error(`Shelf point "${shelfId}" not found`);

  const standby = points.find(p => {
    const label = p.id.toLowerCase();
    return label.includes("standby") || label.includes("charging") || label.includes("desk");
  });

  const pickup = points.find(p => p.id.toLowerCase().includes("pick"));
  const dropoff = points.find(p => p.id.toLowerCase().includes("drop"));

  const from = uiMode === "pickup" ? shelf : pickup;
  const to = uiMode === "pickup" ? dropoff : shelf;

  if (!from || !to || !standby) {
    throw new Error(`Missing required point(s). Mode: ${uiMode}. From: ${from?.id}, To: ${to?.id}, Standby: ${standby?.id}`);
  }

  const payload = {
    fromId: from.id,
    toId: to.id,
    returnId: standby.id,
  };

  console.log("🚀 Mission Payload:", payload);

  const res = await axios.post(`${ROBOT_API_URL}/missions/run`, payload, {
    headers: { "x-api-key": ROBOT_SECRET }
  });

  return res.data?.status || "Mission sent";
}