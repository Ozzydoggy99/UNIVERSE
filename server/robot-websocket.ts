import WebSocket from 'ws';
import { storage } from './mem-storage';
import { EventEmitter } from 'events';
import { registerRobot } from './register-robot';
import https from 'https';

// Import shared constants
import { 
  PHYSICAL_ROBOT_SERIAL,
  ROBOT_API_URL,
  ROBOT_WS_URL,
  ROBOT_SECRET,
  updateRobotConnectionURLs as updateConnectionURLs
} from './robot-constants';

console.log(`Using robot connection: ${ROBOT_API_URL} (HTTP) and ${ROBOT_WS_URL} (WebSocket)`);

// Re-export the updateRobotConnectionURLs function with additional functionality
export function updateRobotConnectionURLs(apiUrl: string, wsUrl: string) {
  updateConnectionURLs(apiUrl, wsUrl);
  
  // Disconnect current connection to force reconnect with new URLs
  if (robotWs) {
    robotWs.terminate();
  }
}

// Use node rejectUnauthorized=false to bypass SSL certificate validation
// This is only for development purposes and should be removed in production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Topics to subscribe to based on documentation and actual robot data
const TOPICS = {
  STATUS: ['/wheel_state', '/ws_connections'],
  POSITION: ['/tracked_pose', '/robot/footprint'],
  SENSORS: ['/battery_state'],
  MAP: ['/map', '/slam/state'],
  CAMERA: ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video'],
  LIDAR: ['/scan']
};

// Data caches
const robotDataCache = {
  status: new Map<string, any>(),
  position: new Map<string, any>(),
  sensors: new Map<string, any>(),
  map: new Map<string, any>(),
  camera: new Map<string, any>(),
  lidar: new Map<string, any>()
};

// Event emitter for internal communication
const robotEvents = new EventEmitter();

// WebSocket client instance
let robotWs: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;
let reconnectInterval: NodeJS.Timeout | null = null;

// Connection status
let isConnected = false;
let enabledTopics: string[] = [];
let lastReconnectTime = 0;

// Logging flags to only log each message type once
let positionDataLogged = false;
let footprintDataLogged = false;
let batteryDataLogged = false;
let mapDataLogged = false;
let slamDataLogged = false;
let cameraDataLogged = false;
let lidarDataLogged = false;

/**
 * Initialize robot WebSocket connection
 */
export function initRobotWebSocket() {
  if (isConnecting) return;
  isConnecting = true;

  // Record the time of this connection attempt
  lastReconnectTime = Date.now();

  // Make sure we have a WebSocket URL
  if (!ROBOT_WS_URL) {
    console.error('WebSocket URL not defined, cannot connect to robot');
    isConnecting = false;
    return;
  }
  
  console.log(`Connecting to robot WebSocket at ${ROBOT_WS_URL}`);
  
  try {
    // Add options to handle redirects and SSL issues
    const wsOptions = {
      followRedirects: true,
      rejectUnauthorized: false,
      headers: {
        // Based on documentation, all HTTP requests must have a Secret header
        'Secret': process.env.ROBOT_SECRET || ''
      }
    };
    
    console.log('Using Secret header for authentication');
    
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
    // Port forwarded connections may take longer to establish
    setTimeout(() => {
      if (robotWs && robotWs.readyState !== WebSocket.OPEN) {
        console.log('WebSocket connection timed out, forcing close');
        robotWs.terminate();
      }
    }, 15000); // Increased timeout for port forwarded connection
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
  
  // Clear any existing reconnect interval
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  const maxReconnectAttempts = 10;
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.log(`Maximum reconnection attempts (${maxReconnectAttempts}) reached, waiting longer...`);
    
    // After max attempts, switch to a persistent reconnection strategy
    // This will keep trying to reconnect every 30 seconds indefinitely
    reconnectAttempts = 0;
    
    // First immediate attempt
    setTimeout(() => {
      console.log('Starting persistent reconnection attempts...');
      initRobotWebSocket();
      
      // Then set up regular attempts every 30 seconds
      reconnectInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastAttempt = now - lastReconnectTime;
        
        // Only attempt reconnection if we're not already connecting
        // and if enough time has passed since the last attempt
        if (!isConnecting && timeSinceLastAttempt > 10000) { // 10 seconds minimum between attempts
          console.log('Persistent reconnection attempt...');
          lastReconnectTime = now;
          initRobotWebSocket();
        }
      }, 30000); // Try every 30 seconds indefinitely
    }, 1000); // Small delay before first attempt
    
    return;
  }
  
  // Standard exponential backoff for initial attempts
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  console.log(`Attempting to reconnect to robot WebSocket in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  
  // Record the time of this reconnection attempt
  lastReconnectTime = Date.now();
  
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
    ...TOPICS.CAMERA,
    ...TOPICS.LIDAR
  ];
  
  // Deduplicate topics - use Array.from to avoid TypeScript issues
  const uniqueTopics = Array.from(new Set<string>(allTopics));
  
  // Check if we support multi-topic subscription
  if (uniqueTopics.length > 1 && robotWs) {
    // Try multi-topic subscription (since 2.7.0)
    robotWs.send(JSON.stringify({
      enable_topic: uniqueTopics
    }));
  } else if (robotWs) {
    // Fall back to single topic subscription
    for (const topic of uniqueTopics) {
      robotWs.send(JSON.stringify({
        enable_topic: topic
      }));
    }
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
      
      // Log status message once to see the structure
      if (topic === '/wheel_state') {
        console.log('Robot wheel state data structure:', JSON.stringify(message, null, 2));
      } else if (topic === '/ws_connections') {
        console.log('Robot connections data structure:', JSON.stringify(message, null, 2));
      }
    } 
    else if (TOPICS.POSITION.includes(topic)) {
      // Position data
      robotDataCache.position.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('position_update', PHYSICAL_ROBOT_SERIAL, message);
      
      // Log position message once to see the structure
      if (topic === '/tracked_pose' && !positionDataLogged) {
        console.log('Robot position data structure:', JSON.stringify(message, null, 2));
        positionDataLogged = true;
      } else if (topic === '/robot/footprint' && !footprintDataLogged) {
        console.log('Robot footprint data structure:', JSON.stringify(message, null, 2));
        footprintDataLogged = true;
      }
    }
    else if (TOPICS.SENSORS.includes(topic)) {
      // Sensor data
      robotDataCache.sensors.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('sensor_update', PHYSICAL_ROBOT_SERIAL, message);
      
      // Log sensor message once to see the structure
      if (topic === '/battery_state' && !batteryDataLogged) {
        console.log('Robot battery data structure:', JSON.stringify(message, null, 2));
        batteryDataLogged = true;
      }
    }
    else if (TOPICS.MAP.includes(topic)) {
      // Map data
      robotDataCache.map.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('map_update', PHYSICAL_ROBOT_SERIAL, message);
      
      // Log map message once to see the structure (but not the full data as it might be large)
      if (topic === '/map' && !mapDataLogged) {
        const { data, ...mapInfo } = message;
        console.log('Robot map data structure (without full data array):', JSON.stringify(mapInfo, null, 2));
        console.log('Map data length:', data ? data.length : 0);
        mapDataLogged = true;
      } else if (topic === '/slam/state' && !slamDataLogged) {
        console.log('Robot SLAM state data structure:', JSON.stringify(message, null, 2));
        slamDataLogged = true;
      }
    }
    else if (TOPICS.CAMERA.includes(topic)) {
      // Camera data (compressed or video)
      robotDataCache.camera.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('camera_update', PHYSICAL_ROBOT_SERIAL, message);
      
      // Log camera message once to see the structure (but not the full image data)
      if ((topic === '/rgb_cameras/front/compressed' || topic === '/rgb_cameras/front/video') && !cameraDataLogged) {
        const { data, ...cameraInfo } = message;
        console.log('Robot camera data structure (without image data):', JSON.stringify(cameraInfo, null, 2));
        console.log('Camera data length:', data ? data.length : 0);
        cameraDataLogged = true;
      }
    }
    else if (TOPICS.LIDAR.includes(topic)) {
      // LiDAR data
      robotDataCache.lidar.set(PHYSICAL_ROBOT_SERIAL, message);
      robotEvents.emit('lidar_update', PHYSICAL_ROBOT_SERIAL, message);
      
      // Log LiDAR message once to see the structure (but not the full data as it might be large)
      if (topic === '/scan' && !lidarDataLogged) {
        const { intensities, ranges, ...lidarInfo } = message;
        console.log('Robot LiDAR data structure (without ranges array):', JSON.stringify(lidarInfo, null, 2));
        console.log('LiDAR ranges length:', ranges ? ranges.length : 0);
        console.log('LiDAR intensities length:', intensities ? intensities.length : 0);
        lidarDataLogged = true;
      }
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
  
  // If we're not connected to the robot, return a special status
  if (!isRobotConnected()) {
    return {
      model: "AxBot Physical Robot (Live)",
      serialNumber,
      battery: 0,
      status: 'offline',
      mode: 'disconnected',
      error: 'Connection to robot lost. Please check network connectivity.',
      slam_state: 'unknown',
      slam_quality: 0,
      lastUpdate: new Date().toISOString(),
      connectionStatus: 'disconnected'
    };
  }
  
  const statusData = robotDataCache.status.get(serialNumber);
  const slamState = getTopicData(serialNumber, 'map', '/slam/state');
  
  if (!statusData) {
    // We don't have status data yet, but we are connected to the robot
    return {
      model: "AxBot Physical Robot (Live)",
      serialNumber,
      battery: getBatteryLevel(serialNumber) || 0,
      status: 'online', // Change to online to match UI expectations
      operationalStatus: 'initializing',
      mode: 'initializing',
      error: 'Waiting for robot data...',
      slam_state: 'unknown',
      slam_quality: 0,
      lastUpdate: new Date().toISOString(),
      connectionStatus: 'connected', // Change to connected to avoid showing "Offline"
      uptime: '0 seconds'
    };
  }
  
  // Transform from robot format to our API format
  // Update status to 'online' instead of control_mode for better UI display
  return {
    model: "AxBot Physical Robot (Live)",
    serialNumber,
    battery: getBatteryLevel(serialNumber),
    status: 'online', // Set to 'online' when connected to match the UI expectations
    operationalStatus: statusData.control_mode || 'autonomous',
    mode: statusData.emergency_stop_pressed ? 'emergency' : 'ready',
    error: statusData.error_msg || '',
    slam_state: slamState?.state || 'unknown',
    slam_quality: slamState?.position_quality || 0,
    lastUpdate: new Date().toISOString(),
    connectionStatus: 'connected',
    uptime: Math.floor(Date.now() / 1000 - 1746077000) + ' seconds' // Simple uptime calculation
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
  
  // If we're not connected to the robot, return a disconnected status
  if (!isRobotConnected()) {
    return {
      x: 0,
      y: 0,
      z: 0,
      orientation: 0,
      speed: 0,
      footprint: [],
      covariance: [[0,0],[0,0]],
      timestamp: new Date().toISOString(),
      connectionStatus: 'disconnected'
    };
  }
  
  const positionData = robotDataCache.position.get(serialNumber);
  const footprintData = getTopicData(serialNumber, 'position', '/robot/footprint');
  
  if (!positionData) {
    // We don't have position data yet, but we are connected
    return {
      x: 0,
      y: 0,
      z: 0,
      orientation: 0,
      speed: 0,
      footprint: [],
      covariance: [[0,0],[0,0]],
      timestamp: new Date().toISOString(),
      connectionStatus: 'connecting'
    };
  }
  
  // Transform from robot format to our API format
  return {
    x: positionData.pos?.[0] || 0,
    y: positionData.pos?.[1] || 0,
    z: 0, // Z coordinate not provided in /tracked_pose
    orientation: positionData.ori || 0,
    speed: 0, // Speed not provided in /tracked_pose
    footprint: footprintData?.footprint || [],
    covariance: positionData.cov || [[0,0],[0,0]],
    timestamp: new Date().toISOString(),
    connectionStatus: 'connected'
  };
}

/**
 * Get a specific topic's data from a robot data cache category
 */
function getTopicData(serialNumber: string, category: keyof typeof robotDataCache, topicName: string) {
  const allData = robotDataCache[category].get(serialNumber);
  if (!allData) return null;
  
  // If the data is already for the requested topic, return it
  if (allData.topic === topicName) {
    return allData;
  }
  
  // Otherwise, we don't have the specific topic data
  return null;
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
  
  // If we're not connected to the robot, return a disconnected status
  if (!isRobotConnected()) {
    return {
      temperature: 0,
      voltage: 0,
      current: 0,
      battery: 0,
      power_supply_status: 'unknown',
      timestamp: new Date().toISOString(),
      charging: false,
      connectionStatus: 'disconnected'
    };
  }
  
  const sensorData = robotDataCache.sensors.get(serialNumber);
  
  if (!sensorData) {
    // We don't have sensor data yet, but we are connected
    return {
      temperature: 0,
      voltage: 0,
      current: 0,
      battery: 0,
      power_supply_status: 'unknown',
      timestamp: new Date().toISOString(),
      charging: false,
      connectionStatus: 'connecting'
    };
  }
  
  // Transform from robot format to our API format
  return {
    temperature: sensorData.temperature || 22,
    voltage: sensorData.voltage || 0,
    current: sensorData.current || 0,
    battery: Math.round((sensorData.percentage || 0) * 100),
    power_supply_status: sensorData.power_supply_status || 'unknown',
    timestamp: new Date().toISOString(),
    charging: sensorData.power_supply_status === 'charging' || sensorData.charging === true,
    connectionStatus: 'connected'
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
  
  // If we're not connected to the robot, return a disconnected status
  if (!isRobotConnected()) {
    return {
      grid: [],
      obstacles: [],
      paths: [],
      size: [0, 0],
      resolution: 0.05,
      origin: [0, 0],
      connectionStatus: 'disconnected'
    };
  }
  
  const mapData = robotDataCache.map.get(serialNumber);
  
  if (!mapData) {
    // We don't have map data yet, but we are connected
    return {
      grid: [],
      obstacles: [],
      paths: [],
      size: [0, 0],
      resolution: 0.05,
      origin: [0, 0],
      connectionStatus: 'connecting'
    };
  }
  
  // For topic '/map' the format is described in the documentation:
  // {
  //   "topic": "/map",
  //   "resolution": 0.1, // the width/height of a single pixel, in meter
  //   "size": [182, 59], // the size of the image, in pixel
  //   "origin": [-8.1, -4.8], // The world coordinate of the lower left pixel
  //   "data": "iVBORw0KGgoAAAANSUhEUgAAALYAAAA7BAAAAA..." // Base64 encoded PNG file
  // }
  
  if (mapData.topic === '/map') {
    console.log('Processing map data from WebSocket topic /map');
    // Transform from robot format to our API format
    return {
      grid: mapData.data || [], // This is a base64 encoded PNG
      obstacles: [], // Not in this data
      paths: [], // Not in this data
      size: mapData.size || [0, 0],
      resolution: mapData.resolution || 0.05,
      origin: mapData.origin || [0, 0],
      connectionStatus: 'connected'
    };
  }
  
  // For topic '/slam/state' we don't have map data but we might have position quality
  if (mapData.topic === '/slam/state') {
    // For SLAM state, we'd need to combine with actual map data
    // Just return basic info - this will be enhanced when combined with map data
    const otherMapData = getTopicData(serialNumber, 'map', '/map');
    
    if (otherMapData && otherMapData.topic === '/map') {
      // We have both SLAM state and map data
      return {
        grid: otherMapData.data || [],
        obstacles: [],
        paths: [],
        size: otherMapData.size || [0, 0],
        resolution: otherMapData.resolution || 0.05,
        origin: otherMapData.origin || [0, 0],
        position_quality: mapData.position_quality || 0,
        reliable: mapData.reliable || false,
        lidar_reliable: mapData.lidar_reliable || false,
        connectionStatus: 'connected'
      };
    }
    
    // We only have SLAM state, no actual map data
    return {
      grid: [],
      obstacles: [],
      paths: [],
      size: [0, 0],
      resolution: 0.05,
      origin: [0, 0],
      position_quality: mapData.position_quality || 0,
      reliable: mapData.reliable || false,
      lidar_reliable: mapData.lidar_reliable || false,
      connectionStatus: 'connected'
    };
  }
  
  // Generic fallback if we have some other type of map data
  console.log(`Processing map data from topic ${mapData.topic || 'unknown'}`);
  return {
    grid: mapData.data || [],
    obstacles: [],
    paths: [],
    size: mapData.size || [0, 0],
    resolution: mapData.resolution || 0.05,
    origin: mapData.origin || [0, 0],
    connectionStatus: 'connected'
  };
}

/**
 * Get the latest robot LiDAR data
 */
export function getRobotLidarData(serialNumber: string) {
  // Check if we have data for this robot
  if (serialNumber !== PHYSICAL_ROBOT_SERIAL) {
    return null;
  }
  
  // If we're not connected to the robot, return a disconnected status
  if (!isRobotConnected()) {
    return {
      ranges: [],
      angle_min: 0,
      angle_max: 0,
      angle_increment: 0,
      range_min: 0,
      range_max: 0,
      intensities: [],
      timestamp: new Date().toISOString(),
      connectionStatus: 'disconnected'
    };
  }
  
  const lidarData = robotDataCache.lidar.get(serialNumber);
  
  if (!lidarData) {
    // We don't have LiDAR data yet, but we are connected
    return {
      ranges: [],
      angle_min: 0,
      angle_max: 0,
      angle_increment: 0,
      range_min: 0,
      range_max: 0,
      intensities: [],
      timestamp: new Date().toISOString(),
      connectionStatus: 'connecting'
    };
  }
  
  // Transform from robot format to our API format
  return {
    ranges: lidarData.ranges || [],
    angle_min: lidarData.angle_min || 0,
    angle_max: lidarData.angle_max || 0,
    angle_increment: lidarData.angle_increment || 0,
    range_min: lidarData.range_min || 0,
    range_max: lidarData.range_max || 0,
    intensities: lidarData.intensities || [],
    timestamp: new Date().toISOString(),
    connectionStatus: 'connected'
  };
}

/**
 * Subscribe to robot LiDAR updates
 */
export function subscribeToLidarUpdates(callback: (serialNumber: string, data: any) => void) {
  robotEvents.on('lidar_update', callback);
  return () => {
    robotEvents.off('lidar_update', callback);
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
  
  // If we're not connected to the robot, return a disconnected status
  if (!isRobotConnected()) {
    return {
      enabled: false,
      streamUrl: `/api/robot-video-frame/${serialNumber}`,
      resolution: {
        width: 640,
        height: 480
      },
      rotation: 0,
      nightVision: false,
      timestamp: new Date().toISOString(),
      connectionStatus: 'disconnected'
    };
  }
  
  const cameraData = robotDataCache.camera.get(serialNumber);
  
  if (!cameraData) {
    // We don't have camera data yet, but we are connected
    return {
      enabled: false,
      streamUrl: `/api/robot-video-frame/${serialNumber}`,
      resolution: {
        width: 640,
        height: 480
      },
      rotation: 0,
      nightVision: false,
      timestamp: new Date().toISOString(),
      connectionStatus: 'connecting'
    };
  }
  
  // Transform from robot format to our API format
  return {
    enabled: true,
    streamUrl: `/api/robot-video-frame/${serialNumber}`,
    resolution: {
      width: cameraData.width || 640,
      height: cameraData.height || 480
    },
    rotation: 0,
    nightVision: false,
    timestamp: new Date().toISOString(),
    connectionStatus: 'connected'
  };
}

/**
 * Subscribe to robot data updates
 */
export function subscribeToRobotUpdates(event: string, callback: (serialNumber: string, data: any) => void) {
  robotEvents.on(event, callback);
  
  // Return unsubscribe function
  return () => {
    robotEvents.off(event, callback);
  };
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