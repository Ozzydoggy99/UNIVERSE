// server/backend/mission-runner.ts
import axios from "axios";

const robotIp = process.env.ROBOT_IP || "192.168.4.31";
const secretKey = process.env.ROBOT_SECRET || "";

interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
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

/**
 * Fetches all points from the robot's current map
 */
async function fetchPoints(): Promise<Point[]> {
  try {
    const url = `http://${robotIp}:8090/maps/current_map/points`;
    console.log(`Fetching points from: ${url}`);
    const res = await axios.get(url, {
      headers: { "x-api-key": secretKey }
    });
    return res.data.points;
  } catch (error: any) {
    console.error("Error fetching points:", error.message);
    throw new Error(`Failed to fetch points: ${error.message}`);
  }
}

/**
 * Categorizes points from the map into pickup, dropoff, standby, and shelves
 */
function categorize(points: Point[]): CategorizedPoints {
  let pickup = null, dropoff = null, standby = null;
  const shelves: Point[] = [];

  for (const p of points) {
    const label = p.id.toLowerCase();
    if (label.includes("pick")) pickup = p;
    else if (label.includes("drop")) dropoff = p;
    else if (label.includes("desk") || label.includes("standby")) standby = p;
    else shelves.push(p);
  }

  return { pickup, dropoff, standby, shelves };
}

/**
 * Commands the robot to move to a specific point
 */
async function moveToPoint(pointId: string): Promise<void> {
  try {
    const url = `http://${robotIp}:8090/chassis/move_to_point`;
    console.log(`Sending move command to: ${url} for point: ${pointId}`);
    await axios.post(url, {
      point_id: pointId,
      creator: "backend-system"
    }, {
      headers: { "x-api-key": secretKey }
    });
  } catch (error: any) {
    console.error(`Error moving to point ${pointId}:`, error.message);
    throw new Error(`Failed to move to point ${pointId}: ${error.message}`);
  }
}

/**
 * Simple wait function for delays between operations
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a mission based on human UI perspective
 * - pickup mode: Robot moves to shelf, then to dropoff point, then to standby
 * - dropoff mode: Robot moves to pickup point, then to shelf, then to standby
 */
export async function runMission({ uiMode, shelfId }: MissionParams): Promise<void> {
  console.log(`Starting mission: mode=${uiMode}, shelfId=${shelfId}`);
  
  // Ensure we have a valid robot IP and secret key
  if (!robotIp) {
    throw new Error("Robot IP is not configured. Please set ROBOT_IP environment variable.");
  }
  
  if (!secretKey) {
    throw new Error("Robot secret key is not configured. Please set ROBOT_SECRET environment variable.");
  }

  // Fetch and categorize all points
  const allPoints = await fetchPoints();
  console.log(`Retrieved ${allPoints.length} points from robot map`);
  
  const { pickup, dropoff, standby, shelves } = categorize(allPoints);
  
  if (!pickup) {
    throw new Error("No pickup point found on the map. Ensure a point with 'pick' in its ID exists.");
  }
  
  if (!dropoff) {
    throw new Error("No dropoff point found on the map. Ensure a point with 'drop' in its ID exists.");
  }

  // Find the requested shelf
  const shelf = shelves.find(p => p.id === shelfId);
  if (!shelf) {
    throw new Error(`Shelf point ${shelfId} not found. Available shelves: ${shelves.map(s => s.id).join(', ')}`);
  }

  if (uiMode === "dropoff") {
    // Human wants to drop a bin at a shelf → Robot: pick up → shelf → home
    console.log("Starting dropoff mission sequence");
    
    await moveToPoint(pickup.id);
    console.log(`📦 Picked up bin at ${pickup.id}`);
    await wait(4000); // Wait for 4 seconds to simulate pickup action

    await moveToPoint(shelf.id);
    console.log(`📤 Dropped bin at shelf ${shelf.id}`);
    await wait(4000); // Wait for 4 seconds to simulate dropoff action
  }

  if (uiMode === "pickup") {
    // Human wants to pick up from shelf → Robot: shelf → dropoff → home
    console.log("Starting pickup mission sequence");
    
    await moveToPoint(shelf.id);
    console.log(`📦 Picked up bin at shelf ${shelf.id}`);
    await wait(4000); // Wait for 4 seconds to simulate pickup action

    await moveToPoint(dropoff.id);
    console.log(`📤 Dropped bin at ${dropoff.id}`);
    await wait(4000); // Wait for 4 seconds to simulate dropoff action
  }

  // Return to standby point if available
  if (standby) {
    await moveToPoint(standby.id);
    console.log(`🛑 Returned to standby (${standby.id})`);
  } else {
    console.log("No standby point found, mission completed without returning to standby");
  }
  
  console.log(`Mission completed successfully: ${uiMode} for shelf ${shelfId}`);
}