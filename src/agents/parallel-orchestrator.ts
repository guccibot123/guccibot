/**
 * Parallel Orchestrator - True multitasking for autonomous agents
 * 
 * Enables background worker threads for monitoring, research, learning
 * while main agent remains responsive to user interactions.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 * @date 2026-02-10
 */

import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type WorkerTaskType = 'monitor' | 'research' | 'learn' | 'optimize' | 'analyze';
export type WorkerStatus = 'idle' | 'running' | 'paused' | 'terminated' | 'error';

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  description: string;
  priority: number;
  
  // Task configuration
  config: Record<string, any>;
  
  // Execution control
  timeout?: number; // milliseconds
  retryOnError?: boolean;
  maxRetries?: number;
  
  // Callbacks
  onProgress?: (progress: WorkerProgress) => void;
  onComplete?: (result: WorkerResult) => void;
  onError?: (error: Error) => void;
}

export interface WorkerProgress {
  taskId: string;
  completed: number;
  total: number;
  message?: string;
  data?: any;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number; // milliseconds
}

export interface WorkerInfo {
  id: string;
  type: WorkerTaskType;
  status: WorkerStatus;
  currentTask?: string;
  tasksCompleted: number;
  errors: number;
  startTime: Date;
  lastActivity?: Date;
}

export interface ParallelOrchestratorConfig {
  maxWorkers: number;
  workerScriptPath?: string;
  enableAutoScaling: boolean;
  idleTimeout: number; // milliseconds
  taskQueueSize: number;
  enableLogging: boolean;
}

/**
 * Parallel Orchestrator
 * 
 * Manages pool of background workers for parallel task execution.
 */
export class ParallelOrchestrator extends EventEmitter {
  private config: ParallelOrchestratorConfig;
  private workers: Map<string, WorkerInstance> = new Map();
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private results: Map<string, WorkerResult> = new Map();
  private nextWorkerId = 1;
  
  constructor(config: Partial<ParallelOrchestratorConfig> = {}) {
    super();
    
    this.config = {
      maxWorkers: config.maxWorkers ?? 5,
      workerScriptPath: config.workerScriptPath ?? this.getDefaultWorkerPath(),
      enableAutoScaling: config.enableAutoScaling ?? true,
      idleTimeout: config.idleTimeout ?? 5 * 60 * 1000, // 5 minutes
      taskQueueSize: config.taskQueueSize ?? 100,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Initialize orchestrator
   */
  async initialize(): Promise<void> {
    this.emit('initialized');
    this.log('ParallelOrchestrator initialized');
  }

  /**
   * Submit task for parallel execution
   */
  async submitTask(task: Omit<WorkerTask, 'id'>): Promise<string> {
    if (this.taskQueue.length >= this.config.taskQueueSize) {
      throw new Error(`Task queue full (${this.config.taskQueueSize})`);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: WorkerTask = {
      ...task,
      id: taskId,
    };

    this.taskQueue.push(fullTask);
    this.emit('taskQueued', fullTask);
    this.log(`Task queued: ${taskId} (${task.description})`);

    // Try to execute immediately if workers available
    await this.processQueue();

    return taskId;
  }

  /**
   * Process task queue
   */
  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0 && this.canSpawnWorker()) {
      const task = this.taskQueue.shift()!;
      await this.executeTask(task);
    }
  }

  /**
   * Execute task on worker
   */
  private async executeTask(task: WorkerTask): Promise<void> {
    const worker = await this.getOrCreateWorker(task.type);
    
    this.activeTasks.set(task.id, task);
    worker.currentTask = task.id;
    worker.status = 'running';
    worker.lastActivity = new Date();

    this.emit('taskStarted', task);
    this.log(`Task started: ${task.id} on worker ${worker.id}`);

    // Send task to worker
    worker.instance.postMessage({
      type: 'execute',
      task: {
        id: task.id,
        type: task.type,
        description: task.description,
        config: task.config,
      },
    });

    // Set timeout if specified
    if (task.timeout) {
      setTimeout(() => {
        if (this.activeTasks.has(task.id)) {
          this.terminateTask(task.id, 'timeout');
        }
      }, task.timeout);
    }
  }

  /**
   * Get or create worker
   */
  private async getOrCreateWorker(type: WorkerTaskType): Promise<WorkerInstance> {
    // Find idle worker of same type
    for (const worker of this.workers.values()) {
      if (worker.type === type && worker.status === 'idle') {
        return worker;
      }
    }

    // Find any idle worker
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle') {
        worker.type = type;
        return worker;
      }
    }

    // Create new worker if under limit
    if (this.workers.size < this.config.maxWorkers) {
      return await this.createWorker(type);
    }

    // Wait for worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const worker of this.workers.values()) {
          if (worker.status === 'idle') {
            clearInterval(checkInterval);
            worker.type = type;
            resolve(worker);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Create new worker
   */
  private async createWorker(type: WorkerTaskType): Promise<WorkerInstance> {
    const workerId = `worker_${this.nextWorkerId++}`;

    const worker = new Worker(this.config.workerScriptPath!, {
      workerData: {
        workerId,
        type,
      },
    });

    const instance: WorkerInstance = {
      id: workerId,
      type,
      status: 'idle',
      instance: worker,
      currentTask: undefined,
      tasksCompleted: 0,
      errors: 0,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // Set up message handlers
    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workers.set(workerId, instance);
    this.emit('workerCreated', instance);
    this.log(`Worker created: ${workerId} (type: ${type})`);

    return instance;
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.lastActivity = new Date();

    switch (message.type) {
      case 'progress':
        this.handleProgress(worker, message.data);
        break;

      case 'complete':
        this.handleComplete(worker, message.data);
        break;

      case 'error':
        this.handleTaskError(worker, message.error);
        break;

      default:
        this.log(`Unknown message type from worker ${workerId}: ${message.type}`);
    }
  }

  /**
   * Handle task progress
   */
  private handleProgress(worker: WorkerInstance, data: any): void {
    const task = worker.currentTask ? this.activeTasks.get(worker.currentTask) : undefined;
    if (!task) return;

    const progress: WorkerProgress = {
      taskId: task.id,
      completed: data.completed,
      total: data.total,
      message: data.message,
      data: data.data,
    };

    this.emit('taskProgress', progress);

    if (task.onProgress) {
      task.onProgress(progress);
    }
  }

  /**
   * Handle task completion
   */
  private handleComplete(worker: WorkerInstance, data: any): void {
    const task = worker.currentTask ? this.activeTasks.get(worker.currentTask) : undefined;
    if (!task) return;

    const result: WorkerResult = {
      taskId: task.id,
      success: true,
      data: data.result,
      duration: data.duration,
    };

    this.results.set(task.id, result);
    this.activeTasks.delete(task.id);
    
    worker.currentTask = undefined;
    worker.status = 'idle';
    worker.tasksCompleted++;

    this.emit('taskCompleted', result);
    this.log(`Task completed: ${task.id}`);

    if (task.onComplete) {
      task.onComplete(result);
    }

    // Process next task in queue
    this.processQueue();

    // Consider scaling down if idle
    if (this.config.enableAutoScaling) {
      this.considerScaleDown(worker);
    }
  }

  /**
   * Handle task error
   */
  private handleTaskError(worker: WorkerInstance, error: any): void {
    const task = worker.currentTask ? this.activeTasks.get(worker.currentTask) : undefined;
    if (!task) return;

    worker.errors++;

    const result: WorkerResult = {
      taskId: task.id,
      success: false,
      error: error.message,
      duration: 0,
    };

    this.results.set(task.id, result);
    this.activeTasks.delete(task.id);
    
    worker.currentTask = undefined;
    worker.status = 'idle';

    this.emit('taskError', { task, error });
    this.log(`Task error: ${task.id} - ${error.message}`);

    if (task.onError) {
      task.onError(new Error(error.message));
    }

    // Retry if configured
    if (task.retryOnError && (!task.maxRetries || worker.errors < task.maxRetries)) {
      this.log(`Retrying task: ${task.id}`);
      this.taskQueue.unshift(task); // Re-queue at front
    }

    // Process next task
    this.processQueue();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.status = 'error';
    this.emit('workerError', { workerId, error });
    this.log(`Worker error: ${workerId} - ${error.message}`);

    // Handle current task
    if (worker.currentTask) {
      this.handleTaskError(worker, error);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    this.workers.delete(workerId);
    this.emit('workerExited', { workerId, code });
    this.log(`Worker exited: ${workerId} (code: ${code})`);

    // Handle current task as error
    if (worker.currentTask) {
      this.handleTaskError(worker, new Error(`Worker exited with code ${code}`));
    }
  }

  /**
   * Terminate task
   */
  private terminateTask(taskId: string, reason: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    // Find worker running this task
    for (const worker of this.workers.values()) {
      if (worker.currentTask === taskId) {
        worker.instance.postMessage({ type: 'terminate', taskId });
        
        const result: WorkerResult = {
          taskId,
          success: false,
          error: `Task terminated: ${reason}`,
          duration: 0,
        };

        this.results.set(taskId, result);
        this.activeTasks.delete(taskId);
        
        worker.currentTask = undefined;
        worker.status = 'idle';

        this.emit('taskTerminated', { taskId, reason });
        this.log(`Task terminated: ${taskId} (${reason})`);
        
        break;
      }
    }
  }

  /**
   * Consider scaling down workers
   */
  private considerScaleDown(worker: WorkerInstance): void {
    if (this.workers.size <= 1) return; // Keep at least one
    if (this.taskQueue.length > 0) return; // Still have work

    const idleTime = Date.now() - worker.lastActivity!.getTime();
    if (idleTime > this.config.idleTimeout) {
      this.terminateWorker(worker.id);
    }
  }

  /**
   * Terminate worker
   */
  private terminateWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.status = 'terminated';
    worker.instance.terminate();
    this.workers.delete(workerId);

    this.emit('workerTerminated', workerId);
    this.log(`Worker terminated: ${workerId}`);
  }

  /**
   * Get task result
   */
  getResult(taskId: string): WorkerResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): 'queued' | 'running' | 'completed' | 'error' | 'unknown' {
    if (this.taskQueue.some(t => t.id === taskId)) return 'queued';
    if (this.activeTasks.has(taskId)) return 'running';
    
    const result = this.results.get(taskId);
    if (result) {
      return result.success ? 'completed' : 'error';
    }

    return 'unknown';
  }

  /**
   * Get all worker info
   */
  getWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(w => ({
      id: w.id,
      type: w.type,
      status: w.status,
      currentTask: w.currentTask,
      tasksCompleted: w.tasksCompleted,
      errors: w.errors,
      startTime: w.startTime,
      lastActivity: w.lastActivity,
    }));
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    workers: number;
    activeWorkers: number;
    queuedTasks: number;
    activeTasks: number;
    completedTasks: number;
    config: ParallelOrchestratorConfig;
  } {
    return {
      workers: this.workers.size,
      activeWorkers: Array.from(this.workers.values()).filter(w => w.status === 'running').length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      completedTasks: this.results.size,
      config: this.config,
    };
  }

  /**
   * Check if can spawn worker
   */
  private canSpawnWorker(): boolean {
    return this.workers.size < this.config.maxWorkers;
  }

  /**
   * Get default worker script path
   */
  private getDefaultWorkerPath(): string {
    // In production, this would point to compiled worker script
    return path.join(path.dirname(fileURLToPath(import.meta.url)), 'parallel-worker.js');
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [ParallelOrchestrator] ${message}`;

    this.emit('log', logEntry);

    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry);
    }
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down...');

    // Terminate all workers
    for (const worker of this.workers.values()) {
      await worker.instance.terminate();
    }

    this.workers.clear();
    this.taskQueue = [];
    this.activeTasks.clear();

    this.emit('shutdown');
    this.log('Shutdown complete');
  }
}

/**
 * Worker instance
 */
interface WorkerInstance {
  id: string;
  type: WorkerTaskType;
  status: WorkerStatus;
  instance: Worker;
  currentTask?: string;
  tasksCompleted: number;
  errors: number;
  startTime: Date;
  lastActivity?: Date;
}

/**
 * Helper: Create orchestrator with defaults
 */
export function createParallelOrchestrator(
  config?: Partial<ParallelOrchestratorConfig>
): ParallelOrchestrator {
  return new ParallelOrchestrator(config);
}
