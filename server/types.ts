// server/types.ts

import { Request } from 'express';

// Service and operation types
export type ServiceType = "robot" | "laundry" | "trash";
export type OperationType = 'pickup' | 'dropoff' | 'transfer';

// Point and map types
export interface Point {
  id: string;
  name: string;
  x: number;
  y: number;
  ori: number;
  properties: {
    robotId: string;
    humanName: string;
    [key: string]: any;
  };
}

export interface MapPoints {
  [floorId: string]: {
    shelfPoints: Point[];
    dockingPoints: Point[];
    dropoffPoint?: Point;
    dropoffDockingPoint?: Point;
    pickupPoint?: Point;
    pickupDockingPoint?: Point;
    chargerPoint?: Point;
    name?: string;
    displayName?: string;
  }
}

// Workflow state interface
export interface WorkflowState {
  id: string;
  serviceType: ServiceType;
  operationType: OperationType;
  floorId: string;
  shelfId: string;
  startTime: Date;
  endTime?: Date;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  error?: string;
  lastMoveId?: number;
  lastMessage?: string;
}

// Move command interface
export interface MoveCommand {
  creator: string;
  type: 'standard' | 'charge' | 'align_with_rack' | 'to_unload_point' | 'follow_target' | 'along_given_route';
  target_x: number;
  target_y: number;
  target_z?: number;
  target_ori?: number;
  target_accuracy?: number;
  use_target_zone?: boolean;
  charge_retry_count?: number;
  rack_area_id?: string;
  properties?: {
    max_trans_vel?: number;
    max_rot_vel?: number;
    acc_lim_x?: number;
    acc_lim_theta?: number;
    planning_mode?: 'directional' | 'omni';
    inplace_rotate?: boolean;
  };
}

// API response interfaces
export interface MoveResponseData {
  id: string;
  state: string;
  fail_reason_str?: string;
  fail_message?: string;
}

export interface JackStateResponse {
  is_up: boolean;
}

export interface ChargingStateResponse {
  is_charging: boolean;
}

// Express request interface
export interface WorkflowRequest extends Request {
  body: {
    serviceType?: string;
    operationType?: string;
    floorId?: string;
    shelfId?: string;
    robotId?: string;
    actionId?: string;
    params?: any;
  };
  params: {
    workflowId?: string;
    type?: string;
  };
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

export interface Robot {
  name: string;
  localIp: string;
  publicIp: string;
  secret: string;
  serialNumber: string;
  createdAt: Date;
}