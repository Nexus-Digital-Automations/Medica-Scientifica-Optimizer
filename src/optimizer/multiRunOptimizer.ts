/**
 * Multi-Run Optimizer - Reduces variance from random initialization
 * Runs GA multiple times and selects the best result
 */

import type { Strategy, OptimizationResult, SimulationState } from '../simulation/types.js';
import type { DemandForecast } from '../simulation/demandModule.js';
import { optimize, type GeneticAlgorithmConfig, DEFAULT_GA_CONFIG } from './geneticAlgorithm.js';
import type { StrategyOverrides } from './geneticAlgorithm.js';

export interface MultiRunConfig {
  numRuns: number; // Number of independent GA runs (default: 5)
  gaConfig: GeneticAlgorithmConfig;
  parallelRuns?: boolean; // Run in parallel (not implemented yet)
}

export const DEFAULT_MULTI_RUN_CONFIG: MultiRunConfig = {
  numRuns: 5,
  gaConfig: DEFAULT_GA_CONFIG,
  parallelRuns: false,
};

export interface MultiRunResult {
  bestStrategy: Strategy;
  bestFitness: number;
  allRuns: OptimizationResult[];
  bestRunIndex: number;
  fitnessStats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    improvement: number; // % improvement of best over mean
  };
}

/**
 * Runs GA optimization multiple times and returns the best result
 * This reduces variance from random initialization and increases reliability
 */
export async function multiRunOptimize(
  config: MultiRunConfig = DEFAULT_MULTI_RUN_CONFIG,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[],
  fixedParams?: StrategyOverrides,
  variableParams?: StrategyOverrides
): Promise<MultiRunResult> {
  console.log(`\n🔄 MULTI-RUN OPTIMIZER - ${config.numRuns} independent GA runs`);
  console.log(`━`.repeat(80));

  const allRuns: OptimizationResult[] = [];
  let bestFitness = -Infinity;
  let bestRunIndex = -1;
  let bestStrategy: Strategy | null = null;

  // Run GA multiple times
  for (let runIndex = 0; runIndex < config.numRuns; runIndex++) {
    console.log(`\n🏃 RUN ${runIndex + 1}/${config.numRuns} - Starting GA optimization...`);
    console.log(`─`.repeat(80));

    const runResult = await optimize(
      config.gaConfig,
      (generation, stats) => {
        // Log progress every 10 generations
        if (generation % 10 === 0) {
          console.log(
            `  Run ${runIndex + 1}, Gen ${generation}: Best=$${stats.bestFitness.toFixed(2)}, Avg=$${stats.avgFitness.toFixed(2)}`
          );
        }
      },
      startingState,
      demandForecast,
      fixedParams,
      variableParams
    );

    allRuns.push(runResult);

    console.log(`✓ Run ${runIndex + 1} complete: Fitness=$${runResult.bestFitness.toFixed(2)}`);

    // Track best result
    if (runResult.bestFitness > bestFitness) {
      bestFitness = runResult.bestFitness;
      bestRunIndex = runIndex;
      bestStrategy = runResult.bestStrategy;
      console.log(`  🎯 NEW BEST FITNESS: $${bestFitness.toFixed(2)}`);
    }
  }

  if (!bestStrategy) {
    throw new Error('No valid strategy found across all runs');
  }

  // Calculate statistics
  const fitnesses = allRuns.map((run) => run.bestFitness);
  const mean = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
  const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnesses.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...fitnesses);
  const max = Math.max(...fitnesses);
  const improvement = mean > 0 ? ((max - mean) / Math.abs(mean)) * 100 : 0;

  console.log(`\n━`.repeat(80));
  console.log(`🏆 MULTI-RUN OPTIMIZATION COMPLETE`);
  console.log(`━`.repeat(80));
  console.log(`Best Fitness: $${bestFitness.toFixed(2)} (Run ${bestRunIndex + 1})`);
  console.log(`Mean Fitness: $${mean.toFixed(2)}`);
  console.log(`Std Dev: $${stdDev.toFixed(2)}`);
  console.log(`Range: $${min.toFixed(2)} - $${max.toFixed(2)}`);
  console.log(`Best vs Mean: +${improvement.toFixed(1)}%`);
  console.log(`━`.repeat(80));

  return {
    bestStrategy,
    bestFitness,
    allRuns,
    bestRunIndex,
    fitnessStats: {
      mean,
      stdDev,
      min,
      max,
      improvement,
    },
  };
}

/**
 * Helper function to compare multiple optimization approaches
 * Useful for benchmarking different configs
 */
export async function compareConfigs(
  configs: Array<{ name: string; config: MultiRunConfig }>,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[],
  fixedParams?: StrategyOverrides,
  variableParams?: StrategyOverrides
): Promise<void> {
  console.log(`\n📊 CONFIGURATION COMPARISON`);
  console.log(`━`.repeat(80));

  const results: Array<{ name: string; result: MultiRunResult }> = [];

  for (const { name, config } of configs) {
    console.log(`\n▶️  Testing: ${name}`);
    const result = await multiRunOptimize(config, startingState, demandForecast, fixedParams, variableParams);
    results.push({ name, result });
  }

  console.log(`\n━`.repeat(80));
  console.log(`📈 COMPARISON SUMMARY`);
  console.log(`━`.repeat(80));

  results.forEach(({ name, result }) => {
    console.log(`\n${name}:`);
    console.log(`  Best: $${result.bestFitness.toFixed(2)}`);
    console.log(`  Mean: $${result.fitnessStats.mean.toFixed(2)} ± $${result.fitnessStats.stdDev.toFixed(2)}`);
    console.log(`  Improvement: +${result.fitnessStats.improvement.toFixed(1)}% over mean`);
  });

  console.log(`\n━`.repeat(80));
}
