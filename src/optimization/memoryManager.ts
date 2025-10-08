/**
 * Historical Memory Manager for Bayesian Optimization
 *
 * Accumulates knowledge from successful optimization runs and provides
 * context-aware historical data for faster future optimizations.
 *
 * Key Features:
 * - Post-run memory accumulation (quality-gated)
 * - Context-aware matching (demand parameter similarity)
 * - Self-improving over time (best solutions accumulate)
 * - Automatic pruning of outdated data
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PolicyParameters } from './policyEngine.js';

/**
 * Demand context for matching similar scenarios
 */
export interface DemandContext {
  customDemandMean1: number;
  customDemandStdDev1: number;
  customDemandMean2: number;
  customDemandStdDev2: number;
  standardDemandIntercept: number;
  standardDemandSlope: number;
}

/**
 * Single historical evaluation record
 */
export interface MemoryEvaluation {
  id: string;
  policy: PolicyParameters;
  fitness: number;
  netWorth: number;
  demandContext: DemandContext;
  timestamp: string;
  totalIterations: number;
  simVersion: string;
}

/**
 * Memory storage structure
 */
export interface OptimizationMemory {
  simVersion: string;
  evaluations: MemoryEvaluation[];
  stats: {
    totalRuns: number;
    avgFitness: number;
    topFitness: number;
    lastUpdated: string;
  };
}

/**
 * Memory Manager - Handles all memory operations
 */
export class MemoryManager {
  private memoryPath: string;
  private currentVersion: string = '1.0.0'; // TODO: Get from package.json

  constructor(memoryPath?: string) {
    // Default to project root
    this.memoryPath = memoryPath || path.join(process.cwd(), 'optimization-memory.json');
  }

  /**
   * Load memory from disk
   */
  load(): OptimizationMemory {
    try {
      if (!fs.existsSync(this.memoryPath)) {
        return this.createEmptyMemory();
      }

      const data = fs.readFileSync(this.memoryPath, 'utf-8');
      const memory: OptimizationMemory = JSON.parse(data);

      // Prune outdated evaluations (different sim version)
      memory.evaluations = memory.evaluations.filter(
        (evaluation) => evaluation.simVersion === this.currentVersion
      );

      return memory;
    } catch (error) {
      console.error('Failed to load memory, creating new:', error);
      return this.createEmptyMemory();
    }
  }

  /**
   * Save memory to disk
   */
  save(memory: OptimizationMemory): void {
    try {
      const data = JSON.stringify(memory, null, 2);
      fs.writeFileSync(this.memoryPath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save memory:', error);
      throw error;
    }
  }

  /**
   * Add new evaluation to memory (with quality gating)
   */
  addEvaluation(
    policy: PolicyParameters,
    fitness: number,
    netWorth: number,
    demandContext: DemandContext,
    totalIterations: number
  ): boolean {
    const memory = this.load();

    // Quality gate: Only save if fitness > 80% of average
    if (memory.evaluations.length > 5) {
      const threshold = memory.stats.avgFitness * 0.8;
      if (fitness < threshold) {
        console.log(`Evaluation below quality threshold (${fitness} < ${threshold}), not saving`);
        return false;
      }
    }

    // Create new evaluation
    const evaluation: MemoryEvaluation = {
      id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      policy,
      fitness,
      netWorth,
      demandContext,
      timestamp: new Date().toISOString(),
      totalIterations,
      simVersion: this.currentVersion,
    };

    // Add to memory
    memory.evaluations.push(evaluation);

    // Update stats
    this.updateStats(memory);

    // Save to disk
    this.save(memory);

    console.log(`✅ Added evaluation to memory (fitness: ${fitness}, total runs: ${memory.stats.totalRuns})`);
    return true;
  }

  /**
   * Get evaluations matching demand context (within similarity threshold)
   */
  getMatchingEvaluations(
    demandContext: DemandContext,
    similarityThreshold: number = 0.95
  ): MemoryEvaluation[] {
    const memory = this.load();

    return memory.evaluations.filter((evaluation) => {
      const similarity = this.calculateDemandSimilarity(demandContext, evaluation.demandContext);
      return similarity >= similarityThreshold;
    });
  }

  /**
   * Get memory statistics
   */
  getStats(): OptimizationMemory['stats'] {
    const memory = this.load();
    return memory.stats;
  }

  /**
   * Clear all memory
   */
  clear(): void {
    const memory = this.createEmptyMemory();
    this.save(memory);
    console.log('🗑️  Memory cleared');
  }

  /**
   * Get top N policies by fitness
   */
  getTopPolicies(n: number = 10, demandContext?: DemandContext): PolicyParameters[] {
    let evaluations: MemoryEvaluation[];

    if (demandContext) {
      evaluations = this.getMatchingEvaluations(demandContext);
    } else {
      const memory = this.load();
      evaluations = memory.evaluations;
    }

    return evaluations
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, n)
      .map((evaluation) => evaluation.policy);
  }

  /**
   * Calculate similarity between two demand contexts
   * Returns 0-1, where 1 = identical, 0 = completely different
   */
  private calculateDemandSimilarity(context1: DemandContext, context2: DemandContext): number {
    const params: (keyof DemandContext)[] = [
      'customDemandMean1',
      'customDemandStdDev1',
      'customDemandMean2',
      'customDemandStdDev2',
      'standardDemandIntercept',
      'standardDemandSlope',
    ];

    let totalDifference = 0;

    for (const param of params) {
      const val1 = context1[param];
      const val2 = context2[param];

      // Calculate percentage difference
      const avgValue = (Math.abs(val1) + Math.abs(val2)) / 2;
      const difference = avgValue > 0 ? Math.abs(val1 - val2) / avgValue : 0;

      totalDifference += difference;
    }

    // Average difference across all parameters
    const avgDifference = totalDifference / params.length;

    // Convert to similarity (1 - difference)
    return Math.max(0, 1 - avgDifference);
  }

  /**
   * Update memory statistics
   */
  private updateStats(memory: OptimizationMemory): void {
    memory.stats.totalRuns = memory.evaluations.length;
    memory.stats.avgFitness =
      memory.evaluations.reduce((sum, e) => sum + e.fitness, 0) / memory.evaluations.length || 0;
    memory.stats.topFitness =
      Math.max(...memory.evaluations.map((e) => e.fitness), 0);
    memory.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Create empty memory structure
   */
  private createEmptyMemory(): OptimizationMemory {
    return {
      simVersion: this.currentVersion,
      evaluations: [],
      stats: {
        totalRuns: 0,
        avgFitness: 0,
        topFitness: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const memoryManager = new MemoryManager();
