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

// Get robot IP from environment variable - require it to be set
const robotIpFromEnv = process.env.ROBOT_IP;
if (!robotIpFromEnv) {
  throw new Error('ROBOT_IP environment variable is required but not set');
}
export const ROBOT_IP = robotIpFromEnv;

// Robot API URL - base URL for all API requests
export let ROBOT_API_URL = `http://${ROBOT_IP}:8090`;

// Robot WebSocket URL - using the proper path for this robot model
// According to docs, this robot model uses /ws/v2/topics path
export let ROBOT_WS_URL = `ws://${ROBOT_IP}:8090/ws/v2/topics`;

// Robot authentication secret - from environment variables (required)
const robotSecretFromEnv = process.env.ROBOT_SECRET_KEY || process.env.ROBOT_SECRET;
if (!robotSecretFromEnv) {
  throw new Error('Robot secret must be provided in environment variables');
}
export const ROBOT_SECRET = robotSecretFromEnv;

// Get the correct header format for AutoXing API (from documentation)
export function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Secret': ROBOT_SECRET
  };
}

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

// No need for a warning as we throw an error above if robot secret is not set