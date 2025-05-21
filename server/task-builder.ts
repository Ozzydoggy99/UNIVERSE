import { getRobotApiUrl, getAuthHeaders } from './robot-constants.js';

interface TaskPoint {
  x: number;
  y: number;
  yaw: number;
  areaId?: string;
  type: string;
  ext: {
    name: string;
    id: string;
  };
  stepActs: any[];
}

interface Task {
  name: string;
  runNum: number;
  taskType: number;
  runType: number;
  sourceType: number;
  taskPts: TaskPoint[];
}

export class TaskBuilder {
  private task: Task;
  private robotId: string;

  constructor(robotId: string, name: string = 'Task') {
    this.robotId = robotId;
    this.task = {
      name,
      runNum: 1,
      taskType: 2,
      runType: 20,
      sourceType: 6,
      taskPts: []
    };
  }

  /**
   * Create a dropoff workflow task
   * @param dropoffPointId The dropoff point ID (001-049)
   * @param shelfPointId The target shelf point ID (e.g., 115 for Floor 1)
   * @returns Promise<string> The created task ID
   */
  async createDropoffTask(dropoffPointId: string, shelfPointId: string): Promise<string> {
    if (!this.validatePointIds(dropoffPointId, shelfPointId, 'dropoff')) {
      throw new Error('Invalid point IDs for dropoff task');
    }

    this.task.taskPts = [];

    // 1. Go to dropoff docking point
    const dropoffDockingPoint = await this.getPointData(`${dropoffPointId}_load_docking`);
    this.addTaskPoint(dropoffDockingPoint);

    // 2. Detect bin and align with rack at dropoff point
    const dropoffPoint = await this.getPointData(`${dropoffPointId}_load`);
    this.addTaskPoint(dropoffPoint, [
      this.createBinDetectionAction(),
      this.createAlignWithRackAction(),
      this.createLiftUpAction()
    ]);

    // 3. Go to shelf docking point
    const shelfDockingPoint = await this.getPointData(`${shelfPointId}_load_docking`);
    this.addTaskPoint(shelfDockingPoint);

    // 4. Align with rack, unload bin at shelf point
    const shelfPoint = await this.getPointData(`${shelfPointId}_load`);
    this.addTaskPoint(shelfPoint, [
      this.createAlignWithRackAction(),
      this.createUnloadRackAction(),
      this.createLiftDownAction()
    ]);

    // 5. Return to home
    const homePoint = await this.getPointData('home');
    this.addTaskPoint(homePoint);

    return this.executeTask();
  }

  /**
   * Create a pickup workflow task
   * @param shelfPointId The source shelf point ID (e.g., 115 for Floor 1)
   * @param pickupPointId The pickup point ID (050-099)
   * @returns Promise<string> The created task ID
   */
  async createPickupTask(shelfPointId: string, pickupPointId: string): Promise<string> {
    if (!this.validatePointIds(pickupPointId, shelfPointId, 'pickup')) {
      throw new Error('Invalid point IDs for pickup task');
    }

    this.task.taskPts = [];

    // 1. Go to shelf docking point
    const shelfDockingPoint = await this.getPointData(`${shelfPointId}_load_docking`);
    this.addTaskPoint(shelfDockingPoint);

    // 2. Detect bin, align with rack, and pick up at shelf point
    const shelfPoint = await this.getPointData(`${shelfPointId}_load`);
    this.addTaskPoint(shelfPoint, [
      this.createBinDetectionAction(),
      this.createAlignWithRackAction(),
      this.createLiftUpAction()
    ]);

    // 3. Go to pickup docking point
    const pickupDockingPoint = await this.getPointData(`${pickupPointId}_load_docking`);
    this.addTaskPoint(pickupDockingPoint);

    // 4. Align with rack, unload bin at pickup point
    const pickupPoint = await this.getPointData(`${pickupPointId}_load`);
    this.addTaskPoint(pickupPoint, [
      this.createAlignWithRackAction(),
      this.createUnloadRackAction(),
      this.createLiftDownAction()
    ]);

    // 5. Return to home
    const homePoint = await this.getPointData('home');
    this.addTaskPoint(homePoint);

    return this.executeTask();
  }

  private validatePointIds(pointId1: string, pointId2: string, type: 'dropoff' | 'pickup'): boolean {
    if (type === 'dropoff') {
      // Dropoff point should be 001-049
      const dropoffId = parseInt(pointId1);
      if (isNaN(dropoffId) || dropoffId < 1 || dropoffId > 49) {
        return false;
      }
    } else {
      // Pickup point should be 050-099
      const pickupId = parseInt(pointId1);
      if (isNaN(pickupId) || pickupId < 50 || pickupId > 99) {
        return false;
      }
    }

    // Shelf point should be floor-specific (e.g., 115 for Floor 1)
    const shelfId = parseInt(pointId2);
    if (isNaN(shelfId) || shelfId < 100 || shelfId > 999) {
      return false;
    }

    return true;
  }

  private async getPointData(pointId: string): Promise<TaskPoint> {
    // TODO: Implement point data retrieval from robot API
    // This should fetch the actual coordinates and other data for the point
    throw new Error('Not implemented');
  }

  private addTaskPoint(point: TaskPoint, actions: any[] = []) {
    if (point) {
      point.stepActs = actions;
      this.task.taskPts.push(point);
    }
  }

  private createAlignWithRackAction() {
    return {
      type: 'align_with_rack',
      data: {}
    };
  }

  private createBinDetectionAction() {
    return {
      type: 'detect_bin',
      data: {
        timeout: 30, // 30 second timeout for bin detection
        retry_count: 3 // Retry detection 3 times if failed
      }
    };
  }

  private createLiftUpAction() {
    return {
      type: 47,
      data: {}
    };
  }

  private createLiftDownAction() {
    return {
      type: 48,
      data: {}
    };
  }

  private createUnloadRackAction() {
    return {
      type: 'to_unload_point',
      data: {}
    };
  }

  private async executeTask(): Promise<string> {
    const apiUrl = await getRobotApiUrl(this.robotId);
    const headers = await getAuthHeaders(this.robotId);

    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(this.task)
    });

    if (!response.ok) {
      throw new Error(`Failed to execute task: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  async createReturnToChargerTask(): Promise<string> {
    // Clear existing points
    this.task.taskPts = [];

    // Get charger point data
    const chargerPoint = await this.getPointData('charger');
    this.addTaskPoint(chargerPoint);

    return this.executeTask();
  }
} 