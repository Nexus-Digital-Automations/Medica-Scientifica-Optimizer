/**
 * TypeScript Type Definitions for Medica Scientifica Factory Simulation
 * Provides complete type safety and transparency for all simulation data
 */

// ============================================================================
// CORE STATE TYPES
// ============================================================================

export interface SimulationState {
  currentDay: number;
  cash: number;
  debt: number;
  rawMaterialInventory: number;
  standardLineWIP: StandardLineWIP;
  customLineWIP: CustomLineWIP;
  finishedGoods: FinishedGoods;
  workforce: Workforce;
  machines: Machines;
  pendingRawMaterialOrders: RawMaterialOrder[];
  history: SimulationHistory;

  // Penalty tracking for fitness function
  rejectedMaterialOrders: number; // Count of orders rejected due to insufficient cash
  stockoutDays: number; // Count of days when demand couldn't be fulfilled due to no inventory
  lostProductionDays: number; // Count of days when production was impossible due to material shortage
}

export interface StandardLineWIP {
  preStation1: WIPBatch[]; // Queue before MCE processing
  station1: WIPBatch[]; // MCE - immediate processing, then to station2
  station2: WIPBatch[]; // WMA - 4 day batching
  station3: WIPBatch[]; // PUC - 1 day batching
}

export interface WIPBatch {
  units: number;
  startDay: number;
  batchingDaysRemaining: number;
}

export interface CustomLineWIP {
  orders: CustomOrder[];
}

export interface CustomOrder {
  orderId: string;
  startDay: number;
  daysInProduction: number;
  currentStation: 'WAITING' | 'MCE' | 'WMA_PASS1' | 'WMA_PASS2' | 'PUC' | 'ARCP' | 'COMPLETE'; // Track production stage (WAITING = order accepted but not started, ARCP = labor bottleneck)
  daysAtCurrentStation: number; // Days at current station
}

export interface FinishedGoods {
  standard: number;
  custom: number;
}

export interface Workforce {
  experts: number;
  rookies: number;
  rookiesInTraining: RookieInTraining[];
  employeeOvertimeTracking: EmployeeOvertimeRecord[]; // Track overtime for quit risk
}

export interface RookieInTraining {
  hireDay: number;
  daysRemaining: number;
}

export interface EmployeeOvertimeRecord {
  employeeId: string;
  employeeType: 'expert' | 'rookie';
  consecutiveOvertimeDays: number;
}

export interface Machines {
  MCE: number; // Station 1
  WMA: number; // Station 2
  PUC: number; // Station 3
}

export interface RawMaterialOrder {
  orderDay: number;
  quantity: number;
  arrivalDay: number;
  cost: number;
}

// ============================================================================
// HISTORY TRACKING TYPES - COMPLETE TRANSPARENCY
// ============================================================================

export interface SimulationHistory {
  // Financial tracking
  dailyCash: DailyMetric[];
  dailyDebt: DailyMetric[];
  dailyNetWorth: DailyMetric[];
  dailyRevenue: DailyMetric[];
  dailyExpenses: DailyMetric[];
  dailyInterestPaid: DailyMetric[];
  dailyInterestEarned: DailyMetric[];

  // Production tracking
  dailyStandardProduction: DailyMetric[];
  dailyCustomProduction: DailyMetric[];
  dailyStandardWIP: DailyMetric[];
  dailyCustomWIP: DailyMetric[];
  dailyFinishedStandard: DailyMetric[];
  dailyFinishedCustom: DailyMetric[];

  // Per-queue WIP tracking for timeline visualization
  // Custom line queues
  dailyCustomQueue1: DailyMetric[]; // Orders in WAITING state
  dailyCustomQueue2: DailyMetric[]; // Orders in MCE processing
  dailyCustomQueue3: DailyMetric[]; // Orders in WMA_PASS2/PUC
  // Standard line queues
  dailyStdQueue1: DailyMetric[]; // preStation1 batch units
  dailyStdQueue2: DailyMetric[]; // station1 batch units
  dailyStdQueue3: DailyMetric[]; // station2 batch units
  dailyStdQueue4: DailyMetric[]; // station3 batch units
  dailyStdQueue5: DailyMetric[]; // finished goods

  // Inventory tracking
  dailyRawMaterial: DailyMetric[];
  dailyRawMaterialOrders: DailyMetric[]; // Materials ARRIVED (ordered 4 days ago)
  dailyRawMaterialOrdersPlaced: DailyMetric[]; // Materials ORDERED today (will arrive in 4 days)
  dailyRawMaterialCost: DailyMetric[];

  // Workforce tracking
  dailyExperts: DailyMetric[];
  dailyRookies: DailyMetric[];
  dailyRookiesInTraining: DailyMetric[];
  dailySalaryCost: DailyMetric[];

  // Machine tracking
  dailyMCECount: DailyMetric[];
  dailyWMACount: DailyMetric[];
  dailyPUCCount: DailyMetric[];

  // Pricing and orders
  dailyStandardPrice: DailyMetric[];
  dailyCustomPrice: DailyMetric[];
  dailyCustomDeliveryTime: DailyMetric[];

  // Dynamic policy tracking (shows OR formula calculations each day)
  dailyReorderPoint: DailyMetric[];
  dailyOrderQuantity: DailyMetric[];
  dailyStandardBatchSize: DailyMetric[];

  // Actions taken
  actionsPerformed: ActionRecord[];
  policyChanges: PolicyChangeRecord[]; // Track when/why policies changed
}

export interface DailyMetric {
  day: number;
  value: number;
}

export interface ActionRecord {
  day: number;
  action: StrategyAction;
}

export interface PolicyChangeRecord {
  day: number;
  policyType: 'reorderPoint' | 'orderQuantity' | 'standardBatchSize';
  oldValue: number;
  newValue: number;
  reason: string; // e.g., "Initial calculation", "Demand phase change", "Machine added", "Timed adjustment"
}

// ============================================================================
// STRATEGY TYPES (DNA FOR GENETIC ALGORITHM)
// ============================================================================

export interface Strategy {
  // Static Genes - Policy decisions (now formula-driven)
  reorderPoint: number;
  orderQuantity: number;
  standardBatchSize: number;
  mceAllocationCustom: number; // 0.0 to 1.0
  standardPrice: number;
  dailyOvertimeHours: number; // 0 to 4 hours per day at 1.5x cost
  customBasePrice: number;
  customPenaltyPerDay: number;
  customTargetDeliveryDays: number;

  // Demand Model Parameters (market conditions)
  customDemandMean1: number;     // Phase 1 (days 51-172) mean demand
  customDemandStdDev1: number;   // Phase 1 standard deviation
  customDemandMean2: number;     // Phase 2 (days 173-400) mean demand
  customDemandStdDev2: number;   // Phase 2 standard deviation

  // Standard Product Demand Curve (linear: Q = intercept + slope * P)
  standardDemandIntercept: number;  // Quantity demanded at price $0
  standardDemandSlope: number;      // Change in quantity per $1 price increase (negative)

  // Quit Risk Model (employee reaction to overtime)
  overtimeTriggerDays: number;      // Consecutive overtime days before quit risk begins
  dailyQuitProbability: number;     // Daily probability of quitting once overworked (0-1)

  // Timed Genes - Specific actions on specific days
  timedActions: StrategyAction[];

  // Policy Control Metadata - Tracks which policies are formula-controlled vs GA-controlled
  policyControlMetadata?: {
    reorderPoint: PolicyMetadata;
    orderQuantity: PolicyMetadata;
    standardBatchSize: PolicyMetadata;
  };
}

// Policy metadata for tracking calculation history
export interface PolicyMetadata {
  controlled: 'FORMULA' | 'GA';
  lastRecalculated: number;
  lastValue: number;
  calculationCount: number;
}

export type StrategyAction =
  | TakeLoanAction
  | PayDebtAction
  | HireRookieAction
  | FireEmployeeAction
  | BuyMachineAction
  | SellMachineAction
  | OrderMaterialsAction
  | StopMaterialOrdersAction
  | AdjustBatchSizeAction
  | AdjustMCEAllocationAction
  | AdjustPriceAction
  | SetReorderPointAction
  | SetOrderQuantityAction;

export interface TakeLoanAction {
  day: number;
  type: 'TAKE_LOAN';
  amount: number;
  isLocked?: boolean;
}

export interface PayDebtAction {
  day: number;
  type: 'PAY_DEBT';
  amount: number;
  isLocked?: boolean;
}

export interface HireRookieAction {
  day: number;
  type: 'HIRE_ROOKIE';
  count: number;
  isLocked?: boolean;
}

export interface BuyMachineAction {
  day: number;
  type: 'BUY_MACHINE';
  machineType: 'MCE' | 'WMA' | 'PUC';
  count: number;
  isLocked?: boolean;
}

export interface SellMachineAction {
  day: number;
  type: 'SELL_MACHINE';
  machineType: 'MCE' | 'WMA' | 'PUC';
  count: number;
  isLocked?: boolean;
}

export interface OrderMaterialsAction {
  day: number;
  type: 'ORDER_MATERIALS';
  quantity: number;
  isLocked?: boolean;
}

export interface StopMaterialOrdersAction {
  day: number;
  type: 'STOP_MATERIAL_ORDERS';
  isLocked?: boolean;
}

export interface AdjustBatchSizeAction {
  day: number;
  type: 'ADJUST_BATCH_SIZE';
  newSize: number;
  isLocked?: boolean;
}

export interface AdjustMCEAllocationAction {
  day: number;
  type: 'ADJUST_MCE_ALLOCATION';
  newAllocation: number;
  isLocked?: boolean;
}

export interface AdjustPriceAction {
  day: number;
  type: 'ADJUST_PRICE';
  productType: 'standard' | 'custom';
  newPrice: number;
  isLocked?: boolean;
}

export interface FireEmployeeAction {
  day: number;
  type: 'FIRE_EMPLOYEE';
  employeeType: 'expert' | 'rookie';
  count: number;
  isLocked?: boolean;
}

export interface SetReorderPointAction {
  day: number;
  type: 'SET_REORDER_POINT';
  newReorderPoint: number;
  isLocked?: boolean;
}

export interface SetOrderQuantityAction {
  day: number;
  type: 'SET_ORDER_QUANTITY';
  newOrderQuantity: number;
  isLocked?: boolean;
}

// ============================================================================
// DAILY METRICS TYPES
// ============================================================================

export interface DailyMetrics {
  revenue: number;
  expenses: number;
  interestPaid: number;
  interestEarned: number;
  standardProduced: number;
  customProduced: number;
  rawMaterialOrdered: number; // Materials that ARRIVED today (ordered 4 days ago)
  rawMaterialOrdersPlaced: number; // Materials ORDERED today (will arrive in 4 days)
  rawMaterialCost: number;
  salaryCost: number;
  standardPrice: number;
  customPrice: number;
  avgCustomDeliveryTime: number;
  actions: StrategyAction[];
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface SimulationResult {
  finalCash: number;
  finalDebt: number;
  finalNetWorth: number;
  state: SimulationState;
  strategy: Strategy;
  fitnessScore: number;
}

export interface OptimizationResult {
  bestStrategy: Strategy;
  bestFitness: number;
  generation: number;
  populationStats: PopulationStats;
  convergenceHistory: number[];
  finalSimulation: SimulationResult;
}

export interface PopulationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
  diversityScore: number;
}
