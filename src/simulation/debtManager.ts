/**
 * Automated Debt Management System
 *
 * Implements intelligent debt paydown strategy with 20% ROI:
 * - Debt costs 0.05%/day (~18.25% annual)
 * - Preemptive 2% loans avoid 5% wage advances
 * - Aggressive paydown with excess cash above operating reserves
 *
 * Core Algorithm:
 * 1. Calculate minimum cash reserve (days of operating expenses)
 * 2. Prevent wage advances by taking preemptive loans
 * 3. Pay down debt aggressively with excess cash
 * 4. Maintain emergency loan buffer for operations
 */

import type { SimulationState, Strategy } from './types.js';
import { CONSTANTS } from './constants.js';

/**
 * Calculate minimum cash reserve needed for safe operations
 *
 * Reserve = (Daily Salaries + Daily Overhead) × minCashReserveDays
 *
 * @param state Current simulation state
 * @param strategy Current strategy with debt policy
 * @returns Minimum cash to maintain in reserve ($)
 */
export function calculateMinCashReserve(
  state: SimulationState,
  strategy: Strategy
): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.info('Function started', {
    function: 'calculateMinCashReserve',
    day: state.currentDay,
    minCashReserveDays: strategy.minCashReserveDays,
  });

  try {
    // Calculate daily salaries
    const expertsCount = state.workforce.experts;
    const rookiesCount = state.workforce.rookies;
    const dailySalaries =
      expertsCount * CONSTANTS.EXPERT_SALARY +
      rookiesCount * CONSTANTS.ROOKIE_SALARY;

    // Add overtime costs if applicable
    const overtimeCost = strategy.dailyOvertimeHours > 0
      ? (dailySalaries * strategy.dailyOvertimeHours / 8) * CONSTANTS.OVERTIME_MULTIPLIER
      : 0;

    // Estimate daily material costs (assuming periodic orders)
    const estimatedDailyMaterialCost = (CONSTANTS.RAW_MATERIAL_ORDER_FEE +
      (strategy.orderQuantity * CONSTANTS.RAW_MATERIAL_UNIT_COST)) / 7; // Amortize over ~7 days

    // Total daily operating expenses
    const dailyOperatingExpenses = dailySalaries + overtimeCost + estimatedDailyMaterialCost;

    // Minimum reserve = daily expenses × reserve days
    const minReserve = dailyOperatingExpenses * strategy.minCashReserveDays;

    logger.info('Function completed', {
      function: 'calculateMinCashReserve',
      day: state.currentDay,
      duration: Date.now() - startTime,
      expertsCount,
      rookiesCount,
      dailySalaries,
      overtimeCost,
      estimatedDailyMaterialCost,
      dailyOperatingExpenses,
      minCashReserveDays: strategy.minCashReserveDays,
      calculatedReserve: Math.round(minReserve),
    });

    return minReserve;
  } catch (error) {
    logger.error('Function failed', {
      function: 'calculateMinCashReserve',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Prevent wage advances by taking preemptive 2% loans
 *
 * If cash < (next payroll + buffer) and days until payroll <= threshold:
 * - Take 2% regular loan now
 * - Avoid 5% wage advance later (saves 3% = 60% ROI on preemptive action)
 *
 * @param state Current simulation state (will be modified)
 * @param strategy Current strategy with debt policy
 * @returns Amount of preemptive loan taken ($)
 */
export function preventWageAdvance(
  state: SimulationState,
  strategy: Strategy
): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.info('Function started', {
    function: 'preventWageAdvance',
    day: state.currentDay,
    cash: Math.round(state.cash),
    debt: Math.round(state.debt),
    preemptiveWageLoanDays: strategy.preemptiveWageLoanDays,
  });

  try {
    // Calculate days until next payroll (weekly on day 7)
    const daysUntilPayroll = 7 - (state.currentDay % 7);

    logger.debug('Payroll calculation', {
      function: 'preventWageAdvance',
      day: state.currentDay,
      daysUntilPayroll,
      threshold: strategy.preemptiveWageLoanDays,
    });

    // Only act if within threshold days of payroll
    if (daysUntilPayroll > strategy.preemptiveWageLoanDays) {
      logger.info('No action needed - payroll too far away', {
        function: 'preventWageAdvance',
        day: state.currentDay,
        daysUntilPayroll,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Calculate next payroll amount
    const expertsCount = state.workforce.experts;
    const rookiesCount = state.workforce.rookies;
    const nextPayroll =
      expertsCount * CONSTANTS.EXPERT_SALARY * 7 +
      rookiesCount * CONSTANTS.ROOKIE_SALARY * 7;

    // Check if we need preemptive loan
    const requiredCash = nextPayroll + strategy.emergencyLoanBuffer;

    if (state.cash >= requiredCash) {
      logger.info('No action needed - sufficient cash', {
        function: 'preventWageAdvance',
        day: state.currentDay,
        cash: Math.round(state.cash),
        requiredCash: Math.round(requiredCash),
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Take preemptive 2% loan to avoid 5% wage advance
    const loanAmount = requiredCash - state.cash;
    const commission = loanAmount * CONSTANTS.NORMAL_DEBT_COMMISSION;
    const totalCost = commission;

    state.cash += loanAmount;
    state.debt += loanAmount;

    logger.info('Preemptive loan taken', {
      function: 'preventWageAdvance',
      day: state.currentDay,
      duration: Date.now() - startTime,
      loanAmount: Math.round(loanAmount),
      commission: Math.round(commission),
      totalCost: Math.round(totalCost),
      newCash: Math.round(state.cash),
      newDebt: Math.round(state.debt),
      savedFromWageAdvance: Math.round(loanAmount * 0.03), // 5% - 2% = 3% saved
    });

    return loanAmount;
  } catch (error) {
    logger.error('Function failed', {
      function: 'preventWageAdvance',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Execute aggressive debt paydown with excess cash
 *
 * Excess Cash = Current Cash - Min Reserve
 * Paydown Amount = Excess Cash × Aggressiveness
 *
 * ROI = 0.05%/day saved + avoidance of future 5% wage advances ≈ 20% annual
 *
 * @param state Current simulation state (will be modified)
 * @param strategy Current strategy with debt policy
 * @returns Amount of debt paid down ($)
 */
export function executeDebtPaydown(
  state: SimulationState,
  strategy: Strategy
): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.info('Function started', {
    function: 'executeDebtPaydown',
    day: state.currentDay,
    cash: Math.round(state.cash),
    debt: Math.round(state.debt),
    aggressiveness: strategy.debtPaydownAggressiveness,
  });

  try {
    // No debt to pay down
    if (state.debt <= 0) {
      logger.info('No debt to pay down', {
        function: 'executeDebtPaydown',
        day: state.currentDay,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Calculate minimum cash reserve
    const minReserve = calculateMinCashReserve(state, strategy);
    const excessCash = state.cash - minReserve;

    logger.debug('Cash analysis', {
      function: 'executeDebtPaydown',
      day: state.currentDay,
      cash: Math.round(state.cash),
      minReserve: Math.round(minReserve),
      excessCash: Math.round(excessCash),
    });

    // No excess cash available
    if (excessCash <= 0) {
      logger.info('No excess cash for debt paydown', {
        function: 'executeDebtPaydown',
        day: state.currentDay,
        duration: Date.now() - startTime,
        cash: Math.round(state.cash),
        minReserve: Math.round(minReserve),
      });
      return 0;
    }

    // Calculate paydown amount (limited by aggressiveness and available debt)
    const targetPaydown = excessCash * strategy.debtPaydownAggressiveness;
    const actualPaydown = Math.min(targetPaydown, state.debt);

    // Execute paydown
    state.cash -= actualPaydown;
    state.debt -= actualPaydown;

    // Calculate savings: 0.05%/day for remaining days
    const remainingDays = CONSTANTS.SIMULATION_END_DAY - state.currentDay;
    const dailySavings = actualPaydown * CONSTANTS.DEBT_INTEREST_RATE_DAILY;
    const totalSavings = dailySavings * remainingDays;

    logger.info('Debt paydown executed', {
      function: 'executeDebtPaydown',
      day: state.currentDay,
      duration: Date.now() - startTime,
      excessCash: Math.round(excessCash),
      targetPaydown: Math.round(targetPaydown),
      actualPaydown: Math.round(actualPaydown),
      newCash: Math.round(state.cash),
      newDebt: Math.round(state.debt),
      dailySavings: Math.round(dailySavings),
      totalSavings: Math.round(totalSavings),
      annualizedROI: ((dailySavings * 365 / actualPaydown) * 100).toFixed(2) + '%',
    });

    return actualPaydown;
  } catch (error) {
    logger.error('Function failed', {
      function: 'executeDebtPaydown',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Main automated debt management function
 *
 * Executes complete debt management strategy:
 * 1. Check if debt management is enabled
 * 2. Prevent wage advances with preemptive loans
 * 3. Pay down debt aggressively with excess cash
 * 4. Monitor debt thresholds and trigger emergency measures if needed
 *
 * Called at end of each simulation day from simulateDay()
 *
 * @param state Current simulation state (will be modified)
 * @param strategy Current strategy with debt policy
 * @returns Summary of actions taken
 */
export function automatedDebtManagement(
  state: SimulationState,
  strategy: Strategy
): {
  preemptiveLoanTaken: number;
  debtPaidDown: number;
  emergencyMeasuresTriggered: boolean;
} {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.info('Function started', {
    function: 'automatedDebtManagement',
    day: state.currentDay,
    autoDebtPaydown: strategy.autoDebtPaydown,
    cash: Math.round(state.cash),
    debt: Math.round(state.debt),
  });

  try {
    // Skip if debt management is disabled
    if (!strategy.autoDebtPaydown) {
      logger.info('Debt management disabled', {
        function: 'automatedDebtManagement',
        day: state.currentDay,
        duration: Date.now() - startTime,
      });
      return {
        preemptiveLoanTaken: 0,
        debtPaidDown: 0,
        emergencyMeasuresTriggered: false,
      };
    }

    // Step 1: Prevent wage advances
    const preemptiveLoan = preventWageAdvance(state, strategy);

    // Step 2: Pay down debt with excess cash
    const debtPaidDown = executeDebtPaydown(state, strategy);

    // Step 3: Check for emergency debt threshold
    let emergencyMeasuresTriggered = false;
    if (state.debt > strategy.maxDebtThreshold) {
      logger.error('EMERGENCY: Debt threshold exceeded', {
        function: 'automatedDebtManagement',
        day: state.currentDay,
        debt: Math.round(state.debt),
        maxDebtThreshold: strategy.maxDebtThreshold,
        excessDebt: Math.round(state.debt - strategy.maxDebtThreshold),
      });
      emergencyMeasuresTriggered = true;
      // Emergency measures could include:
      // - Halt all non-essential spending
      // - Sell machines
      // - Stop production
      // For now, just flag it
    }

    logger.info('Function completed', {
      function: 'automatedDebtManagement',
      day: state.currentDay,
      duration: Date.now() - startTime,
      preemptiveLoanTaken: Math.round(preemptiveLoan),
      debtPaidDown: Math.round(debtPaidDown),
      emergencyMeasuresTriggered,
      finalCash: Math.round(state.cash),
      finalDebt: Math.round(state.debt),
    });

    return {
      preemptiveLoanTaken: preemptiveLoan,
      debtPaidDown,
      emergencyMeasuresTriggered,
    };
  } catch (error) {
    logger.error('Function failed', {
      function: 'automatedDebtManagement',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
