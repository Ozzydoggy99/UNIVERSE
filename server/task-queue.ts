import { EventEmitter } from 'events';
import { TaskBuilder } from './task-builder.js';

export interface TaskStatus {
  id: string;
  type: 'dropoff' | 'pickup';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startTime?: number;
  endTime?: number;
  serialNumber: string;
  dropoffPointId?: string;
  shelfPointId?: string;
  pickupPointId?: string;
  hasBin: boolean;
  isJackedUp: boolean;
}

export class TaskQueue extends EventEmitter {
  private queue: TaskStatus[] = [];
  private maxQueueSize: number = 100;
  private currentTask: TaskStatus | null = null;
  private taskBuilder: TaskBuilder;

  constructor(serialNumber: string) {
    super();
    this.taskBuilder = new TaskBuilder(serialNumber);
  }

  async addTask(taskType: 'dropoff' | 'pickup', params: {
    dropoffPointId?: string;
    shelfPointId: string;
    pickupPointId?: string;
  }): Promise<string> {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    const task: TaskStatus = {
      id: `task_${Date.now()}`,
      type: taskType,
      status: 'queued',
      robotId: this.taskBuilder.robotId,
      ...params,
      hasBin: false,
      isJackedUp: false
    };

    this.queue.push(task);
    this.emit('taskAdded', task);

    if (!this.currentTask) {
      this.processNextTask();
    }

    return task.id;
  }

  private async processNextTask() {
    if (this.queue.length === 0 || this.currentTask) {
      return;
    }

    this.currentTask = this.queue.shift()!;
    this.currentTask.status = 'running';
    this.currentTask.startTime = Date.now();
    this.emit('taskStarted', this.currentTask);

    try {
      let taskId: string;
      if (this.currentTask.type === 'dropoff') {
        taskId = await this.taskBuilder.createDropoffTask(
          this.currentTask.dropoffPointId!,
          this.currentTask.shelfPointId
        );
      } else {
        taskId = await this.taskBuilder.createPickupTask(
          this.currentTask.shelfPointId,
          this.currentTask.pickupPointId!
        );
      }

      this.currentTask.status = 'completed';
      this.currentTask.endTime = Date.now();
      this.emit('taskCompleted', this.currentTask);
    } catch (error) {
      this.currentTask.status = 'failed';
      this.currentTask.error = error instanceof Error ? error.message : 'Unknown error';
      this.currentTask.endTime = Date.now();
      this.emit('taskFailed', this.currentTask);
    }

    this.currentTask = null;
    this.processNextTask();
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.queue.find(t => t.id === taskId) || this.currentTask;
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error('Cannot cancel completed or failed task');
    }

    if (task === this.currentTask) {
      // Handle current task cancellation
      if (task.hasBin || task.isJackedUp) {
        // If robot has bin or is jacked up, go to pickup point first
        if (task.type === 'dropoff') {
          await this.taskBuilder.createPickupTask(
            task.shelfPointId,
            task.dropoffPointId!
          );
        } else {
          await this.taskBuilder.createPickupTask(
            task.shelfPointId,
            task.pickupPointId!
          );
        }
      }
      // Return to charger
      await this.taskBuilder.createReturnToChargerTask();
    } else {
      // Remove from queue
      this.queue = this.queue.filter(t => t.id !== taskId);
    }

    task.status = 'cancelled';
    task.endTime = Date.now();
    this.emit('taskCancelled', task);
  }

  getTaskStatus(taskId: string): TaskStatus | null {
    return this.queue.find(t => t.id === taskId) || this.currentTask || null;
  }

  getQueueStatus(): {
    queueLength: number;
    currentTask: TaskStatus | null;
    queuedTasks: TaskStatus[];
  } {
    return {
      queueLength: this.queue.length,
      currentTask: this.currentTask,
      queuedTasks: [...this.queue]
    };
  }

  updateRobotState(hasBin: boolean, isJackedUp: boolean) {
    if (this.currentTask) {
      this.currentTask.hasBin = hasBin;
      this.currentTask.isJackedUp = isJackedUp;
    }
  }
} 