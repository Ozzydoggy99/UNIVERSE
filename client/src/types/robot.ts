// Define types for robot status data
export interface RobotStatus {
  model?: string;
  serialNumber?: string;
  battery?: number;
  status?: string;
  mode?: string;
  lastUpdate?: string;
  task?: string;
  cameraEnabled?: boolean;
  cameraUrl?: string;
  location?: {
    x: number;
    y: number;
    floor: number;
  };
  // Additional fields for the proxy connection
  operationalStatus?: string;
  uptime?: string;
  messages?: { timestamp: string; text: string }[];
  // Physical robot specific fields
  error?: string;
  slam_state?: string;
  slam_quality?: number;
  control_mode?: string;
  emergency_stop_pressed?: boolean;
  // Connection status for real-time monitoring
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export interface RobotPosition {
  x: number;
  y: number;
  z?: number;
  orientation: number;
  speed?: number;
  timestamp?: string;
  // Additional fields for proxy connection
  currentTask?: string;
  destination?: { x: number; y: number; z: number };
  distanceToTarget?: number;
  // Physical robot specific fields
  footprint?: any[];
  covariance?: number[][];
  pos?: number[];
  ori?: number;
  cov?: number[][];
  // Connection status for real-time monitoring
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export interface RobotSensorData {
  temperature: number;
  humidity?: number;
  proximity?: number | number[];
  battery: number;
  timestamp?: string;
  // Additional fields for the proxy
  light?: number;
  noise?: number;
  // Physical robot specific fields
  voltage?: number;
  current?: number;
  power_supply_status?: string;
  charging?: boolean;
  percentage?: number;
  // Connection status for real-time monitoring
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export interface MapPoint {
  x: number;
  y: number;
  z: number;
}

export interface MapPath {
  points: MapPoint[];
  status: string;
}

export interface MapData {
  grid: any; // Can be array or base64 string depending on map format
  obstacles: MapPoint[];
  paths: MapPath[];
  // Additional fields for maps from the physical robot
  size?: number[];
  resolution?: number;
  origin?: number[];
  // Connection status for real-time monitoring
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export interface CameraData {
  enabled: boolean;
  streamUrl: string;
  resolution: {
    width: number;
    height: number;
  };
  rotation: number;
  nightVision: boolean;
  timestamp: string;
  // Connection status for real-time monitoring
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}