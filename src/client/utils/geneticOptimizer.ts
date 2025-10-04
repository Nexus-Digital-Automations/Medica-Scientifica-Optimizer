import type { Strategy, StrategyAction } from '../types/ui.types';
import { calculateEOQ, calculateROP, calculateEPQ, calculateNPV, calculateQueueMetrics, calculateOptimalPrice } from './formulaCalculations';

export interface OptimizationCandidate {
  id: string;
  actions: StrategyAction[];
  fitness: number;
  netWorth: number;
  error?: string; // Error message if simulation failed
  // Daily net worth history for graphing
  history?: Array<{ day: number; value: number }>;
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
  console.log('[GeneticOptimizer] generateFormulaBasedActions called - ENHANCED VERSION with hiring/machines');
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

  // Queuing theory-based hiring (50% chance, removed restrictive condition)
  if (Math.random() < 0.5) {
    const queue = calculateQueueMetrics({
      arrivalRate: 150,
      serviceRate: 3,
      numServers: 2,
    });

    // Test more aggressive hiring strategies
    const hireCount = queue.value > 5
      ? Math.floor(2 + Math.random() * 3) // 2-4 workers if high queue
      : Math.floor(1 + Math.random() * 2); // 1-2 workers otherwise

    console.log('[GeneticOptimizer] Adding HIRE_ROOKIE action:', { day, count: hireCount });
    actions.push({
      day,
      type: 'HIRE_ROOKIE',
      count: hireCount,
    });
  }

  // NPV-based machine purchase (50% chance, test early and aggressive strategies)
  const daysLeft = 500 - day;
  if (Math.random() < 0.5) {
    const npv = calculateNPV({
      initialInvestment: 20000,
      dailyCashFlow: 100,
      daysRemaining: daysLeft,
      dailyDiscountRate: DAILY_INTEREST,
    });

    // Test more aggressive machine purchases (removed NPV restriction)
    const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
    const machineCount = npv.value > 0 && daysLeft > 100
      ? Math.floor(1 + Math.random() * 2) // 1-2 machines if good NPV
      : 1; // 1 machine for aggressive testing

    const machineType = machineTypes[Math.floor(Math.random() * machineTypes.length)];
    console.log('[GeneticOptimizer] Adding BUY_MACHINE action:', { day, machineType, count: machineCount });
    actions.push({
      day,
      type: 'BUY_MACHINE',
      machineType,
      count: machineCount,
    });
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

  console.log('[GeneticOptimizer] generateFormulaBasedActions complete - generated', actions.length, 'actions:', actions.map(a => a.type));
  return actions;
}

/**
 * Generate random action variations
 * Enhanced to test more diverse strategies including hiring, machines, and one-time actions
 */
export function generateRandomActions(day: number): StrategyAction[] {
  console.log('[GeneticOptimizer] generateRandomActions called - ENHANCED VERSION with 45% hiring, 40% machines');
  const actions: StrategyAction[] = [];
  const actionCount = Math.floor(2 + Math.random() * 4); // 2-5 actions for more diversity

  for (let i = 0; i < actionCount; i++) {
    const actionType = Math.random();

    if (actionType < 0.45) { // 45% - HIRE_ROOKIE (increased from 20%)
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: Math.floor(1 + Math.random() * 4), // 1-4 workers
      });
    } else if (actionType < 0.85) { // 40% - BUY_MACHINE (increased from 15%)
      const machines: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      actions.push({
        day,
        type: 'BUY_MACHINE',
        machineType: machines[Math.floor(Math.random() * 3)],
        count: Math.floor(1 + Math.random() * 2), // 1-2 machines
      });
    } else if (actionType < 0.87) { // 2% - FIRE_EMPLOYEE (new action type)
      const employeeTypes: Array<'expert' | 'rookie'> = ['expert', 'rookie'];
      actions.push({
        day,
        type: 'FIRE_EMPLOYEE',
        employeeType: employeeTypes[Math.floor(Math.random() * 2)],
        count: Math.floor(1 + Math.random() * 2), // 1-2 employees
      });
    } else if (actionType < 0.89) { // 2% - SELL_MACHINE (new action type)
      const machines: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      actions.push({
        day,
        type: 'SELL_MACHINE',
        machineType: machines[Math.floor(Math.random() * 3)],
        count: 1,
      });
    } else if (actionType < 0.92) { // 3% - SET_ORDER_QUANTITY
      actions.push({
        day,
        type: 'SET_ORDER_QUANTITY',
        newOrderQuantity: Math.floor(200 + Math.random() * 1800), // 200-2000
      });
    } else if (actionType < 0.95) { // 3% - SET_REORDER_POINT
      actions.push({
        day,
        type: 'SET_REORDER_POINT',
        newReorderPoint: Math.floor(200 + Math.random() * 800), // 200-1000
      });
    } else if (actionType < 0.97) { // 2% - ADJUST_BATCH_SIZE
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: Math.floor(50 + Math.random() * 450), // 50-500
      });
    } else { // 3% - ADJUST_PRICE
      actions.push({
        day,
        type: 'ADJUST_PRICE',
        productType: 'standard',
        newPrice: Math.floor(400 + Math.random() * 800), // 400-1200
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
 * Estimate the cash cost of an action
 * Returns negative value for costs, positive for revenue
 */
function estimateActionCost(action: StrategyAction): number {
  switch (action.type) {
    case 'HIRE_ROOKIE':
      return -5000 * (action.count || 1); // $5000 per worker
    case 'BUY_MACHINE':
      return -20000 * (action.count || 1); // $20000 per machine
    case 'ORDER_MATERIALS':
      return -50 * (action.quantity || 0); // ~$50 per unit
    case 'TAKE_LOAN':
      return action.amount || 0; // Positive cash inflow
    case 'PAY_DEBT':
      return -(action.amount || 0); // Negative cash outflow
    default:
      return 0; // Most actions (pricing, batch size, etc.) have no immediate cash impact
  }
}

/**
 * Add automatic loan management to ensure actions don't violate cash minimums
 * Inserts TAKE_LOAN actions before cash-negative actions when needed
 */
export function ensureSufficientCash(
  actions: StrategyAction[],
  initialCash: number = 100000,
  minCashThreshold: number = 50000
): StrategyAction[] {
  const result: StrategyAction[] = [];
  let estimatedCash = initialCash;

  for (const action of actions) {
    const actionCost = estimateActionCost(action);
    const cashAfterAction = estimatedCash + actionCost;

    // If action would violate minimum cash threshold, insert loan first
    if (cashAfterAction < minCashThreshold && actionCost < 0) {
      // Calculate loan amount needed: cover the cost + restore to 75% above minimum
      const loanAmount = Math.ceil(
        Math.abs(actionCost) + (minCashThreshold * 0.75)
      );

      // Round loan to nearest $10,000 for realism
      const roundedLoan = Math.ceil(loanAmount / 10000) * 10000;

      result.push({
        day: action.day,
        type: 'TAKE_LOAN',
        amount: roundedLoan,
      });

      estimatedCash += roundedLoan;
    }

    result.push(action);
    estimatedCash += actionCost;
  }

  return result;
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
