import type { Strategy, StrategyAction } from '../types/ui.types';
import { calculateEOQ, calculateROP, calculateEPQ, calculateNPV, calculateQueueMetrics, calculateOptimalPrice } from './formulaCalculations';

export interface SimulationState {
  finalNetWorth?: number;
  state?: {
    cash?: number;
    debt?: number;
    inventory?: number;
    backlog?: number;
    totalRevenue?: number;
    totalCosts?: number;
    profit?: number;
    machines?: {
      MCE?: number;
      WMA?: number;
      PUC?: number;
    };
    employees?: {
      experts?: number;
      rookies?: number;
      rookiesInTraining?: number;
    };
    history?: Record<string, Array<{ day: number; value: number } | number>>;
  };
}

export interface OptimizationCandidate {
  id: string;
  actions: StrategyAction[];
  fitness: number;
  netWorth: number;
  growthRate?: number; // $/day growth rate over evaluation window
  error?: string; // Error message if simulation failed
  // Daily net worth history for graphing
  history?: Array<{ day: number; value: number }>;
  // Full simulation state for comprehensive CSV export
  fullState?: SimulationState; // Contains complete simulation results
  // Strategy parameter overrides
  strategyParams?: {
    reorderPoint?: number;
    orderQuantity?: number;
    standardPrice?: number;
    standardBatchSize?: number;
    mceAllocationCustom?: number;
    dailyOvertimeHours?: number;
    autoDebtPaydown?: boolean;
    minCashReserveDays?: number;
    debtPaydownAggressiveness?: number;
    preemptiveWageLoanDays?: number;
    maxDebtThreshold?: number;
    emergencyLoanBuffer?: number;
  };
}

export interface OptimizationConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  elitePercentage: number;
}

// Lock state for granular control
type LockState = 'unlocked' | 'minimum' | 'maximum' | 'locked';

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
  // Evaluation window for short-term growth rate calculation
  evaluationWindow: number; // Days to measure growth rate (default: 30)
  // Min/Max ranges for policy parameters (suggested from bottleneck analysis)
  policyRanges?: {
    reorderPoint?: { min?: number; max?: number };
    orderQuantity?: { min?: number; max?: number };
    standardPrice?: { min?: number; max?: number };
    standardBatchSize?: { min?: number; max?: number };
    mceAllocationCustom?: { min?: number; max?: number };
    dailyOvertimeHours?: { min?: number; max?: number };
  };
  // Min/Max for workforce (total workers: experts + rookies)
  workforceRange?: { min?: number; max?: number };
  // Min/Max for machines
  machineRanges?: {
    MCE?: { min?: number; max?: number };
    WMA?: { min?: number; max?: number };
    PUC?: { min?: number; max?: number };
  };
  // Policy lock states for optimization direction control
  policyLockStates?: {
    batchSize?: LockState;
    price?: LockState;
    mceAllocation?: LockState;
    reorderPoint?: LockState;
    orderQuantity?: LockState;
    dailyOvertimeHours?: LockState;
  };
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
    autoDebtPaydown: Math.random() > 0.2, // 80% chance enabled (optimal default)
    minCashReserveDays: Math.floor(5 + Math.random() * 11), // 5-15 days
    debtPaydownAggressiveness: Math.random() * 0.5 + 0.5, // 0.5-1.0 (50%-100%)
    preemptiveWageLoanDays: Math.floor(3 + Math.random() * 5), // 3-7 days
    maxDebtThreshold: Math.floor(100000 + Math.random() * 200000), // $100K-$300K
    emergencyLoanBuffer: Math.floor(5000 + Math.random() * 25000), // $5K-$30K
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

  // Debt management mutations
  if (Math.random() < mutationRate && mutated.autoDebtPaydown !== undefined) {
    mutated.autoDebtPaydown = Math.random() > 0.3; // 70% chance enabled after mutation
  }

  if (Math.random() < mutationRate && mutated.minCashReserveDays) {
    const change = Math.floor((Math.random() - 0.5) * 4); // ±2 days
    mutated.minCashReserveDays = Math.max(5, Math.min(15, mutated.minCashReserveDays + change));
  }

  if (Math.random() < mutationRate && mutated.debtPaydownAggressiveness !== undefined) {
    const change = (Math.random() - 0.5) * 0.2; // ±0.1
    mutated.debtPaydownAggressiveness = Math.max(0.5, Math.min(1.0, mutated.debtPaydownAggressiveness + change));
  }

  if (Math.random() < mutationRate && mutated.preemptiveWageLoanDays) {
    const change = Math.floor((Math.random() - 0.5) * 2); // ±1 day
    mutated.preemptiveWageLoanDays = Math.max(3, Math.min(7, mutated.preemptiveWageLoanDays + change));
  }

  if (Math.random() < mutationRate && mutated.maxDebtThreshold) {
    const change = Math.floor((Math.random() - 0.5) * 40000); // ±$20K
    mutated.maxDebtThreshold = Math.max(100000, Math.min(300000, mutated.maxDebtThreshold + change));
  }

  if (Math.random() < mutationRate && mutated.emergencyLoanBuffer) {
    const change = Math.floor((Math.random() - 0.5) * 6000); // ±$3K
    mutated.emergencyLoanBuffer = Math.max(5000, Math.min(30000, mutated.emergencyLoanBuffer + change));
  }

  return mutated;
}

/**
 * Generate random strategy parameters respecting constraints
 */
export function generateConstrainedStrategyParams(
  baseStrategy: Strategy,
  constraints: OptimizationConstraints
): OptimizationCandidate['strategyParams'] {
  const params: OptimizationCandidate['strategyParams'] = {};

  // Only generate random values for variable (non-fixed) policies
  // Respect min/max constraints from policyRanges AND lock states

  // Reorder Point - respect lock state
  if (!constraints.fixedPolicies.reorderPoint) {
    let min = constraints.policyRanges?.reorderPoint?.min ?? 200;
    let max = constraints.policyRanges?.reorderPoint?.max ?? 1000;
    const currentReorderPoint = baseStrategy.reorderPoint;
    const lockState = constraints.policyLockStates?.reorderPoint;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentReorderPoint); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentReorderPoint); // Can only decrease
    }

    params.reorderPoint = Math.floor(min + Math.random() * (max - min + 1));
  }

  // Order Quantity - respect lock state
  if (!constraints.fixedPolicies.orderQuantity) {
    let min = constraints.policyRanges?.orderQuantity?.min ?? 200;
    let max = constraints.policyRanges?.orderQuantity?.max ?? 2000;
    const currentOrderQuantity = baseStrategy.orderQuantity;
    const lockState = constraints.policyLockStates?.orderQuantity;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentOrderQuantity); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentOrderQuantity); // Can only decrease
    }

    params.orderQuantity = Math.floor(min + Math.random() * (max - min + 1));
  }

  // Standard Price - respect lock state
  if (!constraints.fixedPolicies.standardPrice) {
    let min = constraints.policyRanges?.standardPrice?.min ?? 500;
    let max = constraints.policyRanges?.standardPrice?.max ?? 1200;
    const currentPrice = baseStrategy.standardPrice;
    const lockState = constraints.policyLockStates?.price;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentPrice); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentPrice); // Can only decrease
    }

    params.standardPrice = Math.floor(min + Math.random() * (max - min + 1));
  }

  // Standard Batch Size - respect lock state
  if (!constraints.fixedPolicies.standardBatchSize) {
    let min = constraints.policyRanges?.standardBatchSize?.min ?? 50;
    let max = constraints.policyRanges?.standardBatchSize?.max ?? 500;
    const currentBatchSize = baseStrategy.standardBatchSize;
    const lockState = constraints.policyLockStates?.batchSize;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentBatchSize); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentBatchSize); // Can only decrease
    }

    params.standardBatchSize = Math.floor(min + Math.random() * (max - min + 1));
  }

  // MCE Allocation - respect lock state
  if (!constraints.fixedPolicies.mceAllocationCustom) {
    let min = constraints.policyRanges?.mceAllocationCustom?.min ?? 0.2;
    let max = constraints.policyRanges?.mceAllocationCustom?.max ?? 0.8;
    const currentAllocation = baseStrategy.mceAllocationCustom;
    const lockState = constraints.policyLockStates?.mceAllocation;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentAllocation); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentAllocation); // Can only decrease
    }

    params.mceAllocationCustom = min + Math.random() * (max - min);
  }

  // Daily Overtime Hours - respect lock state
  if (!constraints.fixedPolicies.dailyOvertimeHours) {
    let min = constraints.policyRanges?.dailyOvertimeHours?.min ?? 0;
    let max = constraints.policyRanges?.dailyOvertimeHours?.max ?? 3;
    const currentOvertimeHours = baseStrategy.dailyOvertimeHours;
    const lockState = constraints.policyLockStates?.dailyOvertimeHours;

    // Adjust range based on lock state
    if (lockState === 'minimum') {
      min = Math.max(min, currentOvertimeHours); // Can only increase
    } else if (lockState === 'maximum') {
      max = Math.min(max, currentOvertimeHours); // Can only decrease
    }

    params.dailyOvertimeHours = Math.random() < 0.3 ? Math.floor(min + Math.random() * (max - min + 1)) : 0;
  }

  return params;
}

/**
 * Mutate strategy parameters respecting constraints and lock states
 */
export function mutateConstrainedStrategyParams(
  params: OptimizationCandidate['strategyParams'],
  constraints: OptimizationConstraints,
  mutationRate: number,
  baseStrategy?: Strategy
): OptimizationCandidate['strategyParams'] {
  if (!params) return {};

  const mutated = { ...params };

  // Only mutate variable (non-fixed) policies
  // Respect min/max constraints from policyRanges AND lock states

  // Reorder Point - respect lock state
  if (!constraints.fixedPolicies.reorderPoint && Math.random() < mutationRate && mutated.reorderPoint) {
    let min = constraints.policyRanges?.reorderPoint?.min ?? 200;
    let max = constraints.policyRanges?.reorderPoint?.max ?? 1000;
    const lockState = constraints.policyLockStates?.reorderPoint;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.reorderPoint); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.reorderPoint); // Can only decrease
    }

    const change = Math.floor((Math.random() - 0.5) * 200);
    mutated.reorderPoint = Math.max(min, Math.min(max, mutated.reorderPoint + change));
  }

  // Order Quantity - respect lock state
  if (!constraints.fixedPolicies.orderQuantity && Math.random() < mutationRate && mutated.orderQuantity) {
    let min = constraints.policyRanges?.orderQuantity?.min ?? 200;
    let max = constraints.policyRanges?.orderQuantity?.max ?? 2000;
    const lockState = constraints.policyLockStates?.orderQuantity;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.orderQuantity); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.orderQuantity); // Can only decrease
    }

    const change = Math.floor((Math.random() - 0.5) * 400);
    mutated.orderQuantity = Math.max(min, Math.min(max, mutated.orderQuantity + change));
  }

  // Standard Price - respect lock state
  if (!constraints.fixedPolicies.standardPrice && Math.random() < mutationRate && mutated.standardPrice) {
    let min = constraints.policyRanges?.standardPrice?.min ?? 400;
    let max = constraints.policyRanges?.standardPrice?.max ?? 1200;
    const lockState = constraints.policyLockStates?.price;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.standardPrice); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.standardPrice); // Can only decrease
    }

    const change = Math.floor((Math.random() - 0.5) * 200);
    mutated.standardPrice = Math.max(min, Math.min(max, mutated.standardPrice + change));
  }

  // Standard Batch Size - respect lock state
  if (!constraints.fixedPolicies.standardBatchSize && Math.random() < mutationRate && mutated.standardBatchSize) {
    let min = constraints.policyRanges?.standardBatchSize?.min ?? 50;
    let max = constraints.policyRanges?.standardBatchSize?.max ?? 500;
    const lockState = constraints.policyLockStates?.batchSize;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.standardBatchSize); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.standardBatchSize); // Can only decrease
    }

    const change = Math.floor((Math.random() - 0.5) * 100);
    mutated.standardBatchSize = Math.max(min, Math.min(max, mutated.standardBatchSize + change));
  }

  // MCE Allocation - respect lock state
  if (!constraints.fixedPolicies.mceAllocationCustom && Math.random() < mutationRate && mutated.mceAllocationCustom !== undefined) {
    let min = constraints.policyRanges?.mceAllocationCustom?.min ?? 0.2;
    let max = constraints.policyRanges?.mceAllocationCustom?.max ?? 0.8;
    const lockState = constraints.policyLockStates?.mceAllocation;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.mceAllocationCustom); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.mceAllocationCustom); // Can only decrease
    }

    const change = (Math.random() - 0.5) * 0.2;
    mutated.mceAllocationCustom = Math.max(min, Math.min(max, mutated.mceAllocationCustom + change));
  }

  // Daily Overtime Hours - respect lock state
  if (!constraints.fixedPolicies.dailyOvertimeHours && Math.random() < mutationRate && mutated.dailyOvertimeHours !== undefined) {
    let min = constraints.policyRanges?.dailyOvertimeHours?.min ?? 0;
    let max = constraints.policyRanges?.dailyOvertimeHours?.max ?? 3;
    const lockState = constraints.policyLockStates?.dailyOvertimeHours;

    // Adjust range based on lock state (relative to baseStrategy current value)
    if (baseStrategy && lockState === 'minimum') {
      min = Math.max(min, baseStrategy.dailyOvertimeHours); // Can only increase
    } else if (baseStrategy && lockState === 'maximum') {
      max = Math.min(max, baseStrategy.dailyOvertimeHours); // Can only decrease
    }

    mutated.dailyOvertimeHours = Math.random() < 0.5 ? 0 : Math.floor(min + Math.random() * (max - min + 1));
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

// ==================== PHASE 2 REFINEMENT FUNCTIONS ====================

/**
 * Generate local variations around a candidate's actions
 * Used for refinement with smaller mutation ranges
 * @param actions - Original actions from Phase 1
 * @param range - Mutation range (0.1 = ±10%, 0.15 = ±15%)
 */
export function generateLocalVariations(
  actions: StrategyAction[],
  range: number
): StrategyAction[] {
  return actions.map(action => {
    const mutated = { ...action };

    // Smaller mutations for refinement (±5-15% typical)
    if ('count' in mutated && mutated.count !== undefined) {
      const change = Math.floor(mutated.count * range * (Math.random() * 2 - 1));
      mutated.count = Math.max(1, Math.min(10, mutated.count + change));
    }
    if ('newOrderQuantity' in mutated && mutated.newOrderQuantity !== undefined) {
      const change = Math.floor(mutated.newOrderQuantity * range * (Math.random() * 2 - 1));
      mutated.newOrderQuantity = Math.max(100, Math.min(2000, mutated.newOrderQuantity + change));
    }
    if ('newReorderPoint' in mutated && mutated.newReorderPoint !== undefined) {
      const change = Math.floor(mutated.newReorderPoint * range * (Math.random() * 2 - 1));
      mutated.newReorderPoint = Math.max(200, Math.min(1000, mutated.newReorderPoint + change));
    }
    if ('newSize' in mutated && mutated.newSize !== undefined) {
      const change = Math.floor(mutated.newSize * range * (Math.random() * 2 - 1));
      mutated.newSize = Math.max(50, Math.min(500, mutated.newSize + change));
    }
    if ('newPrice' in mutated && mutated.newPrice !== undefined) {
      const change = Math.floor(mutated.newPrice * range * (Math.random() * 2 - 1));
      mutated.newPrice = Math.max(400, Math.min(1200, mutated.newPrice + change));
    }
    if ('newAllocation' in mutated && mutated.newAllocation !== undefined) {
      const change = mutated.newAllocation * range * (Math.random() * 2 - 1);
      mutated.newAllocation = Math.max(0.2, Math.min(0.8, mutated.newAllocation + change));
    }

    return mutated;
  });
}

/**
 * Refinement mutation for strategy parameters (smaller changes than Phase 1)
 * @param params - Strategy parameters to mutate
 * @param intensity - Mutation intensity (0.05-0.15 recommended for refinement)
 * @param constraints - Optional constraints to respect fixed policies
 */
export function mutateRefinement(
  params: OptimizationCandidate['strategyParams'],
  intensity: number,
  constraints?: OptimizationConstraints
): OptimizationCandidate['strategyParams'] {
  if (!params) return params;

  const mutated = { ...params };

  // Only mutate if not fixed in constraints
  if (mutated.reorderPoint !== undefined && (!constraints || !constraints.fixedPolicies.reorderPoint)) {
    const change = Math.floor(mutated.reorderPoint * intensity * (Math.random() * 2 - 1));
    mutated.reorderPoint = Math.max(200, Math.min(1000, mutated.reorderPoint + change));
  }

  if (mutated.orderQuantity !== undefined && (!constraints || !constraints.fixedPolicies.orderQuantity)) {
    const change = Math.floor(mutated.orderQuantity * intensity * (Math.random() * 2 - 1));
    mutated.orderQuantity = Math.max(200, Math.min(2000, mutated.orderQuantity + change));
  }

  if (mutated.standardPrice !== undefined && (!constraints || !constraints.fixedPolicies.standardPrice)) {
    const change = Math.floor(mutated.standardPrice * intensity * (Math.random() * 2 - 1));
    mutated.standardPrice = Math.max(400, Math.min(1200, mutated.standardPrice + change));
  }

  if (mutated.standardBatchSize !== undefined && (!constraints || !constraints.fixedPolicies.standardBatchSize)) {
    const change = Math.floor(mutated.standardBatchSize * intensity * (Math.random() * 2 - 1));
    mutated.standardBatchSize = Math.max(50, Math.min(500, mutated.standardBatchSize + change));
  }

  if (mutated.mceAllocationCustom !== undefined && (!constraints || !constraints.fixedPolicies.mceAllocationCustom)) {
    const change = mutated.mceAllocationCustom * intensity * (Math.random() * 2 - 1);
    mutated.mceAllocationCustom = Math.max(0.2, Math.min(0.8, mutated.mceAllocationCustom + change));
  }

  if (mutated.dailyOvertimeHours !== undefined && (!constraints || !constraints.fixedPolicies.dailyOvertimeHours)) {
    // For overtime, use discrete small changes
    if (Math.random() < intensity) {
      const change = Math.random() < 0.5 ? -1 : 1;
      mutated.dailyOvertimeHours = Math.max(0, Math.min(3, mutated.dailyOvertimeHours + change));
    }
  }

  return mutated;
}

/**
 * Generate seeded population from Phase 1 results for Phase 2 refinement
 * @param seedCandidates - Top candidates from Phase 1 (sorted by growth rate)
 * @param populationSize - Total population size for Phase 2
 * @param refinementIntensity - Mutation intensity (0.05-0.15)
 * @param constraints - Optional constraints to respect fixed policies
 * @returns Seeded population with guided variations
 */
export function generateSeededPopulation(
  seedCandidates: OptimizationCandidate[],
  populationSize: number,
  refinementIntensity: number,
  constraints?: OptimizationConstraints
): OptimizationCandidate[] {
  const population: OptimizationCandidate[] = [];

  // Use top candidates from Phase 1
  const uniqueSeeds = seedCandidates.slice(0, Math.min(10, seedCandidates.length));

  if (uniqueSeeds.length === 0) {
    console.warn('[Phase2] No seed results provided, generating random population');
    return [];
  }

  console.log(`[Phase2] Seeding population with ${uniqueSeeds.length} candidates from Phase 1`);

  // Keep top 3 elite unchanged
  const eliteCount = Math.min(3, uniqueSeeds.length);
  for (let i = 0; i < eliteCount; i++) {
    population.push({
      ...uniqueSeeds[i],
      id: `phase2-elite-${i}`,
      fitness: 0, // Will be re-evaluated
      netWorth: 0,
    });
  }

  // Generate variations around each seed
  const remainingSlots = populationSize - eliteCount;
  const variationsPerSeed = Math.floor(remainingSlots / uniqueSeeds.length);
  const extraVariations = remainingSlots % uniqueSeeds.length;

  uniqueSeeds.forEach((seed, seedIdx) => {
    const numVariations = variationsPerSeed + (seedIdx < extraVariations ? 1 : 0);

    for (let i = 0; i < numVariations; i++) {
      // Create variation with local mutations
      const variedActions = generateLocalVariations(seed.actions, refinementIntensity);
      const variedParams = seed.strategyParams
        ? mutateRefinement(seed.strategyParams, refinementIntensity, constraints)
        : undefined;

      population.push({
        id: `phase2-seed${seedIdx}-var${i}`,
        actions: variedActions,
        fitness: 0,
        netWorth: 0,
        strategyParams: variedParams,
      });
    }
  });

  console.log(`[Phase2] Generated ${population.length} candidates (${eliteCount} elite + ${population.length - eliteCount} variations)`);
  return population;
}

