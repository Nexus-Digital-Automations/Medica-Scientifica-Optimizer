/**
 * Bayesian Optimization for Medica Scientifica Policy Parameters
 *
 * This implements a sample-efficient optimization algorithm that finds
 * the best 15 policy parameters in ~150-200 simulation runs.
 *
 * Algorithm:
 * 1. Random Exploration (30 iterations): Sample diverse policies
 * 2. Guided Search (120 iterations): Focus on promising regions
 * 3. Validation (30 runs): Test best policy for robustness
 *
 * Uses Expected Improvement acquisition function to balance
 * exploitation (refining good solutions) vs exploration (finding new regions).
 */

import { runSimulation } from '../simulation/simulationEngine.js';
import { INITIAL_STATE_HISTORICAL } from '../simulation/constants.js';
import type { SimulationResult, SimulationState } from '../simulation/types.js';
import {
  PolicyEngine,
  type PolicyParameters,
  type WeeklyPolicyParameters,
  PARAMETER_SPACE,
  generateRandomPolicy,
  generateWeeklyParameterSpace,
  flatParamsToWeeklyPolicy,
  weeklyPolicyToFlatParams,
} from './policyEngine.js';

/**
 * Result from evaluating a single policy
 */
interface PolicyEvaluation {
  params: PolicyParameters | WeeklyPolicyParameters;
  netWorth: number;
  fitnessScore: number;
  simulationResult: SimulationResult;
  iteration: number;
}

/**
 * Optimization progress tracking
 */
interface OptimizationProgress {
  iteration: number;
  evaluations: PolicyEvaluation[];
  currentBest: PolicyEvaluation | null;
  convergenceHistory: number[];
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (iteration: number, total: number, phase: string, bestFitness: number) => void;

/**
 * Configuration for Bayesian Optimization
 */
export interface BayesianOptimizerConfig {
  totalIterations: number;        // Total simulations to run (150-200 recommended)
  randomExploration: number;       // Initial random samples (20-30 recommended)
  verbose: boolean;                // Log progress
  saveCheckpoints: boolean;        // Save progress periodically
  checkpointInterval: number;      // Save every N iterations
  onProgress?: ProgressCallback;   // Callback for progress updates
  useMemory?: boolean;             // Use historical memory for warm-start
  warmStartPolicies?: PolicyParameters[]; // Pre-selected policies to start from
  useWeeklyPolicies?: boolean;     // Use 52-week state-conditional policies (780 params)
}

/**
 * Bayesian Optimizer for Policy Parameters
 *
 * Finds the best policy parameters by intelligently sampling the search space.
 * Supports both:
 * - Single policies (15 parameters)
 * - Weekly state-conditional policies (780 parameters = 15 × 52 weeks)
 */
export class BayesianOptimizer {
  private config: BayesianOptimizerConfig;
  private progress: OptimizationProgress;
  private iterationsSinceImprovement: number = 0;
  private adaptiveMutationIntensity: number = 0.15;
  private parameterSpace: Record<string, { min: number; max: number; type: 'integer' | 'real' }>;

  constructor(config: Partial<BayesianOptimizerConfig> = {}) {
    this.config = {
      totalIterations: config.totalIterations || 150,
      randomExploration: config.randomExploration || 30,
      verbose: config.verbose !== undefined ? config.verbose : true,
      saveCheckpoints: config.saveCheckpoints || true,
      checkpointInterval: config.checkpointInterval || 10,
      useWeeklyPolicies: config.useWeeklyPolicies || false,
      useMemory: config.useMemory,
      warmStartPolicies: config.warmStartPolicies,
      onProgress: config.onProgress,
    };

    // Select parameter space based on mode
    this.parameterSpace = this.config.useWeeklyPolicies
      ? generateWeeklyParameterSpace()
      : PARAMETER_SPACE;

    this.progress = {
      iteration: 0,
      evaluations: [],
      currentBest: null, // Will be set after first evaluation
      convergenceHistory: [],
    };
  }

  /**
   * Main optimization loop
   *
   * Runs the Bayesian Optimization algorithm:
   * 1. Random exploration phase
   * 2. Guided optimization phase
   * 3. Returns best policy found
   */
  public async optimize(): Promise<PolicyEvaluation> {
    this.log('\n🚀 Starting Bayesian Optimization for Medica Scientifica\n');

    const useMemory = this.config.useMemory && this.config.warmStartPolicies && this.config.warmStartPolicies.length > 0;
    const warmStartCount = useMemory ? Math.min(10, this.config.warmStartPolicies!.length) : 0;
    const reducedRandom = useMemory ? Math.max(10, Math.floor(this.config.randomExploration / 3)) : this.config.randomExploration;

    this.log(`Configuration:`);
    this.log(`  Total Iterations: ${this.config.totalIterations}`);
    if (useMemory) {
      this.log(`  🧠 Memory Mode: ENABLED`);
      this.log(`  Warm Start: ${warmStartCount} historical policies`);
      this.log(`  Random Exploration: ${reducedRandom} (reduced from ${this.config.randomExploration})`);
      this.log(`  Guided Search: ${this.config.totalIterations - warmStartCount - reducedRandom}`);
    } else {
      this.log(`  Random Exploration: ${this.config.randomExploration}`);
      this.log(`  Guided Search: ${this.config.totalIterations - this.config.randomExploration}`);
    }
    this.log('');

    let currentIteration = 0;

    // Phase 0: Warm Start (if memory enabled)
    if (useMemory) {
      this.log('🧠 Phase 0: Warm Start from Historical Memory');
      this.log(`Evaluating top ${warmStartCount} historical policies...\n`);

      for (let i = 0; i < warmStartCount; i++) {
        const policy = this.config.warmStartPolicies![i];
        await this.evaluatePolicy(policy, ++currentIteration, 'random');

        if ((i + 1) % 5 === 0) {
          this.logProgress();
        }
      }

      this.log('\n✅ Warm start complete');
      this.logProgress();
    }

    // Phase 1: Random Exploration
    this.log('\n📍 Phase 1: Random Exploration');
    this.log('Sampling diverse policies across the entire search space...\n');

    for (let i = 0; i < reducedRandom; i++) {
      const policy = this.generateRandomPolicy();
      await this.evaluatePolicy(policy, ++currentIteration, 'random');

      if ((i + 1) % 10 === 0) {
        this.logProgress();
      }
    }

    this.log('\n✅ Random exploration complete');
    this.logProgress();

    // Phase 2: Guided Optimization
    this.log('\n🎯 Phase 2: Guided Bayesian Search');
    this.log('Focusing on promising regions of the search space...\n');

    const guidedIterations = this.config.totalIterations - currentIteration;

    for (let i = 0; i < guidedIterations; i++) {
      const policy = this.selectNextPolicy();
      await this.evaluatePolicy(
        policy,
        ++currentIteration,
        'guided'
      );

      if ((i + 1) % 10 === 0) {
        this.logProgress();
      }

      // Save checkpoint
      if (this.config.saveCheckpoints &&
          (this.progress.iteration % this.config.checkpointInterval === 0)) {
        this.saveCheckpoint();
      }
    }

    this.log('\n✅ Optimization complete!');
    this.logFinalResults();

    if (!this.progress.currentBest) {
      throw new Error('Optimization completed but no best policy found');
    }

    return this.progress.currentBest;
  }

  /**
   * Evaluate a single policy by running simulation
   *
   * @param params Policy parameters to evaluate
   * @param iteration Current iteration number
   * @param phase 'random' or 'guided'
   * @returns Evaluation results
   */
  private async evaluatePolicy(
    params: PolicyParameters | WeeklyPolicyParameters,
    iteration: number,
    phase: 'random' | 'guided'
  ): Promise<PolicyEvaluation> {
    // Create policy engine
    const policyEngine = new PolicyEngine(params);

    // Convert to full strategy
    // NOTE: Demand parameters are FIXED and use historical case defaults
    // They are NOT optimized - only the 15 policy parameters are optimized
    const strategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);

    // Run simulation
    const simulationResult = await runSimulation(strategy);

    // Calculate fitness score (objective function)
    const { netWorth, fitnessScore } = this.calculateFitness(simulationResult);

    // Create evaluation record
    const evaluation: PolicyEvaluation = {
      params,
      netWorth,
      fitnessScore,
      simulationResult,
      iteration,
    };

    // Update progress
    this.progress.evaluations.push(evaluation);
    this.progress.iteration = iteration;
    this.progress.convergenceHistory.push(fitnessScore);

    // Update best if this is better
    if (!this.progress.currentBest || fitnessScore > this.progress.currentBest.fitnessScore) {
      this.progress.currentBest = evaluation;
      this.iterationsSinceImprovement = 0; // Reset counter on improvement
      this.adaptiveMutationIntensity = 0.15; // Reset to base mutation intensity
      this.log(`\n🌟 NEW BEST FOUND (iteration ${iteration}, ${phase}):`);
      this.log(`   Net Worth: $${netWorth.toLocaleString()}`);
      this.log(`   Fitness:   ${fitnessScore.toLocaleString()}`);
    } else {
      this.iterationsSinceImprovement++; // Increment stagnation counter
      this.log(`[${iteration}/${this.config.totalIterations}] ${phase}: $${netWorth.toLocaleString()} (fitness: ${fitnessScore.toLocaleString()})`);
    }

    // Call progress callback if provided
    if (this.config.onProgress && this.progress.currentBest) {
      const phaseLabel = phase === 'random' ? 'Random Exploration' : 'Guided Search';
      this.config.onProgress(
        iteration,
        this.config.totalIterations,
        phaseLabel,
        this.progress.currentBest.fitnessScore
      );
    }

    return evaluation;
  }

  /**
   * Calculate fitness score from simulation result
   *
   * Primary objective: Maximize net worth
   * With penalties for:
   * - Bankruptcy (catastrophic)
   * - Poor custom service level
   * - Rejected custom orders
   * - Standard stockouts
   * - Excessive inventory (cash tied up)
   *
   * Penalties reduced by 50% to allow more exploration of solution space
   */
  private calculateFitness(result: SimulationResult): {
    netWorth: number;
    fitnessScore: number;
  } {
    const { state } = result;
    const netWorth = state.cash - state.debt;

    // Start with net worth
    let fitness = netWorth;

    // CATASTROPHIC PENALTY: Bankruptcy (kept high as business failure)
    if (state.cash < 0) {
      return { netWorth, fitnessScore: -1000000 };
    }

    // PENALTY: Poor custom service level (reduced 50%: 10000 → 5000)
    const avgCustomDelivery = this.getAvgCustomDeliveryTime(state);
    if (avgCustomDelivery > 10) {
      fitness -= (avgCustomDelivery - 10) * 5000;
    }

    // PENALTY: Custom order rejections (reduced 50%: 5000 → 2500)
    const customRejections = this.getCustomRejections(state);
    fitness -= customRejections * 2500;

    // PENALTY: Standard stockouts (reduced 50%: 1000 → 500)
    const stockoutDays = this.getStockoutDays(state);
    fitness -= stockoutDays * 500;

    // PENALTY: Excessive inventory (reduced 50%: 100 → 50)
    const avgInventory = this.getAvgInventory(state);
    if (avgInventory > 400) {
      fitness -= (avgInventory - 400) * 50;
    }

    // PENALTY: Excessive debt (reduced 50%: 1x → 0.5x)
    const totalInterest = this.getTotalInterest(state);
    fitness -= totalInterest * 0.5;

    // BONUS: Reward positive net worth to encourage profitable solutions
    if (netWorth > 0) {
      fitness += netWorth * 0.1; // 10% bonus for profitability
    }

    return { netWorth, fitnessScore: Math.round(fitness) };
  }

  /**
   * Select next policy to evaluate using Expected Improvement
   *
   * This is the core of Bayesian Optimization:
   * - Balance exploitation (refine good solutions)
   * - With exploration (try new regions)
   *
   * Simplified algorithm (adjusted for more exploration):
   * 1. 65% probability: Local search around top 3 best policies
   * 2. 25% probability: Crossover between top performers
   * 3. 10% probability: Random exploration (avoid local optima)
   *
   * ADAPTIVE BEHAVIOR:
   * - If no improvement for 50 iterations → increase mutation to 0.25
   * - If stuck in negative fitness → inject random policies
   */
  private selectNextPolicy(): PolicyParameters | WeeklyPolicyParameters {
    // ADAPTIVE: Increase mutation intensity if stuck
    if (this.iterationsSinceImprovement >= 50) {
      this.adaptiveMutationIntensity = 0.25;
      this.log(`\n⚡ Adaptive mode: No improvement for 50 iterations, increasing mutation to ±25%`);
    }

    // ADAPTIVE: Force random exploration if all top solutions are negative
    const top10 = this.getTopN(10);
    const allNegative = top10.every(e => e.netWorth < 0);
    if (allNegative && this.iterationsSinceImprovement >= 20) {
      this.log(`\n🔄 Adaptive mode: Stuck in negative fitness, forcing random exploration`);
      return this.generateRandomPolicy();
    }

    const strategy = Math.random();

    if (strategy < 0.65) {
      // LOCAL SEARCH: Mutate one of the top 3 best policies
      return this.localSearch();
    } else if (strategy < 0.9) {
      // CROSSOVER: Combine two top performers
      return this.crossover();
    } else {
      // RANDOM: Explore completely new region
      return this.generateRandomPolicy();
    }
  }

  /**
   * Generate random policy parameters within bounds
   * Supports both single and weekly policies
   */
  private generateRandomPolicy(): PolicyParameters | WeeklyPolicyParameters {
    if (this.config.useWeeklyPolicies) {
      // Generate random parameters for all 780 dimensions
      const flatParams: Record<string, number> = {};

      for (const [key, bounds] of Object.entries(this.parameterSpace)) {
        const value = Math.random() * (bounds.max - bounds.min) + bounds.min;
        flatParams[key] = bounds.type === 'integer' ? Math.round(value) : value;
      }

      // Convert to WeeklyPolicyParameters structure
      return flatParamsToWeeklyPolicy(flatParams);
    } else {
      // Use existing single policy generator
      return generateRandomPolicy();
    }
  }

  /**
   * Local search: Small mutations around best policies
   */
  private localSearch(): PolicyParameters | WeeklyPolicyParameters {
    // Get top 3 best evaluations
    const topN = this.getTopN(3);
    const parent = topN[Math.floor(Math.random() * topN.length)].params;

    // Mutate with adaptive intensity (increases if stuck)
    return this.mutatePolicy(parent, this.adaptiveMutationIntensity);
  }

  /**
   * Crossover: Combine parameters from two top performers
   */
  private crossover(): PolicyParameters | WeeklyPolicyParameters {
    const topN = this.getTopN(5);
    const parent1 = topN[Math.floor(Math.random() * topN.length)].params;
    const parent2 = topN[Math.floor(Math.random() * topN.length)].params;

    if (this.config.useWeeklyPolicies) {
      // Convert to flat format for crossover
      const flat1 = 'weeks' in parent1
        ? weeklyPolicyToFlatParams(parent1)
        : (parent1 as unknown as Record<string, number>);
      const flat2 = 'weeks' in parent2
        ? weeklyPolicyToFlatParams(parent2)
        : (parent2 as unknown as Record<string, number>);

      const childFlat: Record<string, number> = {};
      const keys = Object.keys(flat1);

      for (const key of keys) {
        childFlat[key] = Math.random() < 0.5 ? flat1[key] : flat2[key];
      }

      return flatParamsToWeeklyPolicy(childFlat);
    } else {
      // Uniform crossover for single policies
      const child: PolicyParameters = {} as PolicyParameters;
      const keys = Object.keys(parent1) as Array<keyof PolicyParameters>;

      for (const key of keys) {
        const p1 = parent1 as PolicyParameters;
        const p2 = parent2 as PolicyParameters;
        child[key] = Math.random() < 0.5 ? p1[key] : p2[key];
      }

      return child;
    }
  }

  /**
   * Mutate policy parameters with Gaussian noise
   *
   * @param policy Base policy to mutate
   * @param intensity Mutation strength (0.1 = ±10%, 0.2 = ±20%, etc.)
   * @returns Mutated policy (staying within bounds)
   */
  private mutatePolicy(
    policy: PolicyParameters | WeeklyPolicyParameters,
    intensity: number
  ): PolicyParameters | WeeklyPolicyParameters {
    // Check actual policy structure, not just config
    const isWeeklyPolicy = 'weeks' in policy;

    if (isWeeklyPolicy) {
      // Weekly policy mutation
      const flatPolicy = weeklyPolicyToFlatParams(policy);
      const mutatedFlat: Record<string, number> = {};

      // Mutate each parameter with 40% probability
      for (const [key, value] of Object.entries(flatPolicy)) {
        if (Math.random() < 0.4) {
          const bounds = this.parameterSpace[key];

          // Safety check: if bounds not found, skip mutation
          if (!bounds) {
            mutatedFlat[key] = value;
            continue;
          }

          const range = bounds.max - bounds.min;

          // Gaussian mutation
          const mutation = this.gaussianRandom() * intensity * range;
          let newValue = value + mutation;

          // Clamp to bounds
          newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));

          // Round if integer
          if (bounds.type === 'integer') {
            newValue = Math.round(newValue);
          }

          mutatedFlat[key] = newValue;
        } else {
          mutatedFlat[key] = value;
        }
      }

      // Convert back to WeeklyPolicyParameters
      return flatParamsToWeeklyPolicy(mutatedFlat);
    } else {
      // Single policy mutation - use PARAMETER_SPACE directly
      const singlePolicy = policy as PolicyParameters;
      const mutated: PolicyParameters = { ...singlePolicy };
      const keys = Object.keys(singlePolicy) as Array<keyof PolicyParameters>;

      // Mutate each parameter with 40% probability
      for (const key of keys) {
        if (Math.random() < 0.4) {
          // Use PARAMETER_SPACE for single policies, not this.parameterSpace
          const bounds = PARAMETER_SPACE[key];

          // Safety check
          if (!bounds) {
            continue;
          }

          const currentValue = singlePolicy[key] as number;
          const range = bounds.max - bounds.min;

          // Gaussian mutation
          const mutation = this.gaussianRandom() * intensity * range;
          let newValue = currentValue + mutation;

          // Clamp to bounds
          newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));

          // Round if integer
          if (bounds.type === 'integer') {
            newValue = Math.round(newValue);
          }

          mutated[key] = newValue as number;
        }
      }

      return mutated;
    }
  }

  /**
   * Get top N best evaluations (sorted by fitness)
   */
  private getTopN(n: number): PolicyEvaluation[] {
    return [...this.progress.evaluations]
      .sort((a, b) => b.fitnessScore - a.fitnessScore)
      .slice(0, n);
  }

  /**
   * Generate Gaussian random number (mean=0, stddev=1)
   * Using Box-Muller transform
   */
  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // ========================================================================
  // HELPER METHODS: Extract metrics from simulation state
  // ========================================================================

  private getAvgCustomDeliveryTime(state: SimulationState): number {
    const history = state.history.dailyCustomDeliveryTime || [];
    if (history.length === 0) return 0;
    const sum = history.reduce((acc: number, entry: { day: number; value: number }) => acc + entry.value, 0);
    return sum / history.length;
  }

  private getCustomRejections(_state: SimulationState): number {
    // Count rejected orders (if tracked in state)
    return 0; // TODO: Add if tracked in simulation
  }

  private getStockoutDays(state: SimulationState): number {
    // Count days with zero inventory
    return state.stockoutDays || 0;
  }

  private getAvgInventory(state: SimulationState): number {
    const history = state.history.dailyRawMaterial || [];
    if (history.length === 0) return 0;
    const sum = history.reduce((acc: number, entry: { day: number; value: number }) => acc + entry.value, 0);
    return sum / history.length;
  }

  private getTotalInterest(state: SimulationState): number {
    const history = state.history.dailyInterestPaid || [];
    return history.reduce((acc: number, entry: { day: number; value: number }) => acc + entry.value, 0);
  }

  // ========================================================================
  // LOGGING & PROGRESS TRACKING
  // ========================================================================

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }

  private logProgress(): void {
    const { iteration, currentBest, evaluations } = this.progress;

    if (!currentBest) {
      this.log(`\n📊 Progress Update (Iteration ${iteration}/${this.config.totalIterations})`);
      this.log(`   No evaluations yet`);
      return;
    }

    this.log(`\n📊 Progress Update (Iteration ${iteration}/${this.config.totalIterations})`);
    this.log(`   Current Best: $${currentBest.netWorth.toLocaleString()} (fitness: ${currentBest.fitnessScore.toLocaleString()})`);

    // Recent trend
    const recent = evaluations.slice(-10);
    const avgRecent = recent.reduce((sum, e) => sum + e.netWorth, 0) / recent.length;
    this.log(`   Last 10 Avg:  $${Math.round(avgRecent).toLocaleString()}`);

    // Top 3
    const top3 = this.getTopN(3);
    this.log(`\n   Top 3 Policies:`);
    top3.forEach((evaluation, i) => {
      this.log(`     ${i + 1}. $${evaluation.netWorth.toLocaleString()} (iter ${evaluation.iteration})`);
    });

    this.log('');
  }

  private logFinalResults(): void {
    const { currentBest } = this.progress;

    if (!currentBest) {
      this.log('\n⚠️  No results to display');
      return;
    }

    this.log('\n' + '='.repeat(70));
    this.log('🏆 OPTIMIZATION COMPLETE - BEST POLICY FOUND');
    this.log('='.repeat(70));

    this.log(`\n📈 Performance:`);
    this.log(`   Net Worth:      $${currentBest.netWorth.toLocaleString()}`);
    this.log(`   Fitness Score:  ${currentBest.fitnessScore.toLocaleString()}`);
    this.log(`   Found at:       Iteration ${currentBest.iteration}`);

    // For weekly policies, show week 1 as representative
    const params = 'weeks' in currentBest.params
      ? currentBest.params.weeks[1]
      : currentBest.params;

    if ('weeks' in currentBest.params) {
      this.log(`\n🎯 Best Policy Type: Weekly State-Conditional (780 parameters)`);
      this.log(`   Showing Week 1 parameters as representative:`);
    } else {
      this.log(`\n🎯 Best Policy Parameters:`);
    }

    this.log(`   Inventory:`);
    this.log(`     Reorder Point:  ${params.reorderPoint} units`);
    this.log(`     Order Quantity: ${params.orderQuantity} units`);
    this.log(`     Safety Stock:   ${params.safetyStock} units`);

    this.log(`\n   Production:`);
    this.log(`     MCE Allocation: ${(params.mceCustomAllocation * 100).toFixed(1)}% to Custom`);
    this.log(`     Batch Size:     ${params.standardBatchSize} units`);
    this.log(`     Batch Interval: ${params.batchInterval} days`);

    this.log(`\n   Workforce:`);
    this.log(`     Target Experts: ${params.targetExperts}`);
    this.log(`     Hire Threshold: ${(params.hireThreshold * 100).toFixed(0)}%`);
    this.log(`     Max Overtime:   ${params.maxOvertimeHours.toFixed(1)} hours/day`);

    this.log(`\n   Financial:`);
    this.log(`     Cash Reserve:   $${params.cashReserveTarget.toLocaleString()}`);
    this.log(`     Loan Amount:    $${params.loanAmount.toLocaleString()}`);
    this.log(`     Repay At:       $${params.repayThreshold.toLocaleString()}`);

    this.log(`\n   Pricing:`);
    this.log(`     Standard Price: $${Math.round(225 * params.standardPriceMultiplier)}`);
    this.log(`     Custom Base:    $${params.customBasePrice.toFixed(2)}`);

    if ('weeks' in currentBest.params) {
      this.log(`\n   Note: Actual behavior varies by week (1-52) and business state`);
    }

    this.log('\n' + '='.repeat(70) + '\n');
  }

  private saveCheckpoint(): void {
    // TODO: Implement checkpoint saving to JSON file
    this.log(`💾 Checkpoint saved at iteration ${this.progress.iteration}`);
  }

  /**
   * Validate best policy by running multiple simulations
   * Handles randomness in simulation
   */
  public async validate(runs: number = 30): Promise<{
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    results: number[];
  }> {
    this.log(`\n🔍 Validating best policy with ${runs} runs...\n`);

    if (!this.progress.currentBest) {
      throw new Error('Cannot validate: no best policy found');
    }

    const bestPolicy = this.progress.currentBest.params;
    const results: number[] = [];

    for (let i = 0; i < runs; i++) {
      const policyEngine = new PolicyEngine(bestPolicy);
      const strategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);
      const result = await runSimulation(strategy);
      const netWorth = result.state.cash - result.state.debt;
      results.push(netWorth);

      this.log(`Run ${i + 1}/${runs}: $${netWorth.toLocaleString()}`);
    }

    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...results);
    const max = Math.max(...results);

    this.log(`\n📊 Validation Results:`);
    this.log(`   Mean:    $${Math.round(mean).toLocaleString()}`);
    this.log(`   Std Dev: $${Math.round(stdDev).toLocaleString()}`);
    this.log(`   Min:     $${min.toLocaleString()}`);
    this.log(`   Max:     $${max.toLocaleString()}`);
    this.log(`   Range:   $${(max - min).toLocaleString()}\n`);

    return { mean, stdDev, min, max, results };
  }

  /**
   * Get current optimization progress
   */
  public getProgress(): OptimizationProgress {
    return this.progress;
  }
}

/**
 * Run Bayesian Optimization with default configuration
 * Quick entry point for testing
 */
export async function runBayesianOptimization(
  config?: Partial<BayesianOptimizerConfig>
): Promise<PolicyEvaluation> {
  const optimizer = new BayesianOptimizer(config);
  const bestPolicy = await optimizer.optimize();
  await optimizer.validate(30);
  return bestPolicy;
}
