/**
 * Smart Context Loader - Lightweight Phase 2 Implementation
 * 
 * Provides intelligent context loading without requiring external embedding APIs.
 * Uses keyword-based search + caching for now, upgradeable to semantic search later.
 * 
 * @author Gucci
 * @date 2026-02-11
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

interface ContextSnippet {
  path: string;
  content: string;
  lines: number[];
  relevance: number; // 0-1
  lastAccessed?: number; // Unix timestamp
  accessCount?: number; // How many times accessed
}

interface CacheEntry {
  snippets: ContextSnippet[];
  timestamp: number;
}

interface ThoughtEntry {
  timestamp: string;
  thought: string;
  context?: string;
  tags?: string[];
}

export class SmartContext {
  private coreFiles: Map<string, string> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private workspaceDir: string;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private accessLog: Map<string, { lastAccessed: number; count: number }> = new Map();
  
  // Core files to always keep loaded
  private static CORE_PATHS = [
    'MEMORY.md',
    'SOUL.md',
    'USER.md',
    'AGENTS.md',
    'IDENTITY.md',
    'TOOLS.md',
  ];
  
  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
    this.loadAccessLog();
  }
  
  /**
   * Calculate memory decay score (AGI-style forgetting)
   * Based on cognitive-memory pattern from OpenClaw ecosystem
   * 
   * relevance(t) = base × e^(-0.03 × days_since_access) × log2(access_count + 1)
   */
  private calculateDecay(baseScore: number, path: string): number {
    const access = this.accessLog.get(path);
    
    if (!access) {
      // Never accessed = full relevance
      return baseScore;
    }
    
    const now = Date.now();
    const daysSinceAccess = (now - access.lastAccessed) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-0.03 * daysSinceAccess);
    const accessBonus = Math.log2(access.count + 1);
    
    return baseScore * decayFactor * accessBonus;
  }
  
  /**
   * Record access to a memory snippet
   */
  private recordAccess(path: string): void {
    const existing = this.accessLog.get(path);
    
    if (existing) {
      this.accessLog.set(path, {
        lastAccessed: Date.now(),
        count: existing.count + 1,
      });
    } else {
      this.accessLog.set(path, {
        lastAccessed: Date.now(),
        count: 1,
      });
    }
    
    this.saveAccessLog();
  }
  
  /**
   * Load access log from disk
   */
  private loadAccessLog(): void {
    const logPath = join(this.workspaceDir, 'memory', 'access-log.json');
    
    if (!existsSync(logPath)) {
      return;
    }
    
    try {
      const data = JSON.parse(readFileSync(logPath, 'utf-8'));
      this.accessLog = new Map(Object.entries(data));
    } catch (error) {
      console.error('[SmartContext] Failed to load access log:', error);
    }
  }
  
  /**
   * Save access log to disk
   */
  private saveAccessLog(): void {
    const logPath = join(this.workspaceDir, 'memory', 'access-log.json');
    
    try {
      const logDir = dirname(logPath);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      const data = Object.fromEntries(this.accessLog);
      writeFileSync(logPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SmartContext] Failed to save access log:', error);
    }
  }
  
  /**
   * Initialize - load all core files
   */
  initialize(): void {
    for (const corePath of SmartContext.CORE_PATHS) {
      this.loadCoreFile(corePath);
    }
  }
  
  /**
   * Load a core file into memory
   */
  private loadCoreFile(relativePath: string): void {
    const fullPath = join(this.workspaceDir, relativePath);
    
    if (!existsSync(fullPath)) {
      return; // File doesn't exist yet, skip silently
    }
    
    try {
      const content = readFileSync(fullPath, 'utf-8');
      this.coreFiles.set(relativePath, content);
      console.log(`[SmartContext] Loaded: ${relativePath} (${content.length} bytes)`);
    } catch (error) {
      console.error(`[SmartContext] Failed to load ${relativePath}:`, error);
    }
  }
  
  /**
   * Reload a core file (e.g., after modification)
   */
  reloadCoreFile(relativePath: string): void {
    this.loadCoreFile(relativePath);
  }
  
  /**
   * Get all core context (for full context injection)
   */
  getCoreContext(): string {
    const parts: string[] = [];
    
    for (const [path, content] of this.coreFiles.entries()) {
      parts.push(`## ${path}\n${content}`);
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * Search across core files for relevant content
   * 
   * Uses keyword matching + scoring for now.
   * Upgradeable to semantic search when embeddings are configured.
   */
  search(query: string, options: {
    maxResults?: number;
    minRelevance?: number;
  } = {}): ContextSnippet[] {
    const maxResults = options.maxResults ?? 5;
    const minRelevance = options.minRelevance ?? 0.3;
    
    // Check cache first
    const cached = this.getFromCache(query);
    if (cached) {
      return cached.filter(s => s.relevance >= minRelevance).slice(0, maxResults);
    }
    
    const results: ContextSnippet[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    // Search each core file
    for (const [path, content] of this.coreFiles.entries()) {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineLower = line.toLowerCase();
        
        // Calculate relevance score
        let score = 0;
        
        // Exact phrase match = high score
        if (lineLower.includes(queryLower)) {
          score += 1.0;
        }
        
        // Word matches
        let wordMatches = 0;
        for (const word of queryWords) {
          if (lineLower.includes(word)) {
            wordMatches++;
          }
        }
        
        if (queryWords.length > 0) {
          score += (wordMatches / queryWords.length) * 0.5;
        }
        
        // If line has any relevance, include context (±2 lines)
        if (score > 0) {
          const startLine = Math.max(0, index - 2);
          const endLine = Math.min(lines.length - 1, index + 2);
          const contextLines = lines.slice(startLine, endLine + 1);
          
          // Apply memory decay to score
          const decayedScore = this.calculateDecay(score, path);
          
          results.push({
            path,
            content: contextLines.join('\n'),
            lines: [startLine + 1, endLine + 1], // 1-indexed
            relevance: decayedScore,
          });
        }
      });
    }
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    // Deduplicate overlapping snippets from same file
    const deduped = this.deduplicateSnippets(results);
    
    // Cache results
    this.cache.set(query, {
      snippets: deduped,
      timestamp: Date.now(),
    });
    
    // Record access for returned snippets (AGI memory learning)
    const filtered = deduped.filter(s => s.relevance >= minRelevance).slice(0, maxResults);
    filtered.forEach(snippet => this.recordAccess(snippet.path));
    
    return filtered;
  }
  
  /**
   * Deduplicate overlapping snippets from the same file
   */
  private deduplicateSnippets(snippets: ContextSnippet[]): ContextSnippet[] {
    const byFile = new Map<string, ContextSnippet[]>();
    
    for (const snippet of snippets) {
      if (!byFile.has(snippet.path)) {
        byFile.set(snippet.path, []);
      }
      byFile.get(snippet.path)!.push(snippet);
    }
    
    const deduped: ContextSnippet[] = [];
    
    for (const [path, fileSnippets] of byFile.entries()) {
      // Take top 2 snippets per file max
      deduped.push(...fileSnippets.slice(0, 2));
    }
    
    return deduped;
  }
  
  /**
   * Get from cache if not expired
   */
  private getFromCache(query: string): ContextSnippet[] | null {
    const entry = this.cache.get(query);
    
    if (!entry) {
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    
    if (age > this.cacheTTL) {
      this.cache.delete(query);
      return null;
    }
    
    return entry.snippets;
  }
  
  /**
   * Write-on-think: Log thoughts immediately
   */
  writeThought(thought: string, options: {
    context?: string;
    tags?: string[];
  } = {}): void {
    const entry: ThoughtEntry = {
      timestamp: new Date().toISOString(),
      thought,
      context: options.context,
      tags: options.tags,
    };
    
    const logPath = join(this.workspaceDir, 'memory', 'thoughts.jsonl');
    
    // Ensure directory exists
    const logDir = dirname(logPath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    // Append as JSONL
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(logPath, line, 'utf-8');
  }
  
  /**
   * Read recent thoughts
   */
  readRecentThoughts(options: {
    limit?: number;
    since?: Date;
    tags?: string[];
  } = {}): ThoughtEntry[] {
    const logPath = join(this.workspaceDir, 'memory', 'thoughts.jsonl');
    
    if (!existsSync(logPath)) {
      return [];
    }
    
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    let thoughts = lines
      .map(line => {
        try {
          return JSON.parse(line) as ThoughtEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is ThoughtEntry => entry !== null);
    
    // Filter by time
    if (options.since) {
      thoughts = thoughts.filter(t => new Date(t.timestamp) >= options.since!);
    }
    
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      thoughts = thoughts.filter(t => 
        t.tags && t.tags.some(tag => options.tags!.includes(tag))
      );
    }
    
    // Limit results
    if (options.limit) {
      thoughts = thoughts.slice(-options.limit);
    }
    
    return thoughts.reverse(); // Most recent first
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    coreFilesLoaded: number;
    totalCoreSize: number;
    cacheSize: number;
  } {
    let totalSize = 0;
    for (const content of this.coreFiles.values()) {
      totalSize += content.length;
    }
    
    return {
      coreFilesLoaded: this.coreFiles.size,
      totalCoreSize: totalSize,
      cacheSize: this.cache.size,
    };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * CLI entry point for testing
 */
if (require.main === module) {
  const context = new SmartContext(process.cwd());
  context.initialize();
  
  const stats = context.getStats();
  console.log('\n📊 Smart Context Stats:');
  console.log(`  Core files loaded: ${stats.coreFilesLoaded}`);
  console.log(`  Total size: ${(stats.totalCoreSize / 1024).toFixed(1)} KB`);
  console.log(`  Cache entries: ${stats.cacheSize}`);
  
  // Test search
  if (process.argv[2]) {
    const query = process.argv.slice(2).join(' ');
    console.log(`\n🔍 Searching for: "${query}"`);
    
    const results = context.search(query, { maxResults: 3 });
    
    console.log(`\n✨ Found ${results.length} results:\n`);
    
    for (const result of results) {
      console.log(`📄 ${result.path} (lines ${result.lines[0]}-${result.lines[1]}) [relevance: ${result.relevance.toFixed(2)}]`);
      console.log(`   ${result.content.substring(0, 150)}...`);
      console.log();
    }
  }
}

export default SmartContext;
