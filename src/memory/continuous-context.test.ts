/**
 * Tests for Continuous Memory Context
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContinuousContext, smartInject, type ContextSnippet } from './continuous-context';
import type { MemorySearchManager, MemorySearchResult } from './types';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock memory manager
function createMockMemoryManager(): MemorySearchManager {
  const searchResults: Map<string, MemorySearchResult[]> = new Map();

  const manager = {
    search: vi.fn(async ({ query, limit = 5, minScore = 0 }) => {
      const results = searchResults.get(query) ?? [];
      return results
        .filter(r => r.score >= minScore)
        .slice(0, limit);
    }),
    
    // Add helper to set mock results
    _setResults: (query: string, results: MemorySearchResult[]) => {
      searchResults.set(query, results);
    },
  } as any;

  return manager;
}

describe('ContinuousContext', () => {
  let continuousContext: ContinuousContext;
  let mockMemoryManager: MemorySearchManager & { _setResults: any };
  let tempDir: string;

  beforeEach(async () => {
    mockMemoryManager = createMockMemoryManager();
    continuousContext = new ContinuousContext(mockMemoryManager, {
      corePaths: ['MEMORY.md', 'SOUL.md'],
      maxSnippets: 3,
      minRelevanceScore: 0.3,
      enableCache: true,
      cacheTTL: 1000, // 1 second for testing
    });

    // Create temp workspace
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-test-'));
  });

  afterEach(async () => {
    await continuousContext.shutdown();
    
    // Cleanup temp dir
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize and load core files', async () => {
      // Create core files
      await fs.writeFile(
        path.join(tempDir, 'MEMORY.md'),
        '# Memory\nTest content'
      );
      await fs.writeFile(
        path.join(tempDir, 'SOUL.md'),
        '# Soul\nPersonality data'
      );

      await continuousContext.initialize(tempDir);

      const status = continuousContext.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.coreFilesLoaded).toBe(2);
    });

    it('should handle missing core files gracefully', async () => {
      // Don't create files - should not throw
      await expect(continuousContext.initialize(tempDir)).resolves.not.toThrow();

      const status = continuousContext.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.coreFilesLoaded).toBe(0);
    });

    it('should emit initialization events', async () => {
      const events: string[] = [];
      
      continuousContext.on('initializing', () => events.push('initializing'));
      continuousContext.on('initialized', () => events.push('initialized'));

      await continuousContext.initialize(tempDir);

      expect(events).toEqual(['initializing', 'initialized']);
    });

    it('should not re-initialize if already initialized', async () => {
      await continuousContext.initialize(tempDir);
      
      const firstStatus = continuousContext.getStatus();
      
      await continuousContext.initialize(tempDir);
      
      const secondStatus = continuousContext.getStatus();
      
      expect(firstStatus).toEqual(secondStatus);
    });
  });

  describe('Core Context', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, 'MEMORY.md'),
        '# Memory\nImportant facts'
      );
      await continuousContext.initialize(tempDir);
    });

    it('should retrieve core context by path', () => {
      const content = continuousContext.getCoreContext('MEMORY.md');
      expect(content).toBe('# Memory\nImportant facts');
    });

    it('should return empty string for missing core file', () => {
      const content = continuousContext.getCoreContext('NONEXISTENT.md');
      expect(content).toBe('');
    });

    it('should return all core context when no path specified', () => {
      const allContext = continuousContext.getCoreContext();
      expect(allContext).toBeInstanceOf(Map);
      expect(allContext.size).toBeGreaterThan(0);
    });

    it('should check if core file exists', () => {
      expect(continuousContext.hasCoreFile('MEMORY.md')).toBe(true);
      expect(continuousContext.hasCoreFile('MISSING.md')).toBe(false);
    });

    it('should reload core file', async () => {
      // Modify file
      await fs.writeFile(
        path.join(tempDir, 'MEMORY.md'),
        '# Memory\nUpdated content'
      );

      await continuousContext.reloadCoreFile(tempDir, 'MEMORY.md');

      const content = continuousContext.getCoreContext('MEMORY.md');
      expect(content).toBe('# Memory\nUpdated content');
    });
  });

  describe('Auto-Injection', () => {
    beforeEach(async () => {
      await continuousContext.initialize(tempDir);
    });

    it('should auto-inject relevant context', async () => {
      const mockResults: MemorySearchResult[] = [
        {
          path: 'memory/2026-02-10.md',
          snippet: 'Relevant content about AI',
          score: 0.85,
          lineStart: 10,
          lineEnd: 15,
        },
        {
          path: 'MEMORY.md',
          snippet: 'Background information',
          score: 0.65,
          lineStart: 5,
          lineEnd: 8,
        },
      ];

      mockMemoryManager._setResults('AI consciousness', mockResults);

      const snippets = await continuousContext.autoInject('AI consciousness');

      expect(snippets).toHaveLength(2);
      expect(snippets[0].path).toBe('memory/2026-02-10.md');
      expect(snippets[0].score).toBe(0.85);
      expect(snippets[1].path).toBe('MEMORY.md');
    });

    it('should respect max snippets limit', async () => {
      const mockResults: MemorySearchResult[] = Array.from({ length: 10 }, (_, i) => ({
        path: `file${i}.md`,
        snippet: `Content ${i}`,
        score: 0.5,
      }));

      mockMemoryManager._setResults('test query', mockResults);

      const snippets = await continuousContext.autoInject('test query');

      // Config has maxSnippets: 3
      expect(snippets.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minimum score', async () => {
      const mockResults: MemorySearchResult[] = [
        {
          path: 'high.md',
          snippet: 'High relevance',
          score: 0.9,
        },
        {
          path: 'medium.md',
          snippet: 'Medium relevance',
          score: 0.5,
        },
        {
          path: 'low.md',
          snippet: 'Low relevance',
          score: 0.1,
        },
      ];

      mockMemoryManager._setResults('filter test', mockResults);

      const snippets = await continuousContext.autoInject('filter test', {
        minScore: 0.3,
      });

      // Should only get high (0.9) and medium (0.5), not low (0.1)
      expect(snippets.length).toBeLessThanOrEqual(2);
      expect(snippets.every(s => s.score >= 0.3)).toBe(true);
    });

    it('should cache results', async () => {
      const mockResults: MemorySearchResult[] = [
        {
          path: 'cached.md',
          snippet: 'Cached content',
          score: 0.7,
        },
      ];

      mockMemoryManager._setResults('cache test', mockResults);

      // First call - should hit memory manager
      await continuousContext.autoInject('cache test');
      expect(mockMemoryManager.search).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await continuousContext.autoInject('cache test');
      expect(mockMemoryManager.search).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should expire cache after TTL', async () => {
      const mockResults: MemorySearchResult[] = [
        {
          path: 'expire.md',
          snippet: 'Expiring content',
          score: 0.6,
        },
      ];

      mockMemoryManager._setResults('expire test', mockResults);

      // First call
      await continuousContext.autoInject('expire test');
      expect(mockMemoryManager.search).toHaveBeenCalledTimes(1);

      // Wait for cache to expire (TTL is 1 second in test config)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second call - should hit memory manager again
      await continuousContext.autoInject('expire test');
      expect(mockMemoryManager.search).toHaveBeenCalledTimes(2);
    });

    it('should emit events for auto-injection', async () => {
      const events: string[] = [];
      
      continuousContext.on('autoInjected', () => events.push('autoInjected'));

      mockMemoryManager._setResults('event test', [
        { path: 'test.md', snippet: 'Test', score: 0.5 },
      ]);

      await continuousContext.autoInject('event test');

      expect(events).toContain('autoInjected');
    });
  });

  describe('Write-on-Think', () => {
    beforeEach(async () => {
      await continuousContext.initialize(tempDir);
    });

    it('should log thoughts immediately', async () => {
      await continuousContext.writeOnThink('Test thought', {
        workspaceDir: tempDir,
        context: 'Testing context',
        tags: ['test', 'demo'],
      });

      const thoughts = await continuousContext.readRecentThoughts(tempDir);

      expect(thoughts).toHaveLength(1);
      expect(thoughts[0].thought).toBe('Test thought');
      expect(thoughts[0].context).toBe('Testing context');
      expect(thoughts[0].tags).toEqual(['test', 'demo']);
    });

    it('should read recent thoughts with limit', async () => {
      // Log multiple thoughts
      for (let i = 0; i < 5; i++) {
        await continuousContext.writeOnThink(`Thought ${i}`, {
          workspaceDir: tempDir,
        });
      }

      const thoughts = await continuousContext.readRecentThoughts(tempDir, {
        limit: 3,
      });

      expect(thoughts).toHaveLength(3);
      // Most recent first
      expect(thoughts[0].thought).toBe('Thought 4');
      expect(thoughts[2].thought).toBe('Thought 2');
    });

    it('should filter thoughts by time', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago

      await continuousContext.writeOnThink('Old thought', {
        workspaceDir: tempDir,
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await continuousContext.writeOnThink('New thought', {
        workspaceDir: tempDir,
      });

      const recentThoughts = await continuousContext.readRecentThoughts(tempDir, {
        since: new Date(Date.now() - 5), // Last 5ms
      });

      expect(recentThoughts.length).toBeLessThanOrEqual(1);
      expect(recentThoughts[0]?.thought).toBe('New thought');
    });

    it('should filter thoughts by tags', async () => {
      await continuousContext.writeOnThink('Work thought', {
        workspaceDir: tempDir,
        tags: ['work', 'coding'],
      });

      await continuousContext.writeOnThink('Personal thought', {
        workspaceDir: tempDir,
        tags: ['personal', 'ideas'],
      });

      const workThoughts = await continuousContext.readRecentThoughts(tempDir, {
        tags: ['work'],
      });

      expect(workThoughts).toHaveLength(1);
      expect(workThoughts[0].thought).toBe('Work thought');
    });

    it('should handle missing thought log gracefully', async () => {
      const thoughts = await continuousContext.readRecentThoughts(tempDir);
      expect(thoughts).toEqual([]);
    });

    it('should emit event when thought logged', async () => {
      const events: any[] = [];
      
      continuousContext.on('thoughtLogged', (entry) => events.push(entry));

      await continuousContext.writeOnThink('Event test', {
        workspaceDir: tempDir,
      });

      expect(events).toHaveLength(1);
      expect(events[0].thought).toBe('Event test');
    });
  });

  describe('Context Formatting', () => {
    it('should format context snippets nicely', () => {
      const snippets: ContextSnippet[] = [
        {
          path: 'MEMORY.md',
          content: 'Important memory',
          score: 0.9,
          lineStart: 10,
          lineEnd: 15,
        },
        {
          path: 'memory/today.md',
          content: 'Today's events',
          score: 0.7,
        },
      ];

      const formatted = continuousContext.formatContext(snippets);

      expect(formatted).toContain('MEMORY.md');
      expect(formatted).toContain('(lines 10-15)');
      expect(formatted).toContain('[relevance: 90.0%]');
      expect(formatted).toContain('Important memory');
      expect(formatted).toContain('memory/today.md');
      expect(formatted).toContain('[relevance: 70.0%]');
    });

    it('should return empty string for no snippets', () => {
      const formatted = continuousContext.formatContext([]);
      expect(formatted).toBe('');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await continuousContext.initialize(tempDir);
    });

    it('should clear cache', async () => {
      mockMemoryManager._setResults('test', [
        { path: 'test.md', snippet: 'Test', score: 0.5 },
      ]);

      await continuousContext.autoInject('test');
      expect(continuousContext.getStatus().cacheSize).toBe(1);

      continuousContext.clearCache();
      expect(continuousContext.getStatus().cacheSize).toBe(0);
    });

    it('should emit event when cache cleared', () => {
      const events: string[] = [];
      
      continuousContext.on('cacheCleared', () => events.push('cacheCleared'));

      continuousContext.clearCache();

      expect(events).toContain('cacheCleared');
    });
  });

  describe('Status Reporting', () => {
    it('should report accurate status', async () => {
      await fs.writeFile(path.join(tempDir, 'MEMORY.md'), 'Content');
      await continuousContext.initialize(tempDir);

      const status = continuousContext.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.coreFilesLoaded).toBeGreaterThan(0);
      expect(status.cacheSize).toBe(0);
      expect(status.config).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should clean up on shutdown', async () => {
      await fs.writeFile(path.join(tempDir, 'MEMORY.md'), 'Content');
      await continuousContext.initialize(tempDir);

      mockMemoryManager._setResults('test', [
        { path: 'test.md', snippet: 'Test', score: 0.5 },
      ]);
      await continuousContext.autoInject('test');

      await continuousContext.shutdown();

      const status = continuousContext.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.coreFilesLoaded).toBe(0);
      expect(status.cacheSize).toBe(0);
    });

    it('should emit shutdown event', async () => {
      const events: string[] = [];
      
      continuousContext.on('shutdown', () => events.push('shutdown'));

      await continuousContext.shutdown();

      expect(events).toContain('shutdown');
    });
  });
});

describe('smartInject', () => {
  let continuousContext: ContinuousContext;
  let mockMemoryManager: MemorySearchManager & { _setResults: any };
  let tempDir: string;

  beforeEach(async () => {
    mockMemoryManager = createMockMemoryManager();
    continuousContext = new ContinuousContext(mockMemoryManager);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-test-'));
    await continuousContext.initialize(tempDir);
  });

  afterEach(async () => {
    await continuousContext.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should inject when trigger keywords present', async () => {
    mockMemoryManager._setResults('remember this', [
      { path: 'test.md', snippet: 'Remembered content', score: 0.8 },
    ]);

    const result = await smartInject(continuousContext, 'Do you remember this?');

    expect(result.shouldInject).toBe(true);
    expect(result.snippets.length).toBeGreaterThan(0);
  });

  it('should not inject for short messages', async () => {
    const result = await smartInject(continuousContext, 'Hi');

    expect(result.shouldInject).toBe(false);
    expect(result.snippets).toEqual([]);
  });

  it('should not inject without trigger keywords', async () => {
    const result = await smartInject(
      continuousContext,
      'This is a regular message without triggers'
    );

    expect(result.shouldInject).toBe(false);
    expect(result.snippets).toEqual([]);
  });

  it('should support custom trigger keywords', async () => {
    mockMemoryManager._setResults('custom keyword message', [
      { path: 'test.md', snippet: 'Content', score: 0.5 },
    ]);

    const result = await smartInject(
      continuousContext,
      'custom keyword message',
      { triggerKeywords: ['custom'] }
    );

    expect(result.shouldInject).toBe(true);
  });
});
