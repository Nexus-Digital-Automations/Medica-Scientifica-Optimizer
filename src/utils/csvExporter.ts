/**
 * CSV Export Utility
 * Exports simulation results with dynamic policy tracking
 */

import type { SimulationResult } from '../simulation/types.js';
import { validateBusinessRules, BUSINESS_RULES } from '../simulation/businessRules.js';

export function exportSimulationToCSV(result: SimulationResult): string {
  const { state } = result;
  const history = state.history;

  // Validate business rules for this result
  const businessRulesResult = validateBusinessRules(state);

  // Build CSV header
  const header = [
    '# Medica Scientifica COMPREHENSIVE Optimization Results',
    `# Generated: ${new Date().toISOString()}`,
    `# Period: Complete Simulation (Days 51-415)`,
    '#',
    '# BUSINESS RULES VALIDATION:',
    `#   Status: ${businessRulesResult.valid ? '✅ PASSED' : '❌ FAILED'}`,
    `#   Critical Violations: ${businessRulesResult.criticalCount}`,
    `#   Major Violations: ${businessRulesResult.majorCount}`,
    `#   Warnings: ${businessRulesResult.warningCount}`,
    '#',
    '# HARD CONSTRAINTS ENFORCED:',
    `#   Max Custom Delivery Time: ${BUSINESS_RULES.MAX_CUSTOM_DELIVERY_DAYS} days`,
    `#   Min Custom Service Level: ${(BUSINESS_RULES.MIN_CUSTOM_SERVICE_LEVEL * 100).toFixed(0)}%`,
    `#   Max Consecutive Stockouts: ${BUSINESS_RULES.MAX_CONSECUTIVE_STOCKOUT_DAYS} days`,
    `#   Min Production Utilization: ${(BUSINESS_RULES.MIN_PRODUCTION_UTILIZATION * 100).toFixed(0)}%`,
    `#   Min Cash Threshold: $${BUSINESS_RULES.MIN_CASH_THRESHOLD.toLocaleString()} (bankruptcy)`,
    `#   Min Operational Cash: $${BUSINESS_RULES.MIN_OPERATIONAL_CASH.toLocaleString()} (max 10 days below)`,
    `#   Max Cash-Constrained Orders: ${BUSINESS_RULES.MAX_CASH_CONSTRAINED_ORDERS} rejected orders`,
    `#   Min Custom Production Ratio: ${(BUSINESS_RULES.MIN_CUSTOM_PRODUCTION_RATIO * 100).toFixed(0)}%`,
    '#',
    '# DYNAMIC POLICY SYSTEM:',
    '#   Policies are calculated dynamically using Operations Research formulas',
    '#   EOQ (Economic Order Quantity) - minimizes ordering + holding costs',
    '#   ROP (Reorder Point) - includes safety stock for service level',
    '#   EPQ (Economic Production Quantity) - optimal batch size',
    '#',
    '# DATA FORMAT:',
    '#   Each column shows the state value for that day',
    '#   Action effects are visible as changes in state columns',
    '#   Example: HIRE_ROOKIE actions increase the "Rookies" column value',
    '#   Example: BUY_MACHINE actions increase the "MCE Count" / "WMA Count" / "PUC Count" columns',
    '#   Example: TAKE_LOAN actions increase "Cash" and "Debt" columns',
    '#',
  ].join('\n');

  // Column headers - State values show action effects directly
  const columns = [
    'Day',
    'Cash',
    'Debt',
    'Net Worth',
    'Revenue',
    'Expenses',
    'Interest Paid',
    'Interest Earned',
    'Debt Paid Down',
    'Preemptive Loan',
    'Debt Savings',
    'Debt-to-Asset Ratio',
    'Interest Coverage Ratio',
    'Debt-to-Revenue Ratio',
    'Daily Profit',
    'Standard Production',
    'Custom Production',
    'Standard WIP',
    'Custom WIP',
    'Finished Standard',
    'Finished Custom',
    'Custom Queue 1',
    'Custom Queue 2',
    'Custom Queue 3',
    'Std Queue 1',
    'Std Queue 2',
    'Std Queue 3',
    'Std Queue 4',
    'Std Queue 5',
    'Raw Material',
    'Raw Material Arrived',
    'Raw Material Orders Placed',
    'Raw Material Cost',
    'Experts',
    'Rookies',
    'Rookies In Training',
    'Salary Cost',
    'MCE Count',
    'WMA Count',
    'PUC Count',
    'Standard Price',
    'Custom Price',
    'Custom Delivery Time',
    // Dynamic policies
    'Current ROP',
    'Current EOQ',
    'Current Batch Size',
    // Strategy parameters
    'MCE Custom Allocation',
    'Daily Overtime Hours',
    'Custom Base Price',
    'Custom Penalty Per Day',
    'Custom Target Delivery Days',
  ];

  // Build data rows
  const rows: string[] = [];

  const days = history.dailyCash.map(d => d.day);

  for (const day of days) {
    const getValue = (arr: Array<{day: number; value: number}>) =>
      arr.find(d => d.day === day)?.value?.toFixed(2) || '0.00';

    const getNumericValue = (arr: Array<{day: number; value: number}>) =>
      arr.find(d => d.day === day)?.value || 0;

    // Calculate Daily Profit: Revenue - Expenses + Interest Earned
    // Note: Expenses already includes Interest Paid, so we don't subtract it again
    const revenue = getNumericValue(history.dailyRevenue);
    const expenses = getNumericValue(history.dailyExpenses);
    const interestEarned = getNumericValue(history.dailyInterestEarned);
    const dailyProfit = revenue - expenses + interestEarned;

    rows.push([
      day,
      getValue(history.dailyCash),
      getValue(history.dailyDebt),
      getValue(history.dailyNetWorth),
      getValue(history.dailyRevenue),
      getValue(history.dailyExpenses),
      getValue(history.dailyInterestPaid),
      getValue(history.dailyInterestEarned),
      getValue(history.dailyDebtPaydown),
      getValue(history.dailyPreemptiveLoan),
      getValue(history.dailyDebtSavings),
      getValue(history.dailyDebtToAssetRatio),
      getValue(history.dailyInterestCoverageRatio),
      getValue(history.dailyDebtToRevenueRatio),
      dailyProfit.toFixed(2),
      getValue(history.dailyStandardProduction),
      getValue(history.dailyCustomProduction),
      getValue(history.dailyStandardWIP),
      getValue(history.dailyCustomWIP),
      getValue(history.dailyFinishedStandard),
      getValue(history.dailyFinishedCustom),
      getValue(history.dailyCustomQueue1),
      getValue(history.dailyCustomQueue2),
      getValue(history.dailyCustomQueue3),
      getValue(history.dailyStdQueue1),
      getValue(history.dailyStdQueue2),
      getValue(history.dailyStdQueue3),
      getValue(history.dailyStdQueue4),
      getValue(history.dailyStdQueue5),
      getValue(history.dailyRawMaterial),
      getValue(history.dailyRawMaterialOrders),
      getValue(history.dailyRawMaterialOrdersPlaced),
      getValue(history.dailyRawMaterialCost),
      getValue(history.dailyExperts),
      getValue(history.dailyRookies),
      getValue(history.dailyRookiesInTraining),
      getValue(history.dailySalaryCost),
      getValue(history.dailyMCECount),
      getValue(history.dailyWMACount),
      getValue(history.dailyPUCCount),
      getValue(history.dailyStandardPrice),
      getValue(history.dailyCustomPrice),
      getValue(history.dailyCustomDeliveryTime),
      // Dynamic policies
      getValue(history.dailyReorderPoint),
      getValue(history.dailyOrderQuantity),
      getValue(history.dailyStandardBatchSize),
      // Strategy parameters
      getValue(history.dailyMCEAllocation),
      getValue(history.dailyOvertimeHours),
      getValue(history.dailyCustomBasePrice),
      getValue(history.dailyCustomPenaltyPerDay),
      getValue(history.dailyCustomTargetDeliveryDays),
    ].join(','));
  }

  return [header, '', columns.join(','), ...rows].join('\n');
}
