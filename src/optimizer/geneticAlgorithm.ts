/**
 * Genetic Algorithm Optimizer - Finds optimal factory strategy
 * Uses evolution-based optimization to discover winning strategies
 */

import type { Strategy, OptimizationResult, PopulationStats, StrategyAction, SimulationState } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';
import { runSimulation, evaluateStrategy } from '../simulation/simulationEngine.js';
import type { DemandForecast } from '../simulation/demandModule.js';

export interface GeneticAlgorithmConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  eliteCount: number;
  crossoverRate: number;
}

export interface StrategyOverrides {
  reorderPoint?: number;
  orderQuantity?: number;
  standardBatchSize?: number;
  mceAllocationCustom?: number;
  standardPrice?: number;
  customBasePrice?: number;
  customPenaltyPerDay?: number;
  customTargetDeliveryDays?: number;
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

  // Mutate timed actions with hybrid approach (90% gentle, 10% wild)
  if (Math.random() < mutationRate) {
    // 10% chance: WILD mutation (long-range exploration)
    if (Math.random() < 0.1) {
      // 50% chance: Add completely random new action
      if (Math.random() < 0.5) {
        mutated.timedActions.push(...generateRandomTimedActions().slice(0, 1));
        mutated.timedActions.sort((a, b) => a.day - b.day);
      }
      // 50% chance: Drastically modify existing action (if any exist)
      else if (mutated.timedActions.length > 0) {
        const actionIndex = Math.floor(Math.random() * mutated.timedActions.length);
        const action = mutated.timedActions[actionIndex];

        // Completely random day
        action.day = Math.floor(
          Math.random() * (CONSTANTS.SIMULATION_END_DAY - CONSTANTS.SIMULATION_START_DAY)
        ) + CONSTANTS.SIMULATION_START_DAY;

        // Completely random amounts
        if (action.type === 'TAKE_LOAN' && 'amount' in action) {
          action.amount = Math.floor(Math.random() * 150000) + 20000; // $20K-$170K
        } else if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
          action.count = Math.floor(Math.random() * 4) + 1; // 1-4 rookies
        } else if (action.type === 'ORDER_MATERIALS' && 'quantity' in action) {
          action.quantity = Math.floor(Math.random() * 700) + 200; // 200-900 units
        }

        mutated.timedActions.sort((a, b) => a.day - b.day);
      }
    }
    // 90% chance: GENTLE mutation (local refinement)
    else if (mutated.timedActions.length > 0) {
      const actionIndex = Math.floor(Math.random() * mutated.timedActions.length);
      const action = mutated.timedActions[actionIndex];

      // 70% chance: modify existing action, 30% chance: remove it
      if (Math.random() < 0.7) {
        // Modify action timing slightly (±20 days)
        action.day = Math.max(
          CONSTANTS.SIMULATION_START_DAY,
          Math.min(CONSTANTS.SIMULATION_END_DAY, action.day + Math.floor(Math.random() * 41) - 20)
        );

        // Modify action amount slightly (±30%)
        if (action.type === 'TAKE_LOAN' && 'amount' in action) {
          const variation = action.amount * 0.3;
          action.amount = Math.floor(action.amount + (Math.random() * variation * 2 - variation));
          action.amount = Math.max(10000, Math.min(200000, action.amount));
        } else if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
          action.count = Math.max(1, Math.min(5, action.count + (Math.random() < 0.5 ? 1 : -1)));
        } else if (action.type === 'ORDER_MATERIALS' && 'quantity' in action) {
          const variation = action.quantity * 0.3;
          action.quantity = Math.floor(action.quantity + (Math.random() * variation * 2 - variation));
          action.quantity = Math.max(100, Math.min(1000, action.quantity));
        }

        mutated.timedActions.sort((a, b) => a.day - b.day);
      } else {
        // Remove this action
        mutated.timedActions.splice(actionIndex, 1);
      }
    }
  }

  return mutated;
}

/**
 * Generates a strategy with user-provided overrides as base values
 * Used to seed the initial population with user's preferred parameters
 */
function generateSeededStrategy(overrides: StrategyOverrides): Strategy {
  const base = generateRandomStrategy();

  return {
    reorderPoint: overrides.reorderPoint ?? base.reorderPoint,
    orderQuantity: overrides.orderQuantity ?? base.orderQuantity,
    standardBatchSize: overrides.standardBatchSize ?? base.standardBatchSize,
    mceAllocationCustom: overrides.mceAllocationCustom ?? base.mceAllocationCustom,
    standardPrice: overrides.standardPrice ?? base.standardPrice,
    customBasePrice: overrides.customBasePrice ?? base.customBasePrice,
    customPenaltyPerDay: overrides.customPenaltyPerDay ?? base.customPenaltyPerDay,
    customTargetDeliveryDays: overrides.customTargetDeliveryDays ?? base.customTargetDeliveryDays,
    timedActions: base.timedActions, // Use random timed actions
  };
}

/**
 * Runs the genetic algorithm optimization
 * @param config - Genetic algorithm configuration
 * @param onProgress - Optional progress callback
 * @param startingState - Optional starting state for mid-course re-optimization
 * @param demandForecast - Optional custom demand forecast
 * @param strategyOverrides - Optional strategy parameter overrides to seed initial population
 */
export async function optimize(
  config: GeneticAlgorithmConfig = DEFAULT_GA_CONFIG,
  onProgress?: (generation: number, stats: PopulationStats) => void,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[],
  strategyOverrides?: StrategyOverrides
): Promise<OptimizationResult> {
  console.log('🧬 Starting genetic algorithm optimization...');
  console.log(`Population: ${config.populationSize}, Generations: ${config.generations}`);

  // Initialize population with strategy overrides if provided
  let population: Strategy[] = [];
  if (strategyOverrides) {
    console.log('🎯 Seeding initial population with user strategy parameters');
    // First half: seeded with user's parameters (with slight variations)
    const seedCount = Math.floor(config.populationSize / 2);
    for (let i = 0; i < seedCount; i++) {
      const seeded = generateSeededStrategy(strategyOverrides);
      // Apply slight mutations to create diversity while keeping user's values as base
      population.push(mutate(seeded, 0.1)); // 10% mutation for diversity
    }
    // Second half: completely random for exploration
    for (let i = seedCount; i < config.populationSize; i++) {
      population.push(generateRandomStrategy());
    }
  } else {
    // No overrides: fully random population
    for (let i = 0; i < config.populationSize; i++) {
      population.push(generateRandomStrategy());
    }
  }

  const convergenceHistory: number[] = [];
  let bestStrategy: Strategy = population[0];
  let bestFitness = -Infinity;

  // Evolution loop
  for (let gen = 0; gen < config.generations; gen++) {
    console.log(`\n━━━ Generation ${gen} START ━━━`);
    console.log(`  Population size: ${population.length}`);

    // Evaluate fitness for entire population
    console.log(`  Evaluating fitness for ${population.length} strategies...`);
    const startEval = Date.now();
    const fitnessScores = population.map((strategy, idx) => {
      if (idx % 100 === 0) {
        console.log(`    Evaluating strategy ${idx}/${population.length}...`);
      }
      const fitness = evaluateStrategy(strategy, CONSTANTS.SIMULATION_END_DAY, startingState, demandForecast);
      if (idx % 100 === 0) {
        console.log(`    Strategy ${idx} fitness: $${fitness.toFixed(2)}`);
      }
      return {
        strategy,
        fitness,
      };
    });
    console.log(`  ✓ Fitness evaluation complete in ${Date.now() - startEval}ms`);

    // Sort by fitness (descending)
    console.log(`  Sorting ${fitnessScores.length} strategies by fitness...`);
    fitnessScores.sort((a, b) => b.fitness - a.fitness);
    console.log(`  ✓ Sorting complete`);

    // Update best strategy
    if (fitnessScores[0].fitness > bestFitness) {
      console.log(`  🎯 NEW BEST FITNESS: $${fitnessScores[0].fitness.toFixed(2)} (previous: $${bestFitness.toFixed(2)})`);
      bestFitness = fitnessScores[0].fitness;
      bestStrategy = JSON.parse(JSON.stringify(fitnessScores[0].strategy));
    } else {
      console.log(`  Best fitness unchanged: $${bestFitness.toFixed(2)}`);
    }

    // Calculate population stats
    const avgFitness = fitnessScores.reduce((sum, item) => sum + item.fitness, 0) / fitnessScores.length;
    const worstFitness = fitnessScores[fitnessScores.length - 1].fitness;

    console.log(`  Stats: Best=$${bestFitness.toFixed(2)}, Avg=$${avgFitness.toFixed(2)}, Worst=$${worstFitness.toFixed(2)}`);

    const stats: PopulationStats = {
      generation: gen,
      bestFitness,
      avgFitness,
      worstFitness,
      diversityScore: 0,
    };

    convergenceHistory.push(bestFitness);

    // Report progress
    if (onProgress) {
      console.log(`  Calling progress callback...`);
      onProgress(gen, stats);
      console.log(`  ✓ Progress callback complete`);
    }

    console.log(`━━━ Generation ${gen} END ━━━\n`)

    // Selection: Keep elite strategies
    console.log(`  Selecting ${config.eliteCount} elite strategies...`);
    const newPopulation: Strategy[] = fitnessScores.slice(0, config.eliteCount).map((item) => item.strategy);
    console.log(`  ✓ Elite strategies selected`);

    // Generate rest of population through crossover and mutation
    console.log(`  Generating ${config.populationSize - newPopulation.length} new strategies via crossover/mutation...`);
    let breedCount = 0;
    while (newPopulation.length < config.populationSize) {
      if (breedCount % 100 === 0) {
        console.log(`    Breeding strategy ${breedCount}/${config.populationSize - config.eliteCount}...`);
      }

      // Select two parents (tournament selection from elites only)
      const parent1 = fitnessScores[Math.floor(Math.random() * config.eliteCount)].strategy;
      const parent2 = fitnessScores[Math.floor(Math.random() * config.eliteCount)].strategy;

      let child: Strategy;
      if (Math.random() < config.crossoverRate) {
        child = crossover(parent1, parent2);
      } else {
        child = JSON.parse(JSON.stringify(parent1));
      }

      child = mutate(child, config.mutationRate);
      newPopulation.push(child);
      breedCount++;
    }
    console.log(`  ✓ New population complete (${newPopulation.length} strategies)`);

    population = newPopulation;
  }

  console.log('✅ Optimization complete!');
  console.log(`Best fitness: $${bestFitness.toFixed(2)}`);

  // Run final simulation with best strategy to get complete results
  const finalSimulation = runSimulation(bestStrategy, CONSTANTS.SIMULATION_END_DAY, startingState, demandForecast);

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
