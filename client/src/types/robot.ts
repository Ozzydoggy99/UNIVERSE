// Define types for robot status data
export interface RobotStatus {
  model?: string;
  serialNumber?: string;
  battery?: number;
  status?: string;
  mode?: string;
  lastUpdate?: string;
  task?: string;
  location?: {
    x: number;
    y: number;
    floor: number;
  };
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