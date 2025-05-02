import { RobotStatus, RobotPosition, RobotSensorData, MapData, CameraData } from "@/types/robot";

// WebSocket connection states
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Event types for robot updates
export type RobotUpdateEvent = 
  | { type: 'status'; data: RobotStatus }
  | { type: 'position'; data: RobotPosition }
  | { type: 'sensors'; data: RobotSensorData }
  | { type: 'map'; data: MapData }
  | { type: 'camera'; data: CameraData }
  | { type: 'connection'; state: ConnectionState }
  | { type: 'error'; message: string };

// Event listener function type
export type RobotUpdateListener = (event: RobotUpdateEvent) => void;

// Robot WebSocket client
class RobotWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 3000; // 3 seconds
  private listeners: RobotUpdateListener[] = [];
  private connectionState: ConnectionState = 'disconnected';
  private reconnectTimer: number | null = null;

  // Connect to robot WebSocket server
  connect() {
    // Only try to connect if we're not already connected or connecting
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    this.notifyListeners({ type: 'connection', state: this.connectionState });

    // Determine WebSocket URL (consider protocol, host)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Get host and add port explicitly to avoid undefined port issues
    const host = window.location.hostname;
    
    // Get the current port from location.port
    // The server's dynamic port selection will be reflected here automatically
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    
    // Use camera-specific WebSocket endpoint to avoid conflicts with Vite
    const wsUrl = `${protocol}//${host}:${port}/api/ws/camera`;
    console.log('Connecting to WebSocket URL:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      // Connection opened
      this.ws.addEventListener('open', () => {
        console.log('Robot WebSocket connection established');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.lastSuccessfulConnection = Date.now(); // Track successful connection time
        this.notifyListeners({ type: 'connection', state: this.connectionState });
      });

      // Listen for messages
      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received robot data:', data);
          
          // Each successful message indicates connection is still active
          this.lastSuccessfulConnection = Date.now();

          // Process different message types
          if (data.type === 'connection_established') {
            console.log('WebSocket connection established:', data.message);
          } else if (data.type === 'status' && data.data) {
            this.notifyListeners({
              type: 'status',
              data: data.data
            });
          } else if (data.type === 'position' && data.data) {
            this.notifyListeners({
              type: 'position',
              data: data.data
            });
          } else if (data.type === 'sensors' && data.data) {
            this.notifyListeners({
              type: 'sensors',
              data: data.data
            });
          } else if (data.type === 'map' && data.data) {
            this.notifyListeners({
              type: 'map',
              data: data.data
            });
          } else if (data.type === 'camera' && data.data) {
            this.notifyListeners({
              type: 'camera',
              data: data.data
            });
          } else if (data.type === 'robot_status_update' && data.data) {
            this.notifyListeners({
              type: 'status',
              data: data.data
            });
          } else if (data.type === 'robot_position_update' && data.data) {
            this.notifyListeners({
              type: 'position',
              data: data.data
            });
          } else if (data.type === 'robot_sensors_update' && data.data) {
            this.notifyListeners({
              type: 'sensors',
              data: data.data
            });
          } else if (data.type === 'error') {
            this.notifyListeners({
              type: 'error',
              message: data.message || 'Unknown error'
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Connection closed
      this.ws.addEventListener('close', () => {
        console.log('Robot WebSocket connection closed');
        this.connectionState = 'disconnected';
        this.notifyListeners({ type: 'connection', state: this.connectionState });
        this.reconnect();
      });

      // Connection error
      this.ws.addEventListener('error', (error) => {
        console.error('Robot WebSocket error:', error);
        console.log('WebSocket readyState:', this.ws?.readyState);
        
        // Only set error state if we're not already disconnected
        // This prevents duplicate error notifications
        if (this.connectionState !== 'disconnected') {
          this.connectionState = 'error';
          this.notifyListeners({ 
            type: 'connection', 
            state: this.connectionState 
          });
          
          this.notifyListeners({
            type: 'error',
            message: 'Connection error occurred. Attempting to reconnect...'
          });
        }
        
        // Don't wait for close event if readyState is already closed
        if (this.ws?.readyState === WebSocket.CLOSED) {
          console.log('WebSocket already closed after error, initiating reconnect directly');
          this.reconnect();
        }
        // Close event will handle reconnection in other cases
      });
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.connectionState = 'error';
      this.notifyListeners({ 
        type: 'connection', 
        state: this.connectionState 
      });
      this.reconnect();
    }
  }

  // Reconnect after connection lost with exponential backoff
  private reconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }

    // Reset reconnect attempts after 2 minutes of successful connection
    const now = Date.now();
    if (this.lastSuccessfulConnection && (now - this.lastSuccessfulConnection) > 120000) {
      this.reconnectAttempts = 0;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Exponential backoff with a maximum of 30 seconds
      const backoffTime = Math.min(
        this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1),
        30000
      );
      
      console.log(`Reconnecting in ${Math.round(backoffTime/1000)}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = window.setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        this.connect();
      }, backoffTime);
    } else {
      console.error('Maximum reconnection attempts reached, will try again in 30 seconds');
      
      // After max attempts, try one more time after 30 seconds
      this.reconnectTimer = window.setTimeout(() => {
        console.log('Final reconnection attempt...');
        this.reconnectAttempts = 0; // Reset for fresh start
        this.connect();
      }, 30000);
      
      this.notifyListeners({
        type: 'error',
        message: 'Failed to connect to robot after multiple attempts. Will try again soon.'
      });
    }
  }
  
  // Track the last successful connection time
  private lastSuccessfulConnection: number | null = null;

  // Close connection
  disconnect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }
    
    // Clear any pending reconnect
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.connectionState = 'disconnected';
    this.notifyListeners({ type: 'connection', state: this.connectionState });
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // Register a listener for robot updates
  subscribe(listener: RobotUpdateListener) {
    this.listeners.push(listener);
    
    // Immediately notify the new listener of the current connection state
    listener({ type: 'connection', state: this.connectionState });
    
    return () => {
      this.unsubscribe(listener);
    };
  }

  // Remove a listener
  unsubscribe(listener: RobotUpdateListener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners of updates
  private notifyListeners(event: RobotUpdateEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in robot update listener:', error);
      }
    });
  }

  // Send a message to the robot
  sendMessage(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Request robot status update
  requestStatus(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_status',
      serialNumber: robotSerial
    });
  }

  // Request robot position update
  requestPosition(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_position',
      serialNumber: robotSerial
    });
  }

  // Request robot sensor data
  requestSensorData(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_sensors',
      serialNumber: robotSerial
    });
  }

  // Request robot map data
  requestMapData(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_map',
      serialNumber: robotSerial
    });
  }

  // Request current task for robot
  requestTaskInfo(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_task',
      serialNumber: robotSerial
    });
  }
  
  // Request camera data
  requestCameraData(serialNumber?: string) {
    // Always default to our publicly accessible robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104987ir';
    return this.sendMessage({
      type: 'get_robot_camera',
      serialNumber: robotSerial
    });
  }
  
  // Toggle camera on/off
  toggleCamera(serialNumber: string, enabled: boolean) {
    return this.sendMessage({
      type: 'toggle_robot_camera',
      serialNumber,
      enabled
    });
  }
}

/**
 * Enable WebSocket streams for real-time mapping visualization
 * This function enables all the necessary topics needed for mapping
 * @param serialNumber The robot's serial number (defaults to demo robot if not specified)
 * @param customTopics Optional list of custom topics to enable instead of defaults
 */
export function startMappingStreams(serialNumber?: string, customTopics?: string[]) {
  const robot = serialNumber || 'L382502104987ir';
  console.log(`Starting real-time mapping streams for robot ${robot}`);
  
  // These are the mapping-specific topics needed for comprehensive mapping
  const defaultTopics = [
    // Basic map data 
    '/map',
    '/map_v2',
    
    // SLAM state information
    '/slam/state',
    
    // Different map resolution streams
    '/maps/5cm/1hz',
    '/maps/1cm/1hz',
    
    // Path and trajectory information
    '/trajectory', 
    '/trajectory_node_list',
    '/path',
    
    // LiDAR and point cloud data
    '/scan_matched_points2',
    '/scans',
    '/scan',
    
    // Add any additional topics needed for full mapping visualization
    '/submap_list'
  ];
  
  // Use provided custom topics or fall back to defaults
  const topics = customTopics || defaultTopics;
  
  // Send request to enable mapping-specific topics on the server
  robotWebSocket.sendMessage({
    type: 'start_mapping_streams',
    serialNumber: robot,
    topics: topics
  });
  
  // Also request current data to initialize the UI
  robotWebSocket.requestPosition(robot);
  robotWebSocket.requestMapData(robot);
  
  // Connect to WebSocket if not already connected
  if (!robotWebSocket.isConnected()) {
    console.log('Connecting to WebSocket for real-time mapping...');
    robotWebSocket.connect();
  }
  
  return topics;
}

/**
 * Stop WebSocket streams for mapping
 * This function disables all the topics that were enabled for mapping
 * @param serialNumber The robot's serial number (defaults to demo robot if not specified)
 * @param customTopics Optional list of custom topics to disable instead of defaults
 */
export function stopMappingStreams(serialNumber?: string, customTopics?: string[]) {
  const robot = serialNumber || 'L382502104987ir';
  console.log(`Stopping real-time mapping streams for robot ${robot}`);
  
  // These should match the same topics that were enabled in startMappingStreams
  const defaultTopics = [
    // Basic map data 
    '/map',
    '/map_v2',
    
    // SLAM state information
    '/slam/state',
    
    // Different map resolution streams
    '/maps/5cm/1hz',
    '/maps/1cm/1hz',
    
    // Path and trajectory information
    '/trajectory', 
    '/trajectory_node_list',
    '/path',
    
    // LiDAR and point cloud data
    '/scan_matched_points2',
    '/scans',
    '/scan',
    
    // Add any additional topics needed for full mapping visualization
    '/submap_list'
  ];
  
  // Use provided custom topics or fall back to defaults
  const topics = customTopics || defaultTopics;
  
  // Send request to disable mapping-specific topics on the server
  robotWebSocket.sendMessage({
    type: 'stop_mapping_streams',
    serialNumber: robot,
    topics: topics
  });
  
  return topics;
}

// Export a singleton instance
export const robotWebSocket = new RobotWebSocketClient();