/**
 * Production Module - Handles all production operations with full type safety
 * Manages MCE machine capacity allocation, WIP flow through stations,
 * and coordination between standard and custom production lines
 */

import type { SimulationState, Strategy } from './types.js';
import { CONSTANTS } from './constants.js';
import { consumeRawMaterials } from './inventoryModule.js';

export interface MCECapacityAllocation {
  totalCapacity: number;
  customCapacity: number;
  standardCapacity: number;
  allocationRatio: {
    custom: number;
    standard: number;
  };
}

export interface CustomLineResult {
  newOrdersStarted: number;
  ordersProcessed: number;
  ordersCompleted: number;
  remainingWIP: number;
  avgDeliveryTime: number;
  rawMaterialUsed: number;
  capacityUtilization: {
    mce: number;
    arcp: number;
  };
}

export interface Station1Result {
  unitsProcessed: number;
  rawMaterialUsed: number;
  movedToStation2: number;
  capacityUtilization: number;
}

export interface Station2Result {
  unitsCompleted: number;
  movedToStation3: number;
  remainingInStation2: number;
}

export interface Station3Result {
  unitsCompleted: number;
  movedToFinishedGoods: number;
  remainingInStation3: number;
}

export interface StandardLineResult {
  station1: Station1Result;
  station2: Station2Result;
  station3: Station3Result;
  totalUnitsCompleted: number;
  totalRawMaterialUsed: number;
}

export interface ProductionMetrics {
  standard: {
    wipStation1: number;
    wipStation2: number;
    wipStation3: number;
    wipTotal: number;
    finishedGoods: number;
  };
  custom: {
    wip: number;
    finishedGoods: number;
  };
  machines: {
    MCE: number;
    WMA: number;
    PUC: number;
  };
}

/**
 * Calculates daily MCE (Station 1) capacity
 * The MCE is the shared bottleneck between both production lines
 */
export function calculateMCECapacity(state: SimulationState): number {
  return state.machines.MCE * CONSTANTS.MCE_UNITS_PER_MACHINE_PER_DAY;
}

/**
 * Allocates MCE capacity between custom and standard production lines
 */
export function allocateMCECapacity(state: SimulationState, strategy: Strategy): MCECapacityAllocation {
  const totalCapacity = calculateMCECapacity(state);
  const customAllocation = totalCapacity * strategy.mceAllocationCustom;
  const standardAllocation = totalCapacity * (1 - strategy.mceAllocationCustom);

  return {
    totalCapacity,
    customCapacity: Math.floor(customAllocation),
    standardCapacity: Math.floor(standardAllocation),
    allocationRatio: {
      custom: strategy.mceAllocationCustom,
      standard: 1 - strategy.mceAllocationCustom,
    },
  };
}

/**
 * Processes custom line production for one day
 * Custom line: MCE → WMA (Pass 1) → WMA (Pass 2) → PUC → Ship
 * Implements data-driven multi-stage production with second WMA pass
 */
export function processCustomLineProduction(
  state: SimulationState,
  _strategy: Strategy,
  mceCapacity: number
): CustomLineResult {
  const startingOrders = state.customLineWIP.orders.length;

  // Calculate station capacities
  const wmaCapacity = state.machines.WMA * CONSTANTS.CUSTOM_WMA_CAPACITY_PER_MACHINE_PER_DAY;
  const pucCapacity = state.machines.PUC * CONSTANTS.CUSTOM_PUC_CAPACITY_PER_MACHINE_PER_DAY;

  let newOrdersStarted = 0;
  let ordersCompleted = 0;
  const completedOrders: Array<{ startDay: number; completionDay: number; totalDays: number }> = [];

  // Step 1: MCE Processing (add new orders to WIP at MCE station)
  const newOrdersCapacity = Math.min(mceCapacity, CONSTANTS.CUSTOM_LINE_MAX_WIP - startingOrders);
  const rawMaterialNeeded = newOrdersCapacity * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT;
  const materialConsumption = consumeRawMaterials(state, rawMaterialNeeded, 'custom');
  newOrdersStarted = Math.floor(materialConsumption.consumed / CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT);

  // Add new orders at MCE station
  for (let i = 0; i < newOrdersStarted; i++) {
    state.customLineWIP.orders.push({
      orderId: `custom-${state.currentDay}-${i}`,
      startDay: state.currentDay,
      daysInProduction: 0,
      currentStation: 'MCE',
      daysAtCurrentStation: 0,
    });
  }

  // Step 2-5: Process orders through stations (FIFO - oldest first)
  // Sort by start day to process in order
  state.customLineWIP.orders.sort((a, b) => a.startDay - b.startDay);

  // Track capacity usage at each station
  let wmaPass1Used = 0;
  let wmaPass2Used = 0;
  let pucUsed = 0;

  state.customLineWIP.orders = state.customLineWIP.orders.filter((order) => {
    order.daysInProduction += 1;
    order.daysAtCurrentStation += 1;

    // Process based on current station
    switch (order.currentStation) {
      case 'MCE':
        // MCE processes immediately, move to WMA Pass 1
        order.currentStation = 'WMA_PASS1';
        order.daysAtCurrentStation = 0;
        return true;

      case 'WMA_PASS1':
        // Check WMA Pass 1 capacity
        if (wmaPass1Used < wmaCapacity && order.daysAtCurrentStation >= CONSTANTS.CUSTOM_WMA_PROCESSING_DAYS) {
          wmaPass1Used++;
          order.currentStation = 'WMA_PASS2';
          order.daysAtCurrentStation = 0;
        }
        return true;

      case 'WMA_PASS2':
        // Check WMA Pass 2 capacity (second pass through WMA)
        if (wmaPass2Used < wmaCapacity && order.daysAtCurrentStation >= CONSTANTS.CUSTOM_WMA_PROCESSING_DAYS) {
          wmaPass2Used++;
          order.currentStation = 'PUC';
          order.daysAtCurrentStation = 0;
        }
        return true;

      case 'PUC':
        // Check PUC capacity
        if (pucUsed < pucCapacity && order.daysAtCurrentStation >= CONSTANTS.CUSTOM_PUC_PROCESSING_DAYS) {
          pucUsed++;
          order.currentStation = 'COMPLETE';
          ordersCompleted++;
          completedOrders.push({
            startDay: order.startDay,
            completionDay: state.currentDay,
            totalDays: order.daysInProduction,
          });
          state.finishedGoods.custom++;
          return false; // Remove from WIP
        }
        return true;

      default:
        return true;
    }
  });

  // Calculate average delivery time
  const avgDeliveryTime =
    completedOrders.length > 0
      ? completedOrders.reduce((sum, order) => sum + order.totalDays, 0) / completedOrders.length
      : 0;

  return {
    newOrdersStarted,
    ordersProcessed: wmaPass1Used + wmaPass2Used + pucUsed, // Total orders processed across all stations
    ordersCompleted,
    remainingWIP: state.customLineWIP.orders.length,
    avgDeliveryTime,
    rawMaterialUsed: materialConsumption.consumed,
    capacityUtilization: {
      mce: mceCapacity > 0 ? newOrdersStarted / mceCapacity : 0,
      arcp: 1, // Not used in new multi-stage model
    },
  };
}

/**
 * Processes standard line Station 1 (MCE) for one day
 */
export function processStandardStation1(state: SimulationState, mceCapacity: number): Station1Result {
  // Check raw material availability
  const rawMaterialNeeded = mceCapacity * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT;
  const materialConsumption = consumeRawMaterials(state, rawMaterialNeeded, 'standard');

  const unitsProcessed = Math.floor(
    materialConsumption.consumed / CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT
  );

  // Move units from Station 1 to Station 2
  for (let i = 0; i < unitsProcessed; i++) {
    state.standardLineWIP.station2.push({
      units: 1,
      startDay: state.currentDay,
      batchingDaysRemaining: CONSTANTS.INITIAL_BATCHING_TIME,
    });
  }

  return {
    unitsProcessed,
    rawMaterialUsed: materialConsumption.consumed,
    movedToStation2: unitsProcessed,
    capacityUtilization: mceCapacity > 0 ? unitsProcessed / mceCapacity : 0,
  };
}

/**
 * Processes standard line Station 2 (WMA - batching) for one day
 */
export function processStandardStation2(state: SimulationState): Station2Result {
  let unitsCompleted = 0;

  // Process batching time for all units in Station 2
  state.standardLineWIP.station2 = state.standardLineWIP.station2.filter((batch) => {
    batch.batchingDaysRemaining -= 1;

    if (batch.batchingDaysRemaining <= 0) {
      // Move to Station 3
      state.standardLineWIP.station3.push({
        units: batch.units,
        startDay: batch.startDay,
        batchingDaysRemaining: CONSTANTS.FINAL_BATCHING_TIME,
      });
      unitsCompleted += batch.units;
      return false; // Remove from Station 2
    }

    return true; // Keep in Station 2
  });

  return {
    unitsCompleted,
    movedToStation3: unitsCompleted,
    remainingInStation2: state.standardLineWIP.station2.length,
  };
}

/**
 * Processes standard line Station 3 (PUC - final batching) for one day
 */
export function processStandardStation3(state: SimulationState): Station3Result {
  let unitsCompleted = 0;

  // Process final batching for all units in Station 3
  state.standardLineWIP.station3 = state.standardLineWIP.station3.filter((batch) => {
    batch.batchingDaysRemaining -= 1;

    if (batch.batchingDaysRemaining <= 0) {
      // Move to finished goods
      state.finishedGoods.standard += batch.units;
      unitsCompleted += batch.units;
      return false; // Remove from Station 3
    }

    return true; // Keep in Station 3
  });

  return {
    unitsCompleted,
    movedToFinishedGoods: unitsCompleted,
    remainingInStation3: state.standardLineWIP.station3.length,
  };
}

/**
 * Processes complete standard line production for one day
 */
export function processStandardLineProduction(state: SimulationState, mceCapacity: number): StandardLineResult {
  const station1Results = processStandardStation1(state, mceCapacity);
  const station2Results = processStandardStation2(state);
  const station3Results = processStandardStation3(state);

  return {
    station1: station1Results,
    station2: station2Results,
    station3: station3Results,
    totalUnitsCompleted: station3Results.unitsCompleted,
    totalRawMaterialUsed: station1Results.rawMaterialUsed,
  };
}

/**
 * Gets production metrics summary
 */
export function getProductionMetrics(state: SimulationState): ProductionMetrics {
  const standardWIPPreStation1 = state.standardLineWIP.preStation1.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const standardWIPStation1 = state.standardLineWIP.station1.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const standardWIPStation2 = state.standardLineWIP.station2.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const standardWIPStation3 = state.standardLineWIP.station3.reduce(
    (sum: number, batch) => sum + batch.units,
    0
  );
  const standardWIPTotal = standardWIPPreStation1 + standardWIPStation1 + standardWIPStation2 + standardWIPStation3;

  return {
    standard: {
      wipStation1: standardWIPStation1,
      wipStation2: standardWIPStation2,
      wipStation3: standardWIPStation3,
      wipTotal: standardWIPTotal,
      finishedGoods: state.finishedGoods.standard,
    },
    custom: {
      wip: state.customLineWIP.orders.length,
      finishedGoods: state.finishedGoods.custom,
    },
    machines: {
      MCE: state.machines.MCE,
      WMA: state.machines.WMA,
      PUC: state.machines.PUC,
    },
  };
}
