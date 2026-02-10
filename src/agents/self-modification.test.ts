/**
 * Tests for Self-Modification System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SelfModification, createDefaultPersonality, type PersonalityConfig } from './self-modification';

describe('SelfModification', () => {
  let selfMod: SelfModification;
  let initialPersonality: PersonalityConfig;

  beforeEach(() => {
    initialPersonality = createDefaultPersonality();
    selfMod = new SelfModification(initialPersonality, {
      enableHotReload: true,
      enableABTesting: true,
      enableAutoOptimization: false,
    });
  });

  afterEach(async () => {
    await selfMod.shutdown();
  });

  describe('Personality Management', () => {
    it('should initialize with personality', () => {
      const personality = selfMod.getPersonality();
      expect(personality.name).toBe('Default');
      expect(personality.bluntness).toBe(5);
    });

    it('should update personality with hot-reload', async () => {
      await selfMod.updatePersonality({
        bluntness: 8,
        proactivity: 9,
      });

      const updated = selfMod.getPersonality();
      expect(updated.bluntness).toBe(8);
      expect(updated.proactivity).toBe(9);
    });

    it('should emit personalityUpdated event', async () => {
      const events: any[] = [];
      
      selfMod.on('personalityUpdated', (event) => events.push(event));

      await selfMod.updatePersonality({ bluntness: 7 });

      expect(events.length).toBe(1);
      expect(events[0].current.bluntness).toBe(7);
      expect(events[0].previous.bluntness).toBe(5);
    });

    it('should track personality history', async () => {
      await selfMod.updatePersonality({ bluntness: 6 });
      await selfMod.updatePersonality({ bluntness: 7 });
      await selfMod.updatePersonality({ bluntness: 8 });

      const status = selfMod.getStatus();
      expect(status.historySize).toBe(4); // Initial + 3 updates
    });

    it('should rollback personality', async () => {
      await selfMod.updatePersonality({ bluntness: 8 });
      await selfMod.updatePersonality({ bluntness: 9 });

      const current = selfMod.getPersonality();
      expect(current.bluntness).toBe(9);

      await selfMod.rollback(1);

      const rolledBack = selfMod.getPersonality();
      expect(rolledBack.bluntness).toBe(8);
    });

    it('should rollback multiple steps', async () => {
      await selfMod.updatePersonality({ bluntness: 6 });
      await selfMod.updatePersonality({ bluntness: 7 });
      await selfMod.updatePersonality({ bluntness: 8 });

      await selfMod.rollback(2);

      const rolledBack = selfMod.getPersonality();
      expect(rolledBack.bluntness).toBe(6);
    });

    it('should throw when rolling back too far', async () => {
      await expect(selfMod.rollback(10)).rejects.toThrow('Not enough history');
    });
  });

  describe('Strategy Management', () => {
    it('should register strategy', () => {
      selfMod.registerStrategy({
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'A test strategy',
        implementation: async (input) => ({ result: input * 2 }),
      });

      const strategies = selfMod.getStrategies();
      expect(strategies.length).toBe(1);
      expect(strategies[0].id).toBe('test-strategy');
    });

    it('should execute strategy and track metrics', async () => {
      selfMod.registerStrategy({
        id: 'multiply',
        name: 'Multiply',
        description: 'Multiply input by 2',
        implementation: async (input) => input * 2,
      });

      const { result, metrics } = await selfMod.executeStrategy('multiply', 5);

      expect(result).toBe(10);
      expect(metrics.executionCount).toBe(1);
      expect(metrics.successRate).toBe(1);
    });

    it('should track multiple executions', async () => {
      selfMod.registerStrategy({
        id: 'add',
        name: 'Add',
        description: 'Add 10 to input',
        implementation: async (input) => input + 10,
      });

      await selfMod.executeStrategy('add', 5);
      await selfMod.executeStrategy('add', 10);
      const { metrics } = await selfMod.executeStrategy('add', 15);

      expect(metrics.executionCount).toBe(3);
      expect(metrics.successRate).toBe(1);
    });

    it('should handle strategy errors', async () => {
      selfMod.registerStrategy({
        id: 'error',
        name: 'Error Strategy',
        description: 'Always throws',
        implementation: async () => {
          throw new Error('Test error');
        },
      });

      await expect(selfMod.executeStrategy('error', null)).rejects.toThrow('Test error');

      const strategies = selfMod.getStrategies();
      const errorStrategy = strategies.find(s => s.id === 'error');
      expect(errorStrategy?.metrics.executionCount).toBe(1);
    });

    it('should throw for unknown strategy', async () => {
      await expect(
        selfMod.executeStrategy('unknown', null)
      ).rejects.toThrow('Strategy not found');
    });
  });

  describe('A/B Testing', () => {
    it('should run experiment and return winner', async () => {
      const variant1 = { ...initialPersonality, name: 'Variant1', bluntness: 3 };
      const variant2 = { ...initialPersonality, name: 'Variant2', bluntness: 8 };

      const result = await selfMod.runExperiment({
        id: 'test-experiment',
        name: 'Bluntness Test',
        variants: [variant1, variant2],
        duration: 1000,
        metric: (result) => result.score,
        sampleSize: 10,
      });

      expect(result.experimentId).toBe('test-experiment');
      expect(result.winningVariant).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should emit experiment events', async () => {
      const events: string[] = [];
      
      selfMod.on('experimentStarted', () => events.push('started'));
      selfMod.on('experimentCompleted', () => events.push('completed'));

      await selfMod.runExperiment({
        id: 'event-test',
        name: 'Event Test',
        variants: [
          { ...initialPersonality, name: 'V1' },
          { ...initialPersonality, name: 'V2' },
        ],
        duration: 500,
        metric: (result) => result.score,
        sampleSize: 4,
      });

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should generate recommendations', async () => {
      const result = await selfMod.runExperiment({
        id: 'recommendations-test',
        name: 'Recommendations Test',
        variants: [
          { ...initialPersonality, name: 'Conservative', bluntness: 2 },
          { ...initialPersonality, name: 'Aggressive', bluntness: 9 },
        ],
        duration: 500,
        metric: (result) => result.score,
        sampleSize: 6,
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should throw when A/B testing disabled', async () => {
      const disabledSelfMod = new SelfModification(initialPersonality, {
        enableABTesting: false,
      });

      await expect(
        disabledSelfMod.runExperiment({
          id: 'test',
          name: 'Test',
          variants: [initialPersonality],
          duration: 100,
          metric: () => 0,
          sampleSize: 1,
        })
      ).rejects.toThrow('A/B testing is disabled');

      await disabledSelfMod.shutdown();
    });
  });

  describe('Performance Metrics', () => {
    it('should record interaction outcomes', () => {
      selfMod.recordInteraction({
        success: true,
        latency: 100,
        satisfaction: 0.8,
      });

      const metrics = selfMod.getMetrics();
      expect(metrics.totalInteractions).toBe(1);
      expect(metrics.successfulInteractions).toBe(1);
      expect(metrics.averageResponseTime).toBe(100);
      expect(metrics.userSatisfactionScore).toBe(0.8);
    });

    it('should track multiple interactions', () => {
      selfMod.recordInteraction({ success: true, latency: 100, satisfaction: 0.9 });
      selfMod.recordInteraction({ success: true, latency: 200, satisfaction: 0.8 });
      selfMod.recordInteraction({ success: false, latency: 50, satisfaction: 0.5 });

      const metrics = selfMod.getMetrics();
      expect(metrics.totalInteractions).toBe(3);
      expect(metrics.successfulInteractions).toBe(2);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.averageResponseTime).toBeCloseTo(116.67, 1);
    });

    it('should update satisfaction score average', () => {
      selfMod.recordInteraction({ success: true, latency: 100, satisfaction: 1.0 });
      selfMod.recordInteraction({ success: true, latency: 100, satisfaction: 0.6 });

      const metrics = selfMod.getMetrics();
      expect(metrics.userSatisfactionScore).toBe(0.8);
    });
  });

  describe('Auto-Optimization', () => {
    it('should throw when auto-optimization disabled', async () => {
      await expect(selfMod.autoOptimize()).rejects.toThrow('Auto-optimization is disabled');
    });

    it('should auto-rollback when below safety threshold', async () => {
      const autoSelfMod = new SelfModification(initialPersonality, {
        enableAutoOptimization: true,
        safetyThreshold: 0.7,
      });

      const events: any[] = [];
      autoSelfMod.on('autoRollback', (event) => events.push(event));

      // Update personality
      await autoSelfMod.updatePersonality({ bluntness: 10 });

      // Record poor performance
      for (let i = 0; i < 10; i++) {
        autoSelfMod.recordInteraction({ success: i < 5, latency: 100 });
      }

      // Auto-optimize should rollback
      await autoSelfMod.autoOptimize();

      expect(events.length).toBe(1);
      expect(events[0].reason).toBe('Below safety threshold');

      await autoSelfMod.shutdown();
    });
  });

  describe('Status Reporting', () => {
    it('should report accurate status', async () => {
      selfMod.registerStrategy({
        id: 's1',
        name: 'Strategy 1',
        description: 'Test',
        implementation: async (x) => x,
      });

      await selfMod.updatePersonality({ bluntness: 7 });
      selfMod.recordInteraction({ success: true, latency: 100 });

      const status = selfMod.getStatus();
      expect(status.currentPersonality.bluntness).toBe(7);
      expect(status.historySize).toBe(2); // Initial + 1 update
      expect(status.registeredStrategies).toBe(1);
      expect(status.metrics.totalInteractions).toBe(1);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      const events: string[] = [];
      
      selfMod.on('shutdown', () => events.push('shutdown'));

      await selfMod.shutdown();

      expect(events).toContain('shutdown');
    });
  });
});

describe('Helper Functions', () => {
  it('should create default personality', () => {
    const personality = createDefaultPersonality();

    expect(personality.name).toBe('Default');
    expect(personality.bluntness).toBe(5);
    expect(personality.proactivity).toBe(7);
    expect(personality.autonomy).toBe(7);
    expect(personality.responseStyle).toBe('adaptive');
  });
});
