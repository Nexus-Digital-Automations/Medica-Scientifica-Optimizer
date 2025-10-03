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
  trackOvertime,
  processEmployeeQuitRisk,
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
import { DynamicPolicyCalculator } from '../optimizer/dynamicPolicyCalculator.js';

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
 * Executes timed actions and evaluates state-dependent rules for the current day
 */
function executeTimedActions(
  state: SimulationState,
  strategy: Strategy,
  policyCalculator: DynamicPolicyCalculator,
  rulesEngine?: import('../optimizer/rulesEngine.js').RulesEngine
): StrategyAction[] {
  // Get timed actions for today
  let actionsToday = strategy.timedActions.filter((action) => action.day === state.currentDay);

  // Evaluate rules and add rule-triggered actions
  if (rulesEngine) {
    const ruleActions = rulesEngine.evaluateRules(state, state.currentDay);
    actionsToday = [...actionsToday, ...ruleActions];
  }

  const executedActions: StrategyAction[] = [];

  // Merge TAKE_LOAN actions on the same day into a single loan
  const totalLoanAmount = actionsToday
    .filter((a): a is import('./types.js').TakeLoanAction => a.type === 'TAKE_LOAN')
    .reduce((sum, a) => sum + a.amount, 0);

  if (totalLoanAmount > 0) {
    actionsToday = actionsToday.filter((a) => a.type !== 'TAKE_LOAN');
    actionsToday.push({ day: state.currentDay, type: 'TAKE_LOAN', amount: totalLoanAmount });
  }

  // Merge HIRE_ROOKIE actions on the same day
  const totalRookiesToHire = actionsToday
    .filter((a): a is import('./types.js').HireRookieAction => a.type === 'HIRE_ROOKIE')
    .reduce((sum, a) => sum + a.count, 0);

  if (totalRookiesToHire > 0) {
    actionsToday = actionsToday.filter((a) => a.type !== 'HIRE_ROOKIE');
    actionsToday.push({ day: state.currentDay, type: 'HIRE_ROOKIE', count: totalRookiesToHire });
  }

  // Merge HIRE_EXPERT actions on the same day
  const totalExpertsToHire = actionsToday
    .filter((a): a is import('./types.js').HireExpertAction => a.type === 'HIRE_EXPERT')
    .reduce((sum, a) => sum + a.count, 0);

  if (totalExpertsToHire > 0) {
    actionsToday = actionsToday.filter((a) => a.type !== 'HIRE_EXPERT');
    actionsToday.push({ day: state.currentDay, type: 'HIRE_EXPERT', count: totalExpertsToHire });
  }

  // Merge ORDER_MATERIALS actions on the same day
  const totalMaterialsToOrder = actionsToday
    .filter((a): a is import('./types.js').OrderMaterialsAction => a.type === 'ORDER_MATERIALS')
    .reduce((sum, a) => sum + a.quantity, 0);

  if (totalMaterialsToOrder > 0) {
    actionsToday = actionsToday.filter((a) => a.type !== 'ORDER_MATERIALS');
    actionsToday.push({ day: state.currentDay, type: 'ORDER_MATERIALS', quantity: totalMaterialsToOrder });
  }

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
        // TRIGGER: Labor capacity will change after training
        policyCalculator.recalculatePolicies(state, strategy, 'EMPLOYEE_HIRED');
        break;

      case 'HIRE_EXPERT':
        for (let i = 0; i < action.count; i++) {
          hireExpert(state);
        }
        executedActions.push(action);
        // TRIGGER: Labor capacity changed immediately
        policyCalculator.recalculatePolicies(state, strategy, 'EMPLOYEE_HIRED');
        break;

      case 'BUY_MACHINE':
        if (state.cash >= CONSTANTS.MACHINES[action.machineType].buyPrice * action.count) {
          state.cash -= CONSTANTS.MACHINES[action.machineType].buyPrice * action.count;
          state.machines[action.machineType] += action.count;
          executedActions.push(action);
          // TRIGGER: Production capacity changed
          policyCalculator.recalculatePolicies(state, strategy, 'MACHINE_PURCHASED');
        }
        break;

      case 'SELL_MACHINE':
        if (state.machines[action.machineType] >= action.count) {
          state.cash += CONSTANTS.MACHINES[action.machineType].sellPrice * action.count;
          state.machines[action.machineType] -= action.count;
          executedActions.push(action);
          // TRIGGER: Production capacity changed
          policyCalculator.recalculatePolicies(state, strategy, 'MACHINE_SOLD');
        }
        break;

      case 'ORDER_MATERIALS': {
        // orderRawMaterials returns null if insufficient cash (business case rule)
        const orderResult = orderRawMaterials(state, action.quantity);
        if (orderResult) {
          executedActions.push(action);
        }
        // If null, order was rejected due to insufficient cash (not an error, just a rule)
        break;
      }

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
 *
 * Transaction Order (matches business case):
 * 1. Execute timed actions (loans, hiring, machine purchases) - immediate cash impact
 * 2. Process arriving resources (materials ordered 4 days ago arrive, no cash impact)
 * 3. Process workforce training/promotions
 * 4. Pay salaries (daily expense, deducted immediately)
 * 5. Apply debt interest (calculated on START-OF-DAY debt balance)
 * 6. Reorder raw materials if needed (cash deducted IMMEDIATELY when ordered)
 * 7. Allocate MCE capacity between production lines
 * 8. Run production (Standard line FIRST, then Custom line)
 * 9. Process sales and collect revenue
 * 10. Apply cash interest (calculated on END-OF-DAY cash balance, after all transactions)
 * 11. Record daily history
 *
 * Key Timing Rules from Business Case:
 * - Raw materials: "If there was not enough cash to cover the cost... the order was not executed"
 *   → Cash deducted when order is PLACED (Step 6), materials arrive 4 days later (Step 2)
 * - Machines: "delivered immediately upon cash payment" → Cash deducted in Step 1
 * - Debt interest: Standard accounting on opening balance (Step 5)
 * - Cash interest: Calculated on closing balance after all transactions (Step 10)
 */
function simulateDay(
  state: SimulationState,
  strategy: Strategy,
  policyCalculator: DynamicPolicyCalculator,
  demandForecast?: DemandForecast[],
  rulesEngine?: import('../optimizer/rulesEngine.js').RulesEngine
): DailyMetrics {
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

  // Step 1: Execute timed actions and evaluate rules for this day
  dailyMetrics.actions = executeTimedActions(state, strategy, policyCalculator, rulesEngine);

  // Step 2: Process arriving resources
  const arrivingOrders = processArrivingOrders(state);
  dailyMetrics.rawMaterialOrdered = arrivingOrders.reduce((sum, order) => sum + order.quantity, 0);

  // Step 3: Process workforce (training, promotions)
  processRookieTraining(state);

  // Step 4: Pay salaries (including overtime if policy is set)
  const salaryCost = calculateDailySalaryCost(state, true, strategy.dailyOvertimeHours);
  dailyMetrics.salaryCost = salaryCost.totalSalary;
  processPayment(state, salaryCost.totalSalary, 'Daily salaries');

  // Step 4.5: Track overtime and process employee quit risk
  const workedOvertime = strategy.dailyOvertimeHours > 0;
  trackOvertime(state, workedOvertime);
  processEmployeeQuitRisk(state, strategy.overtimeTriggerDays, strategy.dailyQuitProbability);

  // Step 5: Apply debt interest (on start-of-day debt balance)
  dailyMetrics.interestPaid = applyDebtInterest(state);

  // Step 6: Check and reorder raw materials if needed
  // CRITICAL: Cash is deducted IMMEDIATELY when order is placed (not when it arrives 4 days later)
  const reorderResult = checkAndReorder(state, strategy);
  if (reorderResult) {
    dailyMetrics.rawMaterialCost = reorderResult.totalCost;
  }

  // Step 7: Get demand limits for today (market-driven order arrivals)
  const demandLimits = getDemandForDay(state.currentDay, strategy, demandForecast);

  // Check if we crossed into a new demand phase (trigger policy recalculation)
  if (state.currentDay === 172 || state.currentDay === 218 || state.currentDay === 400) {
    policyCalculator.recalculatePolicies(state, strategy, 'DEMAND_PHASE_CHANGE');
  }

  // Step 8: Allocate MCE capacity between production lines
  const mceAllocation = allocateMCECapacity(state, strategy);

  // Step 8.5: Calculate shared ARCP (labor) capacity - THE CRITICAL BOTTLENECK
  // ARCP is shared between both production lines, so calculate once
  const expertProductivity = state.workforce.experts * CONSTANTS.ARCP_EXPERT_PRODUCTIVITY;
  const rookieProductivity = state.workforce.rookies * CONSTANTS.ARCP_EXPERT_PRODUCTIVITY * CONSTANTS.ARCP_ROOKIE_PRODUCTIVITY_FACTOR;
  const overtimeMultiplier = strategy.dailyOvertimeHours > 0 ? 1 + (strategy.dailyOvertimeHours / 8) : 1;
  const totalARCPCapacity = Math.floor((expertProductivity + rookieProductivity) * overtimeMultiplier);

  // CRITICAL FIX: Allocate ARCP capacity proportionally based on MCE allocation
  // This prevents one line from monopolizing all labor capacity
  // Using same proportion as MCE allocation ensures balanced production
  const standardARCPAllocation = Math.floor(totalARCPCapacity * (1 - strategy.mceAllocationCustom));
  const customARCPAllocation = Math.floor(totalARCPCapacity * strategy.mceAllocationCustom);

  // Step 9: Run production (standard line) FIRST - gets material priority per business rules
  const standardResult = processStandardLineProduction(state, mceAllocation.standardCapacity, strategy, standardARCPAllocation);
  dailyMetrics.standardProduced = standardResult.totalUnitsCompleted;

  // Step 10: Run production (custom line) SECOND
  // CRITICAL: Custom line is make-to-order - orders arrive (demand), are accepted if WIP < 360, rejected otherwise
  const customResult = processCustomLineProduction(
    state,
    strategy,
    demandLimits.custom, // Customer orders arriving today
    mceAllocation.customCapacity, // MCE capacity allocated to custom
    customARCPAllocation // Proportional labor capacity
  );
  dailyMetrics.customProduced = customResult.ordersCompleted;
  dailyMetrics.avgCustomDeliveryTime = customResult.avgDeliveryTime;

  // Step 10: Get current pricing
  const pricing = getCurrentPricing(strategy, dailyMetrics.avgCustomDeliveryTime);
  dailyMetrics.customPrice = pricing.customPrice;

  // Step 11: Process sales and collect revenue (respecting demand limits)
  const salesResult = processSales(state, strategy, dailyMetrics.avgCustomDeliveryTime, demandLimits);
  dailyMetrics.revenue = salesResult.totalRevenue;

  // Step 13: Apply cash interest (on END-OF-DAY cash balance, after all transactions)
  // This ensures interest reflects the actual cash position after expenses, purchases, and revenue
  dailyMetrics.interestEarned = applyCashInterest(state);

  // Step 14: Calculate total expenses
  dailyMetrics.expenses = dailyMetrics.salaryCost + dailyMetrics.interestPaid + dailyMetrics.rawMaterialCost;

  // Step 15: Record daily history for complete transparency
  recordDailyHistory(state, dailyMetrics, strategy);

  return dailyMetrics;
}

/**
 * Runs complete simulation from start to end day
 * @param strategy - The strategy to simulate
 * @param endDay - The final day of simulation (default: CONSTANTS.SIMULATION_END_DAY)
 * @param startingState - Optional starting state for mid-course re-optimization
 * @param demandForecast - Optional custom demand forecast (defaults to business case demand curve)
 */
export async function runSimulation(
  strategy: Strategy,
  endDay = CONSTANTS.SIMULATION_END_DAY,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[]
): Promise<SimulationResult> {
  const state = startingState ? JSON.parse(JSON.stringify(startingState)) : initializeState();
  const startDay = state.currentDay;

  // Initialize dynamic policy calculator
  const policyCalculator = new DynamicPolicyCalculator();

  // Calculate initial policies using OR formulas (if not already set)
  if (strategy.reorderPoint === 0 || strategy.orderQuantity === 0 || strategy.standardBatchSize === 0) {
    const initialPolicies = policyCalculator.calculateInitialPolicies(state, strategy);
    strategy.reorderPoint = initialPolicies.reorderPoint;
    strategy.orderQuantity = initialPolicies.orderQuantity;
    strategy.standardBatchSize = initialPolicies.standardBatchSize;
  }

  // Initialize rules engine if strategy has rules
  let rulesEngine: import('../optimizer/rulesEngine.js').RulesEngine | undefined;
  if (strategy.rules && strategy.rules.length > 0) {
    const { RulesEngine } = await import('../optimizer/rulesEngine.js');
    rulesEngine = new RulesEngine(strategy.rules);
  }

  // Run day-by-day simulation
  for (let day = startDay; day <= endDay; day++) {
    state.currentDay = day;
    simulateDay(state, strategy, policyCalculator, demandForecast, rulesEngine);
  }

  // Export policy change log to state history
  const policyChanges = policyCalculator.getPolicyChangeHistory();
  state.history.policyChanges = policyChanges.map(log => ({
    day: log.day,
    policyType: log.policyName as 'reorderPoint' | 'orderQuantity' | 'standardBatchSize',
    oldValue: log.oldValue,
    newValue: log.newValue,
    reason: `${log.changeReason} (${log.triggerEvent})`,
  }));

  // Calculate final fitness score with multi-factor penalties
  // Net worth = cash - debt
  // Inventory is worthless at plant shutdown, so we penalize remaining inventory
  const inventoryWriteOff = calculateInventoryWriteOff(state);

  // Multi-factor penalty system to teach GA to avoid cash flow failures:
  // 1. Rejected orders penalty: -$10,000 per rejection (indicates suboptimal cash management)
  // 2. Stockout penalty: -$1,000 per day (lost revenue opportunity)
  // 3. Lost production penalty: -$2,000 per day (opportunity cost of idle capacity)
  //
  // Note: Penalties are moderate to guide learning without dominating net worth.
  // Severe penalties prevent GA from finding viable strategies when cash-constrained
  // ordering is necessary for survival.
  const rejectedOrdersPenalty = state.rejectedMaterialOrders * 10000;
  const stockoutPenalty = state.stockoutDays * 1000;
  const lostProductionPenalty = state.lostProductionDays * 2000;

  const fitnessScore = getNetWorth(state)
    - inventoryWriteOff
    - rejectedOrdersPenalty
    - stockoutPenalty
    - lostProductionPenalty;

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
export async function evaluateStrategy(
  strategy: Strategy,
  endDay = CONSTANTS.SIMULATION_END_DAY,
  startingState?: SimulationState,
  demandForecast?: DemandForecast[]
): Promise<number> {
  const result = await runSimulation(strategy, endDay, startingState, demandForecast);
  return result.fitnessScore;
}
