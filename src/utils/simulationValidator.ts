import type { SimulationResult } from '../simulation/types';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'constraint' | 'objective' | 'efficiency';
  title: string;
  description: string;
  days?: number[];
  metric?: string;
  recommendation?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  allPassed: boolean;
}

/**
 * Validates simulation results against objectives and constraints
 * from development/essentials documentation
 */
export function validateSimulationResults(result: SimulationResult): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  const { state } = result;

  // Constraint Validation: Cash must never go negative
  const negativeCashDays = state.history.dailyCash
    .filter(d => d.value < 0)
    .map(d => d.day);

  if (negativeCashDays.length > 0) {
    errors.push({
      severity: 'error',
      category: 'constraint',
      title: 'Negative Cash Balance',
      description: `Cash went negative on ${negativeCashDays.length} day(s). The company cannot operate with negative cash - this violates fundamental business constraints.`,
      days: negativeCashDays,
      metric: 'cash',
      recommendation: 'Take loans earlier or reduce expenses to maintain positive cash flow.',
    });
  }

  // Constraint Validation: Custom WIP capacity (max 360 orders)
  const customWIPViolations = state.history.dailyCustomWIP
    .filter((d: { value: number }) => d.value > 360)
    .map((d: { day: number }) => d.day);

  if (customWIPViolations.length > 0) {
    errors.push({
      severity: 'error',
      category: 'constraint',
      title: 'Custom Line WIP Capacity Exceeded',
      description: `Custom line WIP exceeded maximum capacity of 360 orders on ${customWIPViolations.length} day(s). This violates production constraints.`,
      days: customWIPViolations,
      metric: 'wipCustom',
      recommendation: 'Reduce MCE allocation to custom line or increase ARCP capacity by hiring more workers.',
    });
  }

  // Warning: High debt levels
  const finalDebt = state.history.dailyDebt[state.history.dailyDebt.length - 1]?.value || 0;
  if (finalDebt > 100000) {
    warnings.push({
      severity: 'warning',
      category: 'objective',
      title: 'High Debt Level',
      description: `Final debt of $${finalDebt.toLocaleString()} is concerning. High debt reduces net worth and increases interest expenses.`,
      metric: 'debt',
      recommendation: 'Prioritize debt repayment to improve final net worth.',
    });
  }

  // Warning: Excessive WIP (indicates bottleneck)
  const avgStandardWIP = state.history.dailyStandardWIP.reduce((sum: number, d: { value: number }) => sum + d.value, 0) / state.history.dailyStandardWIP.length;
  if (avgStandardWIP > 500) {
    warnings.push({
      severity: 'warning',
      category: 'efficiency',
      title: 'Excessive Standard Line WIP',
      description: `Average WIP of ${Math.round(avgStandardWIP)} units indicates severe ARCP bottleneck. This ties up materials and capital.`,
      metric: 'wipStandard',
      recommendation: 'Hire more workers to increase ARCP capacity, or reduce MCE allocation to standard line.',
    });
  }

  // Warning: Low production efficiency
  const totalStandardProduced = state.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0);
  const totalCustomProduced = state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0);
  const avgDailyStandard = totalStandardProduced / state.history.dailyStandardProduction.length;
  const avgDailyCustom = totalCustomProduced / state.history.dailyCustomProduction.length;

  if (avgDailyStandard < 5) {
    warnings.push({
      severity: 'warning',
      category: 'efficiency',
      title: 'Low Standard Line Throughput',
      description: `Average daily production of ${avgDailyStandard.toFixed(1)} units/day is very low. ARCP workforce bottleneck detected.`,
      metric: 'dailyStandardProduction',
      recommendation: 'Hire more rookies early to build workforce capacity. Rookies become experts after 15 days.',
    });
  }

  if (avgDailyCustom < 2) {
    warnings.push({
      severity: 'warning',
      category: 'efficiency',
      title: 'Low Custom Line Throughput',
      description: `Average daily production of ${avgDailyCustom.toFixed(1)} orders/day is very low. Consider increasing MCE allocation to custom line.`,
      metric: 'dailyCustomProduction',
      recommendation: 'Increase MCE allocation to custom line to boost custom order throughput.',
    });
  }

  // Info: Interest paid analysis
  const totalInterestPaid = state.history.dailyInterestPaid.reduce((sum, d) => sum + d.value, 0);
  if (totalInterestPaid > 10000) {
    info.push({
      severity: 'info',
      category: 'objective',
      title: 'High Interest Expenses',
      description: `Total interest paid: $${totalInterestPaid.toLocaleString()}. This reduces overall profitability.`,
      metric: 'dailyInterestPaid',
      recommendation: 'Consider paying down debt faster to minimize interest expenses (36.5% annual rate).',
    });
  }

  // Info: Revenue optimization
  const totalRevenue = state.history.dailyRevenue.reduce((sum, d) => sum + d.value, 0);
  const totalExpenses = state.history.dailyExpenses.reduce((sum, d) => sum + d.value, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = (netProfit / totalRevenue) * 100;

  if (profitMargin < 10) {
    warnings.push({
      severity: 'warning',
      category: 'objective',
      title: 'Low Profit Margin',
      description: `Profit margin of ${profitMargin.toFixed(1)}% is concerning. Revenue may not be sufficient to cover expenses efficiently.`,
      recommendation: 'Review pricing strategy and cost structure. Consider optimizing workforce and inventory levels.',
    });
  }

  // Info: Cash flow stability
  const negativeCashFlowDays = state.history.dailyCash
    .filter((d, i) => {
      if (i === 0) return false;
      const previousCash = state.history.dailyCash[i - 1]?.value || 0;
      return d.value < previousCash && d.value > 0;
    })
    .map(d => d.day);

  if (negativeCashFlowDays.length > 200) {
    info.push({
      severity: 'info',
      category: 'efficiency',
      title: 'Frequent Cash Declines',
      description: `Cash declined on ${negativeCashFlowDays.length} days (out of ${state.history.dailyCash.length}). This may indicate cash flow instability.`,
      recommendation: 'Review loan timing and expense management to stabilize cash flow.',
    });
  }

  // Info: Material shortage analysis
  const stockoutDays = state.history.dailyRawMaterial
    .filter(d => d.value === 0)
    .map(d => d.day);

  if (stockoutDays.length > 100) {
    warnings.push({
      severity: 'warning',
      category: 'efficiency',
      title: 'Frequent Material Stockouts',
      description: `Raw materials were depleted on ${stockoutDays.length} days. Stockouts prevent new production from starting.`,
      metric: 'dailyRawMaterial',
      recommendation: 'Order materials more frequently or in larger quantities. Remember: 4-day lead time for material deliveries.',
    });
  }

  // Objective: Net worth analysis
  const { finalNetWorth } = result;
  if (finalNetWorth < 0) {
    errors.push({
      severity: 'error',
      category: 'objective',
      title: 'Negative Final Net Worth',
      description: `Final net worth of $${finalNetWorth.toLocaleString()} is negative. The company ended in worse financial position than it started.`,
      recommendation: 'Major strategy revision needed. Focus on profitability and debt reduction.',
    });
  } else if (finalNetWorth < 50000) {
    warnings.push({
      severity: 'warning',
      category: 'objective',
      title: 'Low Final Net Worth',
      description: `Final net worth of $${finalNetWorth.toLocaleString()} is relatively low. There may be opportunities for optimization.`,
      recommendation: 'Review strategy to increase production efficiency and reduce costs.',
    });
  }

  return {
    errors,
    warnings,
    info,
    allPassed: errors.length === 0,
  };
}
