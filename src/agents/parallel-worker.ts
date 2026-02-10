/**
 * Parallel Worker - Background thread for task execution
 * 
 * Executes tasks in isolated worker thread without blocking main agent.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 * @date 2026-02-10
 */

import { parentPort, workerData } from 'node:worker_threads';
import type { WorkerTaskType } from './parallel-orchestrator.js';

interface WorkerMessage {
  type: 'execute' | 'terminate';
  task?: {
    id: string;
    type: WorkerTaskType;
    description: string;
    config: Record<string, any>;
  };
  taskId?: string;
}

/**
 * Worker main function
 */
async function main() {
  if (!parentPort) {
    throw new Error('This file must be run as a Worker');
  }

  const { workerId, type } = workerData;

  console.log(`[Worker ${workerId}] Started (type: ${type})`);

  // Listen for tasks
  parentPort.on('message', async (message: WorkerMessage) => {
    switch (message.type) {
      case 'execute':
        if (message.task) {
          await executeTask(message.task);
        }
        break;

      case 'terminate':
        console.log(`[Worker ${workerId}] Terminating task ${message.taskId}`);
        process.exit(0);
        break;
    }
  });
}

/**
 * Execute task
 */
async function executeTask(task: {
  id: string;
  type: WorkerTaskType;
  description: string;
  config: Record<string, any>;
}): Promise<void> {
  const startTime = Date.now();

  try {
    console.log(`[Worker] Executing task: ${task.id} (${task.description})`);

    // Report progress
    reportProgress(task.id, 0, 100, 'Starting...');

    // Execute based on task type
    let result: any;

    switch (task.type) {
      case 'monitor':
        result = await executeMonitorTask(task);
        break;

      case 'research':
        result = await executeResearchTask(task);
        break;

      case 'learn':
        result = await executeLearnTask(task);
        break;

      case 'optimize':
        result = await executeOptimizeTask(task);
        break;

      case 'analyze':
        result = await executeAnalyzeTask(task);
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    const duration = Date.now() - startTime;

    // Report completion
    reportComplete(task.id, result, duration);

  } catch (error) {
    console.error(`[Worker] Task error: ${task.id}`, error);
    reportError(task.id, error as Error);
  }
}

/**
 * Execute monitor task
 */
async function executeMonitorTask(task: any): Promise<any> {
  const { target, interval = 1000, duration = 10000 } = task.config;

  const results: any[] = [];
  const iterations = Math.floor(duration / interval);

  for (let i = 0; i < iterations; i++) {
    // Simulate monitoring
    const data = {
      timestamp: new Date().toISOString(),
      target,
      status: 'healthy',
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
      },
    };

    results.push(data);

    reportProgress(task.id, i + 1, iterations, `Monitoring ${target}...`);

    await sleep(interval);
  }

  return {
    target,
    samples: results.length,
    data: results,
  };
}

/**
 * Execute research task
 */
async function executeResearchTask(task: any): Promise<any> {
  const { topic, depth = 'medium', sources = 5 } = task.config;

  reportProgress(task.id, 0, sources, `Researching: ${topic}`);

  const findings: any[] = [];

  for (let i = 0; i < sources; i++) {
    // Simulate research
    await sleep(500);

    const finding = {
      source: `Source ${i + 1}`,
      relevance: Math.random(),
      summary: `Finding about ${topic} from source ${i + 1}`,
      timestamp: new Date().toISOString(),
    };

    findings.push(finding);

    reportProgress(task.id, i + 1, sources, `Researched source ${i + 1}`);
  }

  return {
    topic,
    depth,
    sourcesAnalyzed: sources,
    findings: findings.sort((a, b) => b.relevance - a.relevance),
  };
}

/**
 * Execute learn task
 */
async function executeLearnTask(task: any): Promise<any> {
  const { subject, duration = 5000 } = task.config;

  reportProgress(task.id, 0, 100, `Learning: ${subject}`);

  // Simulate learning process
  const stages = ['reading', 'understanding', 'practicing', 'mastering'];

  for (let i = 0; i < stages.length; i++) {
    await sleep(duration / stages.length);
    reportProgress(task.id, ((i + 1) / stages.length) * 100, 100, `Stage: ${stages[i]}`);
  }

  return {
    subject,
    duration,
    completed: true,
    knowledge: {
      concepts: Math.floor(Math.random() * 20) + 10,
      examples: Math.floor(Math.random() * 30) + 15,
      confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
    },
  };
}

/**
 * Execute optimize task
 */
async function executeOptimizeTask(task: any): Promise<any> {
  const { target, metric = 'performance', iterations = 5 } = task.config;

  reportProgress(task.id, 0, iterations, `Optimizing: ${target}`);

  let currentValue = 100;
  const improvements: any[] = [];

  for (let i = 0; i < iterations; i++) {
    await sleep(300);

    const improvement = Math.random() * 20 + 5; // 5-25% improvement
    currentValue *= (1 + improvement / 100);

    improvements.push({
      iteration: i + 1,
      metric,
      value: currentValue,
      improvement: `+${improvement.toFixed(1)}%`,
    });

    reportProgress(task.id, i + 1, iterations, `Iteration ${i + 1} complete`);
  }

  return {
    target,
    metric,
    iterations,
    initialValue: 100,
    finalValue: currentValue,
    totalImprovement: `+${((currentValue - 100) / 100 * 100).toFixed(1)}%`,
    improvements,
  };
}

/**
 * Execute analyze task
 */
async function executeAnalyzeTask(task: any): Promise<any> {
  const { data, analysisType = 'statistical' } = task.config;

  reportProgress(task.id, 0, 100, 'Analyzing data...');

  // Simulate analysis
  await sleep(1000);
  reportProgress(task.id, 50, 100, 'Computing statistics...');

  await sleep(500);
  reportProgress(task.id, 100, 100, 'Analysis complete');

  return {
    analysisType,
    dataPoints: Array.isArray(data) ? data.length : 0,
    results: {
      mean: Math.random() * 100,
      median: Math.random() * 100,
      stdDev: Math.random() * 20,
      trend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
    },
    insights: [
      'Pattern detected in data distribution',
      'Outliers identified and flagged',
      'Correlation found between key variables',
    ],
  };
}

/**
 * Report progress to parent
 */
function reportProgress(taskId: string, completed: number, total: number, message?: string): void {
  if (!parentPort) return;

  parentPort.postMessage({
    type: 'progress',
    data: {
      taskId,
      completed,
      total,
      message,
    },
  });
}

/**
 * Report completion to parent
 */
function reportComplete(taskId: string, result: any, duration: number): void {
  if (!parentPort) return;

  parentPort.postMessage({
    type: 'complete',
    data: {
      taskId,
      result,
      duration,
    },
  });
}

/**
 * Report error to parent
 */
function reportError(taskId: string, error: Error): void {
  if (!parentPort) return;

  parentPort.postMessage({
    type: 'error',
    error: {
      taskId,
      message: error.message,
      stack: error.stack,
    },
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker
main().catch(error => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
