/**
 * Enhanced Objective Function for Genetic Algorithm
 *
 * Calculates fitness with:
 * 1. Primary: Terminal wealth (cash - debt)
 * 2. Penalties: Massive penalties for constraint violations
 * 3. Terminal value: Accounts for leftover assets at shutdown
 * 4. Secondary: Revenue, service level, operational efficiency
 *
 * Prevents catastrophic failures like:
 * - Selling all machines
 * - Going bankrupt
 * - Exceeding custom queue capacity (360 jobs)
 */

import type { SimulationResult } from '../simulation/types.js';

export interface FitnessBreakdown {
  terminalWealth: number;
  terminalAdjustment: number; // Penalty for leftover assets at shutdown
  totalRevenue: number;
  serviceLevel: number;
  violations: {
    zeroMachines: number;        // NEVER allow MCE < 1
    bankruptcy: number;           // Cash < -$50K
    customQueueOverflow: number;  // Custom WIP > 360
    deliveryViolations: number;   // Custom orders >7 days late
    stockoutDays: number;         // Days with zero raw materials
    total: number;
  };
  finalScore: number;
}

export interface OptimizationConstraints {
  testDay: number;
  endDay: number;
  evaluationWindow: number;
}

/**
 * Calculate fitness score with proper penalties for violations
 *
 * Score components:
 * - 1.0 × terminal wealth (main objective)
 * - 0.01 × total revenue (favor high throughput)
 * - 50,000 × service level (reward on-time delivery)
 * - terminal asset penalty (leftover inventory/machines)
 * - massive violation penalties (1M for zero machines, 500K for bankruptcy)
 *
 * @param result Simulation result to evaluate
 * @param constraints Optimization constraints (currently unused, reserved for future enhancements)
 * @returns Fitness score and detailed breakdown
 */
export function calculateFitness(
  result: SimulationResult,
  _constraints?: Partial<OptimizationConstraints>
): { score: number; breakdown: FitnessBreakdown } {
  const { state } = result;

  // PRIMARY: Terminal wealth
  const terminalWealth = state.cash - state.debt;

  // TERMINAL VALUE PENALTY: Leftover inventory/machines at shutdown
  const finalDay = state.currentDay;
  const daysFromShutdown = Math.max(0, 415 - finalDay);

  // Calculate value of assets that should have been liquidated
  const RAW_MATERIAL_COST = 50;
  const STANDARD_MATERIAL_VALUE = 100; // Estimate
  const CUSTOM_MATERIAL_VALUE = 50;
  const STANDARD_FG_VALUE = 200;
  const CUSTOM_FG_VALUE = 400;

  // Count total WIP in standard line
  const standardWIP = getTotalStandardWIP(state);

  const terminalAssets = {
    rawMaterials: state.rawMaterialInventory * RAW_MATERIAL_COST,
    wipValue: (standardWIP * STANDARD_MATERIAL_VALUE) +
      (state.customLineWIP.orders.length * CUSTOM_MATERIAL_VALUE),
    finishedGoods: (state.finishedGoods.standard * STANDARD_FG_VALUE) +
      (state.finishedGoods.custom * CUSTOM_FG_VALUE),
    machines: (state.machines.MCE * 10000) + (state.machines.WMA * 7500) + (state.machines.PUC * 4000)
  };

  // If near shutdown (< 30 days), penalize unsold assets heavily
  const totalAssets = Object.values(terminalAssets).reduce((a, b) => a + b, 0);
  const assetPenalty = daysFromShutdown < 30 ? totalAssets * 0.5 : 0;

  // CRITICAL VIOLATIONS: Make solutions infeasible
  const violations = {
    // Catastrophic: Zero machines (prevents production entirely)
    zeroMachines: state.machines.MCE < 1 ? 1000000 : 0,

    // Critical: Bankruptcy (cash significantly negative)
    bankruptcy: state.cash < -50000 ? 500000 : 0,

    // Critical: Custom queue capacity exceeded (hard constraint from case)
    customQueueOverflow: calculateCustomQueueOverflowPenalty(state),

    // Important: Custom delivery violations (>7 days late)
    deliveryViolations: countDeliveryViolations(state) * 10000,

    // Important: Stockouts prevent new production from starting
    stockoutDays: (state.stockoutDays || 0) * 1000,
  };

  const totalViolations = Object.values(violations).reduce((a, b) => a + b, 0);

  // SECONDARY METRICS: Operational efficiency
  const totalRevenue = state.history.dailyRevenue.reduce((sum, d) => sum + d.value, 0);

  // Service level: % of custom orders delivered on time
  const customOrdersDelivered = state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0);
  const lateOrders = countDeliveryViolations(state);
  const serviceLevel = customOrdersDelivered > 0
    ? Math.max(0, 1 - (lateOrders / customOrdersDelivered))
    : 1.0;

  // FINAL SCORE CALCULATION
  const score = (
    1.0 * terminalWealth +        // Main objective ($1 per $1 terminal wealth)
    0.01 * totalRevenue +          // Small bonus for high throughput
    50000 * serviceLevel -         // $50K bonus for perfect service
    assetPenalty -                 // Penalty for leftover assets at shutdown
    totalViolations                // MASSIVE penalties for violations
  );

  return {
    score,
    breakdown: {
      terminalWealth,
      terminalAdjustment: -assetPenalty,
      totalRevenue,
      serviceLevel,
      violations: { ...violations, total: totalViolations },
      finalScore: score
    }
  };
}

/**
 * Count total WIP units in standard line (across all stations)
 */
function getTotalStandardWIP(state: SimulationResult['state']): number {
  const wip = state.standardLineWIP;

  const preStation1 = wip.preStation1.reduce((sum, batch) => sum + batch.units, 0);
  const station1 = wip.station1.reduce((sum, batch) => sum + batch.units, 0);
  const station2 = wip.station2.reduce((sum, batch) => sum + batch.units, 0);
  const station3 = wip.station3.reduce((sum, batch) => sum + batch.units, 0);

  return preStation1 + station1 + station2 + station3;
}

/**
 * Calculate penalty for custom queue overflow (>360 jobs)
 *
 * Counts days where custom WIP exceeded 360 and applies heavy penalty
 */
function calculateCustomQueueOverflowPenalty(state: SimulationResult['state']): number {
  const overflowDays = state.history.dailyCustomWIP.filter(d => d.value > 360).length;
  return overflowDays * 100000; // $100K penalty per day of overflow
}

/**
 * Count custom orders that exceeded 7-day delivery target
 *
 * Custom orders should be delivered within 7 days of order.
 * This counts how many are currently late or were delivered late.
 */
function countDeliveryViolations(state: SimulationResult['state']): number {
  // Current orders in WIP that are late
  const currentlyLate = state.customLineWIP.orders.filter(o => o.daysInProduction > 7).length;

  // This is a simplified count - in full implementation, would track historical late deliveries
  // For now, penalize current late orders as proxy
  return currentlyLate;
}
