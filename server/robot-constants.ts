// Constants for robot connection and configuration
// Allows sharing of constants across robot-api.ts and robot-websocket.ts

// Robot connection configuration
// Connection URLs can be set via environment variables to allow dynamic updates
export let ROBOT_API_URL = process.env.ROBOT_API_URL;
export let ROBOT_WS_URL = process.env.ROBOT_WS_URL;

// If environment variables are not set, use default connection options
if (!ROBOT_API_URL || !ROBOT_WS_URL) {
  // Use the configured port forwarding for robot connection
  console.log('Using port forwarded connection to robot (from constants)');
  
  // Connection to the robot via port forwarding (public IP)
  ROBOT_API_URL = 'http://47.180.91.99:8090';
  ROBOT_WS_URL = 'ws://47.180.91.99:8090/ws/v2/topics';
}

// We only support a single physical robot
export const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

// For testing with ngrok, we'll keep this option but it may not be needed
export const ROBOT_SECRET = process.env.ROBOT_SECRET || 'L382502104987ir-secret';

// Allow updating the connection URLs at runtime
export function updateRobotConnectionURLs(apiUrl: string, wsUrl: string) {
  ROBOT_API_URL = apiUrl;
  ROBOT_WS_URL = wsUrl;
  console.log(`Updated robot connection: ${ROBOT_API_URL} (HTTP) and ${ROBOT_WS_URL} (WebSocket)`);
}