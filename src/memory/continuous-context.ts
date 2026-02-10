/**
 * Continuous Memory Context - Always-on semantic memory layer
 * 
 * Transforms memory from "explicit load" to "always available."
 * Auto-injects relevant context, reduces token waste, enables write-on-think.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 * @date 2026-02-10
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MemorySearchManager, MemorySearchResult } from './types.js';

export interface ContinuousContextConfig {
  /** Paths to always keep loaded */
  corePaths: string[];
  
  /** Maximum context snippets to inject per query */
  maxSnippets: number;
  
  /** Minimum relevance score (0-1) for auto-injection */
  minRelevanceScore: number;
  
  /** Enable write-on-think logging */
  enableWriteOnThink: boolean;
  
  /** Path for thought logs */
  thoughtLogPath?: string;
  
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  
  /** Enable aggressive caching */
  enableCache: boolean;
}

export interface ContextSnippet {
  path: string;
  content: string;
  score: number;
  lineStart?: number;
  lineEnd?: number;
}

export interface ThoughtEntry {
  timestamp: Date;
  thought: string;
  context?: string;
  tags?: string[];
}

interface CacheEntry {
  snippets: ContextSnippet[];
  timestamp: number;
}

/**
 * Continuous Memory Context Manager
 * 
 * Provides always-on semantic memory with automatic context injection.
 */
export class ContinuousContext extends EventEmitter {
  private config: ContinuousContextConfig;
  private memoryManager: MemorySearchManager;
  private coreContext: Map<string, string> = new Map();
  private queryCache: Map<string, CacheEntry> = new Map();
  private initialized = false;
  
  constructor(
    memoryManager: MemorySearchManager,
    config: Partial<ContinuousContextConfig> = {}
  ) {
    super();
    
    this.memoryManager = memoryManager;
    this.config = {
      corePaths: config.corePaths ?? [
        'MEMORY.md',
        'SOUL.md',
        'USER.md',
        'AGENTS.md',
      ],
      maxSnippets: config.maxSnippets ?? 5,
      minRelevanceScore: config.minRelevanceScore ?? 0.3,
      enableWriteOnThink: config.enableWriteOnThink ?? true,
      thoughtLogPath: config.thoughtLogPath ?? 'memory/thoughts.jsonl',
      cacheTTL: config.cacheTTL ?? 5 * 60 * 1000, // 5 minutes
      enableCache: config.enableCache ?? true,
    };
  }

  /**
   * Initialize continuous context system
   * Loads core files into memory
   */
  async initialize(workspaceDir: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.emit('initializing');

    try {
      // Load core files
      for (const corePath of this.config.corePaths) {
        await this.loadCoreFile(workspaceDir, corePath);
      }

      this.initialized = true;
      this.emit('initialized', {
        coreFilesLoaded: this.coreContext.size,
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Load a core file into always-available context
   */
  private async loadCoreFile(workspaceDir: string, relativePath: string): Promise<void> {
    const fullPath = path.join(workspaceDir, relativePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      this.coreContext.set(relativePath, content);
      this.emit('coreFileLoaded', { path: relativePath, size: content.length });
    } catch (error) {
      // File might not exist yet (e.g., MEMORY.md not created)
      // Not an error, just skip
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Auto-inject relevant context for a query
   * 
   * This is the core feature - automatically find and inject
   * relevant memory snippets without explicit user request.
   */
  async autoInject(
    query: string,
    options: {
      sources?: string[];
      maxResults?: number;
      minScore?: number;
    } = {}
  ): Promise<ContextSnippet[]> {
    if (!this.initialized) {
      throw new Error('ContinuousContext not initialized');
    }

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getCached(query);
      if (cached) {
        this.emit('cacheHit', { query });
        return cached;
      }
    }

    try {
      // Search memory using existing semantic search
      const results = await this.memoryManager.search({
        query,
        limit: options.maxResults ?? this.config.maxSnippets,
        minScore: options.minScore ?? this.config.minRelevanceScore,
        sources: options.sources,
      });

      // Convert to context snippets
      const snippets: ContextSnippet[] = results.map(result => ({
        path: result.path,
        content: result.snippet,
        score: result.score,
        lineStart: result.lineStart,
        lineEnd: result.lineEnd,
      }));

      // Cache results
      if (this.config.enableCache) {
        this.cache(query, snippets);
      }

      this.emit('autoInjected', {
        query,
        snippetCount: snippets.length,
        totalScore: snippets.reduce((sum, s) => sum + s.score, 0),
      });

      return snippets;
    } catch (error) {
      this.emit('error', { operation: 'autoInject', error });
      return [];
    }
  }

  /**
   * Get core context (always-loaded files)
   */
  getCoreContext(filePath?: string): string | Map<string, string> {
    if (filePath) {
      return this.coreContext.get(filePath) ?? '';
    }
    return new Map(this.coreContext);
  }

  /**
   * Check if core context contains file
   */
  hasCoreFile(filePath: string): boolean {
    return this.coreContext.has(filePath);
  }

  /**
   * Reload a core file (e.g., after modification)
   */
  async reloadCoreFile(workspaceDir: string, relativePath: string): Promise<void> {
    await this.loadCoreFile(workspaceDir, relativePath);
    this.emit('coreFileReloaded', { path: relativePath });
  }

  /**
   * Write-on-think: Log thoughts as they happen
   * 
   * This enables immediate thought capture without retroactive writing.
   */
  async writeOnThink(
    thought: string,
    options: {
      context?: string;
      tags?: string[];
      workspaceDir: string;
    }
  ): Promise<void> {
    if (!this.config.enableWriteOnThink) {
      return;
    }

    const entry: ThoughtEntry = {
      timestamp: new Date(),
      thought,
      context: options.context,
      tags: options.tags,
    };

    const logPath = path.join(options.workspaceDir, this.config.thoughtLogPath!);

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(logPath), { recursive: true });

      // Append as JSONL
      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(logPath, line, 'utf-8');

      this.emit('thoughtLogged', entry);
    } catch (error) {
      this.emit('error', { operation: 'writeOnThink', error });
    }
  }

  /**
   * Read recent thoughts
   */
  async readRecentThoughts(
    workspaceDir: string,
    options: {
      limit?: number;
      since?: Date;
      tags?: string[];
    } = {}
  ): Promise<ThoughtEntry[]> {
    const logPath = path.join(workspaceDir, this.config.thoughtLogPath!);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      let thoughts = lines
        .map(line => {
          try {
            const entry = JSON.parse(line) as ThoughtEntry;
            entry.timestamp = new Date(entry.timestamp);
            return entry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is ThoughtEntry => entry !== null);

      // Filter by time
      if (options.since) {
        thoughts = thoughts.filter(t => t.timestamp >= options.since!);
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        thoughts = thoughts.filter(t =>
          t.tags?.some(tag => options.tags!.includes(tag))
        );
      }

      // Limit results (most recent first)
      if (options.limit) {
        thoughts = thoughts.slice(-options.limit);
      }

      return thoughts.reverse(); // Most recent first
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Build context string from snippets
   */
  formatContext(snippets: ContextSnippet[]): string {
    if (snippets.length === 0) {
      return '';
    }

    const sections = snippets.map((snippet, idx) => {
      const header = `## Context ${idx + 1}: ${snippet.path}`;
      const lines = snippet.lineStart
        ? `(lines ${snippet.lineStart}-${snippet.lineEnd})`
        : '';
      const score = `[relevance: ${(snippet.score * 100).toFixed(1)}%]`;

      return `${header} ${lines} ${score}\n\n${snippet.content}`;
    });

    return sections.join('\n\n---\n\n');
  }

  /**
   * Get query cache
   */
  private getCached(query: string): ContextSnippet[] | null {
    const entry = this.queryCache.get(query);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.config.cacheTTL) {
      this.queryCache.delete(query);
      return null;
    }

    return entry.snippets;
  }

  /**
   * Cache query results
   */
  private cache(query: string, snippets: ContextSnippet[]): void {
    this.queryCache.set(query, {
      snippets,
      timestamp: Date.now(),
    });

    // Clean old cache entries if too large
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 100 entries
      for (let i = 0; i < 100; i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.queryCache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get status
   */
  getStatus(): {
    initialized: boolean;
    coreFilesLoaded: number;
    cacheSize: number;
    config: ContinuousContextConfig;
  } {
    return {
      initialized: this.initialized,
      coreFilesLoaded: this.coreContext.size,
      cacheSize: this.queryCache.size,
      config: this.config,
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    this.clearCache();
    this.coreContext.clear();
    this.initialized = false;
    this.emit('shutdown');
  }
}

/**
 * Helper: Create continuous context with defaults
 */
export function createContinuousContext(
  memoryManager: MemorySearchManager,
  config?: Partial<ContinuousContextConfig>
): ContinuousContext {
  return new ContinuousContext(memoryManager, config);
}

/**
 * Helper: Smart context injection
 * 
 * Analyzes message and decides whether to inject context
 */
export async function smartInject(
  continuousContext: ContinuousContext,
  message: string,
  options: {
    /** Keywords that trigger context injection */
    triggerKeywords?: string[];
    /** Message length threshold for injection */
    minMessageLength?: number;
  } = {}
): Promise<{ snippets: ContextSnippet[]; shouldInject: boolean }> {
  const triggerKeywords = options.triggerKeywords ?? [
    'remember',
    'recall',
    'what did',
    'tell me about',
    'context',
    'background',
    'history',
    'before',
    'last time',
    'previous',
  ];

  const minLength = options.minMessageLength ?? 10;

  // Don't inject for very short messages
  if (message.length < minLength) {
    return { snippets: [], shouldInject: false };
  }

  // Check for trigger keywords
  const lowerMessage = message.toLowerCase();
  const hasTrigger = triggerKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  if (!hasTrigger) {
    return { snippets: [], shouldInject: false };
  }

  // Inject context
  const snippets = await continuousContext.autoInject(message);

  return {
    snippets,
    shouldInject: snippets.length > 0,
  };
}
