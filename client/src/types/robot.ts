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
}

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

export interface RobotSensorData {
  temperature: number;
  humidity: number;
  proximity: number[];
  battery: number;
  timestamp: string;
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
  grid: any[];
  obstacles: MapPoint[];
  paths: MapPath[];
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
}