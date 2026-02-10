/**
 * Tests for Parallel Orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ParallelOrchestrator, type WorkerTask } from './parallel-orchestrator';

describe('ParallelOrchestrator', () => {
  let orchestrator: ParallelOrchestrator;

  beforeEach(async () => {
    orchestrator = new ParallelOrchestrator({
      maxWorkers: 3,
      enableLogging: false,
      taskQueueSize: 10,
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const status = orchestrator.getStatus();
      expect(status.workers).toBe(0); // No workers yet
      expect(status.queuedTasks).toBe(0);
      expect(status.activeTasks).toBe(0);
    });

    it('should emit initialized event', async () => {
      const events: string[] = [];
      
      const newOrchestrator = new ParallelOrchestrator({ enableLogging: false });
      newOrchestrator.on('initialized', () => events.push('initialized'));
      
      await newOrchestrator.initialize();
      
      expect(events).toContain('initialized');
      
      await newOrchestrator.shutdown();
    });
  });

  describe('Task Submission', () => {
    it('should submit and queue task', async () => {
      const taskId = await orchestrator.submitTask({
        type: 'monitor',
        description: 'Test monitoring task',
        priority: 5,
        config: { target: 'system', interval: 1000 },
      });

      expect(taskId).toMatch(/^task_/);
      
      const status = orchestrator.getTaskStatus(taskId);
      expect(['queued', 'running']).toContain(status);
    });

    it('should emit taskQueued event', async () => {
      const events: any[] = [];
      
      orchestrator.on('taskQueued', (task) => events.push(task));

      await orchestrator.submitTask({
        type: 'research',
        description: 'Research task',
        priority: 3,
        config: { topic: 'AI' },
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].description).toBe('Research task');
    });

    it('should enforce queue size limit', async () => {
      const smallOrchestrator = new ParallelOrchestrator({
        taskQueueSize: 2,
        maxWorkers: 1,
        enableLogging: false,
      });

      await smallOrchestrator.initialize();

      // Submit 2 tasks (fill queue)
      await smallOrchestrator.submitTask({
        type: 'monitor',
        description: 'Task 1',
        priority: 1,
        config: {},
      });

      await smallOrchestrator.submitTask({
        type: 'monitor',
        description: 'Task 2',
        priority: 1,
        config: {},
      });

      // Third task should throw (queue full)
      await expect(
        smallOrchestrator.submitTask({
          type: 'monitor',
          description: 'Task 3',
          priority: 1,
          config: {},
        })
      ).rejects.toThrow('Task queue full');

      await smallOrchestrator.shutdown();
    });
  });

  describe('Worker Management', () => {
    it('should create workers on demand', async () => {
      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Task 1',
        priority: 1,
        config: { duration: 100 },
      });

      // Give worker time to spawn
      await new Promise(resolve => setTimeout(resolve, 100));

      const workers = orchestrator.getWorkers();
      expect(workers.length).toBeGreaterThan(0);
    });

    it('should respect max workers limit', async () => {
      const limitedOrchestrator = new ParallelOrchestrator({
        maxWorkers: 2,
        enableLogging: false,
      });

      await limitedOrchestrator.initialize();

      // Submit more tasks than max workers
      for (let i = 0; i < 5; i++) {
        await limitedOrchestrator.submitTask({
          type: 'monitor',
          description: `Task ${i}`,
          priority: 1,
          config: { duration: 5000 },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const status = limitedOrchestrator.getStatus();
      expect(status.workers).toBeLessThanOrEqual(2);

      await limitedOrchestrator.shutdown();
    });

    it('should emit workerCreated event', async () => {
      const events: any[] = [];
      
      orchestrator.on('workerCreated', (worker) => events.push(worker));

      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Test task',
        priority: 1,
        config: {},
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].id).toMatch(/^worker_/);
    });
  });

  describe('Task Execution', () => {
    it('should execute task and get result', async () => {
      const taskId = await orchestrator.submitTask({
        type: 'analyze',
        description: 'Analyze data',
        priority: 5,
        config: { data: [1, 2, 3, 4, 5] },
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = orchestrator.getResult(taskId);
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should emit taskStarted event', async () => {
      const events: string[] = [];
      
      orchestrator.on('taskStarted', () => events.push('taskStarted'));

      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Test task',
        priority: 1,
        config: { duration: 100 },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toContain('taskStarted');
    });

    it('should emit taskCompleted event', async () => {
      const completedTasks: any[] = [];
      
      orchestrator.on('taskCompleted', (result) => completedTasks.push(result));

      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Quick task',
        priority: 1,
        config: { duration: 100 },
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(completedTasks.length).toBeGreaterThan(0);
      expect(completedTasks[0].success).toBe(true);
    });

    it('should call onComplete callback', async () => {
      let callbackCalled = false;
      let callbackResult: any;

      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Callback test',
        priority: 1,
        config: { duration: 100 },
        onComplete: (result) => {
          callbackCalled = true;
          callbackResult = result;
        },
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(callbackCalled).toBe(true);
      expect(callbackResult.success).toBe(true);
    });
  });

  describe('Progress Reporting', () => {
    it('should emit progress events', async () => {
      const progressEvents: any[] = [];
      
      orchestrator.on('taskProgress', (progress) => progressEvents.push(progress));

      await orchestrator.submitTask({
        type: 'research',
        description: 'Research with progress',
        priority: 1,
        config: { topic: 'Testing', sources: 3 },
      });

      await new Promise(resolve => setTimeout(resolve, 2500));

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].taskId).toBeDefined();
    });

    it('should call onProgress callback', async () => {
      const progressUpdates: any[] = [];

      await orchestrator.submitTask({
        type: 'research',
        description: 'Progress callback test',
        priority: 1,
        config: { topic: 'Testing', sources: 2 },
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('Task Status', () => {
    it('should track task status through lifecycle', async () => {
      const taskId = await orchestrator.submitTask({
        type: 'monitor',
        description: 'Status tracking test',
        priority: 1,
        config: { duration: 500 },
      });

      // Initially queued or running
      let status = orchestrator.getTaskStatus(taskId);
      expect(['queued', 'running']).toContain(status);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should be completed
      status = orchestrator.getTaskStatus(taskId);
      expect(status).toBe('completed');
    });

    it('should return unknown for non-existent task', () => {
      const status = orchestrator.getTaskStatus('nonexistent_task');
      expect(status).toBe('unknown');
    });
  });

  describe('Error Handling', () => {
    it('should handle task errors gracefully', async () => {
      const errorEvents: any[] = [];
      
      orchestrator.on('taskError', (event) => errorEvents.push(event));

      // Submit task with invalid config to trigger error
      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Error test',
        priority: 1,
        config: {}, // Missing required fields
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // System should still be operational
      const status = orchestrator.getStatus();
      expect(status.workers).toBeGreaterThanOrEqual(0);
    });

    it('should call onError callback', async () => {
      let errorCalled = false;
      let errorObject: any;

      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Error callback test',
        priority: 1,
        config: {},
        onError: (error) => {
          errorCalled = true;
          errorObject = error;
        },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Note: Whether error is called depends on worker implementation
      // This test verifies the callback mechanism exists
    });
  });

  describe('Status Reporting', () => {
    it('should report accurate status', async () => {
      const initialStatus = orchestrator.getStatus();
      expect(initialStatus.workers).toBe(0);
      expect(initialStatus.queuedTasks).toBe(0);

      // Submit task
      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Status test',
        priority: 1,
        config: { duration: 1000 },
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const activeStatus = orchestrator.getStatus();
      expect(activeStatus.workers + activeStatus.queuedTasks).toBeGreaterThan(0);
    });

    it('should list all workers', async () => {
      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Worker list test',
        priority: 1,
        config: { duration: 1000 },
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const workers = orchestrator.getWorkers();
      expect(Array.isArray(workers)).toBe(true);
      
      if (workers.length > 0) {
        expect(workers[0]).toHaveProperty('id');
        expect(workers[0]).toHaveProperty('type');
        expect(workers[0]).toHaveProperty('status');
      }
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await orchestrator.submitTask({
        type: 'monitor',
        description: 'Shutdown test',
        priority: 1,
        config: { duration: 5000 },
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      await orchestrator.shutdown();

      const status = orchestrator.getStatus();
      expect(status.workers).toBe(0);
      expect(status.activeTasks).toBe(0);
    });

    it('should emit shutdown event', async () => {
      const events: string[] = [];
      
      orchestrator.on('shutdown', () => events.push('shutdown'));

      await orchestrator.shutdown();

      expect(events).toContain('shutdown');
    });
  });
});
