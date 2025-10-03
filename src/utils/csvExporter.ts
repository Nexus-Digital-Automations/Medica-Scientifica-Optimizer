/**
 * CSV Export Utility
 * Exports simulation results with dynamic policy tracking
 */

import type { SimulationResult } from '../simulation/types.js';

export function exportSimulationToCSV(result: SimulationResult): string {
  const { state } = result;
  const history = state.history;

  // Build CSV header
  const header = [
    '# Medica Scientifica COMPREHENSIVE Optimization Results',
    `# Generated: ${new Date().toISOString()}`,
    `# Period: Complete Simulation (Days 51-500)`,
    '#',
    '# DYNAMIC POLICY SYSTEM:',
    '#   Policies are calculated dynamically using Operations Research formulas',
    '#   EOQ (Economic Order Quantity) - minimizes ordering + holding costs',
    '#   ROP (Reorder Point) - includes safety stock for service level',
    '#   EPQ (Economic Production Quantity) - optimal batch size',
    '#',
    '# POLICY CHANGES:',
    '#   Triggered by: factory state changes, demand phases, timed actions',
    '#   See "Policy Change Reason" column for explanations',
    '#',
    '# TIMED ACTIONS:',
    '#   GA-optimized decisions: loans, hiring, material orders, policy adjustments',
    '#',
  ].join('\n');

  // Column headers
  const columns = [
    'Day',
    'Cash',
    'Debt',
    'Net Worth',
    'Revenue',
    'Expenses',
    'Interest Paid',
    'Interest Earned',
    'Standard Production',
    'Custom Production',
    'Standard WIP',
    'Custom WIP',
    'Finished Standard',
    'Finished Custom',
    'Raw Material',
    'Raw Material Orders',
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
    'Policy Change Reason',
    'Action',
  ];

  // Build data rows
  const rows: string[] = [];

  const days = history.dailyCash.map(d => d.day);

  for (const day of days) {
    const getValue = (arr: Array<{day: number; value: number}>) =>
      arr.find(d => d.day === day)?.value?.toFixed(2) || '0.00';

    const policyChange = history.policyChanges.find(p => p.day === day);
    const policyChangeReason = policyChange
      ? `${policyChange.policyType}: ${policyChange.oldValue}→${policyChange.newValue} (${policyChange.reason})`
      : '';

    const actions = history.actionsPerformed.filter(a => a.day === day);
    const actionStr = actions.map(a => JSON.stringify(a.action)).join('; ');

    rows.push([
      day,
      getValue(history.dailyCash),
      getValue(history.dailyDebt),
      getValue(history.dailyNetWorth),
      getValue(history.dailyRevenue),
      getValue(history.dailyExpenses),
      getValue(history.dailyInterestPaid),
      getValue(history.dailyInterestEarned),
      getValue(history.dailyStandardProduction),
      getValue(history.dailyCustomProduction),
      getValue(history.dailyStandardWIP),
      getValue(history.dailyCustomWIP),
      getValue(history.dailyFinishedStandard),
      getValue(history.dailyFinishedCustom),
      getValue(history.dailyRawMaterial),
      getValue(history.dailyRawMaterialOrders),
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
      policyChangeReason,
      actionStr,
    ].join(','));
  }

  return [header, '', columns.join(','), ...rows].join('\n');
}
