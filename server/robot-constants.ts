// server/robot-constants.ts
/**
 * Robot API constants file
 * Contains configuration for connecting to the robot's API
 */
import dotenv from "dotenv";
dotenv.config();

// Robot serial number - used for identification
export const ROBOT_SERIAL = "L382502104987ir";

// Export the serial number as PHYSICAL_ROBOT_SERIAL for backward compatibility
export const PHYSICAL_ROBOT_SERIAL = ROBOT_SERIAL;

// Get robot IP from environment variable or use fallback
const ROBOT_IP = process.env.ROBOT_IP || "47.180.91.99";

// Robot API URL - base URL for all API requests
export let ROBOT_API_URL = `http://${ROBOT_IP}:8090`;

// Robot WebSocket URL - for real-time updates
export let ROBOT_WS_URL = `ws://${ROBOT_IP}:8090/ws`;

// Robot authentication secret - from environment variables
export const ROBOT_SECRET = process.env.ROBOT_SECRET_KEY || process.env.ROBOT_SECRET || "";

// Function to update robot connection URLs
export function updateRobotConnectionURLs(apiUrl: string, wsUrl: string) {
  ROBOT_API_URL = apiUrl;
  ROBOT_WS_URL = wsUrl;
  console.log(`Updated robot connection URLs: API=${apiUrl}, WS=${wsUrl}`);
}

// Utility functions to get robot URL and secret key
export function getRobotUrl(): string {
  return ROBOT_API_URL;
}

export function getRobotSecretKey(): string {
  return ROBOT_SECRET;
}

// Check if robot secret is set and log warning if not
if (!ROBOT_SECRET) {
  console.warn('ROBOT_SECRET_KEY environment variable is not set. Robot API requests may fail authentication.');
}