/**
 * Integration examples for Parallel Orchestrator
 * 
 * Shows how to combine parallel execution with goal loop and continuous context
 * for true autonomous multitasking.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 */

import { ParallelOrchestrator, type WorkerTask } from './parallel-orchestrator.js';
import { GoalLoop } from './goal-loop.js';
import type { ContinuousContext } from '../memory/continuous-context.js';

/**
 * Example 1: Background Email Monitoring
 * 
 * Monitor email in background while agent handles conversations.
 */
export async function setupBackgroundEmailMonitoring(
  orchestrator: ParallelOrchestrator
): Promise<string> {
  const taskId = await orchestrator.submitTask({
    type: 'monitor',
    description: 'Monitor email for urgent messages',
    priority: 8,
    config: {
      target: 'email',
      interval: 30 * 60 * 1000, // 30 minutes
      checkCriteria: {
        keywords: ['urgent', 'asap', 'important'],
        from: ['boss@company.com', 'client@important.com'],
      },
    },
    onProgress: (progress) => {
      console.log(`[Email Monitor] ${progress.message}`);
    },
    onComplete: (result) => {
      if (result.data?.urgentCount > 0) {
        // Trigger notification
        console.log(`[Email Monitor] ${result.data.urgentCount} urgent emails detected!`);
      }
    },
  });

  return taskId;
}

/**
 * Example 2: Parallel Research Tasks
 * 
 * Research multiple topics simultaneously.
 */
export async function conductParallelResearch(
  orchestrator: ParallelOrchestrator,
  topics: string[]
): Promise<Record<string, string>> {
  const taskIds: Record<string, string> = {};

  for (const topic of topics) {
    const taskId = await orchestrator.submitTask({
      type: 'research',
      description: `Research: ${topic}`,
      priority: 5,
      config: {
        topic,
        depth: 'medium',
        sources: 10,
      },
    });

    taskIds[topic] = taskId;
  }

  // Wait for all to complete
  await new Promise(resolve => setTimeout(resolve, 15000));

  const results: Record<string, string> = {};
  for (const [topic, taskId] of Object.entries(taskIds)) {
    const result = orchestrator.getResult(taskId);
    if (result?.success) {
      results[topic] = JSON.stringify(result.data, null, 2);
    }
  }

  return results;
}

/**
 * Example 3: Autonomous Learning Loop
 * 
 * Continuously learn new topics in background.
 */
export async function setupAutonomousLearning(
  orchestrator: ParallelOrchestrator,
  goalLoop: GoalLoop
): Promise<void> {
  // Add goal to schedule learning tasks
  goalLoop.addGoal({
    type: 'learn',
    description: 'Schedule background learning',
    priority: 'normal',
    trigger: 'time',
    schedule: {
      nextRun: new Date(Date.now() + 60000), // Start in 1 minute
      interval: 60 * 60 * 1000, // Every hour
    },
    action: async () => {
      // Identify topic to learn
      const topics = [
        'Advanced TypeScript patterns',
        'System design principles',
        'AI safety research',
        'Cognitive psychology',
      ];

      const topic = topics[Math.floor(Math.random() * topics.length)];

      // Submit learning task to worker
      await orchestrator.submitTask({
        type: 'learn',
        description: `Learn: ${topic}`,
        priority: 3,
        config: {
          subject: topic,
          duration: 30 * 60 * 1000, // 30 minutes
        },
        onComplete: (result) => {
          console.log(`[Learning] Completed: ${topic}`);
          console.log(`  Concepts learned: ${result.data?.knowledge?.concepts}`);
          console.log(`  Confidence: ${(result.data?.knowledge?.confidence * 100).toFixed(1)}%`);
        },
      });

      return { success: true, message: `Learning task scheduled: ${topic}` };
    },
  });
}

/**
 * Example 4: System Health Monitoring
 * 
 * Continuous system monitoring in background.
 */
export async function setupSystemHealthMonitoring(
  orchestrator: ParallelOrchestrator
): Promise<string> {
  const taskId = await orchestrator.submitTask({
    type: 'monitor',
    description: 'Monitor system health',
    priority: 7,
    config: {
      target: 'system',
      interval: 5 * 60 * 1000, // 5 minutes
      metrics: ['cpu', 'memory', 'disk', 'network'],
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
      },
    },
    onComplete: (result) => {
      const metrics = result.data?.metrics;
      if (metrics) {
        console.log('[System Health]', {
          cpu: `${metrics.cpu.toFixed(1)}%`,
          memory: `${metrics.memory.toFixed(1)}%`,
        });

        // Alert if thresholds exceeded
        if (metrics.cpu > 80 || metrics.memory > 85) {
          console.warn('[System Health] Resource usage high!');
        }
      }
    },
  });

  return taskId;
}

/**
 * Example 5: Context-Aware Optimization
 * 
 * Use continuous context to guide optimization tasks.
 */
export async function optimizeWithContext(
  orchestrator: ParallelOrchestrator,
  continuousContext: ContinuousContext
): Promise<void> {
  // Get recent performance context
  const perfSnippets = await continuousContext.autoInject('performance optimization');

  // Determine optimization targets from context
  const targets = perfSnippets
    .map(s => extractOptimizationTarget(s.content))
    .filter(t => t !== null);

  // Run optimizations in parallel
  for (const target of targets) {
    await orchestrator.submitTask({
      type: 'optimize',
      description: `Optimize: ${target}`,
      priority: 6,
      config: {
        target,
        metric: 'performance',
        iterations: 10,
      },
      onComplete: (result) => {
        // Log optimization result to continuous context
        continuousContext.writeOnThink(
          `Optimized ${target}: ${result.data?.totalImprovement}`,
          {
            workspaceDir: process.cwd(),
            tags: ['optimization', 'performance'],
          }
        );
      },
    });
  }
}

/**
 * Example 6: Complete Integration
 * 
 * Full autonomous system with goal loop, continuous context, and parallel execution.
 */
export async function setupFullAutonomousSystem(
  workspaceDir: string
): Promise<{
  orchestrator: ParallelOrchestrator;
  goalLoop: GoalLoop;
  cleanup: () => Promise<void>;
}> {
  // Create orchestrator
  const orchestrator = new ParallelOrchestrator({
    maxWorkers: 5,
    enableAutoScaling: true,
    idleTimeout: 10 * 60 * 1000, // 10 minutes
    enableLogging: true,
  });

  await orchestrator.initialize();

  // Create goal loop
  const goalLoop = new GoalLoop({
    tickInterval: 1000,
    maxConcurrentGoals: 5,
    enableLogging: true,
  });

  // Set up autonomous behaviors
  await setupAutonomousLearning(orchestrator, goalLoop);
  await setupBackgroundEmailMonitoring(orchestrator);
  await setupSystemHealthMonitoring(orchestrator);

  // Start goal loop
  goalLoop.start().catch(console.error);

  // Event listeners
  orchestrator.on('taskCompleted', ({ taskId, data }) => {
    console.log(`[Orchestrator] Task completed: ${taskId}`);
  });

  goalLoop.on('goalCompleted', ({ goal, result }) => {
    console.log(`[GoalLoop] Goal completed: ${goal.description}`);
  });

  // Cleanup function
  const cleanup = async () => {
    await goalLoop.stop();
    await orchestrator.shutdown();
  };

  return { orchestrator, goalLoop, cleanup };
}

/**
 * Example 7: Task Prioritization
 * 
 * Handle urgent tasks while background tasks continue.
 */
export async function handleUrgentTaskWithBackground(
  orchestrator: ParallelOrchestrator,
  urgentTask: Omit<WorkerTask, 'id'>
): Promise<string> {
  // Submit urgent task with high priority
  const taskId = await orchestrator.submitTask({
    ...urgentTask,
    priority: 10, // Maximum priority
  });

  // Background tasks continue running
  // Urgent task gets executed first

  return taskId;
}

/**
 * Example 8: Cascading Tasks
 * 
 * Chain tasks where one's output feeds into another.
 */
export async function executeCascadingTasks(
  orchestrator: ParallelOrchestrator
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    // Step 1: Research
    const researchTaskId = await orchestrator.submitTask({
      type: 'research',
      description: 'Research topic',
      priority: 5,
      config: { topic: 'AI optimization', sources: 5 },
      onComplete: async (result) => {
        if (!result.success) {
          reject(new Error('Research failed'));
          return;
        }

        // Step 2: Analyze research findings
        const analyzeTaskId = await orchestrator.submitTask({
          type: 'analyze',
          description: 'Analyze research',
          priority: 5,
          config: { data: result.data?.findings },
          onComplete: async (analyzeResult) => {
            if (!analyzeResult.success) {
              reject(new Error('Analysis failed'));
              return;
            }

            // Step 3: Optimize based on analysis
            const optimizeTaskId = await orchestrator.submitTask({
              type: 'optimize',
              description: 'Apply optimizations',
              priority: 5,
              config: {
                target: 'system',
                metric: 'performance',
                iterations: 5,
              },
              onComplete: (optimizeResult) => {
                if (optimizeResult.success) {
                  resolve(optimizeResult.data);
                } else {
                  reject(new Error('Optimization failed'));
                }
              },
            });
          },
        });
      },
    });
  });
}

/**
 * Example 9: Resource-Aware Task Scheduling
 * 
 * Scale workers based on system load.
 */
export async function setupResourceAwareScheduling(
  orchestrator: ParallelOrchestrator
): Promise<void> {
  setInterval(async () => {
    const status = orchestrator.getStatus();
    const workers = orchestrator.getWorkers();

    // Check system load (simplified)
    const highLoad = workers.filter(w => w.status === 'running').length >= status.workers * 0.8;

    if (highLoad && status.workers < 5) {
      console.log('[Scheduler] High load detected, workers will scale up as needed');
    } else if (!highLoad && status.workers > 2) {
      console.log('[Scheduler] Low load, workers will scale down when idle');
    }
  }, 60 * 1000); // Check every minute
}

/**
 * Example 10: Performance Metrics Dashboard
 * 
 * Track orchestrator performance over time.
 */
export function createPerformanceDashboard(
  orchestrator: ParallelOrchestrator
): {
  getMetrics: () => any;
  reset: () => void;
} {
  const metrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalDuration: 0,
    averageDuration: 0,
    peakWorkers: 0,
  };

  orchestrator.on('taskCompleted', (result) => {
    metrics.tasksCompleted++;
    metrics.totalDuration += result.duration;
    metrics.averageDuration = metrics.totalDuration / metrics.tasksCompleted;

    const status = orchestrator.getStatus();
    metrics.peakWorkers = Math.max(metrics.peakWorkers, status.workers);
  });

  orchestrator.on('taskError', () => {
    metrics.tasksFailed++;
  });

  return {
    getMetrics: () => ({
      ...metrics,
      successRate: metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed) * 100,
    }),
    reset: () => {
      metrics.tasksCompleted = 0;
      metrics.tasksFailed = 0;
      metrics.totalDuration = 0;
      metrics.averageDuration = 0;
      metrics.peakWorkers = 0;
    },
  };
}

/**
 * Helper: Extract optimization target from context
 */
function extractOptimizationTarget(content: string): string | null {
  // Simplified extraction
  const match = content.match(/optimize\s+(\w+)/i);
  return match ? match[1] : null;
}
