// server/types.ts

export interface Point {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  ori?: number;  // Original orientation property
  theta?: number; // Added theta for compatibility with robot API
  robotId?: string;
  type?: string;
  floor?: string;
  floorId?: string;
}

export interface TaskPoint {
  x: number;
  y: number;
  yaw: number;
  areaId: number;
  type: number;
  ext?: {
    name: string;
  };
  stepActs?: Array<{
    type: number;
    data: Record<string, any>;
  }>;
}

export interface Task {
  name: string;
  robotId: string;
  routeMode: number;
  runMode: number;
  runNum: number;
  taskType: number;
  runType: number;
  ignorePublicSite: boolean;
  speed: number;
  pts: TaskPoint[];
  backPt?: TaskPoint;
}