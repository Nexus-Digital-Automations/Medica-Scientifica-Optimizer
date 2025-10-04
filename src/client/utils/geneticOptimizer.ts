import type { Strategy, StrategyAction } from '../types/ui.types';
import { calculateEOQ, calculateROP, calculateEPQ, calculateNPV, calculateQueueMetrics, calculateOptimalPrice } from './formulaCalculations';

export interface OptimizationCandidate {
  id: string;
  actions: StrategyAction[];
  fitness: number;
  netWorth: number;
}

export interface OptimizationConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  elitePercentage: number;
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
    actions.push({
      day,
      type: 'SET_ORDER_QUANTITY',
      newOrderQuantity: Math.round(eoq.value * (0.8 + Math.random() * 0.4)), // ±20% variation
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
    actions.push({
      day,
      type: 'SET_REORDER_POINT',
      newReorderPoint: Math.round(rop.value * (0.8 + Math.random() * 0.4)),
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
    actions.push({
      day,
      type: 'ADJUST_BATCH_SIZE',
      newSize: Math.round(epq.value * (0.8 + Math.random() * 0.4)),
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
    actions.push({
      day,
      type: 'ADJUST_PRICE',
      productType: 'standard',
      newPrice: Math.round(optimalPrice.value * (0.9 + Math.random() * 0.2)),
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
        newOrderQuantity: Math.floor(100 + Math.random() * 900), // 100-1000
      });
    } else if (actionType < 0.65) {
      actions.push({
        day,
        type: 'SET_REORDER_POINT',
        newReorderPoint: Math.floor(50 + Math.random() * 450), // 50-500
      });
    } else if (actionType < 0.80) {
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: Math.floor(20 + Math.random() * 180), // 20-200
      });
    } else {
      actions.push({
        day,
        type: 'ADJUST_PRICE',
        productType: 'standard',
        newPrice: Math.floor(600 + Math.random() * 400), // 600-1000
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
      mutated.count = Math.max(1, Math.floor(mutated.count * (0.7 + Math.random() * 0.6)));
    }
    if ('newOrderQuantity' in mutated) {
      mutated.newOrderQuantity = Math.max(50, Math.floor(mutated.newOrderQuantity * (0.7 + Math.random() * 0.6)));
    }
    if ('newReorderPoint' in mutated) {
      mutated.newReorderPoint = Math.max(20, Math.floor(mutated.newReorderPoint * (0.7 + Math.random() * 0.6)));
    }
    if ('newSize' in mutated) {
      mutated.newSize = Math.max(10, Math.floor(mutated.newSize * (0.7 + Math.random() * 0.6)));
    }
    if ('newPrice' in mutated) {
      mutated.newPrice = Math.max(400, Math.floor(mutated.newPrice * (0.8 + Math.random() * 0.4)));
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
