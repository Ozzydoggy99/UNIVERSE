// server/backend/mission-runner.ts
import axios from "axios";
import { ROBOT_API_URL, ROBOT_SECRET } from "../robot-constants";

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
    const url = `${ROBOT_API_URL}/maps/current_map/points`;
    console.log(`Fetching points from: ${url}`);
    const res = await axios.get(url, {
      headers: { "x-api-key": ROBOT_SECRET }
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
function categorizePoints(points: Point[]): CategorizedPoints {
  console.log('Categorizing points:', points.map(p => p.id));
  
  const categories = {
    pickup: null as Point | null,
    dropoff: null as Point | null,
    standby: null as Point | null,
    shelves: [] as Point[],
  };
  
  // First, find the special points
  for (const p of points) {
    const label = p.id.toLowerCase();
    
    // Try to find the pickup point (labeled "pickup", "pick", etc.)
    if (label.includes("pick")) {
      console.log('Found pickup point:', p.id);
      categories.pickup = p;
    }
    // Try to find the dropoff point (labeled "dropoff", "drop", etc.)
    else if (label.includes("drop")) {
      console.log('Found dropoff point:', p.id);
      categories.dropoff = p;
    }
    // Try to find the standby point (labeled "standby", "desk", "charging station", etc.)
    else if (
      label.includes("desk") || 
      label.includes("standby") || 
      label.includes("charging")
    ) {
      console.log('Found standby point:', p.id);
      categories.standby = p;
    }
    // All other points are considered shelves
    else {
      categories.shelves.push(p);
    }
  }
  
  // Sort shelves by ID for predictable ordering
  categories.shelves.sort((a, b) => a.id.localeCompare(b.id));
  
  console.log(`Categorized ${points.length} points into:`, {
    pickup: categories.pickup?.id,
    dropoff: categories.dropoff?.id,
    standby: categories.standby?.id,
    shelves: categories.shelves.map(s => s.id),
  });
  
  return categories;
}

/**
 * Commands the robot to move to a specific point
 */
async function moveToPoint(pointId: string): Promise<void> {
  try {
    const url = `${ROBOT_API_URL}/chassis/move_to_point`;
    console.log(`Sending move command to: ${url} for point: ${pointId}`);
    await axios.post(
      url,
      { point_id: pointId, creator: "backend-system" },
      { headers: { "x-api-key": ROBOT_SECRET } }
    );
  } catch (error: any) {
    console.error(`Error moving to point ${pointId}:`, error.message);
    throw new Error(`Failed to move to point ${pointId}: ${error.message}`);
  }
}

/**
 * Simple wait function for delays between operations
 */
function wait(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Runs a mission based on human UI perspective
 * - pickup mode: Robot moves to shelf, then to dropoff point, then to standby
 * - dropoff mode: Robot moves to pickup point, then to shelf, then to standby
 */
export async function runMission({ uiMode, shelfId }: MissionParams): Promise<void> {
  console.log(`Starting mission: mode=${uiMode}, shelfId=${shelfId}`);
  
  // Ensure we have a valid robot API URL and secret key
  if (!ROBOT_API_URL) {
    throw new Error("Robot API URL is not configured.");
  }
  
  if (!ROBOT_SECRET) {
    throw new Error("Robot secret key is not configured. Please check environment variable.");
  }

  // Fetch and categorize all points
  const points = await fetchPoints();
  console.log(`Retrieved ${points.length} points from robot map`);
  
  const { pickup, dropoff, standby, shelves } = categorizePoints(points);
  
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
    await moveToPoint(pickup.id);
    console.log(`📦 Picked up at ${pickup.id}`);
    await wait(4000);

    await moveToPoint(shelf.id);
    console.log(`🚚 Dropped off at shelf ${shelf.id}`);
    await wait(4000);
  }

  if (uiMode === "pickup") {
    // Human wants to pick up from shelf → Robot: shelf → dropoff → home
    await moveToPoint(shelf.id);
    console.log(`📦 Picked up from shelf ${shelf.id}`);
    await wait(4000);

    await moveToPoint(dropoff.id);
    console.log(`🚚 Dropped at ${dropoff.id}`);
    await wait(4000);
  }

  // Return to standby point if available
  if (standby) {
    await moveToPoint(standby.id);
    console.log(`🛑 Returned to standby: ${standby.id}`);
  } else {
    console.log("No standby point found, mission completed without returning to standby");
  }
  
  console.log(`Mission completed successfully: ${uiMode} for shelf ${shelfId}`);
}