/**
 * Genetic Algorithm Optimizer - Finds optimal factory strategy
 * Uses evolution-based optimization to discover winning strategies
 */

import type { Strategy, OptimizationResult, PopulationStats, StrategyAction, SimulationState } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';
import { runSimulation } from '../simulation/simulationEngine.js';
import type { DemandForecast } from '../simulation/demandModule.js';
import { AnalyticalOptimizer } from './analyticalOptimizer.js';
import { constrainStrategy, generateBoundedRandomStrategy } from './strategyConstraints.js';
import { validateBusinessRules } from '../simulation/businessRules.js';

export interface GeneticAlgorithmConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  eliteCount: number;
  crossoverRate: number;
  // Enhanced configuration for adaptive optimization
  enableAdaptiveMutation?: boolean; // Use adaptive mutation rate (decreases over time)
  initialMutationRate?: number; // Starting mutation rate (default: 0.15)
  finalMutationRate?: number; // Ending mutation rate (default: 0.03)
  enableEarlyStopping?: boolean; // Stop if converged
  earlyStopGenerations?: number; // Generations without improvement to trigger stop (default: 15)
  minImprovementThreshold?: number; // Minimum improvement to avoid early stop (default: 0.005 = 0.5%)
  seedWithAnalytical?: boolean; // Seed 20% of population with analytical solutions
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
  generations: 100, // Reduced from 500 with early stopping enabled
  mutationRate: 0.05, // Used only if adaptive mutation disabled
  eliteCount: 20,
  crossoverRate: 0.7,
  // Enhanced features (enabled by default)
  enableAdaptiveMutation: true,
  initialMutationRate: 0.15,
  finalMutationRate: 0.03,
  enableEarlyStopping: true,
  earlyStopGenerations: 15,
  minImprovementThreshold: 0.005,
  seedWithAnalytical: true,
};

/**
 * Generates a random strategy (initial population)
 * Uses constrained bounds to prevent generation of invalid strategies
 */
function generateRandomStrategy(): Strategy {
  const strategy = generateBoundedRandomStrategy();
  strategy.timedActions = generateRandomTimedActions();
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

  // ADAPTIVE POLICY ADJUSTMENTS - Enable optimizer to change policies across strategic periods
  // Based on business case forecast:
  // - Days 51-172: Stable low custom demand
  // - Days 172-218: Linear increase transition (46 days)
  // - Days 218-400: Stable high custom demand
  // - Days 450-500: Runoff period
  //
  // Policy adjustment bias:
  // Period 1: Days 172-218 (Demand Transition - custom demand increasing)
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
        // 35% - Demand transition period (Days 172-218)
        // During this 46-day period, custom demand increases linearly
        adjustmentDay = Math.floor(Math.random() * 47) + 172;
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
    // FORMULA-DRIVEN POLICIES: Not crossed over (will be calculated dynamically)
    reorderPoint: 0,
    orderQuantity: 0,
    standardBatchSize: 0,

    // GA-OPTIMIZABLE POLICIES: Mix from parents
    mceAllocationCustom: Math.random() < 0.5 ? parent1.mceAllocationCustom : parent2.mceAllocationCustom,
    standardPrice: Math.random() < 0.5 ? parent1.standardPrice : parent2.standardPrice,
    dailyOvertimeHours: Math.random() < 0.5 ? parent1.dailyOvertimeHours : parent2.dailyOvertimeHours,

    // FIXED market conditions (data-driven, NOT crossed over)
    customBasePrice: 106.56,
    customPenaltyPerDay: 0.27,
    customTargetDeliveryDays: 5,

    // FIXED demand model (data-driven, NOT crossed over)
    // Three-phase: Days 51-172 stable low → Days 172-218 transition → Days 218-400 stable high
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

  // FORMULA-DRIVEN POLICIES are NOT mutated (reorderPoint, orderQuantity, standardBatchSize)
  // These are calculated dynamically by OR formulas based on factory state

  // Mutate GA-OPTIMIZABLE operational parameters only
  if (Math.random() < mutationRate) {
    mutated.mceAllocationCustom += (Math.random() - 0.5) * 0.2;
  }

  if (Math.random() < mutationRate) {
    mutated.standardPrice += Math.floor(Math.random() * 100) - 50;
  }

  if (Math.random() < mutationRate) {
    mutated.dailyOvertimeHours += (Math.random() < 0.5 ? 1 : -1);
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

  // Apply constraints to ensure mutated values stay within valid bounds
  return constrainStrategy(mutated);
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
  // Anything not specified is fully random or formula-driven
  return {
    // FORMULA-DRIVEN POLICIES: Always 0 (calculated dynamically)
    reorderPoint: 0,
    orderQuantity: 0,
    standardBatchSize: 0,
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
    // FORMULA-DRIVEN POLICIES: Always 0, never constrained
    reorderPoint: 0,
    orderQuantity: 0,
    standardBatchSize: 0,
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
 * Calculate adaptive mutation rate that decreases over generations
 * Starts high for exploration, ends low for fine-tuning
 */
function getAdaptiveMutationRate(
  generation: number,
  maxGenerations: number,
  initialRate: number = 0.15,
  finalRate: number = 0.03
): number {
  const progress = generation / maxGenerations;
  return initialRate * (1 - progress) + finalRate * progress;
}

/**
 * Check if optimization has converged (no significant improvement)
 * Returns true if best fitness hasn't improved for N generations
 */
function hasConverged(
  convergenceHistory: number[],
  earlyStopGenerations: number = 15,
  minImprovementThreshold: number = 0.005
): boolean {
  if (convergenceHistory.length < earlyStopGenerations) {
    return false;
  }

  const recent = convergenceHistory.slice(-earlyStopGenerations);
  const firstValue = recent[0];
  const lastValue = recent[recent.length - 1];

  if (firstValue === 0) {
    return false; // Avoid division by zero
  }

  const improvement = (lastValue - firstValue) / Math.abs(firstValue);
  return improvement < minImprovementThreshold;
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

  // Enhanced features logging
  if (config.enableAdaptiveMutation) {
    console.log(`🎯 Adaptive mutation enabled: ${config.initialMutationRate} → ${config.finalMutationRate}`);
  }
  if (config.enableEarlyStopping) {
    console.log(`⏱️  Early stopping enabled: ${config.earlyStopGenerations} generations, ${(config.minImprovementThreshold ?? 0.005) * 100}% threshold`);
  }
  if (config.seedWithAnalytical) {
    console.log('🔬 Analytical seeding enabled: 20% of population from EOQ/ROP/EPQ formulas');
  }

  // Initialize population with enhanced seeding strategy
  let population: Strategy[] = [];
  const hasConstraints = (fixedParams && Object.keys(fixedParams).length > 0) ||
                        (variableParams && Object.keys(variableParams).length > 0);

  // Step 1: Seed with analytical solutions if enabled (highest quality seeds)
  if (config.seedWithAnalytical) {
    const analyticalOptimizer = new AnalyticalOptimizer();
    const analyticalStrategy = analyticalOptimizer.generateAnalyticalStrategy();
    const analyticalCount = Math.floor(config.populationSize * 0.2); // 20% from analytical

    console.log(`  Adding ${analyticalCount} analytical solutions to population...`);
    for (let i = 0; i < analyticalCount; i++) {
      // Apply small mutations to create diversity around analytical optimum
      const mutated = mutate(analyticalStrategy, 0.05);
      population.push(applyFixedConstraints(mutated, fixedParams));
    }
  }

  // Step 2: Fill remaining population
  const remainingCount = config.populationSize - population.length;

  if (hasConstraints) {
    // Half from user constraints, half random
    const constrainedCount = Math.floor(remainingCount / 2);
    console.log(`  Adding ${constrainedCount} constrained solutions...`);
    for (let i = 0; i < constrainedCount; i++) {
      const seeded = generateConstrainedStrategy(fixedParams, variableParams);
      const mutated = mutate(seeded, 0.1);
      population.push(applyFixedConstraints(mutated, fixedParams));
    }

    console.log(`  Adding ${remainingCount - constrainedCount} random solutions...`);
    for (let i = constrainedCount; i < remainingCount; i++) {
      population.push(generateConstrainedStrategy(fixedParams, undefined));
    }
  } else {
    // All remaining slots: fully random
    console.log(`  Adding ${remainingCount} random solutions...`);
    for (let i = 0; i < remainingCount; i++) {
      population.push(generateRandomStrategy());
    }
  }

  console.log(`✓ Initial population complete: ${population.length} strategies`);

  const convergenceHistory: number[] = [];
  let bestStrategy: Strategy = population[0];
  let bestFitness = -Infinity;

  // Evolution loop
  for (let gen = 0; gen < config.generations; gen++) {
    console.log(`\n━━━ Generation ${gen} START ━━━`);
    console.log(`  Population size: ${population.length}`);

    // Evaluate fitness for entire population with validation and retry
    console.log(`  Evaluating fitness for ${population.length} strategies...`);
    const startEval = Date.now();
    const fitnessScores = await Promise.all(
      population.map(async (strategy, idx) => {
        if (idx % 100 === 0) {
          console.log(`    Evaluating strategy ${idx}/${population.length}...`);
        }

        // Try up to 3 times to get a valid strategy
        let attempts = 0;
        const maxAttempts = 3;
        let currentStrategy = strategy;
        let simulationResult;
        let isValid = false;

        while (attempts < maxAttempts && !isValid) {
          attempts++;

          // Run simulation
          simulationResult = await runSimulation(currentStrategy, CONSTANTS.SIMULATION_END_DAY, startingState, demandForecast);

          // Validate business rules
          const validation = validateBusinessRules(simulationResult.state);

          if (validation.valid) {
            isValid = true;
            if (idx % 100 === 0) {
              console.log(`    Strategy ${idx} fitness: $${simulationResult.fitnessScore.toFixed(2)} ✅ VALID`);
            }
          } else {
            console.warn(`    Strategy ${idx} attempt ${attempts}/${maxAttempts} INVALID: ${validation.criticalCount} critical, ${validation.majorCount} major violations`);
            if (attempts < maxAttempts) {
              // Generate a new random strategy and try again
              currentStrategy = generateRandomStrategy();
              console.log(`    Regenerating strategy ${idx}...`);
            } else {
              // Max attempts reached, assign very negative fitness
              console.error(`    Strategy ${idx} REJECTED after ${maxAttempts} attempts`);
              simulationResult.fitnessScore = -999999999; // Will be discarded by natural selection
            }
          }
        }

        return {
          strategy: currentStrategy,
          fitness: simulationResult!.fitnessScore,
        };
      })
    );
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

    // Check for early stopping
    if (config.enableEarlyStopping) {
      const converged = hasConverged(
        convergenceHistory,
        config.earlyStopGenerations ?? 15,
        config.minImprovementThreshold ?? 0.005
      );

      if (converged) {
        console.log(`\n🛑 EARLY STOPPING TRIGGERED`);
        console.log(`  No significant improvement for ${config.earlyStopGenerations} generations`);
        console.log(`  Final best fitness: $${bestFitness.toFixed(2)}`);
        console.log(`  Stopped at generation ${gen}/${config.generations}`);

        // Run final simulation and return early
        const finalSimulation = await runSimulation(bestStrategy, CONSTANTS.SIMULATION_END_DAY, startingState, demandForecast);

        return {
          bestStrategy,
          bestFitness,
          generation: gen, // Actual generation stopped at
          populationStats: stats,
          convergenceHistory,
          finalSimulation,
        };
      }
    }

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

      // Apply adaptive mutation rate if enabled
      const currentMutationRate = config.enableAdaptiveMutation
        ? getAdaptiveMutationRate(
            gen,
            config.generations,
            config.initialMutationRate ?? 0.15,
            config.finalMutationRate ?? 0.03
          )
        : config.mutationRate;

      child = mutate(child, currentMutationRate);
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
  const finalSimulation = await runSimulation(bestStrategy, CONSTANTS.SIMULATION_END_DAY, startingState, demandForecast);

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
