/**
 * State Management for Simulation
 * Handles cloning, initialization, and state operations with full type safety
 */

import type { SimulationState, DailyMetrics } from './types.js';
import { INITIAL_STATE } from './constants.js';

/**
 * Creates a deep clone of the simulation state
 */
export function cloneState(state: SimulationState): SimulationState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Initializes a new simulation state from initial conditions
 */
export function initializeState(): SimulationState {
  const state = cloneState(INITIAL_STATE);

  // Initialize standard line WIP with starting units (120 units distributed)
  // Distribute initial units across stations
  for (let i = 0; i < 40; i++) {
    state.standardLineWIP.station1.push({ units: 1, startDay: 50, batchingDaysRemaining: 0 });
  }
  for (let i = 0; i < 40; i++) {
    state.standardLineWIP.station2.push({ units: 1, startDay: 48, batchingDaysRemaining: 2 });
  }
  for (let i = 0; i < 40; i++) {
    state.standardLineWIP.station3.push({ units: 1, startDay: 47, batchingDaysRemaining: 0 });
  }

  // Initialize custom line WIP with starting orders (295 orders)
  for (let i = 0; i < 295; i++) {
    state.customLineWIP.orders.push({
      orderId: `initial-${i}`,
      startDay: 50 - Math.floor(Math.random() * 10), // Stagger start days
      daysInProduction: Math.floor(Math.random() * 10),
    });
  }

  return state;
}

/**
 * Validates state integrity
 */
export function validateState(state: SimulationState): boolean {
  if (state.cash === undefined || state.debt === undefined) {
    return false;
  }

  if (state.rawMaterialInventory < 0) {
    return false;
  }

  if (state.workforce.experts < 0 || state.workforce.rookies < 0) {
    return false;
  }

  return true;
}

/**
 * Calculates total units in standard line WIP
 */
export function getTotalStandardWIP(state: SimulationState): number {
  const preStation1Count = state.standardLineWIP.preStation1.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const station1Count = state.standardLineWIP.station1.reduce((sum: number, batch) => sum + batch.units, 0);
  const station2Count = state.standardLineWIP.station2.reduce((sum: number, batch) => sum + batch.units, 0);
  const station3Count = state.standardLineWIP.station3.reduce((sum: number, batch) => sum + batch.units, 0);
  return preStation1Count + station1Count + station2Count + station3Count;
}

/**
 * Calculates net worth (cash - debt)
 */
export function getNetWorth(state: SimulationState): number {
  return state.cash - state.debt;
}

/**
 * Records ALL daily metrics to history for complete transparency
 */
export function recordDailyHistory(state: SimulationState, dailyMetrics: Partial<DailyMetrics> = {}): void {
  const day = state.currentDay;

  // Financial tracking
  state.history.dailyCash.push({ day, value: state.cash });
  state.history.dailyDebt.push({ day, value: state.debt });
  state.history.dailyNetWorth.push({ day, value: getNetWorth(state) });
  state.history.dailyRevenue.push({ day, value: dailyMetrics.revenue || 0 });
  state.history.dailyExpenses.push({ day, value: dailyMetrics.expenses || 0 });
  state.history.dailyInterestPaid.push({ day, value: dailyMetrics.interestPaid || 0 });
  state.history.dailyInterestEarned.push({ day, value: dailyMetrics.interestEarned || 0 });

  // Production tracking
  state.history.dailyStandardProduction.push({ day, value: dailyMetrics.standardProduced || 0 });
  state.history.dailyCustomProduction.push({ day, value: dailyMetrics.customProduced || 0 });
  state.history.dailyStandardWIP.push({ day, value: getTotalStandardWIP(state) });
  state.history.dailyCustomWIP.push({ day, value: state.customLineWIP.orders.length });
  state.history.dailyFinishedStandard.push({ day, value: state.finishedGoods.standard });
  state.history.dailyFinishedCustom.push({ day, value: state.finishedGoods.custom });

  // Inventory tracking
  state.history.dailyRawMaterial.push({ day, value: state.rawMaterialInventory });
  state.history.dailyRawMaterialOrders.push({ day, value: dailyMetrics.rawMaterialOrdered || 0 });
  state.history.dailyRawMaterialCost.push({ day, value: dailyMetrics.rawMaterialCost || 0 });

  // Workforce tracking
  state.history.dailyExperts.push({ day, value: state.workforce.experts });
  state.history.dailyRookies.push({ day, value: state.workforce.rookies });
  state.history.dailyRookiesInTraining.push({ day, value: state.workforce.rookiesInTraining.length });
  state.history.dailySalaryCost.push({ day, value: dailyMetrics.salaryCost || 0 });

  // Machine tracking
  state.history.dailyMCECount.push({ day, value: state.machines.MCE });
  state.history.dailyWMACount.push({ day, value: state.machines.WMA });
  state.history.dailyPUCCount.push({ day, value: state.machines.PUC });

  // Pricing and delivery
  state.history.dailyStandardPrice.push({ day, value: dailyMetrics.standardPrice || 0 });
  state.history.dailyCustomPrice.push({ day, value: dailyMetrics.customPrice || 0 });
  state.history.dailyCustomDeliveryTime.push({ day, value: dailyMetrics.avgCustomDeliveryTime || 0 });

  // Record any actions performed
  if (dailyMetrics.actions && dailyMetrics.actions.length > 0) {
    dailyMetrics.actions.forEach((action) => {
      state.history.actionsPerformed.push({ day, action });
    });
  }
}
