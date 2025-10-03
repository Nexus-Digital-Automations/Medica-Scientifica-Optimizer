/**
 * Game Constants and Initial Conditions for Medica Scientifica Factory Simulation
 * All values taken from the business case reference documentation
 */

import type { SimulationState, Strategy } from './types.js';

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

  // Custom Line Capacity (data-driven from analysis)
  CUSTOM_LINE_MAX_WIP: 360, // maximum orders in WIP
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
  SIMULATION_END_DAY: 500, // Typical business simulation duration
} as const;

/**
 * Initial State at Day 51 (Start of Simulation)
 */
export const INITIAL_STATE: SimulationState = {
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

    // Production tracking
    dailyStandardProduction: [],
    dailyCustomProduction: [],
    dailyStandardWIP: [],
    dailyCustomWIP: [],
    dailyFinishedStandard: [],
    dailyFinishedCustom: [],

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

    // Actions taken
    actionsPerformed: [],
    policyChanges: [],
  },
};

/**
 * Default Strategy Parameters (can be overridden by optimization)
 */
export const DEFAULT_STRATEGY: Strategy = {
  // Inventory Management Policy
  reorderPoint: 200, // units (data-driven: prevents stockouts that occurred at 169 units historically)
  orderQuantity: 400, // units per order

  // Production Policy
  standardBatchSize: 20, // units per batch
  mceAllocationCustom: 0.7, // 70% to custom, 30% to standard

  // Pricing Policy
  standardPrice: 750, // $ per unit
  dailyOvertimeHours: 0, // hours per day (0-4 hours, at 1.5x cost)
  customBasePrice: 106.56, // $ base price (from historical data regression analysis)
  customPenaltyPerDay: 0.27, // $ penalty for each day over target (from regression slope)
  customTargetDeliveryDays: 5, // target delivery time (data-driven optimal)

  // Demand Model Parameters (market conditions)
  customDemandMean1: 25, // Phase 1 (days 51-172) mean demand
  customDemandStdDev1: 5, // Phase 1 standard deviation
  customDemandMean2: 32.5, // Phase 2 (days 173-400) mean demand - 30% increase
  customDemandStdDev2: 6.5, // Phase 2 standard deviation

  // Standard Product Demand Curve (linear: Q = intercept + slope * P)
  standardDemandIntercept: 500, // Theoretical demand at price $0
  standardDemandSlope: -0.25, // Lose 1 unit demand per $4 price increase

  // Quit Risk Model (employee reaction to overtime)
  overtimeTriggerDays: 5, // Consecutive overtime days before quit risk begins
  dailyQuitProbability: 0.10, // 10% daily quit chance once overworked

  // Timed Actions (will be evolved by genetic algorithm)
  timedActions: [],
};
