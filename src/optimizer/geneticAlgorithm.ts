/**
 * Genetic Algorithm Optimizer - Finds optimal factory strategy
 * Uses evolution-based optimization to discover winning strategies
 */

import type { Strategy, OptimizationResult, PopulationStats, StrategyAction } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';
import { runSimulation, evaluateStrategy } from '../simulation/simulationEngine.js';

export interface GeneticAlgorithmConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  eliteCount: number;
  crossoverRate: number;
}

export const DEFAULT_GA_CONFIG: GeneticAlgorithmConfig = {
  populationSize: 100,
  generations: 500,
  mutationRate: 0.05,
  eliteCount: 20,
  crossoverRate: 0.7,
};

/**
 * Generates a random strategy (initial population)
 */
function generateRandomStrategy(): Strategy {
  const strategy: Strategy = {
    reorderPoint: Math.floor(Math.random() * 300) + 100, // 100-400
    orderQuantity: Math.floor(Math.random() * 500) + 200, // 200-700
    standardBatchSize: Math.floor(Math.random() * 30) + 10, // 10-40
    mceAllocationCustom: Math.random() * 0.5 + 0.5, // 0.5-1.0 (favor custom)
    standardPrice: Math.floor(Math.random() * 400) + 600, // 600-1000
    customBasePrice: Math.floor(Math.random() * 600) + 900, // 900-1500
    customPenaltyPerDay: Math.floor(Math.random() * 20) + 5, // 5-25
    customTargetDeliveryDays: Math.floor(Math.random() * 10) + 5, // 5-15
    timedActions: generateRandomTimedActions(),
  };

  return strategy;
}

/**
 * Generates random timed actions for strategy DNA
 */
function generateRandomTimedActions(): StrategyAction[] {
  const actions: StrategyAction[] = [];
  const numActions = Math.floor(Math.random() * 10) + 3; // 3-12 actions

  for (let i = 0; i < numActions; i++) {
    const day = Math.floor(Math.random() * (CONSTANTS.SIMULATION_END_DAY - CONSTANTS.SIMULATION_START_DAY)) +
      CONSTANTS.SIMULATION_START_DAY;

    const actionType = Math.random();

    if (actionType < 0.3) {
      // Take loan
      actions.push({
        day,
        type: 'TAKE_LOAN',
        amount: Math.floor(Math.random() * 100000) + 10000,
      });
    } else if (actionType < 0.5) {
      // Hire rookie
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: Math.floor(Math.random() * 3) + 1,
      });
    } else if (actionType < 0.7) {
      // Buy machine
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      actions.push({
        day,
        type: 'BUY_MACHINE',
        machineType: machineTypes[Math.floor(Math.random() * machineTypes.length)],
        count: 1,
      });
    } else {
      // Order materials
      actions.push({
        day,
        type: 'ORDER_MATERIALS',
        quantity: Math.floor(Math.random() * 500) + 200,
      });
    }
  }

  return actions.sort((a, b) => a.day - b.day);
}

/**
 * Performs crossover between two parent strategies
 */
function crossover(parent1: Strategy, parent2: Strategy): Strategy {
  const child: Strategy = {
    // Mix static genes randomly from parents
    reorderPoint: Math.random() < 0.5 ? parent1.reorderPoint : parent2.reorderPoint,
    orderQuantity: Math.random() < 0.5 ? parent1.orderQuantity : parent2.orderQuantity,
    standardBatchSize: Math.random() < 0.5 ? parent1.standardBatchSize : parent2.standardBatchSize,
    mceAllocationCustom: Math.random() < 0.5 ? parent1.mceAllocationCustom : parent2.mceAllocationCustom,
    standardPrice: Math.random() < 0.5 ? parent1.standardPrice : parent2.standardPrice,
    customBasePrice: Math.random() < 0.5 ? parent1.customBasePrice : parent2.customBasePrice,
    customPenaltyPerDay: Math.random() < 0.5 ? parent1.customPenaltyPerDay : parent2.customPenaltyPerDay,
    customTargetDeliveryDays: Math.random() < 0.5
      ? parent1.customTargetDeliveryDays
      : parent2.customTargetDeliveryDays,

    // Mix timed actions (take some from each parent)
    timedActions: [
      ...parent1.timedActions.slice(0, Math.floor(parent1.timedActions.length / 2)),
      ...parent2.timedActions.slice(Math.floor(parent2.timedActions.length / 2)),
    ].sort((a, b) => a.day - b.day),
  };

  return child;
}

/**
 * Mutates a strategy with given mutation rate
 */
function mutate(strategy: Strategy, mutationRate: number): Strategy {
  const mutated = JSON.parse(JSON.stringify(strategy)) as Strategy;

  // Mutate static genes
  if (Math.random() < mutationRate) {
    mutated.reorderPoint += Math.floor(Math.random() * 100) - 50;
    mutated.reorderPoint = Math.max(50, Math.min(500, mutated.reorderPoint));
  }

  if (Math.random() < mutationRate) {
    mutated.orderQuantity += Math.floor(Math.random() * 100) - 50;
    mutated.orderQuantity = Math.max(100, Math.min(1000, mutated.orderQuantity));
  }

  if (Math.random() < mutationRate) {
    mutated.mceAllocationCustom += (Math.random() - 0.5) * 0.2;
    mutated.mceAllocationCustom = Math.max(0.3, Math.min(1.0, mutated.mceAllocationCustom));
  }

  if (Math.random() < mutationRate) {
    mutated.standardPrice += Math.floor(Math.random() * 100) - 50;
    mutated.standardPrice = Math.max(500, Math.min(1200, mutated.standardPrice));
  }

  // Mutate timed actions (add or remove)
  if (Math.random() < mutationRate) {
    if (Math.random() < 0.5 && mutated.timedActions.length > 0) {
      // Remove random action
      const index = Math.floor(Math.random() * mutated.timedActions.length);
      mutated.timedActions.splice(index, 1);
    } else {
      // Add random action
      mutated.timedActions.push(...generateRandomTimedActions().slice(0, 1));
      mutated.timedActions.sort((a, b) => a.day - b.day);
    }
  }

  return mutated;
}

/**
 * Runs the genetic algorithm optimization
 */
export async function optimize(
  config: GeneticAlgorithmConfig = DEFAULT_GA_CONFIG,
  onProgress?: (generation: number, stats: PopulationStats) => void
): Promise<OptimizationResult> {
  console.log('🧬 Starting genetic algorithm optimization...');
  console.log(`Population: ${config.populationSize}, Generations: ${config.generations}`);

  // Initialize population
  let population: Strategy[] = [];
  for (let i = 0; i < config.populationSize; i++) {
    population.push(generateRandomStrategy());
  }

  const convergenceHistory: number[] = [];
  let bestStrategy: Strategy = population[0];
  let bestFitness = -Infinity;

  // Evolution loop
  for (let gen = 0; gen < config.generations; gen++) {
    // Evaluate fitness for entire population
    const fitnessScores = population.map((strategy) => ({
      strategy,
      fitness: evaluateStrategy(strategy),
    }));

    // Sort by fitness (descending)
    fitnessScores.sort((a, b) => b.fitness - a.fitness);

    // Update best strategy
    if (fitnessScores[0].fitness > bestFitness) {
      bestFitness = fitnessScores[0].fitness;
      bestStrategy = JSON.parse(JSON.stringify(fitnessScores[0].strategy));
    }

    // Calculate population stats
    const avgFitness = fitnessScores.reduce((sum, item) => sum + item.fitness, 0) / fitnessScores.length;
    const worstFitness = fitnessScores[fitnessScores.length - 1].fitness;

    const stats: PopulationStats = {
      generation: gen,
      bestFitness,
      avgFitness,
      worstFitness,
      diversityScore: 0, // Could calculate actual diversity
    };

    convergenceHistory.push(bestFitness);

    // Report progress
    if (onProgress) {
      onProgress(gen, stats);
    }

    if (gen % 50 === 0) {
      console.log(`Gen ${gen}: Best=$${bestFitness.toFixed(2)}, Avg=$${avgFitness.toFixed(2)}`);
    }

    // Selection: Keep elite strategies
    const newPopulation: Strategy[] = fitnessScores.slice(0, config.eliteCount).map((item) => item.strategy);

    // Generate rest of population through crossover and mutation
    while (newPopulation.length < config.populationSize) {
      // Select two parents (tournament selection)
      const parent1 = fitnessScores[Math.floor(Math.random() * config.eliteCount * 2)].strategy;
      const parent2 = fitnessScores[Math.floor(Math.random() * config.eliteCount * 2)].strategy;

      let child: Strategy;
      if (Math.random() < config.crossoverRate) {
        child = crossover(parent1, parent2);
      } else {
        child = JSON.parse(JSON.stringify(parent1));
      }

      child = mutate(child, config.mutationRate);
      newPopulation.push(child);
    }

    population = newPopulation;
  }

  console.log('✅ Optimization complete!');
  console.log(`Best fitness: $${bestFitness.toFixed(2)}`);

  // Run final simulation with best strategy to get complete results
  const finalSimulation = runSimulation(bestStrategy);

  return {
    bestStrategy,
    bestFitness,
    generation: config.generations,
    populationStats: {
      generation: config.generations,
      bestFitness,
      avgFitness: bestFitness,
      worstFitness: bestFitness,
      diversityScore: 0,
    },
    convergenceHistory,
    finalSimulation,
  };
}
