/**
 * Policy Engine for Medica Scientifica Bayesian Optimization
 *
 * Converts 15 high-level policy parameters into 365 days of strategic actions.
 * This is the KEY abstraction that makes Bayesian Optimization feasible.
 *
 * Instead of optimizing 3,650 daily decisions (infeasible), we optimize
 * 15 policies that generate those decisions intelligently based on business state.
 */

import type { SimulationState, Strategy, StrategyAction } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';

/**
 * 15 Policy Parameters - The Optimization Variables
 *
 * These parameters define HOW the business operates, not specific daily actions.
 * Bayesian Optimization will find the best values for these 15 numbers.
 */
export interface PolicyParameters {
  // ============================================================================
  // INVENTORY MANAGEMENT (3 parameters)
  // ============================================================================
  reorderPoint: number;        // [200-600] When inventory drops below this, order more
  orderQuantity: number;       // [300-800] How much to order each time
  safetyStock: number;         // [100-300] Emergency buffer below reorder point

  // ============================================================================
  // PRODUCTION ALLOCATION (1 parameter) - CRITICAL
  // ============================================================================
  mceCustomAllocation: number; // [0.4-0.7] % of MCE time allocated to custom line

  // ============================================================================
  // BATCH PRODUCTION (2 parameters)
  // ============================================================================
  standardBatchSize: number;   // [50-120] Units per production batch
  batchInterval: number;       // [6-12] Days between starting new batches

  // ============================================================================
  // WORKFORCE MANAGEMENT (4 parameters)
  // ============================================================================
  targetExperts: number;       // [8-15] Target number of expert workers
  hireThreshold: number;       // [0.7-0.9] Hire when experts drop below this fraction of target
  maxOvertimeHours: number;    // [0-4] Maximum daily overtime hours allowed
  overtimeThreshold: number;   // [0.75-0.95] Use overtime when utilization exceeds this

  // ============================================================================
  // FINANCIAL MANAGEMENT (3 parameters)
  // ============================================================================
  cashReserveTarget: number;   // [15000-35000] Minimum cash buffer to maintain
  loanAmount: number;          // [20000-50000] Standard loan size when cash is low
  repayThreshold: number;      // [70000-120000] Repay debt when cash exceeds this

  // ============================================================================
  // PRICING STRATEGY (2 parameters)
  // ============================================================================
  standardPriceMultiplier: number;  // [0.9-1.1] Multiplier vs market price ($225)
  customBasePrice: number;          // [105-115] Base price before delivery penalty
}

/**
 * Policy Engine - Converts Parameters → Daily Actions
 *
 * This class implements the business logic that generates strategic actions
 * for each day based on:
 * 1. Policy parameters (from optimizer)
 * 2. Current business state (from simulation)
 * 3. Time context (day number)
 */
export class PolicyEngine {
  private params: PolicyParameters;
  private lastBatchDay: number = 0;
  private lastInventoryOrderDay: number = 0;

  constructor(params: PolicyParameters) {
    this.params = params;
  }

  /**
   * Generate all actions for entire simulation (days 51-415)
   *
   * This is the main entry point. It runs a lightweight simulation forward,
   * generating actions based on policies as business state evolves.
   *
   * @param initialState Starting state at day 51
   * @returns Array of all strategic actions for 365 days
   */
  public generateAllActions(initialState: SimulationState): StrategyAction[] {
    const allActions: StrategyAction[] = [];
    let state = { ...initialState }; // Lightweight state tracking

    // Generate actions for each day
    for (let day = CONSTANTS.SIMULATION_START_DAY; day <= CONSTANTS.SIMULATION_END_DAY; day++) {
      const dailyActions = this.generateDailyActions(state, day);
      allActions.push(...dailyActions);

      // Update lightweight state tracking (simplified)
      state = this.updateStateEstimate(state, dailyActions, day);
    }

    return allActions.sort((a, b) => a.day - b.day);
  }

  /**
   * Generate actions for a specific day based on policy + current state
   *
   * This implements the core business logic:
   * - Check inventory → Order if below reorder point
   * - Check workforce → Hire if below threshold
   * - Check cash → Take loan if too low, repay if too high
   * - Adjust MCE allocation dynamically
   * - Start new batch if interval passed
   * - Set prices (once at start)
   *
   * @param state Current simulation state
   * @param day Current day number
   * @returns Actions to take on this day
   */
  private generateDailyActions(state: SimulationState, day: number): StrategyAction[] {
    const actions: StrategyAction[] = [];

    // ========================================================================
    // 1. INVENTORY MANAGEMENT
    // ========================================================================
    if (state.rawMaterialInventory <= this.params.reorderPoint) {
      // Only order if we haven't ordered recently (avoid spam)
      if (day - this.lastInventoryOrderDay >= 5) {
        actions.push({
          day,
          type: 'ORDER_MATERIALS',
          quantity: this.params.orderQuantity,
        });
        this.lastInventoryOrderDay = day;
      }
    }

    // ========================================================================
    // 2. BATCH PRODUCTION SCHEDULING
    // ========================================================================
    if (day - this.lastBatchDay >= this.params.batchInterval) {
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: this.params.standardBatchSize,
      });
      this.lastBatchDay = day;
    }

    // ========================================================================
    // 3. MCE ALLOCATION (CRITICAL - DAILY ADJUSTMENT)
    // ========================================================================
    let allocation = this.params.mceCustomAllocation;

    // Dynamic adjustment based on business pressures
    const customWIP = state.customLineWIP.orders.length;
    const standardWIP = this.getTotalStandardWIP(state);

    // Increase custom allocation if approaching capacity limit (360 orders)
    if (customWIP > 300) {
      allocation += 0.05; // Emergency: prevent rejections
    } else if (customWIP > 250) {
      allocation += 0.03; // Warning: getting full
    }

    // Decrease custom allocation if standard line starving
    if (state.finishedGoods.standard < 50 && standardWIP < 100) {
      allocation -= 0.10; // Standard needs help
    }

    // Bounds check
    allocation = Math.max(0.3, Math.min(0.8, allocation));

    actions.push({
      day,
      type: 'ADJUST_MCE_ALLOCATION',
      newAllocation: allocation,
    });

    // ========================================================================
    // 4. WORKFORCE MANAGEMENT
    // ========================================================================
    const currentExperts = state.workforce.experts;
    const rookiesInTraining = state.workforce.rookiesInTraining.length;
    const futureExperts = currentExperts + rookiesInTraining;

    // Hiring decision: Maintain target expert count
    if (futureExperts < this.params.targetExperts * this.params.hireThreshold) {
      const hireCount = Math.ceil(this.params.targetExperts - futureExperts);
      if (hireCount > 0 && hireCount <= 5) { // Safety cap
        actions.push({
          day,
          type: 'HIRE_ROOKIE',
          count: hireCount,
        });
      }
    }

    // Overtime decision (handled via strategy parameter, just validate here)
    // The strategy.dailyOvertimeHours will be set from this.params.maxOvertimeHours

    // ========================================================================
    // 5. FINANCIAL MANAGEMENT
    // ========================================================================

    // Take loan if cash is getting low (but debt not too high)
    if (state.cash < this.params.cashReserveTarget && state.debt < 200000) {
      const loanNeeded = this.params.loanAmount;

      actions.push({
        day,
        type: 'TAKE_LOAN',
        amount: loanNeeded,
      });
    }

    // Repay debt if we have excess cash
    if (state.cash > this.params.repayThreshold && state.debt > 0) {
      const excessCash = state.cash - this.params.cashReserveTarget;
      const repayAmount = Math.min(excessCash, state.debt);

      if (repayAmount > 1000) { // Only repay if meaningful amount
        actions.push({
          day,
          type: 'PAY_DEBT',
          amount: Math.floor(repayAmount),
        });
      }
    }

    // ========================================================================
    // 6. PRICING STRATEGY (Set once at start, custom auto-calculated)
    // ========================================================================
    if (day === CONSTANTS.SIMULATION_START_DAY) {
      const marketPrice = 225; // From Medica case
      const standardPrice = Math.round(marketPrice * this.params.standardPriceMultiplier);

      actions.push({
        day,
        type: 'ADJUST_PRICE',
        productType: 'standard',
        newPrice: standardPrice,
      });

      // Note: Custom price is auto-calculated by simulation based on delivery performance
      // customPrice = customBasePrice × (1 - 0.27 × max(0, avgDeliveryTime - 5))
      // We just set the base price in the strategy, not via actions
    }

    return actions;
  }

  /**
   * Update lightweight state estimate for next iteration
   *
   * This is a SIMPLIFIED state update for planning purposes.
   * The real simulation will handle full state transitions.
   * We just need rough estimates to drive policy decisions.
   */
  private updateStateEstimate(
    state: SimulationState,
    actions: StrategyAction[],
    day: number
  ): SimulationState {
    const newState = { ...state };

    // Apply action effects (simplified)
    for (const action of actions) {
      switch (action.type) {
        case 'TAKE_LOAN':
          newState.cash += action.amount;
          newState.debt += action.amount;
          break;
        case 'PAY_DEBT':
          newState.cash -= action.amount;
          newState.debt -= action.amount;
          break;
        case 'HIRE_ROOKIE':
          newState.workforce.rookiesInTraining.push({
            hireDay: day,
            daysRemaining: CONSTANTS.ROOKIE_TRAINING_TIME,
          });
          break;
        case 'ORDER_MATERIALS': {
          // Materials arrive in 4 days, costs deducted now
          const cost = action.quantity * CONSTANTS.RAW_MATERIAL_UNIT_COST +
                      CONSTANTS.RAW_MATERIAL_ORDER_FEE;
          newState.cash -= cost;
          break;
        }
      }
    }

    // Advance day
    newState.currentDay = day;

    // Update rookies in training
    newState.workforce.rookiesInTraining = newState.workforce.rookiesInTraining
      .map(r => ({ ...r, daysRemaining: r.daysRemaining - 1 }))
      .filter(r => {
        if (r.daysRemaining <= 0) {
          newState.workforce.experts++; // Graduate to expert
          return false;
        }
        return true;
      });

    return newState;
  }

  /**
   * Helper: Calculate total WIP in standard line
   */
  private getTotalStandardWIP(state: SimulationState): number {
    const { standardLineWIP } = state;

    const countBatches = (batches: Array<{ units: number }>) =>
      batches.reduce((sum, batch) => sum + batch.units, 0);

    return (
      countBatches(standardLineWIP.preStation1) +
      countBatches(standardLineWIP.station1) +
      countBatches(standardLineWIP.station2) +
      countBatches(standardLineWIP.station3)
    );
  }

  /**
   * Convert policy parameters to a complete Strategy object
   *
   * This creates the Strategy that will be fed into the simulation.
   * It includes both the policy parameters AND the generated actions.
   */
  public toStrategy(initialState: SimulationState, baseStrategy?: Strategy): Strategy {
    const actions = this.generateAllActions(initialState);

    return {
      // Copy base strategy defaults
      ...(baseStrategy || {}),

      // Override with policy parameters
      reorderPoint: this.params.reorderPoint,
      orderQuantity: this.params.orderQuantity,
      standardBatchSize: this.params.standardBatchSize,
      mceAllocationCustom: this.params.mceCustomAllocation,
      standardPrice: Math.round(225 * this.params.standardPriceMultiplier),
      customBasePrice: this.params.customBasePrice,
      dailyOvertimeHours: this.params.maxOvertimeHours,

      // Use defaults from base strategy for other parameters
      customPenaltyPerDay: baseStrategy?.customPenaltyPerDay || 0.27,
      customTargetDeliveryDays: baseStrategy?.customTargetDeliveryDays || 5,

      // Demand model parameters (from historical data)
      customDemandMean1: baseStrategy?.customDemandMean1 || 25,
      customDemandStdDev1: baseStrategy?.customDemandStdDev1 || 5,
      customDemandMean2: baseStrategy?.customDemandMean2 || 32.5,
      customDemandStdDev2: baseStrategy?.customDemandStdDev2 || 6.5,
      standardDemandIntercept: baseStrategy?.standardDemandIntercept || 1500,
      standardDemandSlope: baseStrategy?.standardDemandSlope || -5.0,

      // Quit risk model
      overtimeTriggerDays: baseStrategy?.overtimeTriggerDays || 5,
      dailyQuitProbability: baseStrategy?.dailyQuitProbability || 0.10,

      // Debt management (use policy parameters)
      autoDebtPaydown: true,
      minCashReserveDays: Math.round(this.params.cashReserveTarget / 5000), // Estimate
      debtPaydownAggressiveness: 0.80,
      preemptiveWageLoanDays: 4,
      maxDebtThreshold: 200000,
      emergencyLoanBuffer: this.params.cashReserveTarget,

      // Financial health ratios (use defaults)
      maxDebtToAssetRatio: baseStrategy?.maxDebtToAssetRatio || 0.70,
      minInterestCoverageRatio: baseStrategy?.minInterestCoverageRatio || 3.0,
      maxDebtToRevenueRatio: baseStrategy?.maxDebtToRevenueRatio || 2.0,

      // Generated timed actions from policy
      timedActions: actions,
    } as Strategy;
  }
}

/**
 * Parameter Space Definition for Bayesian Optimization
 *
 * Defines the search space: min/max bounds for each parameter.
 * These bounds are based on:
 * 1. Business constraints from Medica case
 * 2. Domain knowledge from Operations Research
 * 3. Preliminary sensitivity analysis
 */
export const PARAMETER_SPACE = {
  // Inventory
  reorderPoint: { min: 200, max: 600, type: 'integer' as const },
  orderQuantity: { min: 300, max: 800, type: 'integer' as const },
  safetyStock: { min: 100, max: 300, type: 'integer' as const },

  // Allocation
  mceCustomAllocation: { min: 0.4, max: 0.7, type: 'real' as const },

  // Batching
  standardBatchSize: { min: 50, max: 120, type: 'integer' as const },
  batchInterval: { min: 6, max: 12, type: 'integer' as const },

  // Workforce (unlimited ranges for optimizer flexibility)
  targetExperts: { min: 1, max: 50, type: 'integer' as const },
  hireThreshold: { min: 0.3, max: 1.0, type: 'real' as const },
  maxOvertimeHours: { min: 0.0, max: 12.0, type: 'real' as const },
  overtimeThreshold: { min: 0.5, max: 1.0, type: 'real' as const },

  // Financial
  cashReserveTarget: { min: 15000, max: 35000, type: 'integer' as const },
  loanAmount: { min: 20000, max: 50000, type: 'integer' as const },
  repayThreshold: { min: 70000, max: 120000, type: 'integer' as const },

  // Pricing
  standardPriceMultiplier: { min: 0.9, max: 1.1, type: 'real' as const },
  customBasePrice: { min: 105.0, max: 115.0, type: 'real' as const },
};

/**
 * Generate random policy parameters within bounds
 * Used for initial random exploration phase
 */
export function generateRandomPolicy(): PolicyParameters {
  return {
    reorderPoint: Math.floor(Math.random() * (600 - 200) + 200),
    orderQuantity: Math.floor(Math.random() * (800 - 300) + 300),
    safetyStock: Math.floor(Math.random() * (300 - 100) + 100),
    mceCustomAllocation: Math.random() * (0.7 - 0.4) + 0.4,
    standardBatchSize: Math.floor(Math.random() * (120 - 50) + 50),
    batchInterval: Math.floor(Math.random() * (12 - 6) + 6),
    targetExperts: Math.floor(Math.random() * (50 - 1) + 1),
    hireThreshold: Math.random() * (1.0 - 0.3) + 0.3,
    maxOvertimeHours: Math.random() * 12.0,
    overtimeThreshold: Math.random() * (1.0 - 0.5) + 0.5,
    cashReserveTarget: Math.floor(Math.random() * (35000 - 15000) + 15000),
    loanAmount: Math.floor(Math.random() * (50000 - 20000) + 20000),
    repayThreshold: Math.floor(Math.random() * (120000 - 70000) + 70000),
    standardPriceMultiplier: Math.random() * (1.1 - 0.9) + 0.9,
    customBasePrice: Math.random() * (115.0 - 105.0) + 105.0,
  };
}

/**
 * Get reasonable default/baseline policy parameters
 * Based on historical analysis and domain knowledge
 */
export function getDefaultPolicy(): PolicyParameters {
  return {
    // Inventory: Moderate levels
    reorderPoint: 400,
    orderQuantity: 500,
    safetyStock: 200,

    // Allocation: Slight custom preference (higher margin)
    mceCustomAllocation: 0.55,

    // Batching: Balance setup cost vs holding cost
    standardBatchSize: 80,
    batchInterval: 8,

    // Workforce: Lean and efficient
    targetExperts: 12,
    hireThreshold: 0.8,
    maxOvertimeHours: 2,
    overtimeThreshold: 0.85,

    // Financial: Conservative cash management
    cashReserveTarget: 25000,
    loanAmount: 30000,
    repayThreshold: 90000,

    // Pricing: Market rate for standard, mid-range for custom
    standardPriceMultiplier: 1.0,
    customBasePrice: 110,
  };
}
