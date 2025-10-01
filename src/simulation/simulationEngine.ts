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
function simulateDay(state: SimulationState, strategy: Strategy): DailyMetrics {
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

  // Step 11: Process sales and collect revenue
  const salesResult = processSales(state, strategy, dailyMetrics.avgCustomDeliveryTime);
  dailyMetrics.revenue = salesResult.totalRevenue;

  // Step 12: Calculate total expenses
  dailyMetrics.expenses = dailyMetrics.salaryCost + dailyMetrics.interestPaid + dailyMetrics.rawMaterialCost;

  // Step 13: Record daily history for complete transparency
  recordDailyHistory(state, dailyMetrics);

  return dailyMetrics;
}

/**
 * Runs complete simulation from start to end day
 */
export function runSimulation(strategy: Strategy, endDay = CONSTANTS.SIMULATION_END_DAY): SimulationResult {
  const state = initializeState();
  const startDay = CONSTANTS.SIMULATION_START_DAY;

  // Run day-by-day simulation
  for (let day = startDay; day <= endDay; day++) {
    state.currentDay = day;
    simulateDay(state, strategy);
  }

  // Calculate final fitness score (final cash on hand)
  const fitnessScore = state.cash;

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
 */
export function evaluateStrategy(strategy: Strategy, endDay = CONSTANTS.SIMULATION_END_DAY): number {
  const result = runSimulation(strategy, endDay);
  return result.fitnessScore;
}
