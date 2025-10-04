import type { Strategy, StrategyAction } from '../types/ui.types';
import { calculateEOQ, calculateROP, calculateEPQ, calculateNPV, calculateQueueMetrics, calculateOptimalPrice } from './formulaCalculations';

export interface OptimizationCandidate {
  id: string;
  actions: StrategyAction[];
  fitness: number;
  netWorth: number;
  // Strategy parameter overrides
  strategyParams?: {
    reorderPoint?: number;
    orderQuantity?: number;
    standardPrice?: number;
    standardBatchSize?: number;
    mceAllocationCustom?: number;
    dailyOvertimeHours?: number;
  };
}

export interface OptimizationConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  elitePercentage: number;
}

export interface OptimizationConstraints {
  // Policy decisions - true means FIXED (don't change), false means VARIABLE (can optimize)
  fixedPolicies: {
    reorderPoint: boolean;
    orderQuantity: boolean;
    standardPrice: boolean;
    standardBatchSize: boolean;
    mceAllocationCustom: boolean;
    dailyOvertimeHours: boolean;
  };
  // Timed actions - can mark specific actions as fixed
  fixedActions: Set<string>; // Action IDs that cannot be changed
  // Test day configuration
  testDay: number;
  endDay: number;
}

/**
 * Generate formula-based action suggestions for a specific day
 */
export function generateFormulaBasedActions(day: number, baseStrategy: Strategy): StrategyAction[] {
  const actions: StrategyAction[] = [];
  const MATERIAL_COST = 50;
  const ORDER_FEE = 1000;
  const DAILY_INTEREST = 0.365 / 365;

  // EOQ-based order quantity (60% chance)
  if (Math.random() < 0.6) {
    const eoq = calculateEOQ({
      annualDemand: 100000,
      orderingCost: ORDER_FEE,
      holdingCostPerUnit: MATERIAL_COST * 0.2,
    });
    // Constrain order quantity to reasonable range (100-2000 units)
    const proposedQty = Math.round(eoq.value * (0.8 + Math.random() * 0.4));
    const boundedQty = Math.max(100, Math.min(2000, proposedQty));
    actions.push({
      day,
      type: 'SET_ORDER_QUANTITY',
      newOrderQuantity: boundedQty,
    });
  }

  // ROP-based reorder point (60% chance)
  if (Math.random() < 0.6) {
    const rop = calculateROP({
      averageDailyDemand: 300,
      leadTimeDays: 4,
      demandStdDev: 50,
      serviceLevel: 0.95,
    });
    // Constrain reorder point to reasonable range (200-1000 units)
    const proposedROP = Math.round(rop.value * (0.8 + Math.random() * 0.4));
    const boundedROP = Math.max(200, Math.min(1000, proposedROP));
    actions.push({
      day,
      type: 'SET_REORDER_POINT',
      newReorderPoint: boundedROP,
    });
  }

  // EPQ-based batch size (50% chance)
  if (Math.random() < 0.5) {
    const epq = calculateEPQ({
      annualDemand: 50000,
      setupCost: 100,
      holdingCostPerUnit: 100 * 0.2,
      dailyDemandRate: 140,
      dailyProductionRate: 200,
    });
    // Constrain batch size to reasonable range (50-500 units)
    const proposedBatch = Math.round(epq.value * (0.8 + Math.random() * 0.4));
    const boundedBatch = Math.max(50, Math.min(500, proposedBatch));
    actions.push({
      day,
      type: 'ADJUST_BATCH_SIZE',
      newSize: boundedBatch,
    });
  }

  // Queuing theory-based hiring (40% chance)
  if (Math.random() < 0.4) {
    const queue = calculateQueueMetrics({
      arrivalRate: 150,
      serviceRate: 3,
      numServers: 2,
    });

    if (queue.value > 5) { // High wait time, hire workers
      actions.push({
        day,
        type: Math.random() < 0.7 ? 'HIRE_ROOKIE' : 'HIRE_EXPERT',
        count: Math.floor(1 + Math.random() * 3), // 1-3 workers
      });
    }
  }

  // NPV-based machine purchase (30% chance, only if enough days remain)
  const daysLeft = 500 - day;
  if (daysLeft > 100 && Math.random() < 0.3) {
    const npv = calculateNPV({
      initialInvestment: 20000,
      dailyCashFlow: 100,
      daysRemaining: daysLeft,
      dailyDiscountRate: DAILY_INTEREST,
    });

    if (npv.value > 0) { // Positive NPV
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      actions.push({
        day,
        type: 'BUY_MACHINE',
        machineType: machineTypes[Math.floor(Math.random() * machineTypes.length)],
        count: 1,
      });
    }
  }

  // Optimal pricing (40% chance)
  if (Math.random() < 0.4) {
    const optimalPrice = calculateOptimalPrice({
      demandIntercept: baseStrategy.standardDemandIntercept,
      priceSlope: baseStrategy.standardDemandSlope,
      unitCost: 200,
    });
    // Ensure price stays within reasonable bounds ($400-$1200)
    const proposedPrice = Math.round(optimalPrice.value * (0.9 + Math.random() * 0.2));
    const boundedPrice = Math.max(400, Math.min(1200, proposedPrice));
    actions.push({
      day,
      type: 'ADJUST_PRICE',
      productType: 'standard',
      newPrice: boundedPrice,
    });
  }

  return actions;
}

/**
 * Generate random action variations
 */
export function generateRandomActions(day: number): StrategyAction[] {
  const actions: StrategyAction[] = [];
  const actionCount = Math.floor(1 + Math.random() * 3); // 1-3 actions

  for (let i = 0; i < actionCount; i++) {
    const actionType = Math.random();

    if (actionType < 0.15) {
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: Math.floor(1 + Math.random() * 4),
      });
    } else if (actionType < 0.25) {
      actions.push({
        day,
        type: 'HIRE_EXPERT',
        count: Math.floor(1 + Math.random() * 3),
      });
    } else if (actionType < 0.35) {
      const machines: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      actions.push({
        day,
        type: 'BUY_MACHINE',
        machineType: machines[Math.floor(Math.random() * 3)],
        count: 1,
      });
    } else if (actionType < 0.50) {
      actions.push({
        day,
        type: 'SET_ORDER_QUANTITY',
        newOrderQuantity: Math.floor(200 + Math.random() * 1300), // 200-1500
      });
    } else if (actionType < 0.65) {
      actions.push({
        day,
        type: 'SET_REORDER_POINT',
        newReorderPoint: Math.floor(200 + Math.random() * 600), // 200-800
      });
    } else if (actionType < 0.80) {
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: Math.floor(50 + Math.random() * 400), // 50-450
      });
    } else {
      actions.push({
        day,
        type: 'ADJUST_PRICE',
        productType: 'standard',
        newPrice: Math.floor(500 + Math.random() * 600), // 500-1100
      });
    }
  }

  return actions;
}

/**
 * Mutate actions with random changes
 */
export function mutateActions(actions: StrategyAction[], mutationRate: number): StrategyAction[] {
  return actions.map(action => {
    if (Math.random() > mutationRate) return action;

    // Mutate the action
    const mutated = { ...action };

    if ('count' in mutated) {
      mutated.count = Math.max(1, Math.min(5, Math.floor(mutated.count * (0.7 + Math.random() * 0.6))));
    }
    if ('newOrderQuantity' in mutated) {
      const mutatedQty = Math.floor(mutated.newOrderQuantity * (0.7 + Math.random() * 0.6));
      mutated.newOrderQuantity = Math.max(100, Math.min(2000, mutatedQty));
    }
    if ('newReorderPoint' in mutated) {
      const mutatedROP = Math.floor(mutated.newReorderPoint * (0.7 + Math.random() * 0.6));
      mutated.newReorderPoint = Math.max(200, Math.min(1000, mutatedROP));
    }
    if ('newSize' in mutated) {
      const mutatedSize = Math.floor(mutated.newSize * (0.7 + Math.random() * 0.6));
      mutated.newSize = Math.max(50, Math.min(500, mutatedSize));
    }
    if ('newPrice' in mutated) {
      const mutatedPrice = Math.floor(mutated.newPrice * (0.8 + Math.random() * 0.4));
      mutated.newPrice = Math.max(400, Math.min(1200, mutatedPrice));
    }

    return mutated;
  });
}

/**
 * Crossover two parent action sets
 */
export function crossoverActions(parent1: StrategyAction[], parent2: StrategyAction[]): StrategyAction[] {
  const splitPoint = Math.floor(Math.random() * Math.min(parent1.length, parent2.length));
  return [
    ...parent1.slice(0, splitPoint),
    ...parent2.slice(splitPoint),
  ];
}

/**
 * Generate random strategy parameters within valid bounds
 */
export function generateRandomStrategyParams(): OptimizationCandidate['strategyParams'] {
  return {
    reorderPoint: Math.floor(200 + Math.random() * 800), // 200-1000
    orderQuantity: Math.floor(200 + Math.random() * 1800), // 200-2000
    standardPrice: Math.floor(500 + Math.random() * 700), // 500-1200
    standardBatchSize: Math.floor(50 + Math.random() * 450), // 50-500
    mceAllocationCustom: Math.random() * 0.6 + 0.2, // 0.2-0.8 (20%-80% to custom)
    dailyOvertimeHours: Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0, // 0-2 hours, 30% chance
  };
}

/**
 * Mutate strategy parameters
 */
export function mutateStrategyParams(
  params: OptimizationCandidate['strategyParams'],
  mutationRate: number
): OptimizationCandidate['strategyParams'] {
  if (!params) return generateRandomStrategyParams();

  const mutated = { ...params };

  if (Math.random() < mutationRate && mutated.reorderPoint) {
    const change = Math.floor((Math.random() - 0.5) * 200); // ±100
    mutated.reorderPoint = Math.max(200, Math.min(1000, mutated.reorderPoint + change));
  }

  if (Math.random() < mutationRate && mutated.orderQuantity) {
    const change = Math.floor((Math.random() - 0.5) * 400); // ±200
    mutated.orderQuantity = Math.max(200, Math.min(2000, mutated.orderQuantity + change));
  }

  if (Math.random() < mutationRate && mutated.standardPrice) {
    const change = Math.floor((Math.random() - 0.5) * 200); // ±100
    mutated.standardPrice = Math.max(400, Math.min(1200, mutated.standardPrice + change));
  }

  if (Math.random() < mutationRate && mutated.standardBatchSize) {
    const change = Math.floor((Math.random() - 0.5) * 100); // ±50
    mutated.standardBatchSize = Math.max(50, Math.min(500, mutated.standardBatchSize + change));
  }

  if (Math.random() < mutationRate && mutated.mceAllocationCustom !== undefined) {
    const change = (Math.random() - 0.5) * 0.2; // ±0.1
    mutated.mceAllocationCustom = Math.max(0.2, Math.min(0.8, mutated.mceAllocationCustom + change));
  }

  if (Math.random() < mutationRate && mutated.dailyOvertimeHours !== undefined) {
    mutated.dailyOvertimeHours = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 3);
  }

  return mutated;
}

/**
 * Generate random strategy parameters respecting constraints
 */
export function generateConstrainedStrategyParams(
  _baseStrategy: Strategy,
  constraints: OptimizationConstraints
): OptimizationCandidate['strategyParams'] {
  const params: OptimizationCandidate['strategyParams'] = {};

  // Only generate random values for variable (non-fixed) policies
  if (!constraints.fixedPolicies.reorderPoint) {
    params.reorderPoint = Math.floor(200 + Math.random() * 800); // 200-1000
  }
  if (!constraints.fixedPolicies.orderQuantity) {
    params.orderQuantity = Math.floor(200 + Math.random() * 1800); // 200-2000
  }
  if (!constraints.fixedPolicies.standardPrice) {
    params.standardPrice = Math.floor(500 + Math.random() * 700); // 500-1200
  }
  if (!constraints.fixedPolicies.standardBatchSize) {
    params.standardBatchSize = Math.floor(50 + Math.random() * 450); // 50-500
  }
  if (!constraints.fixedPolicies.mceAllocationCustom) {
    params.mceAllocationCustom = Math.random() * 0.6 + 0.2; // 0.2-0.8
  }
  if (!constraints.fixedPolicies.dailyOvertimeHours) {
    params.dailyOvertimeHours = Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
  }

  return params;
}

/**
 * Mutate strategy parameters respecting constraints
 */
export function mutateConstrainedStrategyParams(
  params: OptimizationCandidate['strategyParams'],
  constraints: OptimizationConstraints,
  mutationRate: number
): OptimizationCandidate['strategyParams'] {
  if (!params) return {};

  const mutated = { ...params };

  // Only mutate variable (non-fixed) policies
  if (!constraints.fixedPolicies.reorderPoint && Math.random() < mutationRate && mutated.reorderPoint) {
    const change = Math.floor((Math.random() - 0.5) * 200);
    mutated.reorderPoint = Math.max(200, Math.min(1000, mutated.reorderPoint + change));
  }

  if (!constraints.fixedPolicies.orderQuantity && Math.random() < mutationRate && mutated.orderQuantity) {
    const change = Math.floor((Math.random() - 0.5) * 400);
    mutated.orderQuantity = Math.max(200, Math.min(2000, mutated.orderQuantity + change));
  }

  if (!constraints.fixedPolicies.standardPrice && Math.random() < mutationRate && mutated.standardPrice) {
    const change = Math.floor((Math.random() - 0.5) * 200);
    mutated.standardPrice = Math.max(400, Math.min(1200, mutated.standardPrice + change));
  }

  if (!constraints.fixedPolicies.standardBatchSize && Math.random() < mutationRate && mutated.standardBatchSize) {
    const change = Math.floor((Math.random() - 0.5) * 100);
    mutated.standardBatchSize = Math.max(50, Math.min(500, mutated.standardBatchSize + change));
  }

  if (!constraints.fixedPolicies.mceAllocationCustom && Math.random() < mutationRate && mutated.mceAllocationCustom !== undefined) {
    const change = (Math.random() - 0.5) * 0.2;
    mutated.mceAllocationCustom = Math.max(0.2, Math.min(0.8, mutated.mceAllocationCustom + change));
  }

  if (!constraints.fixedPolicies.dailyOvertimeHours && Math.random() < mutationRate && mutated.dailyOvertimeHours !== undefined) {
    mutated.dailyOvertimeHours = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 3);
  }

  return mutated;
}

/**
 * Filter actions to exclude fixed ones
 */
export function filterConstrainedActions(
  actions: StrategyAction[],
  fixedActions: Set<string>
): StrategyAction[] {
  return actions.filter(action => {
    const actionId = `action-${action.day}-${action.type}-${actions.indexOf(action)}`;
    return !fixedActions.has(actionId);
  });
}

/**
 * Generate initial population
 */
export function generateInitialPopulation(
  day: number,
  baseStrategy: Strategy,
  populationSize: number
): StrategyAction[][] {
  const population: StrategyAction[][] = [];

  // 40% formula-based
  const formulaCount = Math.floor(populationSize * 0.4);
  for (let i = 0; i < formulaCount; i++) {
    population.push(generateFormulaBasedActions(day, baseStrategy));
  }

  // 30% variations around formulas
  const variationCount = Math.floor(populationSize * 0.3);
  for (let i = 0; i < variationCount; i++) {
    const base = generateFormulaBasedActions(day, baseStrategy);
    population.push(mutateActions(base, 0.5)); // High mutation for variations
  }

  // 30% random exploration
  const randomCount = populationSize - formulaCount - variationCount;
  for (let i = 0; i < randomCount; i++) {
    population.push(generateRandomActions(day));
  }

  return population;
}
