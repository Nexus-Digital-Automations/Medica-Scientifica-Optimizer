/**
 * Hybrid Genetic Algorithm Optimizer
 *
 * Combines GA (strategic) with Analytical Models (tactical):
 * - GA evolves 8 high-level genes
 * - Analytical models expand genes → full strategy
 * - Simulation evaluates fitness with violation penalties
 *
 * Much faster than traditional GA (8 params vs 900+ decisions)
 */

import { AnalyticalOptimizer } from './analyticalOptimizer.js';
import {
  type StrategyGenes,
  randomizeGenes,
  mutateGenes,
  crossoverGenes,
  clampGenes,
  calculateDiversity
} from './strategyGenes.js';
import { convertAnalyticalToActions } from './strategyConverter.js';
import { calculateFitness } from './objectiveFunction.js';
import { validateActionSequence } from '../utils/simulationValidator.js';
import type { Strategy, SimulationResult } from '../simulation/types.js';
import type { FitnessBreakdown } from './objectiveFunction.js';

export interface HybridGAConfig {
  populationSize: number;       // e.g., 20
  generations: number;           // e.g., 15
  mutationRate: number;          // e.g., 0.15
  eliteCount: number;            // e.g., 3
  convergenceThreshold: number;  // e.g., 0.01 (1% improvement over 5 gens)
}

export interface HybridIndividual {
  genes: StrategyGenes;
  strategy: Strategy | null;
  fitness: number;
  fitnessBreakdown: FitnessBreakdown | null;
  generation: number;
}

export interface HybridGAResult {
  bestIndividual: HybridIndividual;
  population: HybridIndividual[];
  convergenceHistory: number[];
}

export class HybridGeneticOptimizer {
  private analytical = new AnalyticalOptimizer();

  /**
   * Main optimization loop
   */
  async optimize(
    initialState: {
      currentDay: number;
      machines: { MCE: number; WMA: number; PUC: number };
      workforce: { experts: number; rookies: number };
      cash: number;
    },
    config: HybridGAConfig,
    onProgress?: (gen: number, best: number, avg: number) => void
  ): Promise<HybridGAResult> {
    const { populationSize, generations, mutationRate, eliteCount, convergenceThreshold } = config;

    console.log('🧬 Starting Hybrid GA Optimization');
    console.log(`Population: ${populationSize}, Generations: ${generations}, Mutation: ${mutationRate}`);

    // STEP 1: Initialize population with random genes
    let population: HybridIndividual[] = Array(populationSize).fill(null).map(() => ({
      genes: randomizeGenes(),
      strategy: null,
      fitness: -Infinity,
      fitnessBreakdown: null,
      generation: 0
    }));

    const convergenceHistory: number[] = [];
    let bestEverFitness = -Infinity;
    let bestEverIndividual: HybridIndividual | null = null;

    // STEP 2: Evolution loop
    for (let gen = 0; gen < generations; gen++) {
      console.log(`\n🔄 Generation ${gen + 1}/${generations}`);

      // STEP 3: Evaluate population
      await Promise.all(population.map(async (individual) => {
        try {
          // 3a. Expand genes to full strategy using analytical models
          const demandForecast = this.forecastDemand(initialState.currentDay);

          const analyticalStrategy = this.analytical.generateStrategy(
            demandForecast,
            individual.genes,
            initialState.currentDay
          );

          // 3b. Convert analytical strategy to timed actions
          const actions = convertAnalyticalToActions(analyticalStrategy, initialState);

          // 3c. Pre-validate (fast rejection before simulation)
          const validation = validateActionSequence(actions, {
            machines: initialState.machines,
            workforce: initialState.workforce,
            cash: initialState.cash
          });

          if (!validation.valid) {
            console.warn(`❌ Individual rejected (pre-validation): ${validation.reason}`);
            individual.fitness = -Infinity;
            individual.fitnessBreakdown = {
              terminalWealth: 0,
              terminalAdjustment: 0,
              totalRevenue: 0,
              serviceLevel: 0,
              violations: { zeroMachines: 0, bankruptcy: 0, customQueueOverflow: 0, deliveryViolations: 0, stockoutDays: 0, total: 1 },
              finalScore: -Infinity
            };
            return;
          }

          // 3d. Build full strategy
          const strategy: Strategy = {
            // Base strategy parameters
            reorderPoint: analyticalStrategy.inventoryPolicy.reorderPoint,
            orderQuantity: analyticalStrategy.inventoryPolicy.orderQuantity,
            standardBatchSize: 60, // From case
            mceAllocationCustom: individual.genes.mceAllocationCustom,
            standardPrice: analyticalStrategy.pricingPolicy.standardPrice,
            dailyOvertimeHours: 0,
            customBasePrice: analyticalStrategy.pricingPolicy.customBasePrice,
            customPenaltyPerDay: 5.77,
            customTargetDeliveryDays: 7,

            // Demand model parameters (from case)
            customDemandMean1: 3.28,
            customDemandStdDev1: 1.35,
            customDemandMean2: 3.28,
            customDemandStdDev2: 1.35,
            standardDemandIntercept: 500,
            standardDemandSlope: -0.5,

            // Quit risk model (from case)
            overtimeTriggerDays: 10,
            dailyQuitProbability: 0.1,

            // Debt management (tuned by genes)
            autoDebtPaydown: true,
            minCashReserveDays: individual.genes.minCashReserveDays,
            debtPaydownAggressiveness: individual.genes.debtPaydownAggressiveness,
            preemptiveWageLoanDays: 3,
            maxDebtThreshold: 200000,
            emergencyLoanBuffer: 15000,

            // Financial ratios (from case)
            maxDebtToAssetRatio: 0.7,
            minInterestCoverageRatio: 3.0,
            maxDebtToRevenueRatio: 2.0,

            // Timed actions from analytical models
            timedActions: actions
          };

          // 3e. Simulate
          const result = await this.simulate(strategy);

          // 3f. Calculate fitness with penalties
          const { score, breakdown } = calculateFitness(result, {
            testDay: initialState.currentDay,
            endDay: 415,
            evaluationWindow: 365
          });

          individual.strategy = strategy;
          individual.fitness = score;
          individual.fitnessBreakdown = breakdown;
          individual.generation = gen;

          // Log violations for debugging
          if (breakdown.violations.total > 0) {
            console.warn(`⚠️ Individual has ${breakdown.violations.total} violation penalties`);
          }
        } catch (error) {
          console.error('❌ Evaluation error:', error);
          individual.fitness = -Infinity;
          individual.fitnessBreakdown = {
            terminalWealth: 0,
            terminalAdjustment: 0,
            totalRevenue: 0,
            serviceLevel: 0,
            violations: { zeroMachines: 0, bankruptcy: 0, customQueueOverflow: 0, deliveryViolations: 0, stockoutDays: 0, total: 999 },
            finalScore: -Infinity
          };
        }
      }));

      // STEP 4: Sort by fitness
      population.sort((a, b) => b.fitness - a.fitness);

      // STEP 5: Track convergence
      const bestFitness = population[0].fitness;
      const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / populationSize;
      const validCount = population.filter(ind => ind.fitness > -Infinity).length;
      const diversityScore = calculateDiversity(population.map(ind => ind.genes));

      convergenceHistory.push(bestFitness);

      console.log(`✅ Best: ${bestFitness.toLocaleString()}, Avg: ${avgFitness.toLocaleString()}, Valid: ${validCount}/${populationSize}, Diversity: ${diversityScore.toFixed(3)}`);

      if (onProgress) {
        onProgress(gen, bestFitness, avgFitness);
      }

      // Track best ever
      if (bestFitness > bestEverFitness) {
        bestEverFitness = bestFitness;
        bestEverIndividual = { ...population[0] };
      }

      // STEP 6: Check convergence
      if (gen >= 5) {
        const recent5 = convergenceHistory.slice(-5);
        const improvement = (recent5[4] - recent5[0]) / Math.abs(recent5[0]);

        if (improvement < convergenceThreshold) {
          console.log(`🎯 Converged after ${gen + 1} generations (${(improvement * 100).toFixed(2)}% improvement)`);
          break;
        }
      }

      // STEP 7: Selection + Reproduction (skip on last generation)
      if (gen < generations - 1) {
        const newPopulation: HybridIndividual[] = [];

        // 7a. Elitism: Keep top performers unchanged
        for (let i = 0; i < eliteCount; i++) {
          newPopulation.push({
            genes: { ...population[i].genes },
            strategy: null,
            fitness: -Infinity,
            fitnessBreakdown: null,
            generation: gen + 1
          });
        }

        // 7b. Crossover + Mutation to fill rest of population
        while (newPopulation.length < populationSize) {
          // Tournament selection (select from top 50%)
          const tournamentSize = Math.floor(populationSize / 2);
          const parent1 = population[Math.floor(Math.random() * tournamentSize)];
          const parent2 = population[Math.floor(Math.random() * tournamentSize)];

          // Crossover
          let childGenes = crossoverGenes(parent1.genes, parent2.genes);

          // Mutation
          childGenes = mutateGenes(childGenes, mutationRate);

          // Clamp to valid ranges
          childGenes = clampGenes(childGenes);

          newPopulation.push({
            genes: childGenes,
            strategy: null,
            fitness: -Infinity,
            fitnessBreakdown: null,
            generation: gen + 1
          });
        }

        population = newPopulation;
      }
    }

    // STEP 8: Return best individual
    const finalBest = bestEverIndividual || population[0];

    console.log('\n🏆 Optimization Complete!');
    console.log(`Best Fitness: ${finalBest.fitness.toLocaleString()}`);
    console.log('Best Genes:', finalBest.genes);

    return {
      bestIndividual: finalBest,
      population,
      convergenceHistory
    };
  }

  /**
   * Forecast demand for analytical models
   */
  private forecastDemand(currentDay: number): { mean: number; std: number } {
    // Phase-based forecast from case
    if (currentDay < 172) {
      // Phase 1: Stable demand
      return { mean: 150, std: 30 };
    } else if (currentDay < 218) {
      // Phase 2: Growth phase
      return { mean: 175, std: 35 };
    } else {
      // Phase 3: Higher stable demand
      return { mean: 200, std: 40 };
    }
  }

  /**
   * Simulate strategy via backend API
   */
  private async simulate(strategy: Strategy): Promise<SimulationResult> {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ strategy })
    });

    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.result) {
      throw new Error(`Simulation failed: ${data.error || 'Unknown error'}`);
    }

    return data.result;
  }
}
