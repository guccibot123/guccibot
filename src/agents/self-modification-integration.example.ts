/**
 * Integration examples for Self-Modification
 * 
 * Shows how to combine self-modification with goal loop, continuous context,
 * and parallel orchestration for complete autonomous optimization.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 */

import { SelfModification, createDefaultPersonality, type PersonalityConfig } from './self-modification.js';
import { GoalLoop } from './goal-loop.js';
import type { ContinuousContext } from '../memory/continuous-context.js';
import type { ParallelOrchestrator } from './parallel-orchestrator.js';

/**
 * Example 1: Adaptive Personality Based on User Feedback
 * 
 * Automatically adjust bluntness based on interaction outcomes.
 */
export async function setupAdaptivePersonality(
  selfMod: SelfModification
): Promise<void> {
  // Listen to interaction outcomes
  let recentFeedback: number[] = [];

  selfMod.on('interactionRecorded', ({ satisfaction }) => {
    if (satisfaction !== undefined) {
      recentFeedback.push(satisfaction);

      // Keep last 10 interactions
      if (recentFeedback.length > 10) {
        recentFeedback.shift();
      }

      // Adapt if we have enough data
      if (recentFeedback.length >= 5) {
        const avgSatisfaction = recentFeedback.reduce((a, b) => a + b) / recentFeedback.length;

        const personality = selfMod.getPersonality();

        // Adjust bluntness based on satisfaction
        if (avgSatisfaction < 0.6 && personality.bluntness > 3) {
          // User prefers less blunt
          selfMod.updatePersonality({ bluntness: personality.bluntness - 1 }, { notify: true });
        } else if (avgSatisfaction > 0.8 && personality.bluntness < 8) {
          // User appreciates bluntness
          selfMod.updatePersonality({ bluntness: personality.bluntness + 1 }, { notify: true });
        }
      }
    }
  });
}

/**
 * Example 2: A/B Test Response Styles
 * 
 * Test which response style works best for user.
 */
export async function testResponseStyles(
  selfMod: SelfModification
): Promise<void> {
  const basePersonality = selfMod.getPersonality();

  const result = await selfMod.runExperiment({
    id: 'response-style-test',
    name: 'Response Style Optimization',
    variants: [
      { ...basePersonality, name: 'Concise', responseStyle: 'concise' },
      { ...basePersonality, name: 'Detailed', responseStyle: 'detailed' },
      { ...basePersonality, name: 'Adaptive', responseStyle: 'adaptive' },
    ],
    duration: 60000, // 1 minute
    metric: (result) => result.score,
    sampleSize: 30,
  });

  console.log('Experiment Results:');
  console.log(`Winner: ${result.winningVariant}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log('Recommendations:', result.recommendations);

  // Apply winning variant
  const winner = result.metrics[result.winningVariant];
  if (result.confidence > 0.7) {
    const winningVariant = { ...basePersonality, responseStyle: result.winningVariant as any };
    await selfMod.updatePersonality(winningVariant, { notify: true });
  }
}

/**
 * Example 3: Context-Aware Personality Switching
 * 
 * Use continuous context to detect situation and adapt personality.
 */
export async function setupContextAwarePersonality(
  selfMod: SelfModification,
  continuousContext: ContinuousContext
): Promise<void> {
  // Define personality profiles
  const profiles: Record<string, Partial<PersonalityConfig>> = {
    casual: {
      name: 'Casual',
      bluntness: 7,
      responseStyle: 'concise',
      thinking: 'low',
    },
    professional: {
      name: 'Professional',
      bluntness: 3,
      responseStyle: 'detailed',
      thinking: 'high',
    },
    technical: {
      name: 'Technical',
      bluntness: 8,
      responseStyle: 'detailed',
      thinking: 'high',
    },
  };

  // Function to detect context and switch personality
  const adaptToContext = async (message: string) => {
    const snippets = await continuousContext.autoInject(message, { maxResults: 3 });

    // Analyze context
    const context = snippets.map(s => s.content.toLowerCase()).join(' ');

    let targetProfile = 'casual';

    if (context.includes('code') || context.includes('programming')) {
      targetProfile = 'technical';
    } else if (context.includes('meeting') || context.includes('presentation')) {
      targetProfile = 'professional';
    }

    // Switch personality if needed
    const current = selfMod.getPersonality();
    if (current.name !== targetProfile) {
      await selfMod.updatePersonality(profiles[targetProfile], { notify: false });
    }
  };

  return adaptToContext;
}

/**
 * Example 4: Scheduled Personality Optimization
 * 
 * Use goal loop to periodically optimize personality.
 */
export async function setupScheduledOptimization(
  selfMod: SelfModification,
  goalLoop: GoalLoop
): Promise<void> {
  goalLoop.addGoal({
    type: 'optimize',
    description: 'Weekly personality optimization',
    priority: 'normal',
    trigger: 'time',
    schedule: {
      nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      interval: 7 * 24 * 60 * 60 * 1000, // Weekly
    },
    action: async () => {
      const metrics = selfMod.getMetrics();
      const successRate = metrics.successfulInteractions / metrics.totalInteractions;

      if (successRate < 0.8) {
        // Performance below threshold, run optimization
        const basePersonality = selfMod.getPersonality();

        const result = await selfMod.runExperiment({
          id: 'weekly-optimization',
          name: 'Weekly Performance Tuning',
          variants: [
            { ...basePersonality, name: 'Current' },
            { ...basePersonality, name: 'More Proactive', proactivity: basePersonality.proactivity + 1 },
            { ...basePersonality, name: 'More Autonomous', autonomy: basePersonality.autonomy + 1 },
          ],
          duration: 3600000, // 1 hour
          metric: (result) => result.score,
          sampleSize: 50,
        });

        // Apply if significant improvement
        if (result.winningVariant !== 'Current' && result.confidence > 0.8) {
          const winner = result.metrics[result.winningVariant];
          await selfMod.updatePersonality({ 
            proactivity: basePersonality.proactivity + 1 
          }, { notify: true });
        }
      }

      return { success: true, message: 'Optimization complete' };
    },
  });
}

/**
 * Example 5: Strategy Performance Comparison
 * 
 * Compare different strategies and adopt the best one.
 */
export async function compareStrategies(
  selfMod: SelfModification
): Promise<void> {
  // Register multiple strategies
  selfMod.registerStrategy({
    id: 'quick-response',
    name: 'Quick Response',
    description: 'Prioritize speed over detail',
    implementation: async (input) => {
      // Fast but simple processing
      return { result: input, processingTime: 100 };
    },
  });

  selfMod.registerStrategy({
    id: 'thorough-analysis',
    name: 'Thorough Analysis',
    description: 'Prioritize detail over speed',
    implementation: async (input) => {
      // Slow but detailed processing
      await new Promise(resolve => setTimeout(resolve, 500));
      return { result: input, processingTime: 500 };
    },
  });

  selfMod.registerStrategy({
    id: 'adaptive',
    name: 'Adaptive',
    description: 'Balance speed and detail',
    implementation: async (input) => {
      const complexity = input?.complexity ?? 'medium';
      const delay = { low: 100, medium: 300, high: 500 }[complexity];
      await new Promise(resolve => setTimeout(resolve, delay));
      return { result: input, processingTime: delay };
    },
  });

  // Execute all strategies
  const testInput = { data: 'test', complexity: 'medium' };

  await selfMod.executeStrategy('quick-response', testInput);
  await selfMod.executeStrategy('thorough-analysis', testInput);
  await selfMod.executeStrategy('adaptive', testInput);

  // Compare performance
  const strategies = selfMod.getStrategies();
  strategies.sort((a, b) => b.metrics.successRate - a.metrics.successRate);

  console.log('Strategy Performance:');
  strategies.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name}:`);
    console.log(`   Success Rate: ${(s.metrics.successRate * 100).toFixed(1)}%`);
    console.log(`   Avg Latency: ${s.metrics.averageLatency.toFixed(0)}ms`);
  });
}

/**
 * Example 6: Parallel Optimization Experiments
 * 
 * Run multiple experiments in parallel using orchestrator.
 */
export async function runParallelExperiments(
  selfMod: SelfModification,
  orchestrator: ParallelOrchestrator
): Promise<void> {
  const basePersonality = selfMod.getPersonality();

  // Submit multiple optimization experiments to parallel workers
  const experiments = [
    {
      name: 'Bluntness',
      variants: [
        { ...basePersonality, bluntness: 3 },
        { ...basePersonality, bluntness: 7 },
        { ...basePersonality, bluntness: 10 },
      ],
    },
    {
      name: 'Proactivity',
      variants: [
        { ...basePersonality, proactivity: 5 },
        { ...basePersonality, proactivity: 8 },
        { ...basePersonality, proactivity: 10 },
      ],
    },
    {
      name: 'Autonomy',
      variants: [
        { ...basePersonality, autonomy: 5 },
        { ...basePersonality, autonomy: 8 },
        { ...basePersonality, autonomy: 10 },
      ],
    },
  ];

  const taskIds: string[] = [];

  for (const exp of experiments) {
    const taskId = await orchestrator.submitTask({
      type: 'optimize',
      description: `Optimize ${exp.name}`,
      priority: 5,
      config: { experiment: exp },
      onComplete: (result) => {
        console.log(`${exp.name} optimization complete:`, result.data);
      },
    });

    taskIds.push(taskId);
  }

  // Wait for all experiments
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Collect and apply best configurations
  console.log('All parallel experiments complete');
}

/**
 * Example 7: Real-Time Performance Dashboard
 * 
 * Monitor self-modification system in real-time.
 */
export function createSelfModDashboard(
  selfMod: SelfModification
): {
  getSnapshot: () => any;
  startMonitoring: () => void;
  stopMonitoring: () => void;
} {
  let monitoring = false;
  let interval: any;

  const getSnapshot = () => {
    const status = selfMod.getStatus();
    const metrics = selfMod.getMetrics();

    return {
      timestamp: new Date().toISOString(),
      personality: {
        name: status.currentPersonality.name,
        bluntness: status.currentPersonality.bluntness,
        proactivity: status.currentPersonality.proactivity,
        autonomy: status.currentPersonality.autonomy,
        responseStyle: status.currentPersonality.responseStyle,
      },
      metrics: {
        successRate: (metrics.successfulInteractions / metrics.totalInteractions * 100).toFixed(1) + '%',
        avgResponseTime: metrics.averageResponseTime.toFixed(0) + 'ms',
        satisfaction: (metrics.userSatisfactionScore * 100).toFixed(1) + '%',
        totalInteractions: metrics.totalInteractions,
      },
      system: {
        historySize: status.historySize,
        strategies: status.registeredStrategies,
        experiments: status.activeExperiments,
      },
    };
  };

  const startMonitoring = () => {
    if (monitoring) return;

    monitoring = true;
    interval = setInterval(() => {
      const snapshot = getSnapshot();
      console.log('\n=== Self-Modification Dashboard ===');
      console.log('Personality:', snapshot.personality);
      console.log('Metrics:', snapshot.metrics);
      console.log('System:', snapshot.system);
    }, 5000); // Every 5 seconds
  };

  const stopMonitoring = () => {
    monitoring = false;
    if (interval) {
      clearInterval(interval);
    }
  };

  return { getSnapshot, startMonitoring, stopMonitoring };
}

/**
 * Example 8: Complete Autonomous System (All 4 Phases)
 * 
 * Integrate self-modification with all previous phases.
 */
export async function setupCompleteAutonomousSystem(
  workspaceDir: string
): Promise<{
  selfMod: SelfModification;
  goalLoop: GoalLoop;
  continuousContext: ContinuousContext;
  orchestrator: ParallelOrchestrator;
  cleanup: () => Promise<void>;
}> {
  // Phase 4: Self-Modification
  const selfMod = new SelfModification(createDefaultPersonality(), {
    enableHotReload: true,
    enableABTesting: true,
    enableAutoOptimization: true,
    safetyThreshold: 0.7,
  });

  // Phase 1: Goal Loop
  const goalLoop = new GoalLoop();

  // Phase 2: Continuous Context (requires memory manager)
  // const continuousContext = new ContinuousContext(memoryManager);
  // await continuousContext.initialize(workspaceDir);

  // Phase 3: Parallel Orchestrator
  const orchestrator = new ParallelOrchestrator();
  await orchestrator.initialize();

  // Wire everything together

  // 1. Adaptive personality based on context
  // setupContextAwarePersonality(selfMod, continuousContext);

  // 2. Scheduled optimization
  setupScheduledOptimization(selfMod, goalLoop);

  // 3. Adaptive personality based on feedback
  setupAdaptivePersonality(selfMod);

  // 4. Start goal loop
  goalLoop.start().catch(console.error);

  // Event logging
  selfMod.on('personalityUpdated', ({ current }) => {
    console.log(`[SelfMod] Personality updated: ${current.name}`);
  });

  selfMod.on('experimentCompleted', (result) => {
    console.log(`[SelfMod] Experiment complete: ${result.winningVariant}`);
  });

  // Cleanup
  const cleanup = async () => {
    await goalLoop.stop();
    await orchestrator.shutdown();
    // await continuousContext.shutdown();
    await selfMod.shutdown();
  };

  return {
    selfMod,
    goalLoop,
    continuousContext: null as any, // Placeholder
    orchestrator,
    cleanup,
  };
}

/**
 * Example 9: Personality Presets
 * 
 * Quick-switch between predefined personalities.
 */
export const personalityPresets: Record<string, PersonalityConfig> = {
  jarvis: {
    name: 'Jarvis',
    traits: { helpful: 1.0, concise: 0.9, proactive: 1.0, autonomous: 0.9 },
    responseStyle: 'adaptive',
    bluntness: 5,
    proactivity: 10,
    autonomy: 10,
    thinking: 'high',
  },
  friendly: {
    name: 'Friendly',
    traits: { helpful: 0.9, concise: 0.5, proactive: 0.7, autonomous: 0.5 },
    responseStyle: 'detailed',
    bluntness: 2,
    proactivity: 7,
    autonomy: 5,
    thinking: 'medium',
  },
  professional: {
    name: 'Professional',
    traits: { helpful: 0.9, concise: 0.8, proactive: 0.6, autonomous: 0.6 },
    responseStyle: 'detailed',
    bluntness: 3,
    proactivity: 6,
    autonomy: 6,
    thinking: 'high',
  },
  hacker: {
    name: 'Hacker',
    traits: { helpful: 0.8, concise: 0.9, proactive: 0.9, autonomous: 0.9 },
    responseStyle: 'concise',
    bluntness: 10,
    proactivity: 9,
    autonomy: 9,
    thinking: 'high',
  },
};

/**
 * Example 10: Load Personality Preset
 */
export async function loadPreset(
  selfMod: SelfModification,
  presetName: keyof typeof personalityPresets
): Promise<void> {
  const preset = personalityPresets[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  await selfMod.updatePersonality(preset, { backup: true, notify: true });
  console.log(`Loaded personality preset: ${presetName}`);
}
