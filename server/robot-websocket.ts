import WebSocket from 'ws';
import { storage } from './storage';
import { EventEmitter } from 'events';
import { registerRobot } from './register-robot';
import https from 'https';

// We only support a single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

// Robot connection configuration
// Connection URLs can be set via environment variables to allow dynamic updates
let ROBOT_API_URL = process.env.ROBOT_API_URL;
let ROBOT_WS_URL = process.env.ROBOT_WS_URL;

// If environment variables are not set, use default connection options
if (!ROBOT_API_URL || !ROBOT_WS_URL) {
  // Try to determine if we're in a local network that can directly connect to the robot
  // For now, we'll default to the ngrok URL
  
  // 1. Direct connection via Ethernet RJ45 port (first preference for production)
  // ROBOT_API_URL = 'http://192.168.25.25:8090';
  // ROBOT_WS_URL = 'ws://192.168.25.25:8090/ws/v2/topics';
  
  // 2. Direct connection via robot AP (secondary preference for production)
  // ROBOT_API_URL = 'http://192.168.12.1:8090';
  // ROBOT_WS_URL = 'ws://192.168.12.1:8090/ws/v2/topics';
  
  // 3. Connection via ngrok (for remote development/testing)
  // This URL needs to be checked and updated if it changes
  ROBOT_API_URL = 'https://8f50-47-180-91-99.ngrok-free.app';
  ROBOT_WS_URL = 'wss://8f50-47-180-91-99.ngrok-free.app/ws/v2/topics';
}

console.log(`Using robot connection: ${ROBOT_API_URL} (HTTP) and ${ROBOT_WS_URL} (WebSocket)`);

// Allow updating the connection URLs at runtime
export function updateRobotConnectionURLs(apiUrl: string, wsUrl: string) {
  ROBOT_API_URL = apiUrl;
  ROBOT_WS_URL = wsUrl;
  console.log(`Updated robot connection: ${ROBOT_API_URL} (HTTP) and ${ROBOT_WS_URL} (WebSocket)`);
  
  // Disconnect current connection to force reconnect with new URLs
  if (robotWs) {
    robotWs.terminate();
  }
}

// Authentication note: The documentation states that requests from these IPs don't require a secret:
// - 192.168.25.* (added since 2.7.1)
// - 172.16.*     (added since 2.7.1)
// Since we're connecting to 192.168.25.25, we should not need the secret

// For testing with ngrok, we'll keep this option but it may not be needed
const ROBOT_SECRET = process.env.ROBOT_SECRET || '';

// Use node rejectUnauthorized=false to bypass SSL certificate validation
// This is only for development purposes and should be removed in production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Topics to subscribe to based on documentation
const TOPICS = {
  STATUS: ['/wheel_state'],
  POSITION: ['/tracked_pose'],
  SENSORS: ['/battery_state'],
  MAP: ['/map'],
  CAMERA: ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video']
};

// Data caches
const robotDataCache = {
  status: new Map<string, any>(),
  position: new Map<string, any>(),
  sensors: new Map<string, any>(),
  map: new Map<string, any>(),
  camera: new Map<string, any>()
};

// Event emitter for internal communication
const robotEvents = new EventEmitter();

// WebSocket client instance
let robotWs: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

// Connection status
let isConnected = false;
let enabledTopics: string[] = [];

/**
 * Initialize robot WebSocket connection
 */
export function initRobotWebSocket() {
  if (isConnecting) return;
  isConnecting = true;

  console.log(`Connecting to robot WebSocket at ${ROBOT_WS_URL}`);
  
  try {
    // Add options to handle redirects and SSL issues
    const wsOptions = {
      followRedirects: true,
      rejectUnauthorized: false,
      headers: {
        // Based on documentation, all HTTP requests must have a Secret header
        'Secret': ROBOT_SECRET
      }
    };
    
    robotWs = new WebSocket(ROBOT_WS_URL, wsOptions);
    
    robotWs.on('open', () => {
      console.log('Robot WebSocket connection established');
      isConnected = true;
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Enable all needed topics after connection
      enableRequiredTopics();
    });
    
    robotWs.on('message', (data) => {
      try {
        handleRobotMessage(data.toString());
      } catch (err) {
        console.error('Error handling robot WebSocket message:', err);
      }
    });
    
    robotWs.on('error', (error) => {
      console.error('Robot WebSocket error:', error);
      console.error('Connection error occurred. Attempting to reconnect...');
      isConnected = false;
    });
    
    robotWs.on('close', (code, reason) => {
      console.log(`Robot WebSocket connection closed: ${code} ${reason}`);
      isConnected = false;
      isConnecting = false;
      
      // Attempt to reconnect with exponential backoff
      handleReconnect();
    });
    
    // Add a timeout to detect stalled connections
    setTimeout(() => {
      if (robotWs && robotWs.readyState !== WebSocket.OPEN) {
        console.log('WebSocket connection timed out, forcing close');
        robotWs.terminate();
      }
    }, 10000);
  } catch (error) {
    console.error('Failed to connect to robot WebSocket:', error);
    isConnecting = false;
    handleReconnect();
  }
}

/**
 * Handle WebSocket reconnection with exponential backoff
 */
function handleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  const maxReconnectAttempts = 10;
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.log(`Maximum reconnection attempts (${maxReconnectAttempts}) reached, waiting longer...`);
    reconnectTimeout = setTimeout(() => {
      reconnectAttempts = 0;
      initRobotWebSocket();
    }, 30000); // Wait 30 seconds before trying again
    return;
  }
  
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  console.log(`Attempting to reconnect to robot WebSocket in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    initRobotWebSocket();
  }, delay);
}

/**
 * Enable required topics for robot data
 */
function enableRequiredTopics() {
  if (!robotWs || robotWs.readyState !== WebSocket.OPEN) {
    console.error('Cannot enable topics: WebSocket is not connected');
    return;
  }
  
  // Combine all topics we want to enable
  const allTopics = [
    ...TOPICS.STATUS,
    ...TOPICS.POSITION,
    ...TOPICS.SENSORS,
    ...TOPICS.MAP,
    ...TOPICS.CAMERA
  ];
  
  // Deduplicate topics
  const uniqueTopics = [...new Set(allTopics)];
  
  // Check if we support multi-topic subscription
  if (uniqueTopics.length > 1) {
    // Try multi-topic subscription (since 2.7.0)
    robotWs.send(JSON.stringify({
      enable_topic: uniqueTopics
    }));
  } else {
    // Fall back to single topic subscription
    uniqueTopics.forEach(topic => {
      robotWs.send(JSON.stringify({
        enable_topic: topic
      }));
    });
  }
  
  // Store enabled topics
  enabledTopics = uniqueTopics;
  console.log('Enabled robot topics:', enabledTopics);
}

/**
 * Handle incoming robot WebSocket messages
 */
function handleRobotMessage(messageData: string) {
  try {
    const message = JSON.parse(messageData);
    const topic = message.topic;
    
    if (!topic) {
      // This might be a response to our enable_topic request
      console.log('Received non-topic message from robot:', message);
      return;
    }
    
    // Process message based on topic
    if (TOPICS.STATUS.includes(topic)) {
      // Status data
      robotDataCache.status.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('status_update', PHYSICAL_ROBOT_SERIAL, message);
    } 
    else if (TOPICS.POSITION.includes(topic)) {
      // Position data
      robotDataCache.position.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('position_update', PHYSICAL_ROBOT_SERIAL, message);
    }
    else if (TOPICS.SENSORS.includes(topic)) {
      // Sensor data
      robotDataCache.sensors.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('sensor_update', PHYSICAL_ROBOT_SERIAL, message);
    }
    else if (TOPICS.MAP.includes(topic)) {
      // Map data
      robotDataCache.map.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('map_update', PHYSICAL_ROBOT_SERIAL, message);
    }
    else if (TOPICS.CAMERA.includes(topic)) {
      // Camera data (compressed or video)
      robotDataCache.camera.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('camera_update', PHYSICAL_ROBOT_SERIAL, message);
    }
    else {
      console.log(`Received message from unhandled topic ${topic}`);
    }
  } catch (error) {
    console.error('Error parsing robot WebSocket message:', error);
  }
}

/**
 * Get the latest robot status data
 */
export function getRobotStatus(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const statusData = robotDataCache.status.get(serialNumber);
  
  if (!statusData) {
    // We don't have status data yet
    return null;
  }
  
  // Transform from robot format to our API format
  return {
    model: "Physical Robot (Live)",
    serialNumber,
    battery: getBatteryLevel(serialNumber),
    status: statusData.control_mode || 'unknown',
    mode: statusData.emergency_stop_pressed ? 'emergency' : 'ready',
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Get the latest robot position data
 */
export function getRobotPosition(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const positionData = robotDataCache.position.get(serialNumber);
  
  if (!positionData) {
    // We don't have position data yet
    return null;
  }
  
  // Transform from robot format to our API format
  return {
    x: positionData.pos?.[0] || 0,
    y: positionData.pos?.[1] || 0,
    z: 0, // Z coordinate not provided in /tracked_pose
    orientation: positionData.ori || 0,
    speed: 0, // Speed not provided in /tracked_pose
    timestamp: new Date().toISOString()
  };
}

/**
 * Get the battery level from sensor data
 */
function getBatteryLevel(serialNumber: string): number {
  const sensorData = robotDataCache.sensors.get(serialNumber);
  if (!sensorData) return 0;
  
  // Return battery percentage as a number from 0-100
  return Math.round((sensorData.percentage || 0) * 100);
}

/**
 * Get the latest robot sensor data
 */
export function getRobotSensorData(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const sensorData = robotDataCache.sensors.get(serialNumber);
  
  if (!sensorData) {
    // We don't have sensor data yet
    return null;
  }
  
  // Transform from robot format to our API format
  return {
    temperature: 22, // Temperature not provided in /battery_state
    humidity: 45, // Humidity not provided in /battery_state
    proximity: [], // Proximity not provided in /battery_state
    battery: Math.round((sensorData.percentage || 0) * 100),
    timestamp: new Date().toISOString(),
    charging: sensorData.power_supply_status === 'charging'
  };
}

/**
 * Get the latest robot map data
 */
export function getRobotMapData(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const mapData = robotDataCache.map.get(serialNumber);
  
  if (!mapData) {
    // We don't have map data yet
    return null;
  }
  
  // Transform from robot format to our API format
  return {
    grid: [], // We would need to decode the base64 PNG data to get the actual grid
    obstacles: [], // No direct obstacles data in /map
    paths: [] // No direct paths data in /map
  };
}

/**
 * Get the latest robot camera data
 */
export function getRobotCameraData(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const cameraData = robotDataCache.camera.get(serialNumber);
  
  if (!cameraData) {
    // We don't have camera data yet
    return null;
  }
  
  // Return camera configuration
  return {
    enabled: true,
    streamUrl: `/api/robot-video/${serialNumber}`,
    resolution: {
      width: 640,
      height: 480
    },
    rotation: 0,
    nightVision: false,
    timestamp: new Date().toISOString()
  };
}

/**
 * Subscribe to robot data updates
 */
export function subscribeToRobotUpdates(event: string, callback: (serialNumber: string, data: any) => void) {
  robotEvents.on(event, callback);
  return () => robotEvents.off(event, callback);
}

/**
 * Check if connected to robot
 */
export function isRobotConnected() {
  return isConnected;
}

/**
 * Get a frame of video data from the robot
 */
export function getVideoFrame(serialNumber: string): Buffer | null {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  const cameraData = robotDataCache.camera.get(serialNumber);
  
  if (!cameraData || !cameraData.data) {
    // We don't have camera data yet or it doesn't contain frame data
    return null;
  }
  
  // For video topics, data should be base64 encoded h264 data
  if (cameraData.topic === '/rgb_cameras/front/video') {
    try {
      return Buffer.from(cameraData.data, 'base64');
    } catch (error) {
      console.error('Error decoding video frame:', error);
      return null;
    }
  }
  
  // For compressed topics, data should be base64 encoded JPEG
  if (cameraData.topic === '/rgb_cameras/front/compressed') {
    try {
      return Buffer.from(cameraData.data, 'base64');
    } catch (error) {
      console.error('Error decoding compressed image:', error);
      return null;
    }
  }
  
  return null;
}

// Initialize the connection when this module is loaded
initRobotWebSocket();