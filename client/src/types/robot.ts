// Robot Status
export interface RobotStatus {
  model: string;
  serialNumber: string;
  battery: number;
  status: string; // online, offline, warning, error
  operationalStatus: string; // idle, moving, charging, etc.
  uptime: string;
  messages?: {
    timestamp: string;
    text: string;
  }[];
}

// Robot Position
export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  currentTask: string;
  destination?: Coordinate;
  distanceToTarget?: number;
}

// Robot Sensor Data
export interface RobotSensorData {
  temperature: number;
  humidity: number;
  proximity: number;
  light: number;
  noise: number;
}

// Map Data
export interface MapData {
  grid: any[];
  obstacles: Coordinate[];
  paths: {
    points: Coordinate[];
    status: string;
  }[];
}

// API Authentication
export interface AuthConfig {
  apiEndpoint: string;
  apiKey: string;
  rememberConnection: boolean;
}
