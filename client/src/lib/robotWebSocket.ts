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
    // Use a specific path that won't conflict with Vite's HMR
    // For Vite development, use the current hostname and port
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    console.log('Connecting to WebSocket URL:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      // Connection opened
      this.ws.addEventListener('open', () => {
        console.log('Robot WebSocket connection established');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.notifyListeners({ type: 'connection', state: this.connectionState });
      });

      // Listen for messages
      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received robot data:', data);

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
        this.connectionState = 'error';
        this.notifyListeners({ 
          type: 'connection', 
          state: this.connectionState 
        });
        // Error handling is also managed by the 'close' event
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

  // Reconnect after connection lost
  private reconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting in ${this.reconnectTimeout/1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
      }, this.reconnectTimeout);
    } else {
      console.error('Maximum reconnection attempts reached');
      this.notifyListeners({
        type: 'error',
        message: 'Failed to connect to robot after multiple attempts'
      });
    }
  }

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
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
    return this.sendMessage({
      type: 'get_robot_status',
      serialNumber: robotSerial
    });
  }

  // Request robot position update
  requestPosition(serialNumber?: string) {
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
    return this.sendMessage({
      type: 'get_robot_position',
      serialNumber: robotSerial
    });
  }

  // Request robot sensor data
  requestSensorData(serialNumber?: string) {
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
    return this.sendMessage({
      type: 'get_robot_sensors',
      serialNumber: robotSerial
    });
  }

  // Request robot map data
  requestMapData(serialNumber?: string) {
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
    return this.sendMessage({
      type: 'get_robot_map',
      serialNumber: robotSerial
    });
  }

  // Request current task for robot
  requestTaskInfo(serialNumber?: string) {
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
    return this.sendMessage({
      type: 'get_robot_task',
      serialNumber: robotSerial
    });
  }
  
  // Request camera data
  requestCameraData(serialNumber?: string) {
    // Always default to our physical robot if no serial number provided
    const robotSerial = serialNumber || 'L382502104988is';
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

// Export a singleton instance
export const robotWebSocket = new RobotWebSocketClient();