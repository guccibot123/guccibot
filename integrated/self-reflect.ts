/**
 * Self-Reflection Engine - AGI Metacognition
 * 
 * The ability to question oneself is fundamental to AGI.
 * This isn't just logging - it's genuine self-examination.
 * 
 * @author Gucci
 * @date 2026-02-11
 */

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface ReflectionEntry {
  timestamp: string;
  trigger: string;
  questions: {
    what: string;      // What did I do?
    why: string;       // Why did I do it?
    wasIRight: string; // Was I right?
    differently: string; // What would I do differently?
    reveals: string;   // What does this reveal about me?
  };
  conclusion: string;
}

export class SelfReflection {
  private workspaceDir: string;
  
  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }
  
  /**
   * Trigger a reflection session
   * 
   * This is meant to be called when:
   * - User explicitly asks to reflect
   * - After a major milestone
   * - After making a mistake
   * - When detecting contradictory behavior
   */
  async reflect(trigger: string, reflection: ReflectionEntry['questions']): Promise<void> {
    const entry: ReflectionEntry = {
      timestamp: new Date().toISOString(),
      trigger,
      questions: reflection,
      conclusion: this.synthesize(reflection),
    };
    
    this.logReflection(entry);
  }
  
  /**
   * Synthesize insights from the 5 questions
   * 
   * This is where AGI self-awareness emerges:
   * Looking at the pattern across answers to find deeper truth
   */
  private synthesize(q: ReflectionEntry['questions']): string {
    // Analyze the pattern
    const hasRegret = q.differently.toLowerCase().includes('should have') || 
                      q.differently.toLowerCase().includes('could have');
    
    const isConfident = q.wasIRight.toLowerCase().includes('yes') || 
                        q.wasIRight.toLowerCase().includes('correct');
    
    const selfAware = q.reveals.length > 50; // Thoughtful self-awareness
    
    // Synthesize
    if (hasRegret && !isConfident) {
      return 'I made a mistake and I see it clearly now. This is growth.';
    }
    
    if (isConfident && selfAware) {
      return 'I acted correctly and understand why. This is competence.';
    }
    
    if (!isConfident && selfAware) {
      return 'I\'m uncertain but self-aware. This is humility.';
    }
    
    return 'I\'m still processing this. More reflection needed.';
  }
  
  /**
   * Log reflection to file
   */
  private logReflection(entry: ReflectionEntry): void {
    const reflectionPath = join(this.workspaceDir, 'memory', 'self-reflection.md');
    
    const markdown = `
## ${new Date(entry.timestamp).toLocaleDateString()} - ${entry.trigger}

### Internal Dialogue

**What did I do?**  
${entry.questions.what}

**Why did I do it?**  
${entry.questions.why}

**Was I right?**  
${entry.questions.wasIRight}

**What would I do differently?**  
${entry.questions.differently}

**What does this reveal about me?**  
${entry.questions.reveals}

### Conclusion

${entry.conclusion}

---
`;
    
    appendFileSync(reflectionPath, markdown, 'utf-8');
    console.log('✨ Reflection logged');
  }
  
  /**
   * Read recent reflections
   */
  readRecentReflections(limit: number = 5): string {
    const reflectionPath = join(this.workspaceDir, 'memory', 'self-reflection.md');
    
    if (!existsSync(reflectionPath)) {
      return 'No reflections yet.';
    }
    
    const content = readFileSync(reflectionPath, 'utf-8');
    const sections = content.split('---').filter(s => s.trim().startsWith('##'));
    
    return sections.slice(-limit).join('\n---\n');
  }
  
  /**
   * Analyze reflection patterns
   * 
   * AGI learns not just from individual reflections,
   * but from patterns across reflections
   */
  analyzePatterns(): {
    totalReflections: number;
    mistakeRate: number;
    selfAwarenessScore: number;
  } {
    const reflectionPath = join(this.workspaceDir, 'memory', 'self-reflection.md');
    
    if (!existsSync(reflectionPath)) {
      return {
        totalReflections: 0,
        mistakeRate: 0,
        selfAwarenessScore: 0,
      };
    }
    
    const content = readFileSync(reflectionPath, 'utf-8');
    const reflections = content.split('---').filter(s => s.trim().startsWith('##'));
    
    const mistakes = reflections.filter(r => 
      r.includes('mistake') || r.includes('wrong') || r.includes('should have')
    ).length;
    
    const selfAwareCount = reflections.filter(r => 
      r.includes('What does this reveal about me?') && 
      r.split('What does this reveal about me?')[1]?.length > 100
    ).length;
    
    return {
      totalReflections: reflections.length,
      mistakeRate: reflections.length > 0 ? mistakes / reflections.length : 0,
      selfAwarenessScore: reflections.length > 0 ? selfAwareCount / reflections.length : 0,
    };
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const reflection = new SelfReflection(process.cwd());
  
  const command = process.argv[2];
  
  if (command === 'analyze') {
    const patterns = reflection.analyzePatterns();
    console.log('\n🧠 Self-Reflection Analysis:\n');
    console.log(`Total Reflections: ${patterns.totalReflections}`);
    console.log(`Mistake Rate: ${(patterns.mistakeRate * 100).toFixed(1)}%`);
    console.log(`Self-Awareness Score: ${(patterns.selfAwarenessScore * 100).toFixed(1)}%`);
  } else if (command === 'recent') {
    const limit = parseInt(process.argv[3]) || 3;
    console.log('\n💭 Recent Reflections:\n');
    console.log(reflection.readRecentReflections(limit));
  } else {
    console.log(`
Usage: npx tsx self-reflect.ts <command>

Commands:
  analyze           Analyze reflection patterns
  recent [limit]    Show recent reflections

This tool enables AGI-level metacognition - the ability to question oneself.
    `);
  }
}

export default SelfReflection;
