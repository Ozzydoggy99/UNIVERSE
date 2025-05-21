// server/robot-websocket.ts
/**
 * Robot WebSocket interface for real-time communication
 * Simplified single-connection approach
 * Uses proper AutoXing API authentication format
 */
import WebSocket, { WebSocketServer } from 'ws';
import { Request } from 'express';
import { Server } from 'http';
import { getRobotApiUrl, getAuthHeaders } from './robot-constants.js';
import { robotPositionTracker } from './robot-position-tracker.js';
import { extractPointsFromMap } from './robot-map-api.js';
import robotPointsMap from './robot-points-map.js';
import { EventEmitter } from 'events';

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
  'map': ['/map', '/map_v2', '/slam/state'],
  'video': ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video'],
  'lidar': ['/scan', '/lidar/scan', '/lidar/pointcloud'],
  'pose': ['/tracked_pose', '/robot/footprint']
};

// List of topics to subscribe to from the robot
const subscribeTopics: string[] = [
  '/battery_state',        // Battery information
  '/wheel_state',          // Wheel status
  '/slam/state',           // SLAM status
  '/map',                  // Map data
  '/scan',                 // 2D LiDAR data showing people moving
  '/scan_matched_points2', // 3D LiDAR point cloud data
  '/lidar/scan',           // Alternative LiDAR path
  '/tracked_pose',         // Robot position
  '/robot/footprint'       // Robot footprint
];

// Event emitter for WebSocket events
const wsEvents = new EventEmitter();

/**
 * Get the WebSocket URL for the robot
 */
async function getRobotWebSocketUrl(): Promise<string> {
  // Use the correct WebSocket endpoint according to docs
  const wsUrl = (await getRobotApiUrl('L382502104987ir')).replace(/^http/, 'ws') + '/ws/v2/topics';
  console.log('[DEBUG] Generated WebSocket URL:', wsUrl);
  return wsUrl;
}

/**
 * Connect to the robot WebSocket
 */
async function connectRobotWebSocket() {
  if (isConnecting || (robotWs && robotWs.readyState === WebSocket.OPEN)) {
    console.log('[DEBUG] Already connecting or connected, skipping connection attempt');
    return;
  }

  isConnecting = true;
  const wsUrl = await getRobotWebSocketUrl();
  console.log(`[DEBUG] Connecting to robot WebSocket at ${wsUrl}`);

  try {
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      console.log('[DEBUG] Robot WebSocket connection timed out');
      if (robotWs) {
        try {
          robotWs.terminate();
        } catch (e) {
          console.error('[DEBUG] Error terminating robot WebSocket:', e);
        }
      }
      robotWs = null;
      isConnecting = false;
      scheduleReconnect();
    }, 10000);

    // Get auth headers and only use APPCODE for WebSocket
    const authHeaders = await getAuthHeaders('L382502104987ir');
    const wsHeaders = {
      'APPCODE': authHeaders['APPCODE']
    };
    console.log('[DEBUG] Using WebSocket headers:', wsHeaders);
    
    robotWs = new WebSocket(wsUrl, {
      headers: wsHeaders
    });

    robotWs.on('open', () => {
      console.log('[DEBUG] Robot WebSocket connection established');
      
      // Clear timeout and update state
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      isConnecting = false;
      reconnectAttempt = 0;

      // Subscribe to topics
      try {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          // Subscribe to all topics at once using the correct format
          const subscribeMessage = {
            enable_topic: subscribeTopics
          };
          console.log('[DEBUG] Sending topic subscription:', JSON.stringify(subscribeMessage));
          robotWs.send(JSON.stringify(subscribeMessage));
          
          // Wait for subscription response
          const subscriptionTimeout = setTimeout(() => {
            console.log('[DEBUG] No subscription response received within 5 seconds');
          }, 5000);
          
          robotWs.once('message', (data) => {
            clearTimeout(subscriptionTimeout);
            try {
              const response = JSON.parse(data.toString());
              console.log('[DEBUG] Received subscription response:', JSON.stringify(response, null, 2));
              if (response.enabled_topics) {
                console.log('[DEBUG] Successfully subscribed to topics:', response.enabled_topics);
              } else {
                console.log('[DEBUG] Unexpected subscription response format:', response);
              }
            } catch (e) {
              console.error('[DEBUG] Error parsing subscription response:', e);
              console.error('[DEBUG] Raw subscription response:', data.toString());
            }
          });
          
          console.log(`[DEBUG] Subscribed to robot topics: ${subscribeTopics.join(', ')}`);
        }
      } catch (e) {
        console.error(`[DEBUG] Error subscribing to topics:`, e);
      }

      // Set up ping interval
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      
      pingInterval = setInterval(() => {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          try {
            robotWs.ping();
            console.log('[DEBUG] Sent ping to robot WebSocket');
          } catch (e) {
            console.error('[DEBUG] Error sending ping to robot WebSocket:', e);
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
    
    robotWs.on('message', (data) => {
      try {
        console.log('[DEBUG] Raw WebSocket message received:', data.toString());
        const message = JSON.parse(data.toString());
        console.log('[DEBUG] Parsed WebSocket message:', JSON.stringify(message, null, 2));
        
        // Handle position updates
        if (message.topic === '/tracked_pose') {
          try {
            console.log('[DEBUG] Processing tracked_pose message:', JSON.stringify(message, null, 2));
            const posData = message.data || message;
            if (posData) {
              let position = {
                x: 0,
                y: 0,
                theta: 0,
                timestamp: Date.now()
              };

              // Extract position data based on message format
              if (posData.pos && Array.isArray(posData.pos) && posData.pos.length >= 2) {
                position.x = posData.pos[0];
                position.y = posData.pos[1];
                position.theta = posData.ori || 0;
              } else if (posData.x !== undefined && posData.y !== undefined) {
                position.x = posData.x;
                position.y = posData.y;
                position.theta = posData.theta || posData.orientation || 0;
              }

              console.log('[DEBUG] Extracted position:', position);
              robotPositionTracker.updatePosition(position);
            } else {
              console.log('[DEBUG] No position data found in message');
            }
          } catch (posError) {
            console.error('[DEBUG] Error processing position data:', posError);
            console.error('[DEBUG] Position data that caused error:', JSON.stringify(message, null, 2));
          }
        }
        
        // Handle battery data
        if (message.topic === '/battery_state') {
          try {
            console.log('[DEBUG] Processing battery state message:', JSON.stringify(message, null, 2));
            const batteryData = message.data || message;
            if (batteryData) {
              // Log all possible charging state fields
              console.log('[DEBUG] Battery charging state fields:', {
                charging: batteryData.charging,
                is_charging: batteryData.is_charging,
                charging_state: batteryData.charging_state,
                power_supply_status: batteryData.power_supply_status
              });

              // Check multiple possible charging state indicators
              const isCharging = 
                batteryData.charging === true || 
                batteryData.is_charging === true ||
                batteryData.charging_state === 'charging' ||
                batteryData.power_supply_status === 'charging';

              latestBatteryData = {
                percentage: batteryData.percentage || batteryData.battery_percentage || 0,
                charging: isCharging,
                voltage: batteryData.voltage,
                current: batteryData.current,
                temperature: batteryData.temperature,
                timestamp: Date.now()
              };
              console.log('[DEBUG] Updated battery data:', latestBatteryData);
            } else {
              console.log('[DEBUG] No battery data found in message');
            }
          } catch (batteryError) {
            console.error('[DEBUG] Error processing battery data:', batteryError);
            console.error('[DEBUG] Battery data that caused error:', JSON.stringify(message, null, 2));
          }
        }
        
        // Store data by topic for later retrieval
        if (message.topic === '/robot/footprint') {
          console.log('[DEBUG] Processing footprint data:', message);
          // Handle footprint data
        }
        
        // Forward message to clients based on topic category
        for (const [category, topics] of Object.entries(topicCategories)) {
          if (topics.includes(message.topic)) {
            console.log(`[DEBUG] Forwarding ${message.topic} to ${category} category`);
            wsEvents.emit(category, message);
            break;
          }
        }
      } catch (error) {
        console.error('[DEBUG] Error processing WebSocket message:', error);
        console.error('[DEBUG] Raw message data:', data.toString());
      }
    });

    robotWs.on('error', (error) => {
      console.error('[DEBUG] Robot WebSocket error:', error);
      
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
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });

      // Try to reconnect
      scheduleReconnect();
    });

    robotWs.on('close', (code, reason) => {
      console.log(`[DEBUG] Robot WebSocket connection closed: ${code} ${reason || ''}`);
      
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
 * Schedule a reconnection attempt
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  // Exponential backoff with max delay of 30 seconds
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
  console.log(`[DEBUG] Scheduling reconnection attempt ${reconnectAttempt + 1} in ${delay}ms`);
  
  reconnectTimer = setTimeout(() => {
    reconnectAttempt++;
    connectRobotWebSocket();
  }, delay);
}

/**
 * Broadcast a message to all connected clients
 */
function broadcastToClients(message: any) {
  const messageStr = JSON.stringify(message);
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('[DEBUG] Error sending message to client:', error);
      }
    }
  }
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
 * Send a command to the robot
 */
export function sendRobotCommand(topic: string, data: any): boolean {
  if (!robotWs || robotWs.readyState !== WebSocket.OPEN) {
    console.error('[DEBUG] Cannot send command: WebSocket not connected');
    return false;
  }

  try {
    const message = {
      topic,
      data
    };
    
    robotWs.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('[DEBUG] Error sending robot command:', error);
    return false;
  }
}

/**
 * Setup WebSocket proxy for robot task status updates
 */
export function attachWebSocketProxy(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/status' });

  wss.on('connection', async (client) => {
    console.log('🔌 Admin client connected to task status WS proxy');
    // Connect to the robot's task status WebSocket
    const robotBaseUrl = (await getRobotApiUrl('L382502104987ir')).replace(/^http/, 'ws');
    const upstream = new WebSocket(`${robotBaseUrl}/ws/v2/status`, {
      headers: await getAuthHeaders('L382502104987ir')
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

      // Send initial points data
      if (robotPointsMap.floors[1]) {
        ws.send(JSON.stringify({
          type: 'points_update',
          category: 'map',
          topic: '/map',
          data: {
            points: robotPointsMap.floors[1].points,
            timestamp: Date.now()
          }
        }));
      }
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
  });
}

// Export the event emitter
export { wsEvents };