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
  customDemandMean1?: number;
  customDemandStdDev1?: number;
  customDemandMean2?: number;
  customDemandStdDev2?: number;
  standardDemandIntercept?: number;
  standardDemandSlope?: number;
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
 * Custom pricing uses data-driven defaults (fixed market conditions, not optimizable)
 */
function generateRandomStrategy(): Strategy {
  const strategy: Strategy = {
    reorderPoint: Math.floor(Math.random() * 300) + 100, // 100-400 (OPTIMIZABLE - inventory policy)
    orderQuantity: Math.floor(Math.random() * 500) + 200, // 200-700 (OPTIMIZABLE - inventory policy)
    standardBatchSize: Math.floor(Math.random() * 30) + 10, // 10-40 (OPTIMIZABLE - production policy)
    mceAllocationCustom: Math.random() * 0.5 + 0.5, // 0.5-1.0 (OPTIMIZABLE - capacity allocation)
    standardPrice: Math.floor(Math.random() * 400) + 600, // 600-1000 (OPTIMIZABLE - pricing decision)
    dailyOvertimeHours: Math.floor(Math.random() * 5), // 0-4 hours (OPTIMIZABLE - overtime policy)

    // FIXED MARKET CONDITIONS (data-driven from regression analysis, NOT optimizable)
    customBasePrice: 106.56, // From historical regression baseline at 5-day target
    customPenaltyPerDay: 0.27, // From historical regression slope
    customTargetDeliveryDays: 5, // Data-driven optimal premium service target

    // FIXED DEMAND MODEL (data-driven market conditions, NOT optimizable)
    customDemandMean1: 25, // Phase 1 (days 51-172) mean demand
    customDemandStdDev1: 5, // Phase 1 standard deviation
    customDemandMean2: 32.5, // Phase 2 (days 173-400) mean demand
    customDemandStdDev2: 6.5, // Phase 2 standard deviation

    // FIXED STANDARD DEMAND CURVE (user input market conditions, NOT optimizable)
    standardDemandIntercept: 500, // Quantity demanded at price $0
    standardDemandSlope: -0.25, // Change in quantity per $1 price increase

    // FIXED QUIT RISK MODEL (environment variables, NOT optimizable)
    overtimeTriggerDays: 5, // Consecutive overtime days before quit risk begins
    dailyQuitProbability: 0.10, // 10% daily quit chance once overworked

    timedActions: generateRandomTimedActions(),
  };

  return strategy;
}

/**
 * Generates random timed actions for strategy DNA
 * Now includes policy adjustment actions for adaptive optimization
 */
function generateRandomTimedActions(): StrategyAction[] {
  const actions: StrategyAction[] = [];

  // Generate resource acquisition actions (loans, hiring, machines, materials)
  const numResourceActions = Math.floor(Math.random() * 10) + 3; // 3-12 actions
  for (let i = 0; i < numResourceActions; i++) {
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

  // ADAPTIVE POLICY ADJUSTMENTS - Enable optimizer to change policies across THREE strategic periods
  // Period 1: Days 160-185 (Demand Shock - custom demand increases)
  // Period 2: Days 450-465 (Runoff Start - final wind-down begins)
  // Period 3: Days 75-450 (Active Management - random optimization opportunities)

  if (Math.random() < 0.8) { // 80% chance to include policy adjustments
    const numPolicyAdjustments = Math.floor(Math.random() * 4) + 2; // 2-5 adjustments

    for (let i = 0; i < numPolicyAdjustments; i++) {
      // Strategic period selection with proper bias
      let adjustmentDay: number;
      let isRunoffPeriod = false;
      const periodChoice = Math.random();

      if (periodChoice < 0.35) {
        // 35% - Demand shock period (Days 160-185)
        adjustmentDay = Math.floor(Math.random() * 26) + 160;
      } else if (periodChoice < 0.65) {
        // 30% - Runoff start period (Days 450-465)
        adjustmentDay = Math.floor(Math.random() * 16) + 450;
        isRunoffPeriod = true;
      } else {
        // 35% - Random throughout active management (Days 75-450)
        adjustmentDay = Math.floor(Math.random() * 376) + 75;
      }

      // Period-aware policy selection
      const policyType = Math.random();

      if (isRunoffPeriod) {
        // Runoff period: Prioritize liquidation and capacity reduction
        if (policyType < 0.5) {
          // 50% - Adjust Standard Price (aggressive liquidation pricing)
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_PRICE',
            productType: 'standard',
            newPrice: Math.floor(Math.random() * 300) + 500, // $500-$800 (lower for liquidation)
          });
        } else if (policyType < 0.85) {
          // 35% - Adjust MCE Allocation (reduce custom as backlog clears)
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_MCE_ALLOCATION',
            newAllocation: Math.random() * 0.4 + 0.2, // 20%-60% to custom (lower range)
          });
        } else {
          // 15% - Adjust Batch Size (minimize end-of-period waste)
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_BATCH_SIZE',
            newSize: Math.floor(Math.random() * 15) + 5, // 5-20 units (smaller batches)
          });
        }
      } else {
        // Active management periods: All policy types equally valuable
        if (policyType < 0.35) {
          // 35% - Adjust Standard Price
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_PRICE',
            productType: 'standard',
            newPrice: Math.floor(Math.random() * 400) + 600, // $600-$1000
          });
        } else if (policyType < 0.65) {
          // 30% - Adjust MCE Allocation
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_MCE_ALLOCATION',
            newAllocation: Math.random() * 0.5 + 0.5, // 50%-100% to custom
          });
        } else {
          // 35% - Adjust Batch Size
          actions.push({
            day: adjustmentDay,
            type: 'ADJUST_BATCH_SIZE',
            newSize: Math.floor(Math.random() * 30) + 10, // 10-40 units
          });
        }
      }
    }
  }

  return actions.sort((a, b) => a.day - b.day);
}

/**
 * Performs crossover between two parent strategies
 * Custom pricing parameters are FIXED (market conditions) and not crossed over
 */
function crossover(parent1: Strategy, parent2: Strategy): Strategy {
  const child: Strategy = {
    // Mix OPTIMIZABLE operational parameters from parents
    reorderPoint: Math.random() < 0.5 ? parent1.reorderPoint : parent2.reorderPoint,
    orderQuantity: Math.random() < 0.5 ? parent1.orderQuantity : parent2.orderQuantity,
    standardBatchSize: Math.random() < 0.5 ? parent1.standardBatchSize : parent2.standardBatchSize,
    mceAllocationCustom: Math.random() < 0.5 ? parent1.mceAllocationCustom : parent2.mceAllocationCustom,
    standardPrice: Math.random() < 0.5 ? parent1.standardPrice : parent2.standardPrice,
    dailyOvertimeHours: Math.random() < 0.5 ? parent1.dailyOvertimeHours : parent2.dailyOvertimeHours,

    // FIXED market conditions (data-driven, NOT crossed over)
    customBasePrice: 106.56,
    customPenaltyPerDay: 0.27,
    customTargetDeliveryDays: 5,

    // FIXED demand model (data-driven, NOT crossed over)
    customDemandMean1: 25,
    customDemandStdDev1: 5,
    customDemandMean2: 32.5,
    customDemandStdDev2: 6.5,

    // FIXED standard demand curve (user input, NOT crossed over)
    standardDemandIntercept: 500,
    standardDemandSlope: -0.25,

    // FIXED quit risk model (environment variables, NOT crossed over)
    overtimeTriggerDays: 5,
    dailyQuitProbability: 0.10,

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
 * Custom pricing parameters are FIXED (market conditions) and NEVER mutated
 */
function mutate(strategy: Strategy, mutationRate: number): Strategy {
  const mutated = JSON.parse(JSON.stringify(strategy)) as Strategy;

  // Mutate OPTIMIZABLE operational parameters
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

  if (Math.random() < mutationRate) {
    mutated.dailyOvertimeHours += (Math.random() < 0.5 ? 1 : -1);
    mutated.dailyOvertimeHours = Math.max(0, Math.min(4, mutated.dailyOvertimeHours));
  }

  // Custom pricing (customBasePrice, customPenaltyPerDay, customTargetDeliveryDays),
  // demand model (customDemandMean1, customDemandStdDev1, customDemandMean2, customDemandStdDev2),
  // and quit risk model (overtimeTriggerDays, dailyQuitProbability)
  // are FIXED market/environment conditions and are NEVER mutated

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
        } else if (action.type === 'ADJUST_PRICE' && 'newPrice' in action) {
          action.newPrice = Math.floor(Math.random() * 400) + 600; // $600-$1000
        } else if (action.type === 'ADJUST_MCE_ALLOCATION' && 'newAllocation' in action) {
          action.newAllocation = Math.random() * 0.5 + 0.5; // 50%-100% to custom
        } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
          action.newSize = Math.floor(Math.random() * 30) + 10; // 10-40 units
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
        } else if (action.type === 'ADJUST_PRICE' && 'newPrice' in action) {
          const variation = action.newPrice * 0.3;
          action.newPrice = Math.floor(action.newPrice + (Math.random() * variation * 2 - variation));
          action.newPrice = Math.max(500, Math.min(1200, action.newPrice));
        } else if (action.type === 'ADJUST_MCE_ALLOCATION' && 'newAllocation' in action) {
          action.newAllocation += (Math.random() - 0.5) * 0.2; // ±10% variation
          action.newAllocation = Math.max(0.3, Math.min(1.0, action.newAllocation));
        } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
          action.newSize += Math.floor(Math.random() * 11) - 5; // ±5 units
          action.newSize = Math.max(5, Math.min(50, action.newSize));
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
 * Generates a strategy with fixed parameters (hard constraints) and variable parameter seeds
 * Fixed parameters are NEVER changed by the GA (hard constraints)
 * Variable parameters are used as seeds but can be optimized
 */
function generateConstrainedStrategy(
  fixedParams?: StrategyOverrides,
  variableParams?: StrategyOverrides
): Strategy {
  const base = generateRandomStrategy();

  // Apply fixed parameters (hard constraints - NEVER change these)
  // Apply variable parameters as starting points (can be optimized)
  // Anything not specified is fully random
  return {
    reorderPoint: fixedParams?.reorderPoint ?? (variableParams?.reorderPoint ?? base.reorderPoint),
    orderQuantity: fixedParams?.orderQuantity ?? (variableParams?.orderQuantity ?? base.orderQuantity),
    standardBatchSize: fixedParams?.standardBatchSize ?? (variableParams?.standardBatchSize ?? base.standardBatchSize),
    mceAllocationCustom: fixedParams?.mceAllocationCustom ?? (variableParams?.mceAllocationCustom ?? base.mceAllocationCustom),
    standardPrice: fixedParams?.standardPrice ?? (variableParams?.standardPrice ?? base.standardPrice),
    customBasePrice: fixedParams?.customBasePrice ?? (variableParams?.customBasePrice ?? base.customBasePrice),
    customPenaltyPerDay: fixedParams?.customPenaltyPerDay ?? (variableParams?.customPenaltyPerDay ?? base.customPenaltyPerDay),
    customTargetDeliveryDays: fixedParams?.customTargetDeliveryDays ?? (variableParams?.customTargetDeliveryDays ?? base.customTargetDeliveryDays),
    customDemandMean1: fixedParams?.customDemandMean1 ?? (variableParams?.customDemandMean1 ?? base.customDemandMean1),
    customDemandStdDev1: fixedParams?.customDemandStdDev1 ?? (variableParams?.customDemandStdDev1 ?? base.customDemandStdDev1),
    customDemandMean2: fixedParams?.customDemandMean2 ?? (variableParams?.customDemandMean2 ?? base.customDemandMean2),
    customDemandStdDev2: fixedParams?.customDemandStdDev2 ?? (variableParams?.customDemandStdDev2 ?? base.customDemandStdDev2),
    standardDemandIntercept: fixedParams?.standardDemandIntercept ?? (variableParams?.standardDemandIntercept ?? base.standardDemandIntercept),
    standardDemandSlope: fixedParams?.standardDemandSlope ?? (variableParams?.standardDemandSlope ?? base.standardDemandSlope),
    dailyOvertimeHours: base.dailyOvertimeHours,
    overtimeTriggerDays: base.overtimeTriggerDays,
    dailyQuitProbability: base.dailyQuitProbability,
    timedActions: base.timedActions,
  };
}

/**
 * Applies fixed parameter constraints to a strategy after mutation/crossover
 * This ensures fixed parameters are NEVER changed by the GA
 */
function applyFixedConstraints(strategy: Strategy, fixedParams?: StrategyOverrides): Strategy {
  if (!fixedParams) return strategy;

  return {
    ...strategy,
    reorderPoint: fixedParams.reorderPoint ?? strategy.reorderPoint,
    orderQuantity: fixedParams.orderQuantity ?? strategy.orderQuantity,
    standardBatchSize: fixedParams.standardBatchSize ?? strategy.standardBatchSize,
    mceAllocationCustom: fixedParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
    standardPrice: fixedParams.standardPrice ?? strategy.standardPrice,
    customBasePrice: fixedParams.customBasePrice ?? strategy.customBasePrice,
    customPenaltyPerDay: fixedParams.customPenaltyPerDay ?? strategy.customPenaltyPerDay,
    customTargetDeliveryDays: fixedParams.customTargetDeliveryDays ?? strategy.customTargetDeliveryDays,
    customDemandMean1: fixedParams.customDemandMean1 ?? strategy.customDemandMean1,
    customDemandStdDev1: fixedParams.customDemandStdDev1 ?? strategy.customDemandStdDev1,
    customDemandMean2: fixedParams.customDemandMean2 ?? strategy.customDemandMean2,
    customDemandStdDev2: fixedParams.customDemandStdDev2 ?? strategy.customDemandStdDev2,
    standardDemandIntercept: fixedParams.standardDemandIntercept ?? strategy.standardDemandIntercept,
    standardDemandSlope: fixedParams.standardDemandSlope ?? strategy.standardDemandSlope,
  };
}

/**
 * Runs the genetic algorithm optimization
 * @param config - Genetic algorithm configuration
 * @param onProgress - Optional progress callback
 * @param startingState - Optional starting state for mid-course re-optimization
 * @param demandForecast - Optional custom demand forecast
 * @param fixedParams - Fixed parameters (hard constraints that GA must respect)
 * @param variableParams - Variable parameters (seeds for optimization, GA can change these)
 */
export async function optimize(
  config: GeneticAlgorithmConfig = DEFAULT_GA_CONFIG,
  onProgress?: (generation: number, stats: PopulationStats) => void,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[],
  fixedParams?: StrategyOverrides,
  variableParams?: StrategyOverrides
): Promise<OptimizationResult> {
  console.log('🧬 Starting genetic algorithm optimization...');
  console.log(`Population: ${config.populationSize}, Generations: ${config.generations}`);

  if (fixedParams && Object.keys(fixedParams).length > 0) {
    console.log('🔒 Fixed parameters will be enforced as hard constraints');
  }
  if (variableParams && Object.keys(variableParams).length > 0) {
    console.log('🔄 Variable parameters will seed initial population but can be optimized');
  }

  // Initialize population with fixed/variable parameter constraints
  let population: Strategy[] = [];
  const hasConstraints = (fixedParams && Object.keys(fixedParams).length > 0) ||
                        (variableParams && Object.keys(variableParams).length > 0);

  if (hasConstraints) {
    // First half: seeded with user's parameters (variable params with slight variations)
    const seedCount = Math.floor(config.populationSize / 2);
    for (let i = 0; i < seedCount; i++) {
      const seeded = generateConstrainedStrategy(fixedParams, variableParams);
      // Apply slight mutations to create diversity (fixed params will be preserved)
      const mutated = mutate(seeded, 0.1);
      population.push(applyFixedConstraints(mutated, fixedParams)); // Enforce fixed constraints
    }
    // Second half: random exploration (still respecting fixed constraints)
    for (let i = seedCount; i < config.populationSize; i++) {
      population.push(generateConstrainedStrategy(fixedParams, undefined));
    }
  } else {
    // No constraints: fully random population
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
      // CRITICAL: Enforce fixed parameter constraints after mutation
      child = applyFixedConstraints(child, fixedParams);
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
