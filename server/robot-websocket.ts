// server/robot-websocket.ts
/**
 * Robot WebSocket interface for real-time communication
 * Simplified single-connection approach
 * Uses proper AutoXing API authentication format
 */
import WebSocket, { WebSocketServer } from 'ws';
import { Request } from 'express';
import { Server } from 'http';
import { ROBOT_API_URL, ROBOT_WS_URL, ROBOT_SECRET, getAuthHeaders, ROBOT_IP } from './robot-constants';
import { robotPositionTracker } from './robot-position-tracker';

// Initialize connection states
let robotWs: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

// Client tracking
const clients: Set<WebSocket> = new Set();

// Topic classifications for forwarding to frontend with context
const topicCategories: Record<string, string[]> = {
  'status': ['/battery_state', '/detailed_battery_state', '/wheel_state'],
  'pose': ['/tracked_pose', '/robot/footprint'],
  'map': ['/map', '/map_v2', '/slam/state'],
  'video': ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video'],
  'lidar': ['/scan', '/lidar/scan', '/lidar/pointcloud'],
};

// List of topics to subscribe to from the robot
const subscribeTopics: string[] = [
  '/tracked_pose',         // Robot position
  '/battery_state',        // Battery information
  '/wheel_state',          // Wheel status
  '/slam/state',           // SLAM status
  '/map',                  // Map data
  '/scan',                 // 2D LiDAR data showing people moving
  '/scan_matched_points2', // 3D LiDAR point cloud data
  '/lidar/scan'            // Alternative LiDAR path
];

/**
 * Get the WebSocket URL for the robot
 */
function getRobotWebSocketUrl(): string {
  // Use the WebSocket URL from constants
  return ROBOT_WS_URL;
}

/**
 * Connect to the robot WebSocket
 */
function connectRobotWebSocket() {
  if (isConnecting || (robotWs && robotWs.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  const wsUrl = getRobotWebSocketUrl();
  console.log(`Connecting to robot WebSocket at ${wsUrl}`);

  try {
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      console.log('Robot WebSocket connection timed out');
      if (robotWs) {
        try {
          robotWs.terminate();
        } catch (e) {
          console.error('Error terminating robot WebSocket:', e);
        }
      }
      robotWs = null;
      isConnecting = false;
      scheduleReconnect();
    }, 10000);

    // Create connection with proper auth headers according to AutoXing API docs
    // Explicitly format the correct WebSocket URL with topics path that robot needs
    const robotIp = process.env.ROBOT_IP || "47.180.91.99";
    const fullWsUrl = `ws://${robotIp}:8090/ws/v2/topics`;
    
    console.log(`Connecting to robot WebSocket at ${fullWsUrl}`);
    
    robotWs = new WebSocket(fullWsUrl, {
      headers: getAuthHeaders()
    });

    robotWs.on('open', () => {
      console.log('Robot WebSocket connection established');
      
      // Clear timeout and update state
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      isConnecting = false;
      reconnectAttempt = 0;

      // Subscribe to topics
      // According to the updated API documentation, we should use the enable_topics command
      // with an array of topics for more efficient subscription
      try {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          // Per the AutoXing API docs, we need to use the command format:
          // { "command": "enable_topics", "topics": ["/topic1", "/topic2"] }
          robotWs.send(JSON.stringify({
            command: "enable_topics",
            topics: subscribeTopics
          }));
          console.log(`Subscribed to robot topics: ${subscribeTopics.join(', ')}`);
        }
      } catch (e) {
        console.error(`Error subscribing to topics:`, e);
      }

      // Set up ping interval
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      
      pingInterval = setInterval(() => {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          try {
            robotWs.ping();
          } catch (e) {
            console.error('Error sending ping to robot WebSocket:', e);
          }
        }
      }, 30000);

      // Notify clients of connection
      broadcastToClients({
        type: 'connection',
        status: 'connected',
        timestamp: Date.now()
      });
    });

    // Data will be stored in the top-level variables
    
    robotWs.on('message', (data) => {
      try {
        const messageStr = data.toString();
        let message: any;
        
        try {
          message = JSON.parse(messageStr);
        } catch (e) {
          // Not JSON, just use raw data
          message = { raw: messageStr };
        }

        // Categorize message by topic if available
        if (message.topic) {
          let category = 'other';
          
          // Find which category this topic belongs to
          for (const [cat, topics] of Object.entries(topicCategories)) {
            if (topics.includes(message.topic)) {
              category = cat;
              break;
            }
          }

          // Store data by topic for later retrieval
          if (message.topic === '/tracked_pose' || message.topic === '/robot/footprint') {
            // Handle position data
            // Position tracker imported at the top of file
            
            // Extract position data properly based on message format
            let posData = {
              x: 0,
              y: 0,
              theta: 0,
              timestamp: Date.now()
            };
            
            if (message.pos && Array.isArray(message.pos) && message.pos.length >= 2) {
              posData.x = message.pos[0];
              posData.y = message.pos[1];
              posData.theta = message.ori || 0;
            } else if (message.data && message.data.pos && Array.isArray(message.data.pos)) {
              posData.x = message.data.pos[0];
              posData.y = message.data.pos[1];
              posData.theta = message.data.ori || 0;
            } else if (message.x !== undefined && message.y !== undefined) {
              posData.x = message.x;
              posData.y = message.y;
              posData.theta = message.theta || message.orientation || 0;
            } else if (message.data && message.data.x !== undefined) {
              posData.x = message.data.x;
              posData.y = message.data.y;
              posData.theta = message.data.theta || message.data.orientation || 0;
            }
            
            // Update the position tracker
            robotPositionTracker.updatePosition(posData);
          } else if (message.topic === '/map' || message.topic === '/map_v2') {
            // Store map data in top-level variable
            latestMapData = message;
            console.log(`Stored latest map data from ${message.topic}`);
          } else if (category === 'lidar') {
            // Store LiDAR data in top-level variable
            latestLidarData = message;
            
            // For better debugging, let's extract the structure of the data
            const dataStructure = {};
            
            // If message has data property, check its format
            if (message.data) {
              // List all top-level properties in the data
              Object.keys(message.data).forEach(key => {
                const value = message.data[key];
                if (Array.isArray(value)) {
                  dataStructure[key] = `Array[${value.length}]`;
                } else if (typeof value === 'object' && value !== null) {
                  dataStructure[key] = 'Object';
                } else {
                  dataStructure[key] = typeof value;
                }
              });
            }
            
            // Check if we have point cloud data directly in message (not nested in data)
            const hasPointCloud = (message.points && message.points.length > 0) || 
                                  (message.data && message.data.points && message.data.points.length > 0);
            const hasRanges = (message.ranges && message.ranges.length > 0) || 
                              (message.data && message.data.ranges && message.data.ranges.length > 0);
                              
            console.log(`Received LiDAR data from topic ${message.topic} - Has point cloud: ${hasPointCloud}, Has ranges: ${hasRanges}`);
            console.log(`LiDAR data structure: ${JSON.stringify(dataStructure)}`);
          } else if (message.topic === '/battery_state') {
            // Store battery data
            latestBatteryData = message;
            console.log(`Stored latest battery data: ${message.percentage ? (message.percentage * 100).toFixed(1) + '%' : 'unknown'}`);
          }
          
          // Forward with category info
          broadcastToClients({
            type: 'data',
            category,
            topic: message.topic,
            data: message,
            timestamp: Date.now()
          });
        } else if (message.error) {
          // Handle error messages
          console.log('Robot WebSocket error message:', message.error);
          
          broadcastToClients({
            type: 'error',
            error: message.error,
            timestamp: Date.now()
          });
        } else {
          // Just forward other messages
          broadcastToClients({
            type: 'data',
            category: 'unknown',
            data: message,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.error('Error processing robot WebSocket message:', e);
      }
    });

    robotWs.on('error', (error) => {
      console.error('Robot WebSocket error:', error);
      console.log('Connection error occurred. Attempting to reconnect...');
    });

    robotWs.on('close', (code, reason) => {
      console.log(`Robot WebSocket connection closed: ${code} ${reason || ''}`);
      
      // Clean up intervals
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      robotWs = null;
      isConnecting = false;

      // Notify clients
      broadcastToClients({
        type: 'connection',
        status: 'disconnected',
        code,
        reason: reason?.toString(),
        timestamp: Date.now()
      });

      // Try to reconnect
      scheduleReconnect();
    });
  } catch (error) {
    console.error('Error creating robot WebSocket connection:', error);
    isConnecting = false;
    robotWs = null;
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectAttempt++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 30000);
  console.log(`Attempting to reconnect to robot WebSocket in ${delay}ms (attempt ${reconnectAttempt})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRobotWebSocket();
  }, delay);
}

/**
 * Broadcast a message to all connected clients
 */
function broadcastToClients(message: any) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (e) {
        console.error('Error broadcasting to client:', e);
      }
    }
  });
}

/**
 * Get the current WebSocket connection status
 */
export function getRobotWebSocketStatus(): string {
  if (robotWs && robotWs.readyState === WebSocket.OPEN) {
    return 'connected';
  } else if (isConnecting) {
    return 'connecting';
  } else {
    return 'disconnected';
  }
}

// Storage for latest topic data for access outside the WebSocket connection
let latestMapData: any = null;
let latestLidarData: any = null;
let latestBatteryData: any = null;

/**
 * Get the latest map data from the robot
 */
export function getLatestMapData(): any {
  return latestMapData;
}

/**
 * Get the latest LiDAR data from the robot
 */
export function getLatestLidarData(): any {
  return latestLidarData;
}

/**
 * Get the latest battery data from the robot
 */
export function getLatestBatteryData(): any {
  return latestBatteryData && latestBatteryData.percentage ? 
    { percentage: latestBatteryData.percentage, charging: !!latestBatteryData.charging } : 
    null;
}

/**
 * Get robot status information
 */
export function getRobotStatus(serialNumber: string) {
  if (!(robotWs && robotWs.readyState === WebSocket.OPEN)) {
    throw new Error('Cannot get robot status: Robot WebSocket not connected');
  }
  
  // Only return minimal status when connected
  return {
    connected: true,
    reconnectAttempt,
    serialNumber,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get robot position information
 */
export function getRobotPosition(serialNumber: string) {
  // Use the position tracker for consistent position data
  const { robotPositionTracker } = require('./robot-position-tracker');
  
  if (robotPositionTracker.hasPosition()) {
    return robotPositionTracker.getLatestPosition();
  }
  
  // Return default position if nothing is available yet
  return { 
    x: 0, 
    y: 0, 
    theta: 0, 
    orientation: 0,
    timestamp: Date.now()
  };
}

/**
 * Get robot sensor data
 */
export function getRobotSensorData(serialNumber: string) {
  // Combine various sensor data points
  return {
    battery: getLatestBatteryData() || { percentage: 0.8, charging: false },
    lidar: getLatestLidarData() ? { available: true } : { available: false },
    lastUpdated: Date.now()
  };
}

/**
 * Get robot map data
 */
export function getRobotMapData(serialNumber: string) {
  const mapData = getLatestMapData();
  
  if (mapData) {
    return mapData;
  }
  
  // Return default map data if nothing is available yet
  return { 
    grid: '',
    resolution: 0.05,
    origin: [0, 0, 0],
    size: [100, 100],
    stamp: Date.now()
  };
}

/**
 * Get robot camera data
 */
export function getRobotCameraData(serialNumber: string) {
  // Camera data is typically fetched directly via HTTP endpoints
  // We'll just return a flag indicating if the WebSocket is connected
  return {
    available: !!(robotWs && robotWs.readyState === WebSocket.OPEN),
    endpoints: [
      '/rgb_cameras/front/image',
      '/rgb_cameras/front/snapshot',
      '/camera/snapshot',
      '/camera/image'
    ]
  };
}

/**
 * Get robot video frame
 */
export function getVideoFrame(serialNumber: string): Buffer {
  // Video frames are typically fetched directly via HTTP endpoints
  // This is a placeholder since we don't store the actual frame buffer here
  throw new Error('Video frames should be fetched directly via HTTP endpoint');
}

/**
 * Get robot lidar data
 */
export function getRobotLidarData(serialNumber: string) {
  const lidarData = getLatestLidarData();
  
  if (lidarData) {
    return {
      topic: lidarData.topic || '/scan',
      stamp: lidarData.stamp || Date.now(),
      ranges: (lidarData.ranges || lidarData.data?.ranges || []).slice(0, 100), // Limit the data to avoid overwhelming the client
      points: (lidarData.points || lidarData.data?.points || []).slice(0, 100),
      available: true
    };
  }
  
  // Return minimal LiDAR data structure when no real data is available
  return {
    topic: '/scan',
    stamp: Date.now(),
    ranges: [],
    points: [],
    available: false
  };
}

/**
 * Check if the robot is connected via WebSocket
 */
export function isRobotConnected(serialNumber: string): boolean {
  return robotWs !== null && robotWs.readyState === WebSocket.OPEN;
}

/**
 * Send a command to the robot via WebSocket
 */
export function sendRobotCommand(serialNumber: string, command: any): boolean {
  if (!(robotWs && robotWs.readyState === WebSocket.OPEN)) {
    throw new Error('Cannot send robot command: Robot WebSocket not connected');
  }
  
  try {
    robotWs.send(JSON.stringify(command));
    return true;
  } catch (e) {
    console.error('Error sending command to robot:', e);
    throw new Error(`Failed to send command to robot: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Setup WebSocket proxy for robot task status updates
 */
export function attachWebSocketProxy(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/status' });

  wss.on('connection', (client) => {
    console.log('🔌 Admin client connected to task status WS proxy');
    
    // Connect to the robot's task status WebSocket
    const robotBaseUrl = ROBOT_API_URL.replace(/^http/, 'ws');
    const upstream = new WebSocket(`${robotBaseUrl}/ws/status`, {
      headers: getAuthHeaders()
    });

    upstream.on('open', () => {
      console.log('➡️ Connected to robot task status WebSocket');
      
      try {
        client.send(JSON.stringify({
          taskId: 'system',
          status: 'connected',
          message: 'Task status stream connected'
        }));
      } catch (err) {
        console.error('Error sending connected message to client:', err);
      }
    });
    
    upstream.on('message', (data) => {
      try {
        // Forward messages from robot to client
        if (client.readyState === WebSocket.OPEN) {
          const parsed = JSON.parse(data.toString());
          
          // Only show updates for our specific robot
          if (!parsed.sn || parsed.sn === 'L382502104987ir') {
            client.send(data);
          }
        }
      } catch (err) {
        console.error('Error forwarding task status message:', err);
        // If parsing fails, still send the original message
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    });
    
    upstream.on('error', (err) => {
      console.error('❌ Upstream task status WS error:', err);
      
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            taskId: 'system',
            status: 'error',
            message: 'Connection error with robot WebSocket'
          }));
        }
      } catch (sendErr) {
        console.error('Error sending error message to client:', sendErr);
      }
    });
    
    upstream.on('close', () => {
      console.log('Upstream task status WebSocket closed');
      
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            taskId: 'system',
            status: 'disconnected', 
            message: 'Task status stream disconnected'
          }));
          client.close();
        }
      } catch (err) {
        console.error('Error sending close message to client:', err);
      }
    });

    // Handle client disconnect
    client.on('close', () => {
      console.log('❌ Admin task status WS client disconnected');
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    });

    // Handle client errors
    client.on('error', (err) => {
      console.error('❌ Admin task status WS client error:', err);
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    });
  });
}

/**
 * Setup WebSocket server for clients
 */
export function setupRobotWebSocketServer(server: Server) {
  // Create WebSocket server for client connections
  const wss = new WebSocketServer({ 
    server, 
    path: '/api/robot-ws'
  });

  // Connect to robot WebSocket
  connectRobotWebSocket();
  
  // Also set up the task status WebSocket proxy
  attachWebSocketProxy(server);

  // Handle client connections
  wss.on('connection', (ws: WebSocket, req: Request) => {
    console.log(`Client WebSocket connected from ${req.socket.remoteAddress}`);
    
    // Add to client list
    clients.add(ws);

    // Send initial status
    try {
      ws.send(JSON.stringify({
        type: 'status',
        connected: robotWs && robotWs.readyState === WebSocket.OPEN,
        reconnectAttempt,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error sending initial status to client:', e);
    }

    // Handle client messages
    ws.on('message', (message) => {
      try {
        const command = JSON.parse(message.toString());
        
        // Handle reconnect command
        if (command.action === 'reconnect') {
          if (robotWs) {
            try {
              robotWs.terminate();
            } catch (e) {
              console.error('Error terminating existing connection:', e);
            }
            robotWs = null;
          }
          
          connectRobotWebSocket();
          
          try {
            ws.send(JSON.stringify({
              type: 'command_response',
              action: 'reconnect',
              status: 'initiated',
              timestamp: Date.now()
            }));
          } catch (e) {
            console.error('Error sending command response:', e);
          }
        }
        
        // Handle custom message to robot
        if (command.action === 'send' && command.data) {
          const success = sendRobotCommand('', command.data);
          
          try {
            ws.send(JSON.stringify({
              type: 'command_response',
              action: 'send',
              status: success ? 'sent' : 'failed',
              timestamp: Date.now()
            }));
          } catch (e) {
            console.error('Error sending command response:', e);
          }
        }
      } catch (e) {
        console.error('Error processing client message:', e);
        
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            error: e instanceof Error ? e.message : String(e),
            timestamp: Date.now()
          }));
        } catch (sendError) {
          console.error('Error sending error response:', sendError);
        }
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('Client WebSocket disconnected');
      clients.delete(ws);
    });

    // Handle client errors
    ws.on('error', (error) => {
      console.error('Client WebSocket error:', error);
      clients.delete(ws);
    });
  });
}