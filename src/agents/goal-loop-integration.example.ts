/**
 * Integration examples for Autonomous Goal Loop
 * 
 * This file demonstrates how to integrate the GoalLoop system
 * into OpenClaw for autonomous agent behavior.
 * 
 * @author Gucci (guccichong.888@gmail.com)
 */

import { GoalLoop, createTimeBasedGoal, createConditionBasedGoal } from './goal-loop';
import type { GoalResult } from './goal-loop';

/**
 * Example 1: Email Monitoring
 * 
 * Autonomously check email every 30 minutes during work hours,
 * notify user of urgent messages.
 */
export function setupEmailMonitoring(goalLoop: GoalLoop) {
  const emailGoal = createTimeBasedGoal(
    'Monitor email for urgent messages',
    async (): Promise<GoalResult> => {
      // Check if within work hours (9 AM - 9 PM)
      const hour = new Date().getHours();
      if (hour < 9 || hour >= 21) {
        return { 
          success: true, 
          message: 'Outside work hours, skipping',
          shouldReschedule: true,
        };
      }

      try {
        // TODO: Integrate with actual email service
        // const urgentEmails = await checkEmailService();
        
        // if (urgentEmails.length > 0) {
        //   await notifyUser(`${urgentEmails.length} urgent emails`);
        // }

        return { 
          success: true, 
          message: `Email check complete`,
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Email check failed: ${error}`,
        };
      }
    },
    {
      type: 'monitor',
      priority: 'high',
      interval: 30 * 60 * 1000, // 30 minutes
      startDelay: 60 * 1000, // Start after 1 minute
    }
  );

  goalLoop.addGoal(emailGoal);
}

/**
 * Example 2: Proactive Learning
 * 
 * Autonomously research topics during idle time (3 AM daily)
 */
export function setupProactiveLearning(goalLoop: GoalLoop) {
  const learningGoal = createTimeBasedGoal(
    'Daily autonomous learning session',
    async (): Promise<GoalResult> => {
      try {
        // Check if it's 3 AM
        const hour = new Date().getHours();
        if (hour !== 3) {
          return { 
            success: true, 
            message: 'Not 3 AM yet',
            shouldReschedule: true,
          };
        }

        // TODO: Integrate with research system
        // const topics = await identifyLearningTopics();
        // const researchResults = await conductResearch(topics);
        // await updateKnowledgeBase(researchResults);

        return { 
          success: true, 
          message: 'Learning session complete',
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Learning failed: ${error}`,
        };
      }
    },
    {
      type: 'learn',
      priority: 'normal',
      interval: 24 * 60 * 60 * 1000, // 24 hours
      startDelay: getMillisecondsUntil3AM(),
    }
  );

  goalLoop.addGoal(learningGoal);
}

/**
 * Example 3: Task Reconciliation
 * 
 * Check Kanban board every 30 minutes, update stalled tasks
 */
export function setupTaskReconciliation(goalLoop: GoalLoop) {
  const taskGoal = createTimeBasedGoal(
    'Reconcile Kanban tasks',
    async (): Promise<GoalResult> => {
      try {
        // TODO: Integrate with Kanban system
        // const stalledTasks = await checkKanbanBoard();
        
        // if (stalledTasks.length > 0) {
        //   await updateTaskStatuses(stalledTasks);
        //   await notifyUser(`Updated ${stalledTasks.length} stalled tasks`);
        // }

        return { 
          success: true, 
          message: 'Task reconciliation complete',
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Task reconciliation failed: ${error}`,
        };
      }
    },
    {
      type: 'optimize',
      priority: 'normal',
      interval: 30 * 60 * 1000, // 30 minutes
    }
  );

  goalLoop.addGoal(taskGoal);
}

/**
 * Example 4: Git Monitoring
 * 
 * Check for uncommitted changes daily
 */
export function setupGitMonitoring(goalLoop: GoalLoop) {
  const gitGoal = createTimeBasedGoal(
    'Check for uncommitted git changes',
    async (): Promise<GoalResult> => {
      try {
        // TODO: Integrate with git
        // const { exec } = await import('node:child_process');
        // const { promisify } = await import('node:util');
        // const execAsync = promisify(exec);
        
        // const { stdout } = await execAsync('git status --short');
        
        // if (stdout.trim()) {
        //   await notifyUser('Uncommitted git changes detected');
        // }

        return { 
          success: true, 
          message: 'Git check complete',
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Git check failed: ${error}`,
        };
      }
    },
    {
      type: 'monitor',
      priority: 'low',
      interval: 24 * 60 * 60 * 1000, // 24 hours
    }
  );

  goalLoop.addGoal(gitGoal);
}

/**
 * Example 5: Condition-Based Notification
 * 
 * Notify user when specific conditions are met
 */
export function setupConditionBasedNotification(goalLoop: GoalLoop) {
  const notificationGoal = createConditionBasedGoal(
    'Notify user of important events',
    async () => {
      // TODO: Check multiple conditions
      // const hasUrgentEmail = await checkUrgentEmail();
      // const hasUpcomingMeeting = await checkCalendar();
      // const hasSystemAlert = await checkSystemHealth();
      
      // return hasUrgentEmail || hasUpcomingMeeting || hasSystemAlert;
      return false;
    },
    async (): Promise<GoalResult> => {
      try {
        // TODO: Send notification
        // await notifyUser('Important event requires attention');

        return { 
          success: true, 
          message: 'Notification sent',
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Notification failed: ${error}`,
        };
      }
    },
    {
      type: 'communicate',
      priority: 'critical',
    }
  );

  goalLoop.addGoal(notificationGoal);
}

/**
 * Example 6: Memory Maintenance
 * 
 * Periodically review and fold memory during quiet hours
 */
export function setupMemoryMaintenance(goalLoop: GoalLoop) {
  const memoryGoal = createTimeBasedGoal(
    'Review and fold memory files',
    async (): Promise<GoalResult> => {
      try {
        // TODO: Integrate with memory system
        // const dailyFiles = await getDailyMemoryFiles();
        // const insights = await extractInsights(dailyFiles);
        // await updateLongTermMemory(insights);

        return { 
          success: true, 
          message: 'Memory maintenance complete',
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Memory maintenance failed: ${error}`,
        };
      }
    },
    {
      type: 'optimize',
      priority: 'low',
      interval: 7 * 24 * 60 * 60 * 1000, // Weekly
      startDelay: getMillisecondsUntil3AM(),
    }
  );

  goalLoop.addGoal(memoryGoal);
}

/**
 * Complete integration setup
 * 
 * This function sets up all autonomous behaviors for a Jarvis-level assistant
 */
export function setupAutonomousAgent(): GoalLoop {
  const goalLoop = new GoalLoop({
    tickInterval: 1000, // Check every second
    maxConcurrentGoals: 5,
    maxTotalGoals: 100,
    enableLogging: true,
    logPath: 'memory/autonomous-actions.log',
  });

  // Set up all autonomous behaviors
  setupEmailMonitoring(goalLoop);
  setupProactiveLearning(goalLoop);
  setupTaskReconciliation(goalLoop);
  setupGitMonitoring(goalLoop);
  setupConditionBasedNotification(goalLoop);
  setupMemoryMaintenance(goalLoop);

  // Listen to events for debugging/monitoring
  goalLoop.on('goalStarted', (goal) => {
    console.log(`[Autonomous] Starting: ${goal.description}`);
  });

  goalLoop.on('goalCompleted', ({ goal, result }) => {
    console.log(`[Autonomous] Completed: ${goal.description} - ${result.message}`);
  });

  goalLoop.on('goalError', ({ goal, error }) => {
    console.error(`[Autonomous] Error in ${goal.description}:`, error);
  });

  // Start the loop
  goalLoop.start().catch(console.error);

  return goalLoop;
}

/**
 * Helper: Calculate milliseconds until 3 AM
 */
function getMillisecondsUntil3AM(): number {
  const now = new Date();
  const target = new Date(now);
  
  target.setHours(3, 0, 0, 0);
  
  // If 3 AM already passed today, target tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}

/**
 * Example: Graceful shutdown
 */
export async function shutdownAutonomousAgent(goalLoop: GoalLoop) {
  console.log('[Autonomous] Shutting down gracefully...');
  await goalLoop.stop();
  console.log('[Autonomous] Shutdown complete');
}
