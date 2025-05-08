import WebSocket, { WebSocketServer } from 'ws';
import { Request } from 'express';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants';
import { Server } from 'http';

// Initialize connection states
let robotWs: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

// Client tracking
const clients: Set<WebSocket> = new Set();

// Define topic categories for the single WebSocket
const topicCategories = {
  'status': ['/battery_state', '/detailed_battery_state', '/wheel_state', '/ws_connections'],
  'pose': ['/tracked_pose', '/robot/footprint'],
  'map': ['/map', '/map_v2', '/slam/state'],
  'video': ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video'],
  'lidar': ['/scan', '/scan_matched_points2', '/lidar/scan', '/lidar/pointcloud', '/lidar/points'],
};

// Topic subscriptions
const activeTopics: string[] = [
  '/wheel_state',
  '/ws_connections',
  '/tracked_pose',
  '/robot/footprint',
  '/battery_state',
  '/detailed_battery_state',
  '/map',
  '/slam/state',
  '/map_v2',
  '/rgb_cameras/front/compressed',
  '/rgb_cameras/front/video',
  '/scan',
  '/scan_matched_points2',
  '/horizontal_laser_2d/matched',
  '/left_laser_2d/matched',
  '/right_laser_2d/matched',
  '/lt_laser_2d/matched',
  '/rb_laser_2d/matched',
  '/maps/5cm/1hz',
  '/maps/1cm/1hz',
  '/pointcloud2',
  '/points',
  '/points2',
  '/lidar/points',
  '/lidar/scan',
  '/lidar/pointcloud',
  '/lidar/scan_matched',
  '/slam/points',
  '/raw/lidar',
];

// Function to extract the WebSocket URL from ROBOT_API_URL
function getRobotWebSocketUrl(): string {
  const apiUrl = ROBOT_API_URL;
  if (!apiUrl) {
    console.error('ROBOT_API_URL is not defined');
    return '';
  }
  
  // Convert from HTTP to WS protocol
  const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
  return wsUrl;
}

// Function to connect to the robot's WebSocket
function connectRobotWebSocket() {
  if (isConnecting || robotWs) return;
  
  try {
    isConnecting = true;
    
    const robotWebSocketUrl = getRobotWebSocketUrl();
    console.log(`Connecting to robot WebSocket at ${robotWebSocketUrl}`);
    
    // Set a connection timeout
    connectionTimeout = setTimeout(() => {
      console.log('WebSocket connection timed out, forcing close');
      if (robotWs) {
        try {
          robotWs.terminate();
        } catch (e) {
          console.error('Error terminating WebSocket:', e);
        }
      }
      robotWs = null;
      isConnecting = false;
      scheduleReconnect();
    }, 10000); // 10 second timeout
    
    // Create WebSocket connection
    robotWs = new WebSocket(robotWebSocketUrl, {
      headers: {
        'x-api-key': ROBOT_SECRET
      }
    });
    
    robotWs.on('open', () => {
      console.log('Robot WebSocket connection established');
      isConnecting = false;
      reconnectAttempt = 0;
      
      // Clear the connection timeout
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      // Set up ping interval
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          try {
            robotWs.ping();
          } catch (e) {
            console.error('Error sending ping:', e);
          }
        }
      }, 30000); // Ping every 30 seconds
      
      // Subscribe to topics
      console.log(`Enabled robot topics: ${JSON.stringify(activeTopics, null, 2)}`);
      activeTopics.forEach(topic => {
        if (robotWs && robotWs.readyState === WebSocket.OPEN) {
          try {
            robotWs.send(JSON.stringify({
              op: 'subscribe',
              topic
            }));
          } catch (e) {
            console.error(`Error subscribing to ${topic}:`, e);
          }
        }
      });
    });
    
    robotWs.on('message', (data) => {
      try {
        // Parse the message to check if it's a topic message or other response
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (e) {
          message = { raw: data.toString() };
        }
        
        // Check if it's an error message
        if (message.error) {
          console.log('Received non-topic message from robot:', message);
        }
        
        // Broadcast to all connected clients
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify({
                source: 'robot',
                timestamp: Date.now(),
                data: message
              }));
            } catch (e) {
              console.error('Error broadcasting to client:', e);
            }
          }
        });
      } catch (e) {
        console.error('Error processing robot message:', e);
      }
    });
    
    robotWs.on('error', (error) => {
      console.error('Robot WebSocket error:', error);
      console.log('Connection error occurred. Attempting to reconnect...');
    });
    
    robotWs.on('close', (code, reason) => {
      console.log(`Robot WebSocket connection closed: ${code} ${reason || ''}`);
      
      // Clear intervals and timeouts
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      // Clean up
      robotWs = null;
      isConnecting = false;
      
      // Schedule reconnect
      scheduleReconnect();
    });
    
  } catch (error) {
    console.error('Error creating robot WebSocket:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

// Function to schedule reconnection
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

// Function to get current connection status
export function getRobotWebSocketStatus(): string {
  if (robotWs && robotWs.readyState === WebSocket.OPEN) {
    return 'Connected';
  } else if (isConnecting) {
    return 'Connecting';
  } else {
    return 'Not connected';
  }
}

// Placeholder functions for robot data retrieval that are expected by the existing code
export function getRobotStatus(serialNumber: string) {
  return {
    model: "AxBot Physical Robot",
    status: "online",
    battery: 95,
    serialNumber,
    lastSeen: new Date().toISOString()
  };
}

export function getRobotPosition(serialNumber: string) {
  return {
    x: 0,
    y: 0,
    z: 0,
    orientation: 0,
    lastUpdated: new Date().toISOString()
  };
}

export function getRobotSensorData(serialNumber: string) {
  return {
    temperature: 0,
    voltage: 24.5,
    current: 1.2,
    humidity: 45,
    pressure: 1013,
    serialNumber
  };
}

export function getRobotMapData(serialNumber: string) {
  return {
    grid: "",
    resolution: 0.05,
    width: 0,
    height: 0,
    origin: { x: 0, y: 0, z: 0 }
  };
}

export function getRobotCameraData(serialNumber: string) {
  return {
    enabled: false,
    streamUrl: "",
    resolution: "640x480",
    format: "jpg",
    serialNumber
  };
}

// Function to retrieve video frame data (exported for compatibility with robot-video.ts)
export function getVideoFrame(serialNumber: string): Buffer | null {
  // No video frame available yet, but keeping this function for API compatibility
  return null;
}

export function getRobotLidarData(serialNumber: string) {
  return {
    ranges: [],
    angle_min: 0,
    angle_max: 0,
    angle_increment: 0,
    time_increment: 0,
    scan_time: 0,
    range_min: 0,
    range_max: 0
  };
}

export function isRobotConnected(serialNumber: string) {
  // Check if robot WebSocket is connected
  return robotWs && robotWs.readyState === WebSocket.OPEN;
}

export function sendRobotCommand(serialNumber: string, command: any) {
  if (robotWs && robotWs.readyState === WebSocket.OPEN) {
    try {
      robotWs.send(JSON.stringify(command));
      return true;
    } catch (e: any) {
      console.error('Error sending command to robot:', e);
      return false;
    }
  }
  return false;
}

// Attach channel-based robot WebSocket proxy with topic categorization
export function attachRobotWebSocketProxy(wss: WebSocketServer) {
  // The logs show that the robot doesn't support custom WebSocket paths like /ws/status
  // Instead, it has a single WebSocket endpoint at /ws and uses topics
  
  // Define which topics belong to which logical "channels"
  const channelTopicMap = {
    'status': ['/battery_state', '/detailed_battery_state', '/wheel_state', '/ws_connections'],
    'pose': ['/tracked_pose', '/robot/footprint'],
    'map': ['/map', '/map_v2', '/slam/state'],
    'video': ['/rgb_cameras/front/compressed', '/rgb_cameras/front/video'],
    'lidar': ['/scan', '/scan_matched_points2', '/lidar/scan', '/lidar/pointcloud', '/lidar/points'],
  };
  
  // Since we already have a main WebSocket connection in connectRobotWebSocket(),
  // we'll use that for all communication and distribute messages by topic
  
  // When we receive a message from the robot, check which channel it belongs to
  // and forward it to the clients with the appropriate channel label
  robotWs?.on("message", (msg) => {
    try {
      const message = JSON.parse(msg.toString());
      
      // If the message has a topic field, categorize it
      if (message.topic) {
        const topic = message.topic;
        let channel = 'unknown';
        
        // Find which channel this topic belongs to
        for (const [chan, topics] of Object.entries(channelTopicMap)) {
          if (topics.includes(topic)) {
            channel = chan;
            break;
          }
        }
        
        // Broadcast message with its channel
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify({
                channel,
                topic,
                timestamp: Date.now(),
                data: message
              }));
            } catch (e) {
              console.error(`Error sending ${channel} message to client:`, e);
            }
          }
        });
      }
    } catch (e) {
      // Not JSON or other error, just log it
      console.log("Non-JSON message from robot:", msg.toString().substring(0, 100));
    }
  });
  
  // The existing connectRobotWebSocket already handles connection,
  // reconnection, and subscribing to topics
}

// Setup WebSocket server for clients
export function setupRobotWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/robot-ws' 
  });
  
  // Initialize the primary WebSocket connection
  connectRobotWebSocket();
  
  // Wait for the primary WebSocket connection to be established before attaching proxy
  setTimeout(() => {
    if (robotWs && robotWs.readyState === WebSocket.OPEN) {
      // Attach proxy only if we have a connection
      attachRobotWebSocketProxy(wss);
    }
  }, 2000);
  
  wss.on('connection', (ws: WebSocket, req: Request) => {
    console.log(`New client WebSocket connection established from ${req.socket.remoteAddress}`);
    
    // Add to clients set
    clients.add(ws);
    
    // Send initial status
    try {
      ws.send(JSON.stringify({
        type: 'status',
        connected: robotWs && robotWs.readyState === WebSocket.OPEN,
        reconnectAttempt,
        activeTopics
      }));
    } catch (e) {
      console.error('Error sending initial status:', e);
    }
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        // Parse client command
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
          
          ws.send(JSON.stringify({
            type: 'command_response',
            action: 'reconnect',
            status: 'initiated'
          }));
        }
        
        // Handle custom message to robot
        if (command.action === 'send' && command.data) {
          if (robotWs && robotWs.readyState === WebSocket.OPEN) {
            try {
              robotWs.send(JSON.stringify(command.data));
              ws.send(JSON.stringify({
                type: 'command_response',
                action: 'send',
                status: 'sent'
              }));
            } catch (e: any) {
              ws.send(JSON.stringify({
                type: 'command_response',
                action: 'send',
                status: 'error',
                error: e.toString()
              }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'command_response',
              action: 'send',
              status: 'error',
              error: 'Robot WebSocket not connected'
            }));
          }
        }
      } catch (e: any) {
        console.error('Error processing client message:', e);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            error: e.toString()
          }));
        } catch (sendError) {
          console.error('Error sending error response:', sendError);
        }
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log('Client WebSocket connection closed');
      clients.delete(ws);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('Client WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Start robot WebSocket connection
  connectRobotWebSocket();
}