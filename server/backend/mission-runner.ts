import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  floorId?: string;
  description?: string;
}

interface CategorizedPoints {
  pickup: Point | null;
  dropoff: Point | null;
  standby: Point | null;
  shelves: Point[];
}

interface MissionParams {
  uiMode: "pickup" | "dropoff";
  shelfId: string;
}

export async function fetchRobotMapPoints(): Promise<Point[]> {
  const headers = { "x-api-key": ROBOT_SECRET };

  // Get all maps and pick the first one
  const mapsRes = await axios.get(`${ROBOT_API_URL}/maps/`, { headers });
  const maps = mapsRes.data || [];
  const activeMap = maps[0];

  if (!activeMap) throw new Error("❌ No map found on robot");

  const floorMatch = activeMap.name?.match(/^(\d+)/);
  const floorId = floorMatch ? floorMatch[1] : "1";

  const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${activeMap.id}`, { headers });
  const mapData = mapDetailRes.data;
  const overlays = Array.isArray(mapData?.overlays) ? mapData.overlays : [];

  console.log("🧠 Overlays:", overlays.map((o: any) => o.text || o.type));

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

function categorizePoints(points: Point[]): CategorizedPoints {
  const categories: CategorizedPoints = {
    pickup: null,
    dropoff: null,
    standby: null,
    shelves: [],
  };

  for (const p of points) {
    const label = p.id.toLowerCase();

    if (label.includes("pick")) categories.pickup = p;
    else if (label.includes("drop")) categories.dropoff = p;
    else if (label.includes("standby") || label.includes("desk") || label.includes("charging")) categories.standby = p;
    else if (!isNaN(Number(p.id))) categories.shelves.push(p);
  }

  return categories;
}

export async function runMission({ uiMode, shelfId }: MissionParams): Promise<string> {
  const points = await fetchRobotMapPoints();
  const { pickup, dropoff, standby, shelves } = categorizePoints(points);

  const shelf = shelves.find(p => p.id === shelfId);
  if (!shelf) throw new Error(`Shelf point ${shelfId} not found`);

  const home = standby;
  if (!home) throw new Error("No standby/home point defined");

  const from = uiMode === "pickup" ? shelf : pickup;
  const to = uiMode === "pickup" ? dropoff : shelf;

  if (!from || !to) throw new Error(`Missing from/to point (mode: ${uiMode})`);

  const payload = {
    fromId: from.id,
    toId: to.id,
    returnId: home.id,
  };

  console.log("🚀 Sending mission:", payload);

  const response = await axios.post(`${ROBOT_API_URL}/missions/run`, payload, {
    headers: { "x-api-key": ROBOT_SECRET }
  });

  return response.data?.status || "Mission sent";
}