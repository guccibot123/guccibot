/**
 * Integration examples for Continuous Memory Context
 * 
 * Shows how to integrate always-on semantic memory into OpenClaw agents.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 */

import { ContinuousContext, smartInject } from './continuous-context.js';
import type { MemorySearchManager } from './types.js';

/**
 * Example 1: Auto-Context Injection in Agent Turns
 * 
 * Automatically inject relevant context before agent processes message.
 */
export async function agentTurnWithAutoContext(
  continuousContext: ContinuousContext,
  userMessage: string
): Promise<string> {
  // Smart injection - only inject when relevant
  const { snippets, shouldInject } = await smartInject(
    continuousContext,
    userMessage
  );

  if (shouldInject) {
    // Format context
    const contextString = continuousContext.formatContext(snippets);

    // Prepend to system prompt or user message
    const enrichedMessage = `
# Relevant Context

${contextString}

---

# User Message

${userMessage}
    `.trim();

    return enrichedMessage;
  }

  // No context needed
  return userMessage;
}

/**
 * Example 2: Write-on-Think for Transparency
 * 
 * Log agent's reasoning process in real-time.
 */
export async function agentWithThoughtLogging(
  continuousContext: ContinuousContext,
  workspaceDir: string
) {
  // During agent execution, log thoughts
  await continuousContext.writeOnThink(
    'Analyzing user request for task complexity',
    {
      workspaceDir,
      context: 'User asked about building autonomous agent',
      tags: ['reasoning', 'task-analysis'],
    }
  );

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));

  await continuousContext.writeOnThink(
    'Decided to spawn sub-agent for parallel research',
    {
      workspaceDir,
      context: 'Task requires deep dive into multiple sources',
      tags: ['decision', 'delegation'],
    }
  );

  // Later, review thought process
  const recentThoughts = await continuousContext.readRecentThoughts(
    workspaceDir,
    { limit: 10 }
  );

  console.log('Agent thought process:');
  recentThoughts.forEach(thought => {
    console.log(`  ${thought.timestamp.toISOString()}: ${thought.thought}`);
  });
}

/**
 * Example 3: Token-Efficient Context Loading
 * 
 * Load only relevant snippets instead of entire files.
 */
export async function tokenEfficientContextLoading(
  continuousContext: ContinuousContext,
  query: string
): Promise<{ tokens: number; snippets: any[] }> {
  // Traditional approach: Load entire MEMORY.md (potentially 10K+ tokens)
  const traditionalTokens = 10000;

  // Continuous context approach: Auto-inject only relevant snippets
  const snippets = await continuousContext.autoInject(query, {
    maxResults: 3,
    minScore: 0.5,
  });

  // Each snippet ~200 tokens, total ~600 tokens
  const efficientTokens = snippets.length * 200;

  console.log(`Token savings: ${traditionalTokens - efficientTokens} tokens`);
  console.log(`Efficiency: ${((1 - efficientTokens / traditionalTokens) * 100).toFixed(1)}%`);

  return { tokens: efficientTokens, snippets };
}

/**
 * Example 4: Core Files Always Available
 * 
 * Access MEMORY.md, SOUL.md without explicit read.
 */
export async function coreFilesExample(
  continuousContext: ContinuousContext
): Promise<void> {
  // Core files are already loaded at startup
  const soulContent = continuousContext.getCoreContext('SOUL.md');
  const userContent = continuousContext.getCoreContext('USER.md');

  console.log('Soul (personality):', soulContent.slice(0, 100) + '...');
  console.log('User context:', userContent.slice(0, 100) + '...');

  // No explicit fs.readFile needed!
  // No token waste loading entire file!
}

/**
 * Example 5: Integration with Goal Loop
 * 
 * Combine autonomous goals with continuous context.
 */
export async function goalWithContextAwareness(
  continuousContext: ContinuousContext
): Promise<{ success: boolean; message: string }> {
  // Goal: Check if user has any upcoming meetings
  // Use context to understand user's schedule patterns

  const snippets = await continuousContext.autoInject('calendar meetings schedule');

  if (snippets.length > 0) {
    // Found relevant context about meetings
    const contextSummary = snippets
      .map(s => s.content.slice(0, 100))
      .join(' | ');

    return {
      success: true,
      message: `Found schedule context: ${contextSummary}`,
    };
  }

  return {
    success: true,
    message: 'No meeting context found, using default behavior',
  };
}

/**
 * Example 6: Real-Time Context Updates
 * 
 * Reload core files when modified.
 */
export async function setupContextFileWatcher(
  continuousContext: ContinuousContext,
  workspaceDir: string
): Promise<() => void> {
  const { watch } = await import('node:fs');

  const watchers: any[] = [];

  // Watch core files for changes
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'AGENTS.md'];

  for (const file of coreFiles) {
    const watcher = watch(
      `${workspaceDir}/${file}`,
      async (eventType) => {
        if (eventType === 'change') {
          await continuousContext.reloadCoreFile(workspaceDir, file);
          console.log(`Reloaded: ${file}`);
        }
      }
    );

    watchers.push(watcher);
  }

  // Return cleanup function
  return () => {
    watchers.forEach(w => w.close());
  };
}

/**
 * Example 7: Query-Specific Context Sources
 * 
 * Different queries search different memory sources.
 */
export async function contextWithSpecificSources(
  continuousContext: ContinuousContext
): Promise<void> {
  // For technical questions, search code-related memory
  const codeContext = await continuousContext.autoInject(
    'How do I implement OAuth?',
    {
      sources: ['research/programming-*.md', 'patterns/auth-*.md'],
    }
  );

  // For personal questions, search user context
  const personalContext = await continuousContext.autoInject(
    'What are my goals?',
    {
      sources: ['USER.md', 'memory/goals.md'],
    }
  );

  console.log('Code snippets:', codeContext.length);
  console.log('Personal snippets:', personalContext.length);
}

/**
 * Example 8: Complete Integration Setup
 * 
 * Initialize continuous context in OpenClaw gateway.
 */
export async function setupContinuousContext(
  memoryManager: MemorySearchManager,
  workspaceDir: string
): Promise<ContinuousContext> {
  // Create continuous context
  const continuousContext = new ContinuousContext(memoryManager, {
    corePaths: [
      'MEMORY.md',
      'SOUL.md',
      'USER.md',
      'AGENTS.md',
      'TOOLS.md',
    ],
    maxSnippets: 5,
    minRelevanceScore: 0.3,
    enableWriteOnThink: true,
    thoughtLogPath: 'memory/thoughts.jsonl',
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    enableCache: true,
  });

  // Initialize (loads core files)
  await continuousContext.initialize(workspaceDir);

  // Set up event listeners
  continuousContext.on('autoInjected', ({ query, snippetCount }) => {
    console.log(`[Context] Auto-injected ${snippetCount} snippets for: ${query.slice(0, 50)}...`);
  });

  continuousContext.on('thoughtLogged', ({ thought }) => {
    console.log(`[Thought] ${thought.slice(0, 100)}...`);
  });

  continuousContext.on('error', ({ operation, error }) => {
    console.error(`[Context Error] ${operation}:`, error);
  });

  // Set up file watcher
  const cleanup = await setupContextFileWatcher(continuousContext, workspaceDir);

  // Store cleanup for shutdown
  (continuousContext as any)._cleanup = cleanup;

  return continuousContext;
}

/**
 * Example 9: Graceful Shutdown
 */
export async function shutdownContinuousContext(
  continuousContext: ContinuousContext
): Promise<void> {
  console.log('[Context] Shutting down...');

  // Stop file watchers
  const cleanup = (continuousContext as any)._cleanup;
  if (cleanup) {
    cleanup();
  }

  // Shutdown context
  await continuousContext.shutdown();

  console.log('[Context] Shutdown complete');
}

/**
 * Example 10: Performance Comparison
 */
export async function performanceComparison(
  continuousContext: ContinuousContext
): Promise<void> {
  console.log('\n=== Performance Comparison ===\n');

  // Traditional approach
  console.time('Traditional: Read entire MEMORY.md');
  // Simulate reading 10KB file
  await new Promise(resolve => setTimeout(resolve, 50));
  console.timeEnd('Traditional: Read entire MEMORY.md');
  console.log('Tokens loaded: ~10,000');

  // Continuous context approach
  console.time('Continuous: Auto-inject relevant snippets');
  const snippets = await continuousContext.autoInject('What did I learn today?');
  console.timeEnd('Continuous: Auto-inject relevant snippets');
  console.log(`Tokens loaded: ~${snippets.length * 200} (${snippets.length} snippets)`);

  const savings = 10000 - (snippets.length * 200);
  console.log(`\nToken savings: ${savings} (${((savings / 10000) * 100).toFixed(1)}%)`);
}

/**
 * Example 11: Multi-Agent Context Sharing
 * 
 * Share continuous context across multiple agent sessions.
 */
export class SharedContextManager {
  private contexts: Map<string, ContinuousContext> = new Map();

  async getOrCreateContext(
    agentId: string,
    memoryManager: MemorySearchManager,
    workspaceDir: string
  ): Promise<ContinuousContext> {
    let context = this.contexts.get(agentId);

    if (!context) {
      context = await setupContinuousContext(memoryManager, workspaceDir);
      this.contexts.set(agentId, context);
    }

    return context;
  }

  async shutdownAll(): Promise<void> {
    for (const context of this.contexts.values()) {
      await shutdownContinuousContext(context);
    }
    this.contexts.clear();
  }
}
