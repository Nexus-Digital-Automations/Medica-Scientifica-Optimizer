/**
 * State Management for Simulation
 * Handles cloning, initialization, and state operations with full type safety
 */

import type { SimulationState, DailyMetrics } from './types.js';
import { INITIAL_STATE, INITIAL_STATE_BUSINESS_CASE, INITIAL_STATE_HISTORICAL } from './constants.js';

/**
 * Creates a deep clone of the simulation state
 */
export function cloneState(state: SimulationState): SimulationState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Initializes a new simulation state from initial conditions
 * @param baseState - Optional initial state to use (defaults to INITIAL_STATE)
 */
export function initializeState(baseState: SimulationState = INITIAL_STATE): SimulationState {
  const state = cloneState(baseState);

  // Determine WIP counts based on which initial state is being used
  const isHistorical = state.cash > 100000; // Historical has ~$384K, business case has ~$8K
  const standardWIPCount = isHistorical ? 414 : 120;
  const customWIPCount = isHistorical ? 300 : 295;

  // Initialize standard line WIP with starting units
  // Distribute initial units across stations (evenly split for simplicity)
  const unitsPerStation = Math.floor(standardWIPCount / 3);
  const remainder = standardWIPCount % 3;

  for (let i = 0; i < unitsPerStation; i++) {
    state.standardLineWIP.station1.push({ units: 1, startDay: 50, batchingDaysRemaining: 0 });
  }
  for (let i = 0; i < unitsPerStation; i++) {
    state.standardLineWIP.station2.push({ units: 1, startDay: 48, batchingDaysRemaining: 2 });
  }
  for (let i = 0; i < unitsPerStation + remainder; i++) {
    state.standardLineWIP.station3.push({ units: 1, startDay: 47, batchingDaysRemaining: 0 });
  }

  // Initialize custom line WIP with starting orders
  // For historical data (Day 49): Match Excel breakdown exactly
  // - 264 waiting for MCE
  // - 12 in WMA Pass 1
  // - 12 in PUC
  // - 12 in WMA Pass 2
  if (isHistorical) {
    // 264 orders waiting for MCE processing (Queue 1)
    for (let i = 0; i < 264; i++) {
      state.customLineWIP.orders.push({
        orderId: `initial-waiting-${i}`,
        startDay: 50 - Math.floor(i / 30), // Stagger arrival over ~9 days
        daysInProduction: 0,
        currentStation: 'WAITING',
        daysAtCurrentStation: Math.floor(i / 30),
      });
    }
    // 12 orders in WMA Pass 1 (Queue 2 First Pass)
    for (let i = 0; i < 12; i++) {
      state.customLineWIP.orders.push({
        orderId: `initial-wma1-${i}`,
        startDay: 48,
        daysInProduction: 2,
        currentStation: 'WMA_PASS1',
        daysAtCurrentStation: 1,
      });
    }
    // 12 orders in PUC (Queue 3)
    for (let i = 0; i < 12; i++) {
      state.customLineWIP.orders.push({
        orderId: `initial-puc-${i}`,
        startDay: 46,
        daysInProduction: 4,
        currentStation: 'PUC',
        daysAtCurrentStation: 1,
      });
    }
    // 12 orders in WMA Pass 2 (Queue 2 Second Pass)
    for (let i = 0; i < 12; i++) {
      state.customLineWIP.orders.push({
        orderId: `initial-wma2-${i}`,
        startDay: 45,
        daysInProduction: 5,
        currentStation: 'WMA_PASS2',
        daysAtCurrentStation: 1,
      });
    }
  } else {
    // Business case: Use random distribution for initial WIP
    for (let i = 0; i < customWIPCount; i++) {
      const daysInProd = Math.floor(Math.random() * 10);
      state.customLineWIP.orders.push({
        orderId: `initial-${i}`,
        startDay: 50 - Math.floor(Math.random() * 10), // Stagger start days
        daysInProduction: daysInProd,
        currentStation: daysInProd < 2 ? 'WMA_PASS1' : daysInProd < 4 ? 'WMA_PASS2' : 'PUC',
        daysAtCurrentStation: 0,
      });
    }
  }

  return state;
}

/**
 * Get initial state by scenario ID
 */
export function getInitialStateByScenario(scenarioId?: string): SimulationState {
  if (scenarioId === 'historical-data-day51') {
    return INITIAL_STATE_HISTORICAL;
  }
  // Default to business case
  return INITIAL_STATE_BUSINESS_CASE;
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
export function recordDailyHistory(
  state: SimulationState,
  dailyMetrics: Partial<DailyMetrics> = {},
  strategy?: import('./types.js').Strategy
): void {
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

  // Per-queue WIP tracking for timeline visualization
  // Custom line queues - count orders by station
  const customQueue1 = state.customLineWIP.orders.filter(o => o.currentStation === 'WAITING').length;
  const customQueue2 = state.customLineWIP.orders.filter(o => o.currentStation === 'MCE').length;
  const customQueue3 = state.customLineWIP.orders.filter(o =>
    o.currentStation === 'WMA_PASS1' || o.currentStation === 'WMA_PASS2' || o.currentStation === 'PUC'
  ).length;

  state.history.dailyCustomQueue1.push({ day, value: customQueue1 });
  state.history.dailyCustomQueue2.push({ day, value: customQueue2 });
  state.history.dailyCustomQueue3.push({ day, value: customQueue3 });

  // Standard line queues - sum batch units at each station
  const stdQueue1 = state.standardLineWIP.preStation1.reduce((sum, batch) => sum + batch.units, 0);
  const stdQueue2 = state.standardLineWIP.station1.reduce((sum, batch) => sum + batch.units, 0);
  const stdQueue3 = state.standardLineWIP.station2.reduce((sum, batch) => sum + batch.units, 0);
  const stdQueue4 = state.standardLineWIP.station3.reduce((sum, batch) => sum + batch.units, 0);
  const stdQueue5 = state.finishedGoods.standard;

  state.history.dailyStdQueue1.push({ day, value: stdQueue1 });
  state.history.dailyStdQueue2.push({ day, value: stdQueue2 });
  state.history.dailyStdQueue3.push({ day, value: stdQueue3 });
  state.history.dailyStdQueue4.push({ day, value: stdQueue4 });
  state.history.dailyStdQueue5.push({ day, value: stdQueue5 });

  // Inventory tracking
  state.history.dailyRawMaterial.push({ day, value: state.rawMaterialInventory });
  state.history.dailyRawMaterialOrders.push({ day, value: dailyMetrics.rawMaterialOrdered || 0 });
  state.history.dailyRawMaterialOrdersPlaced.push({ day, value: dailyMetrics.rawMaterialOrdersPlaced || 0 });
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

  // Dynamic policy tracking (current policy values for this day)
  if (strategy) {
    state.history.dailyReorderPoint.push({ day, value: strategy.reorderPoint });
    state.history.dailyOrderQuantity.push({ day, value: strategy.orderQuantity });
    state.history.dailyStandardBatchSize.push({ day, value: strategy.standardBatchSize });
  }

  // Record any actions performed
  if (dailyMetrics.actions && dailyMetrics.actions.length > 0) {
    dailyMetrics.actions.forEach((action) => {
      state.history.actionsPerformed.push({ day, action });
    });
  }
}
