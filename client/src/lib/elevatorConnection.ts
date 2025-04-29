import { Robot } from "@/types/robot";

// Type definitions for WebSocket messages
export type ElevatorRequestMessage = {
  type: 'elevator_queue_request';
  robotId: string;
  elevatorId: number;
  startFloor: number;
  targetFloor: number;
  priority?: number;
};

export type ElevatorStatusUpdateMessage = {
  type: 'elevator_status_update';
  elevatorId: number;
  status: string; // 'IDLE', 'MOVING', 'MAINTENANCE', etc.
};

export type ElevatorQueueStatusUpdateMessage = {
  type: 'elevator_queue_status_update';
  queueId: number;
  status: string; // 'WAITING', 'IN_PROGRESS', 'COMPLETED', etc.
};

export type MapRequestMessage = {
  type: 'load_map';
  serialNumber: string;
  floorNumber: number;
};

export type SubscribeMessage = {
  type: 'subscribe';
  buildingId?: number; // Optional: subscribe to a specific building's elevators
};

export type ElevatorMessage = 
  | ElevatorRequestMessage 
  | ElevatorStatusUpdateMessage 
  | ElevatorQueueStatusUpdateMessage 
  | MapRequestMessage 
  | SubscribeMessage;

// Response types
export type ElevatorUpdate = {
  type: 'elevator_update';
  elevator: {
    id: number;
    buildingId: number;
    name: string;
    currentFloor: number;
    status: string;
    capacity: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type ElevatorQueueUpdate = {
  type: 'elevator_queue_update';
  queueEntry: {
    id: number;
    elevatorId: number;
    robotId: string;
    startFloor: number;
    targetFloor: number;
    status: string;
    priority: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type MapData = {
  type: 'map_data';
  floorMap: {
    id: number;
    buildingId: number;
    floorNumber: number;
    mapData: string; // JSON string containing map data
    createdAt: string;
    updatedAt: string;
  };
};

export type ErrorResponse = {
  type: 'error';
  message: string;
};

export type SubscribedResponse = {
  type: 'subscribed';
  message: string;
};

export type ElevatorResponse = 
  | ElevatorUpdate 
  | ElevatorQueueUpdate 
  | MapData 
  | ErrorResponse 
  | SubscribedResponse;

// Elevator WebSocket connection handler
export class ElevatorConnection {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 2000; // 2 seconds
  private messageListeners: Array<(message: ElevatorResponse) => void> = [];
  private statusListeners: Array<(status: string) => void> = [];
  private robot: Robot | null = null;

  constructor(robot?: Robot) {
    if (robot) {
      this.robot = robot;
    }
  }

  // Connect to the WebSocket server
  connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log("WebSocket connection already open");
      return;
    }

    try {
      // Create WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/elevator`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      // Setup event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      
      // Update status listeners
      this.notifyStatusListeners('connecting');
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.notifyStatusListeners('error');
    }
  }

  // Disconnect from the WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.notifyStatusListeners('disconnected');
    }
  }

  // Send a message to the WebSocket server
  sendMessage(message: ElevatorMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      this.connect(); // Try to reconnect
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  // Subscribe to receive updates for a specific building or all elevators
  subscribe(buildingId?: number): void {
    const message: SubscribeMessage = {
      type: 'subscribe',
      buildingId
    };
    this.sendMessage(message);
  }

  // Request to use an elevator
  requestElevator(elevatorId: number, startFloor: number, targetFloor: number, priority?: number): void {
    if (!this.robot) {
      console.error("Robot information not available");
      return;
    }

    const message: ElevatorRequestMessage = {
      type: 'elevator_queue_request',
      robotId: this.robot.serialNumber || 'unknown-robot',
      elevatorId,
      startFloor,
      targetFloor,
      priority
    };
    
    this.sendMessage(message);
  }

  // Update elevator status
  updateElevatorStatus(elevatorId: number, status: string): void {
    const message: ElevatorStatusUpdateMessage = {
      type: 'elevator_status_update',
      elevatorId,
      status
    };
    
    this.sendMessage(message);
  }

  // Update elevator queue entry status
  updateQueueEntryStatus(queueId: number, status: string): void {
    const message: ElevatorQueueStatusUpdateMessage = {
      type: 'elevator_queue_status_update',
      queueId,
      status
    };
    
    this.sendMessage(message);
  }

  // Request floor map data
  requestFloorMap(floorNumber: number): void {
    if (!this.robot) {
      console.error("Robot information not available");
      return;
    }

    const message: MapRequestMessage = {
      type: 'load_map',
      serialNumber: this.robot.serialNumber || 'unknown-robot',
      floorNumber
    };
    
    this.sendMessage(message);
  }

  // Set the robot information
  setRobot(robot: Robot): void {
    this.robot = robot;
  }

  // Add a listener for WebSocket messages
  addMessageListener(listener: (message: ElevatorResponse) => void): void {
    this.messageListeners.push(listener);
  }

  // Remove a listener for WebSocket messages
  removeMessageListener(listener: (message: ElevatorResponse) => void): void {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  // Add a listener for connection status changes
  addStatusListener(listener: (status: string) => void): void {
    this.statusListeners.push(listener);
  }

  // Remove a listener for connection status changes
  removeStatusListener(listener: (status: string) => void): void {
    this.statusListeners = this.statusListeners.filter(l => l !== listener);
  }

  // Handle WebSocket open event
  private handleOpen(): void {
    console.log("WebSocket connection opened");
    this.reconnectAttempts = 0;
    this.notifyStatusListeners('connected');
    
    // Auto-subscribe to all elevators when connected
    this.subscribe();
  }

  // Handle WebSocket message event
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ElevatorResponse;
      console.log("Received WebSocket message:", message);
      
      // Notify all listeners
      this.messageListeners.forEach(listener => listener(message));
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  // Handle WebSocket close event
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.socket = null;
    this.notifyStatusListeners('disconnected');
    
    // Try to reconnect if not intentionally closed
    if (event.code !== 1000) {
      this.attemptReconnect();
    }
  }

  // Handle WebSocket error event
  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.notifyStatusListeners('error');
  }

  // Attempt to reconnect to the WebSocket server
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Maximum reconnect attempts reached");
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.notifyStatusListeners('reconnecting');
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  // Notify status listeners of a status change
  private notifyStatusListeners(status: string): void {
    this.statusListeners.forEach(listener => listener(status));
  }
}

// Create a singleton instance for global use
export const elevatorConnection = new ElevatorConnection();

// Hook for using the elevator connection
export function useElevatorConnection() {
  return elevatorConnection;
}