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

import type { SimulationState, Strategy, DailyMetrics } from './types.js';
import { CONSTANTS } from './constants.js';
import { getTotalStandardWIP } from './state.js';

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
 * Calculate total business asset value for debt-to-asset ratio
 *
 * Total Assets = Cash + Raw Materials + WIP + Finished Goods + Machines (at cost)
 *
 * @param state Current simulation state
 * @returns Total asset value in dollars
 */
export function calculateTotalAssets(state: SimulationState): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.debug('Function started', {
    function: 'calculateTotalAssets',
    day: state.currentDay,
  });

  try {
    // Cash on hand
    const cash = state.cash;

    // Raw materials value
    const rawMaterialValue = state.rawMaterialInventory * CONSTANTS.RAW_MATERIAL_UNIT_COST;

    // WIP value (material cost only)
    const standardWIPValue = getTotalStandardWIP(state) *
      CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST;
    const customWIPValue = state.customLineWIP.orders.length *
      CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST;

    // Finished goods value
    const finishedGoodsValue =
      (state.finishedGoods.standard * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT +
        state.finishedGoods.custom * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT) *
      CONSTANTS.RAW_MATERIAL_UNIT_COST;

    // Machine value (at purchase price)
    const machineValue =
      state.machines.MCE * CONSTANTS.MACHINES.MCE.buyPrice +
      state.machines.WMA * CONSTANTS.MACHINES.WMA.buyPrice +
      state.machines.PUC * CONSTANTS.MACHINES.PUC.buyPrice;

    const totalAssets = cash + rawMaterialValue + standardWIPValue + customWIPValue +
      finishedGoodsValue + machineValue;

    logger.debug('Function completed', {
      function: 'calculateTotalAssets',
      day: state.currentDay,
      duration: Date.now() - startTime,
      cash: Math.round(cash),
      rawMaterialValue: Math.round(rawMaterialValue),
      standardWIPValue: Math.round(standardWIPValue),
      customWIPValue: Math.round(customWIPValue),
      finishedGoodsValue: Math.round(finishedGoodsValue),
      machineValue: Math.round(machineValue),
      totalAssets: Math.round(totalAssets),
    });

    return totalAssets;
  } catch (error) {
    logger.error('Function failed', {
      function: 'calculateTotalAssets',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Calculate annualized revenue based on trailing N days
 *
 * Used for debt-to-revenue ratio calculation
 *
 * @param state Current simulation state
 * @param days Number of trailing days to average (default: 30)
 * @returns Annualized revenue estimate in dollars
 */
export function calculateTrailingRevenue(
  state: SimulationState,
  days: number = 30
): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.debug('Function started', {
    function: 'calculateTrailingRevenue',
    day: state.currentDay,
    trailingDays: days,
  });

  try {
    const history = state.history.dailyRevenue;

    if (history.length === 0) {
      logger.debug('No revenue history available', {
        function: 'calculateTrailingRevenue',
        day: state.currentDay,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Get last N days of revenue
    const recentRevenue = history.slice(-days);
    const totalRevenue = recentRevenue.reduce((sum, entry) => sum + entry.value, 0);

    // Annualize: (trailing sum / days) × 365
    const annualizedRevenue = (totalRevenue / recentRevenue.length) * 365;

    logger.debug('Function completed', {
      function: 'calculateTrailingRevenue',
      day: state.currentDay,
      duration: Date.now() - startTime,
      trailingDays: recentRevenue.length,
      totalTrailingRevenue: Math.round(totalRevenue),
      annualizedRevenue: Math.round(annualizedRevenue),
    });

    return annualizedRevenue;
  } catch (error) {
    logger.error('Function failed', {
      function: 'calculateTrailingRevenue',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Calculate maximum loan amount that respects ALL ratio constraints
 *
 * Returns the minimum of all 3 ratio-based loan limits (most restrictive wins)
 *
 * @param state Current simulation state
 * @param strategy Current strategy with ratio constraints
 * @returns Maximum allowable loan amount in dollars
 */
export function calculateMaxAllowableLoan(
  state: SimulationState,
  strategy: Strategy
): number {
  const logger = { info: console.log, debug: console.log, error: console.error };
  const startTime = Date.now();

  logger.info('Function started', {
    function: 'calculateMaxAllowableLoan',
    day: state.currentDay,
    currentDebt: Math.round(state.debt),
  });

  try {
    const currentDebt = state.debt;
    const totalAssets = calculateTotalAssets(state);
    const trailingRevenue = calculateTrailingRevenue(state, 30);

    // Limit 1: Debt-to-Asset Ratio
    // maxDebt = totalAssets × maxDebtToAssetRatio
    // maxLoan = (totalAssets × maxDebtToAssetRatio) - currentDebt
    const maxDebtByAssetRatio = totalAssets * strategy.maxDebtToAssetRatio;
    const maxLoanByAssetRatio = Math.max(0, maxDebtByAssetRatio - currentDebt);

    // Limit 2: Debt-to-Revenue Ratio
    // maxDebt = trailingRevenue × maxDebtToRevenueRatio
    // maxLoan = (trailingRevenue × maxDebtToRevenueRatio) - currentDebt
    const maxDebtByRevenueRatio = trailingRevenue * strategy.maxDebtToRevenueRatio;
    const maxLoanByRevenueRatio = Math.max(0, maxDebtByRevenueRatio - currentDebt);

    // Limit 3: Interest Coverage Ratio
    // Daily interest = (currentDebt + newLoan) × 0.0005 (0.05%/day)
    // Max daily interest = dailyRevenue / minInterestCoverageRatio
    // Solving: (currentDebt + maxLoan) × 0.0005 <= dailyRevenue / minCoverageRatio
    // maxLoan <= (dailyRevenue / (minCoverageRatio × 0.0005)) - currentDebt
    const recentDays = Math.min(7, state.history.dailyRevenue.length);
    const avgDailyRevenue = recentDays > 0
      ? state.history.dailyRevenue.slice(-recentDays).reduce((sum, e) => sum + e.value, 0) / recentDays
      : 1000; // fallback
    const maxDebtByInterestCoverage = avgDailyRevenue /
      (strategy.minInterestCoverageRatio * CONSTANTS.DEBT_INTEREST_RATE_DAILY);
    const maxLoanByInterestCoverage = Math.max(0, maxDebtByInterestCoverage - currentDebt);

    // Return the MINIMUM of all 3 limits (most restrictive)
    const maxLoan = Math.min(
      maxLoanByAssetRatio,
      maxLoanByRevenueRatio,
      maxLoanByInterestCoverage
    );

    logger.info('Function completed', {
      function: 'calculateMaxAllowableLoan',
      day: state.currentDay,
      duration: Date.now() - startTime,
      currentDebt: Math.round(currentDebt),
      totalAssets: Math.round(totalAssets),
      trailingRevenue: Math.round(trailingRevenue),
      avgDailyRevenue: Math.round(avgDailyRevenue),
      maxLoanByAssetRatio: Math.round(maxLoanByAssetRatio),
      maxLoanByRevenueRatio: Math.round(maxLoanByRevenueRatio),
      maxLoanByInterestCoverage: Math.round(maxLoanByInterestCoverage),
      maxAllowableLoan: Math.round(maxLoan),
    });

    return maxLoan;
  } catch (error) {
    logger.error('Function failed', {
      function: 'calculateMaxAllowableLoan',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Calculate current financial health ratios for reporting
 *
 * Used for CSV export and ratio tracking
 *
 * @param state Current simulation state
 * @param dailyMetrics Daily metrics from current simulation day
 * @returns Object containing all 3 financial ratios
 */
export function calculateCurrentRatios(
  state: SimulationState,
  dailyMetrics: DailyMetrics
): {
  debtToAssetRatio: number;
  interestCoverageRatio: number;
  debtToRevenueRatio: number;
} {
  const logger = { debug: console.log };
  const startTime = Date.now();

  logger.debug('Function started', {
    function: 'calculateCurrentRatios',
    day: state.currentDay,
  });

  try {
    const totalAssets = calculateTotalAssets(state);
    const trailingRevenue = calculateTrailingRevenue(state, 30);

    const debtToAssetRatio = totalAssets > 0 ? state.debt / totalAssets : 0;

    const interestCoverageRatio = dailyMetrics.interestPaid > 0
      ? dailyMetrics.revenue / dailyMetrics.interestPaid
      : 999; // No interest = effectively infinite coverage

    const debtToRevenueRatio = trailingRevenue > 0
      ? state.debt / trailingRevenue
      : 0;

    logger.debug('Function completed', {
      function: 'calculateCurrentRatios',
      day: state.currentDay,
      duration: Date.now() - startTime,
      debtToAssetRatio: debtToAssetRatio.toFixed(3),
      interestCoverageRatio: interestCoverageRatio.toFixed(2),
      debtToRevenueRatio: debtToRevenueRatio.toFixed(3),
    });

    return {
      debtToAssetRatio,
      interestCoverageRatio,
      debtToRevenueRatio,
    };
  } catch (error) {
    console.error('Function failed', {
      function: 'calculateCurrentRatios',
      day: state.currentDay,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return safe defaults on error
    return {
      debtToAssetRatio: 0,
      interestCoverageRatio: 999,
      debtToRevenueRatio: 0,
    };
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

    // Calculate required loan
    const requestedLoan = requiredCash - state.cash;

    // HARD CAP: Check ratio constraints
    const maxAllowableLoan = calculateMaxAllowableLoan(state, strategy);
    const cappedLoanAmount = Math.min(requestedLoan, maxAllowableLoan);

    if (cappedLoanAmount < requestedLoan) {
      logger.info('Preemptive loan capped by ratio constraints', {
        function: 'preventWageAdvance',
        day: state.currentDay,
        requestedLoan: Math.round(requestedLoan),
        cappedLoan: Math.round(cappedLoanAmount),
        reduction: Math.round(requestedLoan - cappedLoanAmount),
      });
    }

    if (cappedLoanAmount <= 0) {
      logger.info('Cannot take preemptive loan - would violate ratio constraints', {
        function: 'preventWageAdvance',
        day: state.currentDay,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Take capped loan to avoid wage advance
    const loanAmount = cappedLoanAmount;
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
