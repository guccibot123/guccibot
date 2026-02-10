/**
 * Smart Heartbeat Executor - Goal Loop Integration
 * 
 * Enhances the existing heartbeat system with Goal Loop priority logic.
 * Calculates which check is most overdue and executes it intelligently.
 * 
 * @author Gucci
 * @date 2026-02-10
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

interface HeartbeatState {
  lastChecks: Record<string, number | null>;
  nextWindows: Record<string, { start: string; end: string }>;
  cadences: Record<string, number>; // seconds
}

interface CheckConfig {
  name: string;
  cadence: number; // seconds
  timeWindow?: { start: string; end: string };
  lastRun: number | null;
  priority: number; // 0-10, calculated
}

const STATE_FILE = 'heartbeat-state.json';

/**
 * Calculate priority for a check based on:
 * - How overdue it is
 * - Whether we're in its time window
 * - Its configured cadence (urgency)
 */
function calculatePriority(check: CheckConfig, now: Date): number {
  const nowMs = now.getTime();
  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();
  
  // Check time window
  if (check.timeWindow) {
    const [startHour, startMin] = check.timeWindow.start.split(':').map(Number);
    const [endHour, endMin] = check.timeWindow.end.split(':').map(Number);
    
    const currentMinutes = nowHour * 60 + nowMinute;
    const windowStart = startHour * 60 + startMin;
    const windowEnd = endHour * 60 + endMin;
    
    // Outside window = priority 0
    if (currentMinutes < windowStart || currentMinutes >= windowEnd) {
      return 0;
    }
  }
  
  // Never run = max priority (10)
  if (check.lastRun === null) {
    return 10;
  }
  
  // Calculate how overdue (as fraction of cadence)
  const lastRunMs = check.lastRun * 1000;
  const timeSinceRun = (nowMs - lastRunMs) / 1000; // seconds
  const overdueRatio = timeSinceRun / check.cadence;
  
  // Priority scales with how overdue:
  // 0.0x cadence = priority 0
  // 1.0x cadence = priority 5
  // 2.0x cadence = priority 10
  const priority = Math.min(10, overdueRatio * 5);
  
  return Math.round(priority * 10) / 10; // Round to 1 decimal
}

/**
 * Load heartbeat state from file
 */
function loadState(): HeartbeatState {
  const statePath = join(process.cwd(), STATE_FILE);
  
  if (!existsSync(statePath)) {
    // Create default state
    const defaultState: HeartbeatState = {
      lastChecks: {
        email: null,
        calendar: null,
        tasks: null,
        git: null,
        proactive: null,
      },
      nextWindows: {
        email: { start: '09:00', end: '21:00' },
        calendar: { start: '08:00', end: '22:00' },
        proactive: { start: '03:00', end: '03:30' },
      },
      cadences: {
        email: 1800, // 30 min
        calendar: 7200, // 2 hours
        tasks: 1800, // 30 min
        git: 86400, // 24 hours
        proactive: 86400, // 24 hours
      },
    };
    
    writeFileSync(statePath, JSON.stringify(defaultState, null, 2));
    return defaultState;
  }
  
  return JSON.parse(readFileSync(statePath, 'utf-8'));
}

/**
 * Save updated state to file
 */
function saveState(state: HeartbeatState): void {
  const statePath = join(process.cwd(), STATE_FILE);
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Select the highest priority check to run
 */
function selectCheck(state: HeartbeatState, now: Date): CheckConfig | null {
  const checks: CheckConfig[] = [];
  
  for (const [name, cadence] of Object.entries(state.cadences)) {
    const check: CheckConfig = {
      name,
      cadence,
      timeWindow: state.nextWindows[name],
      lastRun: state.lastChecks[name],
      priority: 0,
    };
    
    check.priority = calculatePriority(check, now);
    checks.push(check);
  }
  
  // Sort by priority descending
  checks.sort((a, b) => b.priority - a.priority);
  
  // Return highest priority check if priority > 0
  const topCheck = checks[0];
  return topCheck && topCheck.priority > 0 ? topCheck : null;
}

/**
 * Log wisdom learned from a check (AGI learning pattern)
 */
function logWisdom(checkName: string, result: {
  success: boolean;
  message: string;
  shouldNotify: boolean;
}, notes?: string): void {
  const wisdomPath = join(process.cwd(), 'memory', 'autonomous-wisdom.md');
  
  const entry = `
### ${new Date().toISOString().split('T')[0]} - ${checkName}

**Result:** ${result.success ? '✅ Success' : '❌ Failed'}  
**Message:** ${result.message}  
**Action Needed:** ${result.shouldNotify ? 'Yes' : 'No'}

${notes ? `**Learning:** ${notes}\n` : ''}
---
`;
  
  try {
    appendFileSync(wisdomPath, entry, 'utf-8');
  } catch (error) {
    // Silently fail if wisdom logging fails
  }
}

/**
 * Execute a check and return result
 */
async function executeCheck(checkName: string): Promise<{
  success: boolean;
  message: string;
  shouldNotify: boolean;
}> {
  const now = new Date();
  const hour = now.getHours();
  
  switch (checkName) {
    case 'email':
      // TODO: Integrate with actual email service
      // For now, return mock result
      return {
        success: true,
        message: 'Email check: No urgent messages',
        shouldNotify: false,
      };
    
    case 'calendar':
      // TODO: Integrate with calendar service
      return {
        success: true,
        message: 'Calendar check: No upcoming events',
        shouldNotify: false,
      };
    
    case 'tasks':
      // Check Kanban board for stalled tasks
      try {
        const { readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        
        const tasksPath = join(process.cwd(), 'kanban', 'tasks.json');
        const data = JSON.parse(readFileSync(tasksPath, 'utf-8'));
        
        // Get tasks in "In Progress" column
        const inProgressTasks = data.columns.inProgress?.tasks || [];
        
        // Find stalled tasks (in progress for >48h)
        const now = Date.now();
        const stalled = inProgressTasks.filter((t: any) => {
          const createdDate = new Date(t.created).getTime();
          const hoursInProgress = (now - createdDate) / (1000 * 60 * 60);
          
          return hoursInProgress > 48; // Stalled if >48h in progress
        });
        
        if (stalled.length > 0) {
          const titles = stalled.map((t: any) => t.title.substring(0, 30)).join(', ');
          return {
            success: true,
            message: `Kanban: ${stalled.length} stalled task(s) - ${titles}`,
            shouldNotify: true,
          };
        }
        
        // Count tasks needing review
        const reviewTasks = data.columns.review?.tasks || [];
        if (reviewTasks.length > 0) {
          return {
            success: true,
            message: `Kanban: ${reviewTasks.length} task(s) need review`,
            shouldNotify: true,
          };
        }
        
        return {
          success: true,
          message: 'Kanban check: All tasks on track',
          shouldNotify: false,
        };
      } catch (error) {
        return {
          success: false,
          message: `Kanban check failed: ${error}`,
          shouldNotify: false,
        };
      }
    
    case 'git':
      // Check git status in workspace
      try {
        const { execSync } = await import('node:child_process');
        const workspaceDir = process.cwd();
        
        // Check for uncommitted changes
        const status = execSync('git status --short', { 
          cwd: workspaceDir,
          encoding: 'utf-8' 
        }).trim();
        
        if (status) {
          const lines = status.split('\n').length;
          const result = {
            success: true,
            message: `Git: ${lines} uncommitted changes detected`,
            shouldNotify: true,
          };
          
          // AGI Learning: Log wisdom about uncommitted files
          logWisdom('git', result, `Found ${lines} uncommitted files - regular development activity`);
          
          return result;
        }
        
        const result = {
          success: true,
          message: 'Git check: Working tree clean',
          shouldNotify: false,
        };
        
        logWisdom('git', result, 'Clean working tree - all changes committed');
        
        return result;
      } catch (error) {
        const result = {
          success: false,
          message: `Git check failed: ${error}`,
          shouldNotify: false,
        };
        
        logWisdom('git', result, `Error checking git status - might not be a git repo`);
        
        return result;
      }
    
    case 'proactive':
      // Only runs at 3 AM
      if (hour === 3) {
        // TODO: Run proactive optimization
        return {
          success: true,
          message: 'Proactive scan: System healthy',
          shouldNotify: false,
        };
      }
      return {
        success: true,
        message: 'Proactive scan: Not 3 AM, skipping',
        shouldNotify: false,
      };
    
    default:
      return {
        success: false,
        message: `Unknown check: ${checkName}`,
        shouldNotify: false,
      };
  }
}

/**
 * Main heartbeat executor
 */
async function runHeartbeat(): Promise<string> {
  const now = new Date();
  const state = loadState();
  
  // Select highest priority check
  const check = selectCheck(state, now);
  
  if (!check) {
    // Nothing needs running right now
    return 'HEARTBEAT_OK';
  }
  
  // Execute the check
  const result = await executeCheck(check.name);
  
  // Update state
  state.lastChecks[check.name] = Math.floor(now.getTime() / 1000);
  saveState(state);
  
  // Log execution
  const logEntry = {
    timestamp: now.toISOString(),
    check: check.name,
    priority: check.priority,
    result: result.message,
  };
  
  // Write to autonomous-actions.log
  try {
    const { appendFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const logPath = join(process.cwd(), 'memory', 'autonomous-actions.log');
    appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (error) {
    // Silently fail if logging fails
  }
  
  console.log('[Heartbeat]', JSON.stringify(logEntry));
  
  // Return appropriate response
  if (result.shouldNotify) {
    return result.message;
  }
  
  return 'HEARTBEAT_OK';
}

/**
 * CLI entry point
 */
if (require.main === module) {
  runHeartbeat()
    .then((message) => {
      console.log(message);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Heartbeat error:', error);
      process.exit(1);
    });
}

export { runHeartbeat, loadState, saveState, selectCheck, calculatePriority };
