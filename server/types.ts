// server/types.ts
/**
 * Type definitions for the server
 */

export interface RobotTaskRequest {
  uiMode: "pickup" | "dropoff";
  shelfId: string;
  mode?: "pickup" | "dropoff"; // For backward compatibility with existing code
}