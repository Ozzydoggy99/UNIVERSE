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

/**
 * Run a mission (pickup or dropoff) using the robot
 * Simplified version that uses direct point-to-point movement
 */
export async function runMission({ shelfId, uiMode, points }: RobotTaskRequest) {
  // If no points provided, fetch them from robot
  if (!points || points.length === 0) {
    console.log("No points provided, fetching from robot...");
    points = await fetchPoints();
  }

  console.log('🧾 Running mission:', uiMode, shelfId);
  console.log('🧾 Available points:', points.map(p => `"${p.id}"`).join(', '));

  const normalize = (id: string | number) => String(id).trim().toLowerCase();

  // Find the required points
  const shelf = points.find(p => normalize(p.id) === normalize(shelfId));
  const standby = points.find(p => normalize(p.id) === 'desk');

  if (!shelf) throw new Error(`❌ Shelf point "${shelfId}" not found`);
  if (!standby) throw new Error(`❌ Desk (standby) point not found`);

  // Determine start and end points based on UI mode
  const start = uiMode === 'pickup' ? shelf : standby;
  const end = uiMode === 'pickup' ? standby : shelf;

  console.log(`📍 Moving from "${start.id}" to "${end.id}"`);

  try {
    // Send the move command to the robot
    const movePayload = {
      action: 'navigate_to',  // Using navigate_to which works with our robot
      target_x: end.x,
      target_y: end.y
    };

    const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, movePayload, {
      headers: { 'x-api-key': ROBOT_SECRET }
    });

    console.log('✅ Robot move initiated:', response.data);
    
    return {
      mission: `${uiMode}-${shelfId}-${Date.now()}`,
      status: "in_progress",
      move_id: response.data.id,
      from: start.id,
      to: end.id
    };
  } catch (error: any) {
    console.error('❌ Error initiating robot movement:', error.message);
    throw new Error(`Failed to start robot mission: ${error.message}`);
  }
}