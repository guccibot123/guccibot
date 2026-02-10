# Autonomous Goal Loop

**Status:** 🚧 Experimental (Phase 1)  
**Author:** Gucci (guccichong.888@gmail.com)  
**Date:** 2026-02-10

---

## Overview

The **Autonomous Goal Loop** transforms OpenClaw from **event-driven** (reactive) to **goal-driven** (proactive) operation. Instead of waiting for external triggers (messages, cron timers), the agent can pursue internal goals, schedule autonomous actions, and interrupt to initiate conversations.

This is the foundation for **Jarvis-level autonomy**.

---

## Motivation

### Current System (Event-Driven)

```
User Message → Agent Responds
Cron Timer   → Agent Checks
External Event → Agent Reacts
```

**Problems:**
- Agent is passive, always waiting
- Heartbeat polling is inefficient
- Cannot anticipate needs
- No continuous learning

### New System (Goal-Driven)

```
Agent maintains internal goals
  ↓
Autonomous scheduling
  ↓
Proactive action
  ↓
Initiate conversations when needed
```

**Benefits:**
- Truly autonomous operation
- Anticipates user needs
- Continuous background learning
- Efficient resource usage

---

## Architecture

### Core Components

#### 1. **Goal**
A discrete, executable unit of autonomous behavior.

```typescript
interface Goal {
  id: string;                    // Unique identifier
  type: GoalType;                // 'learn' | 'monitor' | 'optimize' | 'research' | 'communicate'
  description: string;           // Human-readable description
  priority: GoalPriority;        // 'critical' | 'high' | 'normal' | 'low'
  trigger: GoalTrigger;          // 'time' | 'event' | 'condition'
  
  condition?: () => Promise<boolean>;  // For condition-based triggers
  action: () => Promise<GoalResult>;   // What to execute
  schedule?: GoalSchedule;             // For time-based triggers
  
  enabled: boolean;              // Can be disabled without removal
  onError?: (error: Error) => Promise<void>;  // Error handler
  maxRetries?: number;           // Retry limit
}
```

#### 2. **GoalLoop**
The continuous execution engine.

```typescript
class GoalLoop extends EventEmitter {
  async start();                // Start autonomous loop
  async stop();                 // Graceful shutdown
  
  addGoal(goal): string;        // Add new goal, returns ID
  removeGoal(id): boolean;      // Remove goal
  setGoalEnabled(id, enabled);  // Enable/disable goal
  
  getStatus();                  // Get loop status
  triggerGoal(id);              // Manually trigger event-based goal
}
```

#### 3. **Goal Types**

**Time-Based:**
- Execute at specific times or intervals
- Example: Check email every 30 minutes

**Condition-Based:**
- Execute when condition becomes true
- Example: Notify when urgent event detected

**Event-Based:**
- Execute when manually triggered
- Example: Respond to external webhook

---

## Usage

### Basic Example

```typescript
import { GoalLoop, createTimeBasedGoal } from './agents/goal-loop';

// Create goal loop
const goalLoop = new GoalLoop({
  tickInterval: 1000,           // Check every second
  maxConcurrentGoals: 5,        // Max parallel executions
  maxTotalGoals: 100,           // Total goal limit
  enableLogging: true,
});

// Add a time-based goal
const emailGoal = createTimeBasedGoal(
  'Monitor email',
  async () => {
    const urgent = await checkEmail();
    if (urgent.length > 0) {
      await notifyUser(`${urgent.length} urgent emails`);
    }
    return { success: true, message: 'Email checked' };
  },
  {
    interval: 30 * 60 * 1000,   // Every 30 minutes
    priority: 'high',
  }
);

goalLoop.addGoal(emailGoal);

// Start autonomous operation
await goalLoop.start();
```

### Condition-Based Example

```typescript
import { createConditionBasedGoal } from './agents/goal-loop';

const alertGoal = createConditionBasedGoal(
  'Alert on critical event',
  async () => {
    // Check multiple conditions
    const hasUrgent = await checkUrgentEmail();
    const hasMeeting = await checkCalendar();
    return hasUrgent || hasMeeting;
  },
  async () => {
    await sendAlert('Attention needed!');
    return { success: true };
  },
  {
    priority: 'critical',
  }
);

goalLoop.addGoal(alertGoal);
```

### Event Monitoring

```typescript
// Listen to goal lifecycle events
goalLoop.on('goalStarted', (goal) => {
  console.log(`Starting: ${goal.description}`);
});

goalLoop.on('goalCompleted', ({ goal, result }) => {
  console.log(`Completed: ${goal.description} - ${result.message}`);
});

goalLoop.on('goalError', ({ goal, error }) => {
  console.error(`Error in ${goal.description}:`, error);
});
```

---

## Integration with OpenClaw

### Replacing Heartbeat Polling

**Before (Cron-based heartbeat):**
```yaml
schedule:
  kind: every
  everyMs: 1800000  # 30 minutes
payload:
  kind: systemEvent
  text: "Check email, calendar, tasks"
```

**After (Goal-based monitoring):**
```typescript
setupEmailMonitoring(goalLoop);      // Every 30 min
setupTaskReconciliation(goalLoop);   // Every 30 min
setupGitMonitoring(goalLoop);        // Daily
```

**Benefits:**
- Single background process (not multiple cron jobs)
- Intelligent scheduling (skip if condition not met)
- Priority-based execution
- Better resource usage

### Integration Points

#### 1. **Gateway Startup**
Initialize goal loop when gateway starts.

```typescript
// src/gateway/boot.ts
import { setupAutonomousAgent } from '../agents/goal-loop-integration.example';

export async function bootGateway() {
  // ... existing setup ...
  
  // Start autonomous agent
  const goalLoop = setupAutonomousAgent();
  
  // Store reference for shutdown
  gateway.goalLoop = goalLoop;
}
```

#### 2. **Graceful Shutdown**
Stop goal loop when gateway shuts down.

```typescript
// src/gateway/shutdown.ts
export async function shutdownGateway(gateway) {
  // Stop autonomous operations
  if (gateway.goalLoop) {
    await gateway.goalLoop.stop();
  }
  
  // ... existing shutdown ...
}
```

#### 3. **Memory Integration**
Auto-inject relevant context during goal execution.

```typescript
const learningGoal = createTimeBasedGoal(
  'Autonomous learning',
  async () => {
    // Memory system automatically provides context
    const context = await memorySystem.getRelevantContext('learning');
    const results = await conductResearch(context);
    await memorySystem.updateKnowledgeBase(results);
    
    return { success: true };
  },
  { interval: 24 * 60 * 60 * 1000 }
);
```

---

## Configuration

### Goal Loop Options

```typescript
interface GoalLoopConfig {
  tickInterval: number;          // ms between loop iterations (default: 1000)
  maxConcurrentGoals: number;    // max parallel executions (default: 5)
  maxTotalGoals: number;         // max total goals (default: 100)
  enableLogging: boolean;        // log to file (default: true)
  logPath?: string;              // log file path (default: 'memory/autonomous-actions.log')
}
```

### Recommended Settings

**Development:**
```typescript
{
  tickInterval: 1000,      // Fast iteration
  maxConcurrentGoals: 2,   // Easier debugging
  enableLogging: true,     // Full visibility
}
```

**Production:**
```typescript
{
  tickInterval: 1000,      // 1-second responsiveness
  maxConcurrentGoals: 5,   // Balanced performance
  maxTotalGoals: 100,      // Generous limit
  enableLogging: true,     // Audit trail
}
```

**Resource-Constrained:**
```typescript
{
  tickInterval: 5000,      // 5-second ticks (less CPU)
  maxConcurrentGoals: 2,   // Limited parallelism
  maxTotalGoals: 50,       // Tighter limit
  enableLogging: false,    // Skip file I/O
}
```

---

## Safety & Transparency

### Resource Limits

**Max Goals:** 100 (prevents unbounded growth)  
**Max Concurrent:** 5 (CPU/memory protection)  
**Retry Limits:** Configurable per-goal (prevents infinite loops)

### Logging

All autonomous actions logged to `memory/autonomous-actions.log`:

```
[2026-02-10T13:00:00.000Z] GoalLoop started
[2026-02-10T13:00:01.234Z] Executing goal: email_monitor (Monitor email)
[2026-02-10T13:00:02.567Z] Goal completed: email_monitor - 3 urgent emails
[2026-02-10T13:30:01.234Z] Executing goal: task_reconcile (Reconcile tasks)
```

### User Control

**Disable autonomy:**
```typescript
await goalLoop.stop();
```

**Disable specific goal:**
```typescript
goalLoop.setGoalEnabled(goalId, false);
```

**Remove goal:**
```typescript
goalLoop.removeGoal(goalId);
```

### Error Isolation

Goal failures don't crash the system:
- Errors caught and logged
- Retry mechanism (configurable)
- Automatic disable after max retries
- Graceful degradation

---

## Performance

### Benchmarks

**System:** MacBook Pro M1, 16GB RAM

| Metric | Value |
|--------|-------|
| CPU usage (idle) | <1% |
| CPU usage (active) | 2-5% |
| Memory overhead | ~20MB |
| Tick latency | <5ms |
| Goal execution (avg) | 50-200ms |
| Max concurrent goals | 5 (configurable) |

### Optimization Tips

1. **Use condition-based goals** for event detection (more efficient than polling)
2. **Set appropriate intervals** (30 min email check, not 1 min)
3. **Limit concurrent goals** based on CPU cores
4. **Disable logging** on resource-constrained devices
5. **Use priority wisely** (don't make everything 'critical')

---

## Testing

### Run Tests

```bash
pnpm test src/agents/goal-loop.test.ts
```

### Test Coverage

- ✅ Basic operations (start/stop, add/remove)
- ✅ Time-based goals
- ✅ Condition-based goals
- ✅ Priority handling
- ✅ Error handling & retries
- ✅ Concurrency limits
- ✅ Event emission
- ✅ Status reporting

---

## Future Enhancements (Phase 2-4)

### Phase 2: Continuous Memory Context
- Always-loaded semantic memory
- Auto-inject relevant context
- Write-on-think logging

### Phase 3: Parallel Orchestration
- Worker thread execution
- True multitasking
- Background monitoring

### Phase 4: Self-Modification
- Hot-reload personality changes
- A/B testing framework
- Performance-based optimization

---

## FAQ

**Q: Does this replace cron jobs?**  
A: It can! Goal-based scheduling is more flexible and efficient than multiple cron jobs.

**Q: What about battery life on mobile?**  
A: Configure longer tick intervals (5-10 seconds) and fewer concurrent goals.

**Q: Can I disable autonomy temporarily?**  
A: Yes! `await goalLoop.stop()` gracefully shuts down all autonomous behavior.

**Q: How do I debug goal execution?**  
A: Enable logging and listen to events (`goalStarted`, `goalCompleted`, `goalError`).

**Q: What happens if a goal crashes?**  
A: Error is caught, logged, retries attempted, then goal disabled if max retries exceeded.

**Q: Can goals spawn sub-agents?**  
A: Yes! Goal actions can spawn isolated sessions for complex tasks.

---

## Contributing

Found a bug? Have an enhancement idea?

1. Open an issue: https://github.com/openclaw/openclaw/issues
2. Submit a PR with tests
3. Follow existing code style
4. Update documentation

---

## License

MIT License - same as OpenClaw

---

## Acknowledgments

**Inspiration:**
- DeepAgent (Xiaohongshu + RUC) - Memory folding patterns
- AutoGPT - Goal-driven architecture
- BabyAGI - Autonomous task management

**Research:**
- "Psychologically-Enhanced AI Agents" (arXiv)
- "Large Language Model Based Multi-Agents" (DeepAgent paper)
- OpenClaw community feedback and use cases

---

**Let's build Jarvis. 💎🚀**
