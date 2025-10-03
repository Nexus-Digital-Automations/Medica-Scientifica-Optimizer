/**
 * Business Rules Validator
 * Enforces hard constraints to prevent unrealistic operational strategies
 *
 * These rules ensure the optimization respects real-world business requirements:
 * - Customer service standards
 * - Operational feasibility
 * - Mission alignment (patient care)
 */

import type { SimulationState } from './types.js';

export interface BusinessRuleViolation {
  rule: string;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING';
  message: string;
  day: number;
  value: number;
  threshold: number;
}

export interface BusinessRulesResult {
  valid: boolean;
  violations: BusinessRuleViolation[];
  criticalCount: number;
  majorCount: number;
  warningCount: number;
}

/**
 * Business Rule Thresholds - Hard Constraints
 */
export const BUSINESS_RULES = {
  // Customer Service Standards
  MAX_CUSTOM_DELIVERY_DAYS: 7, // Custom orders MUST deliver within 7 days
  MIN_CUSTOM_SERVICE_LEVEL: 0.90, // 90% of orders must meet delivery target
  MAX_CUSTOM_BACKLOG_DAYS: 14, // Maximum acceptable backlog age

  // Inventory Management
  MIN_SAFETY_STOCK_DAYS: 2, // Minimum 2 days of raw materials on hand
  MAX_STOCKOUT_DAYS: 5, // Maximum 5 days of stockouts allowed per 100 days
  MAX_CONSECUTIVE_STOCKOUT_DAYS: 2, // No more than 2 consecutive stockout days

  // Production Standards
  MIN_PRODUCTION_UTILIZATION: 0.50, // Must use at least 50% of workforce capacity
  MAX_IDLE_WORKFORCE_DAYS: 7, // Maximum consecutive days with idle workers

  // Financial Health
  MIN_CASH_THRESHOLD: -50000, // Cannot go below -$50K cash (bankruptcy protection)
  MAX_DEBT_TO_REVENUE_RATIO: 5.0, // Debt cannot exceed 5x monthly revenue

  // Mission Alignment (Patient Care)
  MAX_ORDERS_REJECTED_PER_100_DAYS: 10, // Cannot reject more than 10 orders per 100 days
  MIN_CUSTOM_PRODUCTION_RATIO: 0.15, // Custom must be at least 15% of total production
} as const;

/**
 * Validate business rules for a completed simulation
 */
export function validateBusinessRules(state: SimulationState): BusinessRulesResult {
  const violations: BusinessRuleViolation[] = [];

  // Rule 1: Maximum Custom Delivery Time (CRITICAL)
  violations.push(...checkCustomDeliveryTime(state));

  // Rule 2: Custom Service Level (CRITICAL)
  violations.push(...checkCustomServiceLevel(state));

  // Rule 3: Inventory Stockouts (MAJOR)
  violations.push(...checkInventoryStockouts(state));

  // Rule 4: Production Utilization (MAJOR)
  violations.push(...checkProductionUtilization(state));

  // Rule 5: Financial Health (CRITICAL)
  violations.push(...checkFinancialHealth(state));

  // Rule 6: Mission Alignment (MAJOR)
  violations.push(...checkMissionAlignment(state));

  // Count violations by severity
  const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
  const majorCount = violations.filter(v => v.severity === 'MAJOR').length;
  const warningCount = violations.filter(v => v.severity === 'WARNING').length;

  // Strategy is INVALID if any CRITICAL violations exist
  const valid = criticalCount === 0;

  return {
    valid,
    violations,
    criticalCount,
    majorCount,
    warningCount,
  };
}

/**
 * Rule 1: Custom Delivery Time - MUST NOT EXCEED 7 DAYS
 */
function checkCustomDeliveryTime(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];
  const deliveryTimes = state.history.dailyCustomDeliveryTime;

  for (const entry of deliveryTimes) {
    if (entry.value > BUSINESS_RULES.MAX_CUSTOM_DELIVERY_DAYS) {
      violations.push({
        rule: 'MAX_CUSTOM_DELIVERY_DAYS',
        severity: 'CRITICAL',
        message: `Custom delivery time of ${entry.value.toFixed(1)} days exceeds maximum of ${BUSINESS_RULES.MAX_CUSTOM_DELIVERY_DAYS} days. This violates customer service standards.`,
        day: entry.day,
        value: entry.value,
        threshold: BUSINESS_RULES.MAX_CUSTOM_DELIVERY_DAYS,
      });
    }
  }

  return violations;
}

/**
 * Rule 2: Custom Service Level - 90% ON-TIME DELIVERY REQUIRED
 */
function checkCustomServiceLevel(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];
  const deliveryTimes = state.history.dailyCustomDeliveryTime.filter(d => d.value > 0);

  if (deliveryTimes.length === 0) return violations;

  // Calculate percentage of days meeting target delivery time
  const targetDays = 5; // Target delivery time from constants
  const onTimeDays = deliveryTimes.filter(d => d.value <= targetDays).length;
  const serviceLevel = onTimeDays / deliveryTimes.length;

  if (serviceLevel < BUSINESS_RULES.MIN_CUSTOM_SERVICE_LEVEL) {
    violations.push({
      rule: 'MIN_CUSTOM_SERVICE_LEVEL',
      severity: 'CRITICAL',
      message: `Custom service level of ${(serviceLevel * 100).toFixed(1)}% is below minimum ${(BUSINESS_RULES.MIN_CUSTOM_SERVICE_LEVEL * 100).toFixed(0)}%. Only ${onTimeDays}/${deliveryTimes.length} days met target delivery time.`,
      day: state.currentDay,
      value: serviceLevel,
      threshold: BUSINESS_RULES.MIN_CUSTOM_SERVICE_LEVEL,
    });
  }

  return violations;
}

/**
 * Rule 3: Inventory Stockouts - LIMIT STOCKOUT FREQUENCY
 */
function checkInventoryStockouts(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];
  const inventoryLevels = state.history.dailyRawMaterial;

  // Check for consecutive stockout days
  let consecutiveStockouts = 0;
  let maxConsecutiveStockouts = 0;

  for (const entry of inventoryLevels) {
    if (entry.value === 0) {
      consecutiveStockouts++;
      maxConsecutiveStockouts = Math.max(maxConsecutiveStockouts, consecutiveStockouts);
    } else {
      consecutiveStockouts = 0;
    }
  }

  if (maxConsecutiveStockouts > BUSINESS_RULES.MAX_CONSECUTIVE_STOCKOUT_DAYS) {
    violations.push({
      rule: 'MAX_CONSECUTIVE_STOCKOUT_DAYS',
      severity: 'MAJOR',
      message: `${maxConsecutiveStockouts} consecutive days of stockouts exceeds maximum of ${BUSINESS_RULES.MAX_CONSECUTIVE_STOCKOUT_DAYS} days. This disrupts production.`,
      day: state.currentDay,
      value: maxConsecutiveStockouts,
      threshold: BUSINESS_RULES.MAX_CONSECUTIVE_STOCKOUT_DAYS,
    });
  }

  // Check stockout frequency per 100 days
  const stockoutDays = inventoryLevels.filter(d => d.value === 0).length;
  const totalDays = inventoryLevels.length;
  const stockoutsPer100Days = (stockoutDays / totalDays) * 100;

  if (stockoutsPer100Days > BUSINESS_RULES.MAX_STOCKOUT_DAYS) {
    violations.push({
      rule: 'MAX_STOCKOUT_DAYS',
      severity: 'MAJOR',
      message: `${stockoutsPer100Days.toFixed(1)} stockout days per 100 days exceeds maximum of ${BUSINESS_RULES.MAX_STOCKOUT_DAYS}. This indicates poor inventory management.`,
      day: state.currentDay,
      value: stockoutsPer100Days,
      threshold: BUSINESS_RULES.MAX_STOCKOUT_DAYS,
    });
  }

  return violations;
}

/**
 * Rule 4: Production Utilization - WORKFORCE MUST BE PRODUCTIVE
 */
function checkProductionUtilization(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];
  const production = state.history.dailyStandardProduction;
  const experts = state.history.dailyExperts;
  const rookies = state.history.dailyRookies;

  // Calculate average utilization
  let totalUtilization = 0;
  let utilizationDays = 0;

  for (let i = 0; i < production.length; i++) {
    const expertCapacity = experts[i]?.value * 3 || 0; // 3 units per expert
    const rookieCapacity = (rookies[i]?.value * 3 * 0.4) || 0; // 40% of expert
    const totalCapacity = expertCapacity + rookieCapacity;

    if (totalCapacity > 0) {
      const utilization = production[i].value / totalCapacity;
      totalUtilization += utilization;
      utilizationDays++;
    }
  }

  const avgUtilization = utilizationDays > 0 ? totalUtilization / utilizationDays : 0;

  if (avgUtilization < BUSINESS_RULES.MIN_PRODUCTION_UTILIZATION) {
    violations.push({
      rule: 'MIN_PRODUCTION_UTILIZATION',
      severity: 'MAJOR',
      message: `Average production utilization of ${(avgUtilization * 100).toFixed(1)}% is below minimum ${(BUSINESS_RULES.MIN_PRODUCTION_UTILIZATION * 100).toFixed(0)}%. Workforce is underutilized.`,
      day: state.currentDay,
      value: avgUtilization,
      threshold: BUSINESS_RULES.MIN_PRODUCTION_UTILIZATION,
    });
  }

  return violations;
}

/**
 * Rule 5: Financial Health - PREVENT BANKRUPTCY
 */
function checkFinancialHealth(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];
  const cashHistory = state.history.dailyCash;

  // Check minimum cash threshold
  const minCash = Math.min(...cashHistory.map(d => d.value));

  if (minCash < BUSINESS_RULES.MIN_CASH_THRESHOLD) {
    violations.push({
      rule: 'MIN_CASH_THRESHOLD',
      severity: 'CRITICAL',
      message: `Minimum cash of $${minCash.toFixed(2)} is below bankruptcy threshold of $${BUSINESS_RULES.MIN_CASH_THRESHOLD.toFixed(2)}. Company would fail.`,
      day: state.currentDay,
      value: minCash,
      threshold: BUSINESS_RULES.MIN_CASH_THRESHOLD,
    });
  }

  return violations;
}

/**
 * Rule 6: Mission Alignment - SERVE PATIENTS, DON'T REJECT ORDERS
 */
function checkMissionAlignment(state: SimulationState): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];

  // Check order rejection rate
  const rejectedOrders = state.rejectedMaterialOrders || 0;
  const totalDays = state.currentDay - 51; // Days since start
  const rejectionsPerEndDays = (rejectedOrders / totalDays) * 100;

  if (rejectionsPerEndDays > BUSINESS_RULES.MAX_ORDERS_REJECTED_PER_100_DAYS) {
    violations.push({
      rule: 'MAX_ORDERS_REJECTED_PER_100_DAYS',
      severity: 'MAJOR',
      message: `${rejectionsPerEndDays.toFixed(1)} orders rejected per 100 days exceeds maximum of ${BUSINESS_RULES.MAX_ORDERS_REJECTED_PER_100_DAYS}. This violates mission to serve patients.`,
      day: state.currentDay,
      value: rejectionsPerEndDays,
      threshold: BUSINESS_RULES.MAX_ORDERS_REJECTED_PER_100_DAYS,
    });
  }

  // Check custom production ratio (ensure we're not neglecting custom orders)
  const totalStandard = state.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0);
  const totalCustom = state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0);
  const totalProduction = totalStandard + totalCustom;
  const customRatio = totalProduction > 0 ? totalCustom / totalProduction : 0;

  if (customRatio < BUSINESS_RULES.MIN_CUSTOM_PRODUCTION_RATIO) {
    violations.push({
      rule: 'MIN_CUSTOM_PRODUCTION_RATIO',
      severity: 'MAJOR',
      message: `Custom production ratio of ${(customRatio * 100).toFixed(1)}% is below minimum ${(BUSINESS_RULES.MIN_CUSTOM_PRODUCTION_RATIO * 100).toFixed(0)}%. Custom line is being neglected.`,
      day: state.currentDay,
      value: customRatio,
      threshold: BUSINESS_RULES.MIN_CUSTOM_PRODUCTION_RATIO,
    });
  }

  return violations;
}

/**
 * Format violations for logging
 */
export function formatViolations(result: BusinessRulesResult): string {
  if (result.valid) {
    return '✅ All business rules passed';
  }

  const lines: string[] = [];
  lines.push('❌ BUSINESS RULE VIOLATIONS DETECTED:');
  lines.push('');
  lines.push(`Critical: ${result.criticalCount} | Major: ${result.majorCount} | Warning: ${result.warningCount}`);
  lines.push('');

  // Group by severity
  const critical = result.violations.filter(v => v.severity === 'CRITICAL');
  const major = result.violations.filter(v => v.severity === 'MAJOR');
  const warning = result.violations.filter(v => v.severity === 'WARNING');

  if (critical.length > 0) {
    lines.push('🔴 CRITICAL VIOLATIONS (Strategy REJECTED):');
    critical.forEach(v => {
      lines.push(`  - ${v.rule}: ${v.message}`);
    });
    lines.push('');
  }

  if (major.length > 0) {
    lines.push('🟡 MAJOR VIOLATIONS:');
    major.forEach(v => {
      lines.push(`  - ${v.rule}: ${v.message}`);
    });
    lines.push('');
  }

  if (warning.length > 0) {
    lines.push('⚠️  WARNINGS:');
    warning.forEach(v => {
      lines.push(`  - ${v.rule}: ${v.message}`);
    });
  }

  return lines.join('\n');
}
