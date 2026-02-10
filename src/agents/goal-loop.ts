/**
 * Autonomous Goal Loop - Enables goal-driven AI agent behavior
 * 
 * Transforms OpenClaw from event-driven (reactive) to goal-driven (proactive).
 * Agents can pursue internal goals, schedule autonomous actions, and interrupt
 * to initiate conversations without waiting for external triggers.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 * @date 2026-02-10
 */

import { EventEmitter } from 'node:events';

export type GoalType = 'learn' | 'monitor' | 'optimize' | 'research' | 'communicate';
export type GoalTrigger = 'time' | 'event' | 'condition';
export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';

export interface GoalSchedule {
  nextRun: Date;
  interval?: number; // milliseconds
  maxRuns?: number;
  runsCompleted?: number;
}

export interface Goal {
  id: string;
  type: GoalType;
  description: string;
  priority: GoalPriority;
  trigger: GoalTrigger;
  
  // Condition-based trigger
  condition?: () => boolean | Promise<boolean>;
  
  // Action to execute
  action: () => Promise<GoalResult>;
  
  // Time-based scheduling
  schedule?: GoalSchedule;
  
  // Metadata
  createdAt: Date;
  lastRun?: Date;
  enabled: boolean;
  
  // Error handling
  onError?: (error: Error) => Promise<void>;
  maxRetries?: number;
  retries?: number;
}

export interface GoalResult {
  success: boolean;
  message?: string;
  data?: any;
  shouldReschedule?: boolean;
}

export interface GoalLoopConfig {
  tickInterval: number; // milliseconds between loop iterations
  maxConcurrentGoals: number;
  maxTotalGoals: number;
  enableLogging: boolean;
  logPath?: string;
}

export class GoalLoop extends EventEmitter {
  private goals: Map<string, Goal> = new Map();
  private running = false;
  private config: GoalLoopConfig;
  private currentlyExecuting: Set<string> = new Set();
  
  constructor(config: Partial<GoalLoopConfig> = {}) {
    super();
    this.config = {
      tickInterval: config.tickInterval ?? 1000, // 1 second default
      maxConcurrentGoals: config.maxConcurrentGoals ?? 5,
      maxTotalGoals: config.maxTotalGoals ?? 100,
      enableLogging: config.enableLogging ?? true,
      logPath: config.logPath ?? 'memory/autonomous-actions.log',
    };
  }

  /**
   * Start the autonomous goal loop
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('GoalLoop is already running');
    }

    this.running = true;
    this.emit('started');
    this.log('GoalLoop started');

    // Main loop - runs continuously
    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        this.emit('error', error);
        console.error('GoalLoop tick error:', error);
      }

      await this.sleep(this.config.tickInterval);
    }

    this.emit('stopped');
    this.log('GoalLoop stopped');
  }

  /**
   * Stop the goal loop
   */
  async stop(): Promise<void> {
    this.running = false;
    
    // Wait for currently executing goals to complete
    while (this.currentlyExecuting.size > 0) {
      await this.sleep(100);
    }
  }

  /**
   * Single tick of the goal loop
   */
  private async tick(): Promise<void> {
    const readyGoals = await this.getReadyGoals();
    
    for (const goal of readyGoals) {
      // Respect concurrency limits
      if (this.currentlyExecuting.size >= this.config.maxConcurrentGoals) {
        break;
      }

      // Execute goal (non-blocking)
      this.executeGoal(goal).catch(error => {
        this.emit('goalError', { goal, error });
      });
    }
  }

  /**
   * Get goals that are ready to execute
   */
  private async getReadyGoals(): Promise<Goal[]> {
    const ready: Goal[] = [];

    for (const goal of this.goals.values()) {
      if (!goal.enabled) continue;
      if (this.currentlyExecuting.has(goal.id)) continue;
      
      const isReady = await this.isGoalReady(goal);
      if (isReady) {
        ready.push(goal);
      }
    }

    // Sort by priority
    return ready.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  /**
   * Check if a goal is ready to execute
   */
  private async isGoalReady(goal: Goal): Promise<boolean> {
    switch (goal.trigger) {
      case 'time':
        if (!goal.schedule) return false;
        return Date.now() >= goal.schedule.nextRun.getTime();
        
      case 'condition':
        if (!goal.condition) return false;
        return await goal.condition();
        
      case 'event':
        // Event-triggered goals are managed externally
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Execute a single goal
   */
  private async executeGoal(goal: Goal): Promise<void> {
    this.currentlyExecuting.add(goal.id);
    this.emit('goalStarted', goal);
    this.log(`Executing goal: ${goal.id} (${goal.description})`);

    try {
      const result = await goal.action();
      
      goal.lastRun = new Date();
      goal.retries = 0;

      this.emit('goalCompleted', { goal, result });
      this.log(`Goal completed: ${goal.id} - ${result.message ?? 'Success'}`);

      // Update schedule if time-based
      if (goal.schedule) {
        this.updateSchedule(goal, result);
      }

      // Disable if max runs reached
      if (goal.schedule?.maxRuns && 
          (goal.schedule.runsCompleted ?? 0) >= goal.schedule.maxRuns) {
        goal.enabled = false;
        this.log(`Goal disabled (max runs reached): ${goal.id}`);
      }

    } catch (error) {
      await this.handleGoalError(goal, error as Error);
    } finally {
      this.currentlyExecuting.delete(goal.id);
    }
  }

  /**
   * Handle goal execution errors
   */
  private async handleGoalError(goal: Goal, error: Error): Promise<void> {
    this.emit('goalError', { goal, error });
    this.log(`Goal error: ${goal.id} - ${error.message}`);

    goal.retries = (goal.retries ?? 0) + 1;

    if (goal.onError) {
      await goal.onError(error);
    }

    // Disable if max retries exceeded
    if (goal.maxRetries && goal.retries >= goal.maxRetries) {
      goal.enabled = false;
      this.log(`Goal disabled (max retries exceeded): ${goal.id}`);
    }
  }

  /**
   * Update goal schedule after execution
   */
  private updateSchedule(goal: Goal, result: GoalResult): void {
    if (!goal.schedule) return;

    goal.schedule.runsCompleted = (goal.schedule.runsCompleted ?? 0) + 1;

    if (result.shouldReschedule !== false && goal.schedule.interval) {
      goal.schedule.nextRun = new Date(Date.now() + goal.schedule.interval);
    }
  }

  /**
   * Add a goal to the loop
   */
  addGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'enabled'>): string {
    if (this.goals.size >= this.config.maxTotalGoals) {
      throw new Error(`Maximum goals reached (${this.config.maxTotalGoals})`);
    }

    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullGoal: Goal = {
      ...goal,
      id,
      createdAt: new Date(),
      enabled: true,
      retries: 0,
    };

    this.goals.set(id, fullGoal);
    this.emit('goalAdded', fullGoal);
    this.log(`Goal added: ${id} (${goal.description})`);

    return id;
  }

  /**
   * Remove a goal from the loop
   */
  removeGoal(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    this.goals.delete(id);
    this.emit('goalRemoved', goal);
    this.log(`Goal removed: ${id}`);

    return true;
  }

  /**
   * Enable/disable a goal
   */
  setGoalEnabled(id: string, enabled: boolean): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    goal.enabled = enabled;
    this.log(`Goal ${enabled ? 'enabled' : 'disabled'}: ${id}`);

    return true;
  }

  /**
   * Get goal by ID
   */
  getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  /**
   * Get all goals
   */
  getAllGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  /**
   * Manually trigger an event-based goal
   */
  async triggerGoal(id: string): Promise<void> {
    const goal = this.goals.get(id);
    if (!goal) {
      throw new Error(`Goal not found: ${id}`);
    }

    if (goal.trigger !== 'event') {
      throw new Error(`Goal ${id} is not event-triggered`);
    }

    await this.executeGoal(goal);
  }

  /**
   * Get loop status
   */
  getStatus(): {
    running: boolean;
    totalGoals: number;
    enabledGoals: number;
    executingGoals: number;
    config: GoalLoopConfig;
  } {
    return {
      running: this.running,
      totalGoals: this.goals.size,
      enabledGoals: Array.from(this.goals.values()).filter(g => g.enabled).length,
      executingGoals: this.currentlyExecuting.size,
      config: this.config,
    };
  }

  /**
   * Priority comparison
   */
  private comparePriority(a: GoalPriority, b: GoalPriority): number {
    const order: Record<GoalPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };
    return order[b] - order[a];
  }

  /**
   * Log autonomous actions
   */
  private log(message: string): void {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Emit for external logging
    this.emit('log', logEntry);

    // TODO: Write to file system (requires fs access)
    // For now, just console.log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GoalLoop] ${message}`);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper function to create time-based goals easily
 */
export function createTimeBasedGoal(
  description: string,
  action: () => Promise<GoalResult>,
  options: {
    type?: GoalType;
    priority?: GoalPriority;
    interval: number; // milliseconds
    startDelay?: number; // milliseconds before first run
    maxRuns?: number;
  }
): Omit<Goal, 'id' | 'createdAt' | 'enabled'> {
  return {
    type: options.type ?? 'monitor',
    description,
    priority: options.priority ?? 'normal',
    trigger: 'time',
    action,
    schedule: {
      nextRun: new Date(Date.now() + (options.startDelay ?? 0)),
      interval: options.interval,
      maxRuns: options.maxRuns,
      runsCompleted: 0,
    },
  };
}

/**
 * Helper function to create condition-based goals easily
 */
export function createConditionBasedGoal(
  description: string,
  condition: () => boolean | Promise<boolean>,
  action: () => Promise<GoalResult>,
  options: {
    type?: GoalType;
    priority?: GoalPriority;
  } = {}
): Omit<Goal, 'id' | 'createdAt' | 'enabled'> {
  return {
    type: options.type ?? 'monitor',
    description,
    priority: options.priority ?? 'normal',
    trigger: 'condition',
    condition,
    action,
  };
}
