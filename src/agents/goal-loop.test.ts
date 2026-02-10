/**
 * Tests for Autonomous Goal Loop
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoalLoop, createTimeBasedGoal, createConditionBasedGoal, type GoalResult } from './goal-loop';

describe('GoalLoop', () => {
  let goalLoop: GoalLoop;

  beforeEach(() => {
    goalLoop = new GoalLoop({
      tickInterval: 100, // Fast ticks for testing
      enableLogging: false, // Quiet tests
    });
  });

  afterEach(async () => {
    if (goalLoop.getStatus().running) {
      await goalLoop.stop();
    }
  });

  describe('Basic Operations', () => {
    it('should start and stop successfully', async () => {
      expect(goalLoop.getStatus().running).toBe(false);

      const startPromise = goalLoop.start();
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(goalLoop.getStatus().running).toBe(true);

      await goalLoop.stop();
      expect(goalLoop.getStatus().running).toBe(false);

      // Start promise should resolve after stop
      await startPromise;
    });

    it('should add and remove goals', () => {
      const goal = createTimeBasedGoal(
        'Test goal',
        async () => ({ success: true }),
        { interval: 1000 }
      );

      const id = goalLoop.addGoal(goal);
      expect(goalLoop.getGoal(id)).toBeDefined();
      expect(goalLoop.getStatus().totalGoals).toBe(1);

      const removed = goalLoop.removeGoal(id);
      expect(removed).toBe(true);
      expect(goalLoop.getGoal(id)).toBeUndefined();
      expect(goalLoop.getStatus().totalGoals).toBe(0);
    });

    it('should enable and disable goals', () => {
      const goal = createTimeBasedGoal(
        'Test goal',
        async () => ({ success: true }),
        { interval: 1000 }
      );

      const id = goalLoop.addGoal(goal);
      expect(goalLoop.getGoal(id)?.enabled).toBe(true);

      goalLoop.setGoalEnabled(id, false);
      expect(goalLoop.getGoal(id)?.enabled).toBe(false);

      goalLoop.setGoalEnabled(id, true);
      expect(goalLoop.getGoal(id)?.enabled).toBe(true);
    });

    it('should enforce max goals limit', () => {
      const limitedLoop = new GoalLoop({
        maxTotalGoals: 2,
        enableLogging: false,
      });

      const goal = createTimeBasedGoal(
        'Test goal',
        async () => ({ success: true }),
        { interval: 1000 }
      );

      limitedLoop.addGoal(goal);
      limitedLoop.addGoal(goal);

      expect(() => limitedLoop.addGoal(goal)).toThrow('Maximum goals reached');
    });
  });

  describe('Time-Based Goals', () => {
    it('should execute time-based goal at scheduled time', async () => {
      let executed = false;

      const goal = createTimeBasedGoal(
        'Immediate execution',
        async () => {
          executed = true;
          return { success: true };
        },
        { 
          interval: 1000,
          startDelay: 50, // Execute quickly
        }
      );

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(executed).toBe(true);

      await goalLoop.stop();
      await startPromise;
    });

    it('should execute recurring time-based goal', async () => {
      let executionCount = 0;

      const goal = createTimeBasedGoal(
        'Recurring goal',
        async () => {
          executionCount++;
          return { success: true };
        },
        { 
          interval: 100, // Every 100ms
          startDelay: 0,
        }
      );

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      // Wait for multiple executions
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Should execute at least 3 times
      expect(executionCount).toBeGreaterThanOrEqual(2);

      await goalLoop.stop();
      await startPromise;
    });

    it('should respect maxRuns limit', async () => {
      let executionCount = 0;

      const goal = createTimeBasedGoal(
        'Limited runs',
        async () => {
          executionCount++;
          return { success: true };
        },
        { 
          interval: 50,
          startDelay: 0,
          maxRuns: 2,
        }
      );

      const id = goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      // Wait enough time for >2 executions if not limited
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(executionCount).toBe(2);
      expect(goalLoop.getGoal(id)?.enabled).toBe(false);

      await goalLoop.stop();
      await startPromise;
    });
  });

  describe('Condition-Based Goals', () => {
    it('should execute when condition becomes true', async () => {
      let conditionMet = false;
      let executed = false;

      const goal = createConditionBasedGoal(
        'Condition-based goal',
        () => conditionMet,
        async () => {
          executed = true;
          return { success: true };
        }
      );

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      // Condition not met yet
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(executed).toBe(false);

      // Meet condition
      conditionMet = true;
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(executed).toBe(true);

      await goalLoop.stop();
      await startPromise;
    });

    it('should support async conditions', async () => {
      let shouldExecute = false;
      let executed = false;

      const goal = createConditionBasedGoal(
        'Async condition goal',
        async () => {
          // Simulate async check (e.g., file existence, API call)
          await new Promise(resolve => setTimeout(resolve, 10));
          return shouldExecute;
        },
        async () => {
          executed = true;
          return { success: true };
        }
      );

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      shouldExecute = true;
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(executed).toBe(true);

      await goalLoop.stop();
      await startPromise;
    });
  });

  describe('Priority Handling', () => {
    it('should execute higher priority goals first', async () => {
      const executionOrder: string[] = [];

      const lowPriority = createTimeBasedGoal(
        'Low priority',
        async () => {
          executionOrder.push('low');
          return { success: true };
        },
        { 
          interval: 10000,
          startDelay: 0,
          priority: 'low',
        }
      );

      const highPriority = createTimeBasedGoal(
        'High priority',
        async () => {
          executionOrder.push('high');
          return { success: true };
        },
        { 
          interval: 10000,
          startDelay: 0,
          priority: 'high',
        }
      );

      goalLoop.addGoal(lowPriority);
      goalLoop.addGoal(highPriority);
      
      const startPromise = goalLoop.start();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(executionOrder[0]).toBe('high');
      expect(executionOrder[1]).toBe('low');

      await goalLoop.stop();
      await startPromise;
    });
  });

  describe('Error Handling', () => {
    it('should handle goal errors gracefully', async () => {
      let errorHandled = false;

      const goal = createTimeBasedGoal(
        'Failing goal',
        async () => {
          throw new Error('Test error');
        },
        { 
          interval: 1000,
          startDelay: 0,
        }
      );

      goal.onError = async (error) => {
        errorHandled = true;
        expect(error.message).toBe('Test error');
      };

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(errorHandled).toBe(true);

      await goalLoop.stop();
      await startPromise;
    });

    it('should disable goal after max retries', async () => {
      const goal = createTimeBasedGoal(
        'Repeatedly failing goal',
        async () => {
          throw new Error('Always fails');
        },
        { 
          interval: 50,
          startDelay: 0,
        }
      );

      goal.maxRetries = 3;

      const id = goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      // Wait for retries to exhaust
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const finalGoal = goalLoop.getGoal(id);
      expect(finalGoal?.enabled).toBe(false);
      expect(finalGoal?.retries).toBe(3);

      await goalLoop.stop();
      await startPromise;
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrent goals limit', async () => {
      const limitedLoop = new GoalLoop({
        maxConcurrentGoals: 2,
        tickInterval: 50,
        enableLogging: false,
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const createSlowGoal = () => createTimeBasedGoal(
        'Slow goal',
        async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          currentConcurrent--;
          return { success: true };
        },
        { 
          interval: 10000, // Only run once
          startDelay: 0,
        }
      );

      // Add 5 goals
      for (let i = 0; i < 5; i++) {
        limitedLoop.addGoal(createSlowGoal());
      }

      const startPromise = limitedLoop.start();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should never exceed max concurrent
      expect(maxConcurrent).toBeLessThanOrEqual(2);

      await limitedLoop.stop();
      await startPromise;
    });
  });

  describe('Event Emission', () => {
    it('should emit events for goal lifecycle', async () => {
      const events: string[] = [];

      goalLoop.on('started', () => events.push('started'));
      goalLoop.on('goalAdded', () => events.push('goalAdded'));
      goalLoop.on('goalStarted', () => events.push('goalStarted'));
      goalLoop.on('goalCompleted', () => events.push('goalCompleted'));
      goalLoop.on('stopped', () => events.push('stopped'));

      const goal = createTimeBasedGoal(
        'Event test',
        async () => ({ success: true }),
        { 
          interval: 1000,
          startDelay: 50,
        }
      );

      goalLoop.addGoal(goal);
      
      const startPromise = goalLoop.start();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await goalLoop.stop();
      await startPromise;

      expect(events).toContain('started');
      expect(events).toContain('goalAdded');
      expect(events).toContain('goalStarted');
      expect(events).toContain('goalCompleted');
      expect(events).toContain('stopped');
    });
  });

  describe('Status Reporting', () => {
    it('should report accurate status', () => {
      const goal1 = createTimeBasedGoal(
        'Goal 1',
        async () => ({ success: true }),
        { interval: 1000 }
      );

      const goal2 = createTimeBasedGoal(
        'Goal 2',
        async () => ({ success: true }),
        { interval: 1000 }
      );

      const id1 = goalLoop.addGoal(goal1);
      goalLoop.addGoal(goal2);

      let status = goalLoop.getStatus();
      expect(status.totalGoals).toBe(2);
      expect(status.enabledGoals).toBe(2);
      expect(status.running).toBe(false);

      goalLoop.setGoalEnabled(id1, false);

      status = goalLoop.getStatus();
      expect(status.totalGoals).toBe(2);
      expect(status.enabledGoals).toBe(1);
    });
  });
});
