// server/types.ts
/**
 * Type definitions for the server
 */

export interface Point {
  id: string;
  x: number;
  y: number;
  ori: number;
  floorId?: string;
  description?: string;
  name?: string; // Added for compatibility with mission-routes.ts
}

export interface RobotTaskRequest {
  uiMode: "pickup" | "dropoff";
  shelfId: string;
  points?: Point[]; // Points data for the mission
  mode?: "pickup" | "dropoff"; // For backward compatibility with existing code
}