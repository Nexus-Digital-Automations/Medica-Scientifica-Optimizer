/**
 * Game Constants and Initial Conditions for Medica Scientifica Factory Simulation
 * All values taken from the business case reference documentation
 */

import type { SimulationState } from './types.js';

export const CONSTANTS = {
  // Financial Constants
  ROOKIE_SALARY: 85, // per day
  EXPERT_SALARY: 150, // per day
  OVERTIME_MULTIPLIER: 1.5,
  DEBT_INTEREST_RATE_DAILY: 0.001, // 0.1% per day (36.5% annually)
  CASH_INTEREST_RATE_DAILY: 0.0005, // 0.05% per day
  NORMAL_DEBT_COMMISSION: 0.02, // 2% on each loan
  SALARY_DEBT_COMMISSION: 0.05, // 5% on automatically-taken salary loans

  // Raw Material Costs
  RAW_MATERIAL_UNIT_COST: 50, // $ per unit
  RAW_MATERIAL_ORDER_FEE: 1000, // $ per order
  RAW_MATERIAL_LEAD_TIME: 4, // days

  // Production Constants
  STANDARD_RAW_MATERIAL_PER_UNIT: 2, // parts per unit
  CUSTOM_RAW_MATERIAL_PER_UNIT: 1, // part per unit
  STANDARD_PRODUCTION_ORDER_FEE: 100, // $ per batch order
  INITIAL_BATCHING_TIME: 4, // days (Station 2)
  FINAL_BATCHING_TIME: 1, // day (Station 3)

  // Machine Capacity (calibrated based on business case)
  MCE_UNITS_PER_MACHINE_PER_DAY: 30, // Station 1 capacity

  // Workforce Productivity
  ARCP_EXPERT_PRODUCTIVITY: 3, // units per day
  ARCP_ROOKIE_PRODUCTIVITY_FACTOR: 0.4, // 40% of expert
  ROOKIE_TRAINING_TIME: 15, // days to become expert

  // Custom Line Capacity (from business case reference guide)
  CUSTOM_LINE_MAX_WIP: 360, // maximum orders in WIP (business case specification)
  MIN_CUSTOM_PRODUCTION_DAYS: 5, // minimum days to complete custom order
  CUSTOM_WMA_CAPACITY_PER_MACHINE_PER_DAY: 6, // WMA capacity per machine (12 total with 2 machines)
  CUSTOM_PUC_CAPACITY_PER_MACHINE_PER_DAY: 6, // PUC capacity per machine (12 total with 2 machines)
  CUSTOM_WMA_PROCESSING_DAYS: 1, // Days per WMA pass
  CUSTOM_PUC_PROCESSING_DAYS: 1, // Days at PUC station

  // Machine Costs (Station 1: MCE, Station 2: WMA, Station 3: PUC)
  MACHINES: {
    MCE: { buyPrice: 20000, sellPrice: 10000, station: 1 },
    WMA: { buyPrice: 15000, sellPrice: 7500, station: 2 },
    PUC: { buyPrice: 12000, sellPrice: 4000, station: 3 },
  },

  // Simulation Parameters
  SIMULATION_START_DAY: 51,
  SIMULATION_END_DAY: 415, // Active management period: 365 days (Day 51-415)
} as const;

/**
 * Initial State at Day 51 - Business Case (Reference Guide Values)
 * From textbook: Cash $8.2K, Debt $70K, 0 inventory, 120 standard WIP, 295 custom WIP
 */
export const INITIAL_STATE_BUSINESS_CASE: SimulationState = {
  currentDay: 51,
  cash: 8206.12,
  debt: 70000.0,
  rawMaterialInventory: 0,

  // Work in Progress
  standardLineWIP: {
    preStation1: [], // Queue before MCE processing
    station1: [], // MCE - awaiting processing
    station2: [], // WMA - in batching (4 days)
    station3: [], // PUC - in final batching (1 day)
  },

  customLineWIP: {
    orders: [], // Array of order objects with start dates
  },

  finishedGoods: {
    standard: 0,
    custom: 0,
  },

  // Workforce
  workforce: {
    experts: 1,
    rookies: 0,
    rookiesInTraining: [], // Array of {hireDay, remainingDays}
    employeeOvertimeTracking: [], // Track overtime for quit risk model
  },

  // Capital Equipment
  machines: {
    MCE: 1, // Station 1
    WMA: 1, // Station 2
    PUC: 1, // Station 3
  },

  // Pending Orders
  pendingRawMaterialOrders: [], // Array of {orderDay, quantity, arrivalDay}

  // Penalty tracking for fitness function
  rejectedMaterialOrders: 0, // Count of orders rejected due to insufficient cash
  stockoutDays: 0, // Count of days when demand couldn't be fulfilled due to no inventory
  lostProductionDays: 0, // Count of days when production was impossible due to material shortage

  // Historical Tracking for Analytics - COMPLETE TRANSPARENCY FOR ALL VARIABLES
  history: {
    // Financial tracking
    dailyCash: [],
    dailyDebt: [],
    dailyNetWorth: [],
    dailyRevenue: [],
    dailyExpenses: [],
    dailyInterestPaid: [],
    dailyInterestEarned: [],
    dailyDebtPaydown: [],
    dailyPreemptiveLoan: [],
    dailyDebtSavings: [],
    dailyDebtToAssetRatio: [],
    dailyInterestCoverageRatio: [],
    dailyDebtToRevenueRatio: [],

    // Production tracking
    dailyStandardProduction: [],
    dailyCustomProduction: [],
    dailyStandardWIP: [],
    dailyCustomWIP: [],
    dailyFinishedStandard: [],
    dailyFinishedCustom: [],
    dailyCustomQueue1: [],
    dailyCustomQueue2: [],
    dailyCustomQueue3: [],
    dailyStdQueue1: [],
    dailyStdQueue2: [],
    dailyStdQueue3: [],
    dailyStdQueue4: [],
    dailyStdQueue5: [],

    // Inventory tracking
    dailyRawMaterial: [],
    dailyRawMaterialOrders: [],
    dailyRawMaterialOrdersPlaced: [],
    dailyRawMaterialCost: [],

    // Workforce tracking
    dailyExperts: [],
    dailyRookies: [],
    dailyRookiesInTraining: [],
    dailySalaryCost: [],

    // Machine tracking
    dailyMCECount: [],
    dailyWMACount: [],
    dailyPUCCount: [],

    // Pricing and orders
    dailyStandardPrice: [],
    dailyCustomPrice: [],
    dailyCustomDeliveryTime: [],

    // Dynamic policy tracking
    dailyReorderPoint: [],
    dailyOrderQuantity: [],
    dailyStandardBatchSize: [],

    // Strategy parameter tracking
    dailyMCEAllocation: [],
    dailyOvertimeHours: [],
    dailyCustomBasePrice: [],
    dailyCustomPenaltyPerDay: [],
    dailyCustomTargetDeliveryDays: [],

    // Actions taken
    actionsPerformed: [],
    policyChanges: [],
  },
};

/**
 * Initial State at Day 51 - Historical Data (Actual Excel Values)
 * From historical Excel file: Cash $384K, Debt $0, 164 inventory, 414 standard WIP, 300 custom WIP
 * This represents the state after the first 50 days of a successful run
 */
export const INITIAL_STATE_HISTORICAL: SimulationState = {
  currentDay: 51,
  cash: 383919.70,
  debt: 0.0,
  rawMaterialInventory: 164,

  // Work in Progress - Historical WIP levels from Excel
  standardLineWIP: {
    preStation1: [],
    station1: [],
    station2: [],
    station3: [], // 414 units will be added in state.ts initialization
  },

  customLineWIP: {
    orders: [], // 300 orders will be added in state.ts initialization
  },

  finishedGoods: {
    standard: 0,
    custom: 0,
  },

  // Workforce (same as business case)
  workforce: {
    experts: 1,
    rookies: 0,
    rookiesInTraining: [],
    employeeOvertimeTracking: [],
  },

  // Capital Equipment (from Excel Day 49)
  machines: {
    MCE: 1, // 1 MCE machine
    WMA: 2, // 2 WMA machines (Excel Day 49)
    PUC: 2, // 2 PUC machines (Excel Day 49)
  },

  // Pending Orders
  pendingRawMaterialOrders: [],

  // Penalty tracking for fitness function
  rejectedMaterialOrders: 0,
  stockoutDays: 0,
  lostProductionDays: 0,

  // Historical Tracking for Analytics
  history: {
    dailyCash: [],
    dailyDebt: [],
    dailyNetWorth: [],
    dailyRevenue: [],
    dailyExpenses: [],
    dailyInterestPaid: [],
    dailyInterestEarned: [],
    dailyDebtPaydown: [],
    dailyPreemptiveLoan: [],
    dailyDebtSavings: [],
    dailyDebtToAssetRatio: [],
    dailyInterestCoverageRatio: [],
    dailyDebtToRevenueRatio: [],
    dailyStandardProduction: [],
    dailyCustomProduction: [],
    dailyStandardWIP: [],
    dailyCustomWIP: [],
    dailyFinishedStandard: [],
    dailyFinishedCustom: [],
    dailyCustomQueue1: [],
    dailyCustomQueue2: [],
    dailyCustomQueue3: [],
    dailyStdQueue1: [],
    dailyStdQueue2: [],
    dailyStdQueue3: [],
    dailyStdQueue4: [],
    dailyStdQueue5: [],
    dailyRawMaterial: [],
    dailyRawMaterialOrders: [],
    dailyRawMaterialOrdersPlaced: [],
    dailyRawMaterialCost: [],
    dailyExperts: [],
    dailyRookies: [],
    dailyRookiesInTraining: [],
    dailySalaryCost: [],
    dailyMCECount: [],
    dailyWMACount: [],
    dailyPUCCount: [],
    dailyStandardPrice: [],
    dailyCustomPrice: [],
    dailyCustomDeliveryTime: [],
    dailyReorderPoint: [],
    dailyOrderQuantity: [],
    dailyStandardBatchSize: [],
    dailyMCEAllocation: [],
    dailyOvertimeHours: [],
    dailyCustomBasePrice: [],
    dailyCustomPenaltyPerDay: [],
    dailyCustomTargetDeliveryDays: [],
    actionsPerformed: [],
    policyChanges: [],
  },
};

/**
 * Default Initial State (Historical Data)
 * This is used when no specific initial state is requested
 * Changed from Business Case to Historical Data as the primary starting point
 */
export const INITIAL_STATE = INITIAL_STATE_HISTORICAL;
