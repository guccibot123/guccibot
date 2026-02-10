/**
 * Self-Modification - Dynamic behavior adaptation and self-optimization
 * 
 * Enables agents to hot-reload personality configs, A/B test strategies,
 * and self-optimize based on performance metrics.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 * @date 2026-02-10
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PersonalityConfig {
  name: string;
  traits: Record<string, number>; // 0-1 scale
  responseStyle: 'concise' | 'detailed' | 'adaptive';
  bluntness: number; // 0-10
  proactivity: number; // 0-10
  autonomy: number; // 0-10
  thinking: 'low' | 'medium' | 'high';
  customBehaviors?: Record<string, any>;
}

export interface BehaviorStrategy {
  id: string;
  name: string;
  description: string;
  implementation: (input: any) => Promise<any>;
  metrics: StrategyMetrics;
}

export interface StrategyMetrics {
  successRate: number;
  averageLatency: number;
  userSatisfaction: number;
  errorRate: number;
  executionCount: number;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  variants: PersonalityConfig[];
  duration: number; // milliseconds
  metric: (result: any) => number;
  sampleSize: number;
}

export interface ExperimentResult {
  experimentId: string;
  winningVariant: string;
  confidence: number;
  metrics: Record<string, any>;
  recommendations: string[];
}

export interface SelfModificationConfig {
  enableHotReload: boolean;
  enableABTesting: boolean;
  enableAutoOptimization: boolean;
  configPath?: string;
  backupPath?: string;
  metricsRetention: number; // days
  safetyThreshold: number; // 0-1, min success rate before rollback
}

/**
 * Self-Modification System
 * 
 * Allows agent to modify its own behavior at runtime.
 */
export class SelfModification extends EventEmitter {
  private config: SelfModificationConfig;
  private currentPersonality: PersonalityConfig;
  private personalityHistory: PersonalityConfig[] = [];
  private strategies: Map<string, BehaviorStrategy> = new Map();
  private activeExperiments: Map<string, ExperimentState> = new Map();
  private performanceMetrics: PerformanceMetrics;
  
  constructor(
    initialPersonality: PersonalityConfig,
    config: Partial<SelfModificationConfig> = {}
  ) {
    super();
    
    this.currentPersonality = initialPersonality;
    this.personalityHistory.push({ ...initialPersonality });
    
    this.config = {
      enableHotReload: config.enableHotReload ?? true,
      enableABTesting: config.enableABTesting ?? true,
      enableAutoOptimization: config.enableAutoOptimization ?? false,
      configPath: config.configPath ?? 'personality.json',
      backupPath: config.backupPath ?? 'personality.backup.json',
      metricsRetention: config.metricsRetention ?? 30,
      safetyThreshold: config.safetyThreshold ?? 0.7,
    };
    
    this.performanceMetrics = {
      totalInteractions: 0,
      successfulInteractions: 0,
      averageResponseTime: 0,
      userSatisfactionScore: 0,
      errorCount: 0,
    };
  }

  /**
   * Hot-reload personality configuration
   */
  async updatePersonality(
    patch: Partial<PersonalityConfig>,
    options: {
      backup?: boolean;
      notify?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.config.enableHotReload) {
      throw new Error('Hot-reload is disabled');
    }

    // Backup current personality
    if (options.backup !== false) {
      await this.backupPersonality();
    }

    // Apply patch
    const previous = { ...this.currentPersonality };
    this.currentPersonality = {
      ...this.currentPersonality,
      ...patch,
    };

    // Track history
    this.personalityHistory.push({ ...this.currentPersonality });

    this.emit('personalityUpdated', {
      previous,
      current: this.currentPersonality,
      patch,
    });

    // Notify user if requested
    if (options.notify) {
      this.emit('notify', {
        type: 'personality-update',
        message: `Personality updated: ${Object.keys(patch).join(', ')}`,
      });
    }
  }

  /**
   * Get current personality
   */
  getPersonality(): PersonalityConfig {
    return { ...this.currentPersonality };
  }

  /**
   * Rollback to previous personality
   */
  async rollback(steps: number = 1): Promise<void> {
    if (this.personalityHistory.length <= steps) {
      throw new Error('Not enough history to rollback');
    }

    // Get previous personality
    const targetIndex = this.personalityHistory.length - steps - 1;
    const target = this.personalityHistory[targetIndex];

    // Apply rollback
    const previous = { ...this.currentPersonality };
    this.currentPersonality = { ...target };

    this.emit('personalityRolledBack', {
      previous,
      current: this.currentPersonality,
      steps,
    });
  }

  /**
   * Register behavior strategy
   */
  registerStrategy(strategy: Omit<BehaviorStrategy, 'metrics'>): void {
    const fullStrategy: BehaviorStrategy = {
      ...strategy,
      metrics: {
        successRate: 0,
        averageLatency: 0,
        userSatisfaction: 0,
        errorRate: 0,
        executionCount: 0,
      },
    };

    this.strategies.set(strategy.id, fullStrategy);
    this.emit('strategyRegistered', fullStrategy);
  }

  /**
   * Execute strategy with metrics tracking
   */
  async executeStrategy(
    strategyId: string,
    input: any
  ): Promise<{ result: any; metrics: StrategyMetrics }> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const startTime = Date.now();
    let success = false;
    let result: any;

    try {
      result = await strategy.implementation(input);
      success = true;
    } catch (error) {
      this.emit('strategyError', { strategyId, error });
      throw error;
    } finally {
      const latency = Date.now() - startTime;

      // Update metrics
      strategy.metrics.executionCount++;
      strategy.metrics.averageLatency =
        (strategy.metrics.averageLatency * (strategy.metrics.executionCount - 1) + latency) /
        strategy.metrics.executionCount;

      if (success) {
        const successCount = strategy.metrics.successRate * (strategy.metrics.executionCount - 1) + 1;
        strategy.metrics.successRate = successCount / strategy.metrics.executionCount;
      } else {
        strategy.metrics.errorRate =
          (strategy.metrics.errorRate * (strategy.metrics.executionCount - 1) + 1) /
          strategy.metrics.executionCount;
      }

      this.emit('strategyExecuted', { strategyId, success, latency });
    }

    return { result, metrics: { ...strategy.metrics } };
  }

  /**
   * Run A/B test experiment
   */
  async runExperiment(experiment: ExperimentConfig): Promise<ExperimentResult> {
    if (!this.config.enableABTesting) {
      throw new Error('A/B testing is disabled');
    }

    const state: ExperimentState = {
      config: experiment,
      startTime: Date.now(),
      variantResults: new Map(),
      currentSample: 0,
    };

    this.activeExperiments.set(experiment.id, state);
    this.emit('experimentStarted', experiment);

    // Run experiment
    const samplesPerVariant = Math.floor(experiment.sampleSize / experiment.variants.length);

    for (const variant of experiment.variants) {
      const variantResults: number[] = [];

      // Temporarily switch to variant
      const original = { ...this.currentPersonality };
      this.currentPersonality = variant;

      // Run samples
      for (let i = 0; i < samplesPerVariant; i++) {
        // Simulate interaction (in real implementation, this would be actual usage)
        const result = await this.simulateInteraction(variant);
        const score = experiment.metric(result);
        variantResults.push(score);

        state.currentSample++;
        this.emit('experimentProgress', {
          experimentId: experiment.id,
          progress: state.currentSample / experiment.sampleSize,
        });
      }

      state.variantResults.set(variant.name, variantResults);

      // Restore original
      this.currentPersonality = original;
    }

    // Analyze results
    const result = this.analyzeExperiment(state);

    this.activeExperiments.delete(experiment.id);
    this.emit('experimentCompleted', result);

    return result;
  }

  /**
   * Analyze experiment results
   */
  private analyzeExperiment(state: ExperimentState): ExperimentResult {
    const metrics: Record<string, any> = {};
    let bestVariant: string = '';
    let bestScore = -Infinity;

    for (const [variant, results] of state.variantResults.entries()) {
      const mean = results.reduce((a, b) => a + b, 0) / results.length;
      const variance =
        results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
      const stdDev = Math.sqrt(variance);

      metrics[variant] = { mean, stdDev, samples: results.length };

      if (mean > bestScore) {
        bestScore = mean;
        bestVariant = variant;
      }
    }

    // Calculate confidence (simplified t-test)
    const confidence = this.calculateConfidence(state.variantResults);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, bestVariant);

    return {
      experimentId: state.config.id,
      winningVariant: bestVariant,
      confidence,
      metrics,
      recommendations,
    };
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(results: Map<string, number[]>): number {
    // Simplified confidence calculation
    // In real implementation, use proper statistical tests
    const variants = Array.from(results.values());
    if (variants.length < 2) return 0;

    const means = variants.map(v => v.reduce((a, b) => a + b, 0) / v.length);
    const maxMean = Math.max(...means);
    const minMean = Math.min(...means);
    const spread = (maxMean - minMean) / maxMean;

    return Math.min(spread * 2, 1); // 0-1 scale
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    metrics: Record<string, any>,
    winner: string
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push(`Adopt "${winner}" configuration for best performance`);

    // Analyze winning traits
    const winnerMetrics = metrics[winner];
    if (winnerMetrics.stdDev < 0.1) {
      recommendations.push('Winning variant shows high consistency');
    }

    if (winnerMetrics.mean > 0.8) {
      recommendations.push('Winning variant exceeds performance threshold');
    }

    return recommendations;
  }

  /**
   * Auto-optimize based on performance metrics
   */
  async autoOptimize(): Promise<void> {
    if (!this.config.enableAutoOptimization) {
      throw new Error('Auto-optimization is disabled');
    }

    // Analyze current performance
    const successRate = this.performanceMetrics.successfulInteractions / 
                       this.performanceMetrics.totalInteractions;

    // Check if below safety threshold
    if (successRate < this.config.safetyThreshold) {
      await this.rollback();
      this.emit('autoRollback', { reason: 'Below safety threshold', successRate });
      return;
    }

    // Identify optimization opportunities
    const optimizations = this.identifyOptimizations();

    if (optimizations.length > 0) {
      this.emit('optimizationsIdentified', optimizations);

      // Apply top optimization
      const top = optimizations[0];
      await this.updatePersonality(top.patch, { backup: true, notify: true });
    }
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizations(): Array<{
    name: string;
    patch: Partial<PersonalityConfig>;
    expectedImprovement: number;
  }> {
    const optimizations: Array<any> = [];

    // Example: If response time is high, increase conciseness
    if (this.performanceMetrics.averageResponseTime > 5000) {
      optimizations.push({
        name: 'Increase conciseness',
        patch: { responseStyle: 'concise' as const },
        expectedImprovement: 0.3,
      });
    }

    // Example: If user satisfaction is low, increase detail
    if (this.performanceMetrics.userSatisfactionScore < 0.7) {
      optimizations.push({
        name: 'Increase detail',
        patch: { responseStyle: 'detailed' as const },
        expectedImprovement: 0.2,
      });
    }

    return optimizations.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
  }

  /**
   * Simulate interaction (for testing)
   */
  private async simulateInteraction(personality: PersonalityConfig): Promise<any> {
    // Simulate processing time based on personality
    const baseTime = 100;
    const styleMultiplier = {
      concise: 0.8,
      detailed: 1.5,
      adaptive: 1.0,
    };

    const processingTime = baseTime * styleMultiplier[personality.responseStyle];
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate success based on traits
    const bluntnessScore = personality.bluntness / 10;
    const proactivityScore = personality.proactivity / 10;
    const autonomyScore = personality.autonomy / 10;

    const score = (bluntnessScore + proactivityScore + autonomyScore) / 3;

    return {
      success: score > 0.5,
      score,
      latency: processingTime,
    };
  }

  /**
   * Backup current personality
   */
  private async backupPersonality(): Promise<void> {
    if (!this.config.backupPath) return;

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        personality: this.currentPersonality,
        metrics: this.performanceMetrics,
      };

      // In real implementation, write to file
      this.emit('personalityBackedUp', backup);
    } catch (error) {
      this.emit('backupError', error);
    }
  }

  /**
   * Load personality from file
   */
  async loadPersonality(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const personality = JSON.parse(content) as PersonalityConfig;

      await this.updatePersonality(personality, { backup: true });
      this.emit('personalityLoaded', { filePath, personality });
    } catch (error) {
      this.emit('loadError', { filePath, error });
      throw error;
    }
  }

  /**
   * Save personality to file
   */
  async savePersonality(filePath: string): Promise<void> {
    try {
      const content = JSON.stringify(this.currentPersonality, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');

      this.emit('personalitySaved', { filePath });
    } catch (error) {
      this.emit('saveError', { filePath, error });
      throw error;
    }
  }

  /**
   * Record interaction outcome
   */
  recordInteraction(outcome: {
    success: boolean;
    latency: number;
    satisfaction?: number;
  }): void {
    this.performanceMetrics.totalInteractions++;

    if (outcome.success) {
      this.performanceMetrics.successfulInteractions++;
    } else {
      this.performanceMetrics.errorCount++;
    }

    // Update average response time
    const n = this.performanceMetrics.totalInteractions;
    this.performanceMetrics.averageResponseTime =
      (this.performanceMetrics.averageResponseTime * (n - 1) + outcome.latency) / n;

    // Update satisfaction score
    if (outcome.satisfaction !== undefined) {
      this.performanceMetrics.userSatisfactionScore =
        (this.performanceMetrics.userSatisfactionScore * (n - 1) + outcome.satisfaction) / n;
    }

    this.emit('interactionRecorded', outcome);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get all strategies
   */
  getStrategies(): BehaviorStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get status
   */
  getStatus(): {
    currentPersonality: PersonalityConfig;
    historySize: number;
    activeExperiments: number;
    registeredStrategies: number;
    metrics: PerformanceMetrics;
    config: SelfModificationConfig;
  } {
    return {
      currentPersonality: this.getPersonality(),
      historySize: this.personalityHistory.length,
      activeExperiments: this.activeExperiments.size,
      registeredStrategies: this.strategies.size,
      metrics: this.getMetrics(),
      config: this.config,
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    // Cancel active experiments
    this.activeExperiments.clear();

    // Save current personality
    if (this.config.configPath) {
      await this.savePersonality(this.config.configPath).catch(() => {});
    }

    this.emit('shutdown');
  }
}

/**
 * Experiment state
 */
interface ExperimentState {
  config: ExperimentConfig;
  startTime: number;
  variantResults: Map<string, number[]>;
  currentSample: number;
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  totalInteractions: number;
  successfulInteractions: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  errorCount: number;
}

/**
 * Helper: Create default personality
 */
export function createDefaultPersonality(): PersonalityConfig {
  return {
    name: 'Default',
    traits: {
      helpful: 0.9,
      concise: 0.7,
      proactive: 0.8,
      autonomous: 0.7,
    },
    responseStyle: 'adaptive',
    bluntness: 5,
    proactivity: 7,
    autonomy: 7,
    thinking: 'medium',
  };
}
