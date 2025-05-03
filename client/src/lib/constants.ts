/**
 * Application Constants
 * 
 * This file defines global constants used throughout the application.
 */

// The serial number of the physical robot we're connecting to
export const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

// WebSocket connection retry delay (in milliseconds)
export const WS_RECONNECT_DELAY = 3000;

// Maximum number of WebSocket reconnection attempts before showing an error
export const MAX_WS_RECONNECT_ATTEMPTS = 5;

// Power cycle configuration
export const POWER_CYCLE_COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes between power cycles

// Map update frequency (in milliseconds)
export const MAP_UPDATE_INTERVAL = 5000;

// Sensor polling interval (in milliseconds)
export const SENSOR_POLLING_INTERVAL = 3000;

// Lidar update interval (in milliseconds)
export const LIDAR_UPDATE_INTERVAL = 1000;

// Camera update interval (in milliseconds)
export const CAMERA_UPDATE_INTERVAL = 2000;

// Default robot position visualization parameters
export const DEFAULT_ROBOT_SCALE = 0.5;
export const DEFAULT_ROBOT_STROKE_WIDTH = 2;
export const DEFAULT_ROBOT_FILL_COLOR = 'rgba(59, 130, 246, 0.5)';
export const DEFAULT_ROBOT_STROKE_COLOR = 'rgb(37, 99, 235)';