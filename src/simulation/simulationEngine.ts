/**
 * Main Simulation Engine - Orchestrates all modules for day-by-day simulation
 * This is the core that runs the factory simulation with complete transparency
 */

import type { SimulationState, Strategy, DailyMetrics, SimulationResult, StrategyAction } from './types.js';
import { CONSTANTS } from './constants.js';
import { initializeState, recordDailyHistory, getNetWorth } from './state.js';
import {
  applyDebtInterest,
  applyCashInterest,
  takeLoan,
  payDebt,
  processPayment,
} from './financeModule.js';
import {
  processRookieTraining,
  calculateDailySalaryCost,
  hireRookie,
  hireExpert,
} from './hrModule.js';
import {
  processArrivingOrders,
  checkAndReorder,
  orderRawMaterials,
} from './inventoryModule.js';
import {
  allocateMCECapacity,
  processCustomLineProduction,
  processStandardLineProduction,
} from './productionModule.js';
import { processSales, getCurrentPricing } from './pricingModule.js';
import { getDemandForDay, type DemandForecast } from './demandModule.js';

/**
 * Calculates the value of all remaining inventory at end of simulation
 * This inventory becomes worthless when the plant shuts down
 */
function calculateInventoryWriteOff(state: SimulationState): number {
  // Raw material value at cost
  const rawMaterialValue = state.rawMaterialInventory * CONSTANTS.RAW_MATERIAL_UNIT_COST;

  // WIP value (rough estimate based on raw material consumed)
  const wipStandardPreStation1 = state.standardLineWIP.preStation1.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const wipStandardStation1 = state.standardLineWIP.station1.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const wipStandardStation2 = state.standardLineWIP.station2.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const wipStandardStation3 = state.standardLineWIP.station3.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const wipStandardValue =
    (wipStandardPreStation1 + wipStandardStation1 + wipStandardStation2 + wipStandardStation3) *
    CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT *
    CONSTANTS.RAW_MATERIAL_UNIT_COST;

  const wipCustomValue =
    state.customLineWIP.orders.length * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST;

  // Finished goods value (cost basis - material cost only)
  const finishedGoodsValue =
    (state.finishedGoods.standard * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT +
      state.finishedGoods.custom * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT) *
    CONSTANTS.RAW_MATERIAL_UNIT_COST;

  // Pending raw material orders (already paid for but not yet arrived)
  const pendingOrdersValue = state.pendingRawMaterialOrders.reduce(
    (sum: number, order) => sum + order.quantity * CONSTANTS.RAW_MATERIAL_UNIT_COST,
    0
  );

  return rawMaterialValue + wipStandardValue + wipCustomValue + finishedGoodsValue + pendingOrdersValue;
}

/**
 * Executes timed actions for the current day
 */
function executeTimedActions(state: SimulationState, strategy: Strategy): StrategyAction[] {
  const actionsToday = strategy.timedActions.filter((action) => action.day === state.currentDay);
  const executedActions: StrategyAction[] = [];

  for (const action of actionsToday) {
    switch (action.type) {
      case 'TAKE_LOAN':
        takeLoan(state, action.amount, false);
        executedActions.push(action);
        break;

      case 'PAY_DEBT':
        payDebt(state, action.amount);
        executedActions.push(action);
        break;

      case 'HIRE_ROOKIE':
        for (let i = 0; i < action.count; i++) {
          hireRookie(state);
        }
        executedActions.push(action);
        break;

      case 'HIRE_EXPERT':
        for (let i = 0; i < action.count; i++) {
          hireExpert(state);
        }
        executedActions.push(action);
        break;

      case 'BUY_MACHINE':
        if (state.cash >= CONSTANTS.MACHINES[action.machineType].buyPrice * action.count) {
          state.cash -= CONSTANTS.MACHINES[action.machineType].buyPrice * action.count;
          state.machines[action.machineType] += action.count;
          executedActions.push(action);
        }
        break;

      case 'SELL_MACHINE':
        if (state.machines[action.machineType] >= action.count) {
          state.cash += CONSTANTS.MACHINES[action.machineType].sellPrice * action.count;
          state.machines[action.machineType] -= action.count;
          executedActions.push(action);
        }
        break;

      case 'ORDER_MATERIALS':
        orderRawMaterials(state, action.quantity);
        executedActions.push(action);
        break;

      case 'ADJUST_BATCH_SIZE':
        strategy.standardBatchSize = action.newSize;
        executedActions.push(action);
        break;

      case 'ADJUST_MCE_ALLOCATION':
        strategy.mceAllocationCustom = action.newAllocation;
        executedActions.push(action);
        break;

      case 'ADJUST_PRICE':
        if (action.productType === 'standard') {
          strategy.standardPrice = action.newPrice;
        } else {
          strategy.customBasePrice = action.newPrice;
        }
        executedActions.push(action);
        break;
    }
  }

  return executedActions;
}

/**
 * Simulates a single day in the factory
 */
function simulateDay(state: SimulationState, strategy: Strategy, demandForecast?: DemandForecast[]): DailyMetrics {
  const dailyMetrics: DailyMetrics = {
    revenue: 0,
    expenses: 0,
    interestPaid: 0,
    interestEarned: 0,
    standardProduced: 0,
    customProduced: 0,
    rawMaterialOrdered: 0,
    rawMaterialCost: 0,
    salaryCost: 0,
    standardPrice: strategy.standardPrice,
    customPrice: strategy.customBasePrice,
    avgCustomDeliveryTime: 0,
    actions: [],
  };

  // Step 1: Execute timed actions for this day
  dailyMetrics.actions = executeTimedActions(state, strategy);

  // Step 2: Process arriving resources
  const arrivingOrders = processArrivingOrders(state);
  dailyMetrics.rawMaterialOrdered = arrivingOrders.reduce((sum, order) => sum + order.quantity, 0);

  // Step 3: Process workforce (training, promotions)
  processRookieTraining(state);

  // Step 4: Pay salaries
  const salaryCost = calculateDailySalaryCost(state);
  dailyMetrics.salaryCost = salaryCost.totalSalary;
  processPayment(state, salaryCost.totalSalary, 'Daily salaries');

  // Step 5: Apply interest
  dailyMetrics.interestPaid = applyDebtInterest(state);
  dailyMetrics.interestEarned = applyCashInterest(state);

  // Step 6: Check and reorder raw materials if needed
  const reorderResult = checkAndReorder(state, strategy);
  if (reorderResult) {
    dailyMetrics.rawMaterialCost = reorderResult.totalCost;
  }

  // Step 7: Allocate MCE capacity between production lines
  const mceAllocation = allocateMCECapacity(state, strategy);

  // Step 8: Run production (custom line)
  const customResult = processCustomLineProduction(state, strategy, mceAllocation.customCapacity);
  dailyMetrics.customProduced = customResult.ordersCompleted;
  dailyMetrics.avgCustomDeliveryTime = customResult.avgDeliveryTime;

  // Step 9: Run production (standard line)
  const standardResult = processStandardLineProduction(state, mceAllocation.standardCapacity);
  dailyMetrics.standardProduced = standardResult.totalUnitsCompleted;

  // Step 10: Get current pricing
  const pricing = getCurrentPricing(strategy, dailyMetrics.avgCustomDeliveryTime);
  dailyMetrics.customPrice = pricing.customPrice;

  // Step 11: Get demand limits for today
  const demandLimits = getDemandForDay(state.currentDay, strategy, demandForecast);

  // Step 12: Process sales and collect revenue (respecting demand limits)
  const salesResult = processSales(state, strategy, dailyMetrics.avgCustomDeliveryTime, demandLimits);
  dailyMetrics.revenue = salesResult.totalRevenue;

  // Step 12: Calculate total expenses
  dailyMetrics.expenses = dailyMetrics.salaryCost + dailyMetrics.interestPaid + dailyMetrics.rawMaterialCost;

  // Step 13: Record daily history for complete transparency
  recordDailyHistory(state, dailyMetrics);

  return dailyMetrics;
}

/**
 * Runs complete simulation from start to end day
 * @param strategy - The strategy to simulate
 * @param endDay - The final day of simulation (default: CONSTANTS.SIMULATION_END_DAY)
 * @param startingState - Optional starting state for mid-course re-optimization
 * @param demandForecast - Optional custom demand forecast (defaults to business case demand curve)
 */
export function runSimulation(
  strategy: Strategy,
  endDay = CONSTANTS.SIMULATION_END_DAY,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[]
): SimulationResult {
  const state = startingState ? JSON.parse(JSON.stringify(startingState)) : initializeState();
  const startDay = state.currentDay;

  // Run day-by-day simulation
  for (let day = startDay; day <= endDay; day++) {
    state.currentDay = day;
    simulateDay(state, strategy, demandForecast);
  }

  // Calculate final fitness score (cash minus inventory write-off penalty)
  // Inventory is worthless at plant shutdown, so we penalize remaining inventory
  const inventoryWriteOff = calculateInventoryWriteOff(state);
  const fitnessScore = state.cash - inventoryWriteOff;

  return {
    finalCash: state.cash,
    finalDebt: state.debt,
    finalNetWorth: getNetWorth(state),
    state,
    strategy,
    fitnessScore,
  };
}

/**
 * Runs simulation and returns only fitness score (optimized for genetic algorithm)
 * @param strategy - The strategy to evaluate
 * @param endDay - The final day of simulation (default: CONSTANTS.SIMULATION_END_DAY)
 * @param startingState - Optional starting state for mid-course re-optimization
 * @param demandForecast - Optional custom demand forecast (defaults to business case demand curve)
 */
export function evaluateStrategy(
  strategy: Strategy,
  endDay = CONSTANTS.SIMULATION_END_DAY,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[]
): number {
  const result = runSimulation(strategy, endDay, startingState, demandForecast);
  return result.fitnessScore;
}
