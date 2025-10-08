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
 * Business State Categories for Conditional Logic
 */
export type CashState = 'LOW' | 'MEDIUM' | 'HIGH';
export type InventoryState = 'LOW' | 'MEDIUM' | 'HIGH';
export type DebtState = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * State Thresholds for Conditional Policies
 */
export const STATE_THRESHOLDS = {
  cash: {
    LOW: 80000,    // Below this = LOW, above = MEDIUM
    HIGH: 200000,  // Above this = HIGH
  },
  inventory: {
    LOW: 200,      // Below this = LOW
    HIGH: 500,     // Above this = HIGH
  },
  debt: {
    LOW: 50000,    // Below this = LOW
    HIGH: 150000,  // Above this = HIGH
  },
};

/**
 * State-Conditional Multipliers
 * Applied to base weekly parameters based on business conditions
 */
export const STATE_MULTIPLIERS = {
  cash: {
    LOW: 0.7,      // Conservative when cash is tight
    MEDIUM: 1.0,   // Baseline
    HIGH: 1.2,     // Aggressive when flush
  },
  inventory: {
    LOW: 1.3,      // Order more when low
    MEDIUM: 1.0,   // Normal
    HIGH: 0.7,     // Reduce orders when high
  },
  debt: {
    LOW: 1.1,      // Can invest more when low debt
    MEDIUM: 1.0,   // Balanced
    HIGH: 0.8,     // Conservative when high debt
  },
};

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
 * Weekly Policy Parameters - 52 weeks of dynamic strategies
 *
 * Total optimization space: 15 parameters × 52 weeks = 780 dimensions
 * This allows the strategy to evolve week-by-week throughout the year
 */
export interface WeeklyPolicyParameters {
  weeks: {
    [weekNumber: number]: PolicyParameters; // Weeks 1-52
  };
}

/**
 * Policy Engine - Converts Parameters → Daily Actions
 *
 * This class implements the business logic that generates strategic actions
 * for each day based on:
 * 1. Policy parameters (from optimizer) - either single or weekly
 * 2. Current business state (from simulation)
 * 3. Time context (day number, week number)
 * 4. State-conditional multipliers (cash, inventory, debt)
 */
export class PolicyEngine {
  private params: PolicyParameters | null = null;
  private weeklyParams: WeeklyPolicyParameters | null = null;
  private isWeekly: boolean = false;
  private lastBatchDay: number = 0;
  private lastInventoryOrderDay: number = 0;

  constructor(params: PolicyParameters | WeeklyPolicyParameters) {
    if ('weeks' in params) {
      this.weeklyParams = params;
      this.isWeekly = true;
    } else {
      this.params = params;
      this.isWeekly = false;
    }
  }

  /**
   * Determine cash state based on current cash level
   */
  private getCashState(cash: number): CashState {
    if (cash < STATE_THRESHOLDS.cash.LOW) return 'LOW';
    if (cash >= STATE_THRESHOLDS.cash.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Determine inventory state based on raw material level
   */
  private getInventoryState(inventory: number): InventoryState {
    if (inventory < STATE_THRESHOLDS.inventory.LOW) return 'LOW';
    if (inventory >= STATE_THRESHOLDS.inventory.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Determine debt state based on current debt level
   */
  private getDebtState(debt: number): DebtState {
    if (debt < STATE_THRESHOLDS.debt.LOW) return 'LOW';
    if (debt >= STATE_THRESHOLDS.debt.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Get week number from day (Day 51 = Week 1, Day 57 = Week 1, Day 58 = Week 2, etc.)
   * Clamps to week 52 since simulation is 365 days (52.14 weeks)
   */
  private getWeekNumber(day: number): number {
    const daysSinceStart = day - CONSTANTS.SIMULATION_START_DAY;
    const weekNumber = Math.floor(daysSinceStart / 7) + 1;
    // Clamp to week 52 (last few days use week 52 parameters)
    return Math.min(weekNumber, 52);
  }

  /**
   * Get effective policy parameters for a given day and state
   * Applies weekly lookup and state-conditional multipliers
   */
  private getEffectiveParameters(day: number, state: SimulationState): PolicyParameters {
    // Get base parameters (either single or week-specific)
    let baseParams: PolicyParameters;

    if (this.isWeekly && this.weeklyParams) {
      const weekNumber = this.getWeekNumber(day);
      baseParams = this.weeklyParams.weeks[weekNumber];

      if (!baseParams) {
        throw new Error(`No policy parameters defined for week ${weekNumber}`);
      }
    } else if (this.params) {
      baseParams = this.params;
    } else {
      throw new Error('No policy parameters available');
    }

    // Determine business state
    const cashState = this.getCashState(state.cash);
    const inventoryState = this.getInventoryState(state.rawMaterialInventory);
    const debtState = this.getDebtState(state.debt);

    // Get multipliers
    const cashMultiplier = STATE_MULTIPLIERS.cash[cashState];
    const inventoryMultiplier = STATE_MULTIPLIERS.inventory[inventoryState];
    const debtMultiplier = STATE_MULTIPLIERS.debt[debtState];

    // Apply state-conditional multipliers to base parameters
    // Different parameters are affected by different state conditions
    return {
      // Inventory: Affected by inventory state and cash state
      reorderPoint: Math.round(baseParams.reorderPoint * inventoryMultiplier),
      orderQuantity: Math.round(baseParams.orderQuantity * inventoryMultiplier * cashMultiplier),
      safetyStock: Math.round(baseParams.safetyStock * inventoryMultiplier),

      // Production: Affected by cash state (can we afford aggressive custom production?)
      mceCustomAllocation: Math.max(0.2, Math.min(0.8, baseParams.mceCustomAllocation * cashMultiplier)),

      // Batching: Affected by cash and debt state
      standardBatchSize: Math.round(baseParams.standardBatchSize * debtMultiplier),
      batchInterval: baseParams.batchInterval, // Keep constant

      // Workforce: Affected by cash state (can we afford hiring/overtime?)
      targetExperts: Math.round(baseParams.targetExperts * cashMultiplier),
      hireThreshold: baseParams.hireThreshold, // Keep constant
      maxOvertimeHours: baseParams.maxOvertimeHours * cashMultiplier * debtMultiplier,
      overtimeThreshold: baseParams.overtimeThreshold, // Keep constant

      // Financial: Affected by debt state
      cashReserveTarget: Math.round(baseParams.cashReserveTarget * debtMultiplier),
      loanAmount: Math.round(baseParams.loanAmount * (1 / debtMultiplier)), // Borrow MORE when debt is LOW
      repayThreshold: Math.round(baseParams.repayThreshold * debtMultiplier),

      // Pricing: Keep base parameters (pricing is less state-dependent)
      standardPriceMultiplier: baseParams.standardPriceMultiplier,
      customBasePrice: baseParams.customBasePrice,
    };
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

    // Get effective parameters with weekly lookup + state-conditional multipliers
    const effectiveParams = this.getEffectiveParameters(day, state);

    // ========================================================================
    // 1. INVENTORY MANAGEMENT
    // ========================================================================
    if (state.rawMaterialInventory <= effectiveParams.reorderPoint) {
      // Only order if we haven't ordered recently (avoid spam)
      if (day - this.lastInventoryOrderDay >= 5) {
        actions.push({
          day,
          type: 'ORDER_MATERIALS',
          quantity: effectiveParams.orderQuantity,
        });
        this.lastInventoryOrderDay = day;
      }
    }

    // ========================================================================
    // 2. BATCH PRODUCTION SCHEDULING
    // ========================================================================
    if (day - this.lastBatchDay >= effectiveParams.batchInterval) {
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: effectiveParams.standardBatchSize,
      });
      this.lastBatchDay = day;
    }

    // ========================================================================
    // 3. MCE ALLOCATION (CRITICAL - DAILY ADJUSTMENT)
    // ========================================================================
    let allocation = effectiveParams.mceCustomAllocation;

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
    if (futureExperts < effectiveParams.targetExperts * effectiveParams.hireThreshold) {
      const hireCount = Math.ceil(effectiveParams.targetExperts - futureExperts);
      if (hireCount > 0 && hireCount <= 5) { // Safety cap
        actions.push({
          day,
          type: 'HIRE_ROOKIE',
          count: hireCount,
        });
      }
    }

    // Overtime decision (handled via strategy parameter, just validate here)
    // The strategy.dailyOvertimeHours will be set from effectiveParams.maxOvertimeHours

    // ========================================================================
    // 5. FINANCIAL MANAGEMENT
    // ========================================================================

    // Take loan if cash is getting low (but debt not too high)
    if (state.cash < effectiveParams.cashReserveTarget && state.debt < 200000) {
      const loanNeeded = effectiveParams.loanAmount;

      actions.push({
        day,
        type: 'TAKE_LOAN',
        amount: loanNeeded,
      });
    }

    // Repay debt if we have excess cash
    if (state.cash > effectiveParams.repayThreshold && state.debt > 0) {
      const excessCash = state.cash - effectiveParams.cashReserveTarget;
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
      const standardPrice = Math.round(marketPrice * effectiveParams.standardPriceMultiplier);

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
   * Get representative parameters for Strategy object
   * For single policies: returns the single set
   * For weekly policies: returns week 1 as representative
   */
  private getRepresentativeParameters(): PolicyParameters {
    if (this.isWeekly && this.weeklyParams) {
      const week1Params = this.weeklyParams.weeks[1];
      if (!week1Params) {
        throw new Error('Week 1 parameters not defined for weekly policy');
      }
      return week1Params;
    } else if (this.params) {
      return this.params;
    } else {
      throw new Error('No policy parameters available');
    }
  }

  /**
   * Convert policy parameters to a complete Strategy object
   *
   * This creates the Strategy that will be fed into the simulation.
   * It includes both the policy parameters AND the generated actions.
   * For weekly policies, uses week 1 as representative for static fields,
   * but actual behavior comes from generated timedActions.
   */
  public toStrategy(initialState: SimulationState, baseStrategy?: Strategy): Strategy {
    const actions = this.generateAllActions(initialState);
    const representativeParams = this.getRepresentativeParameters();

    return {
      // Copy base strategy defaults
      ...(baseStrategy || {}),

      // Override with policy parameters (representative for weekly)
      reorderPoint: representativeParams.reorderPoint,
      orderQuantity: representativeParams.orderQuantity,
      standardBatchSize: representativeParams.standardBatchSize,
      mceAllocationCustom: representativeParams.mceCustomAllocation,
      standardPrice: Math.round(225 * representativeParams.standardPriceMultiplier),
      customBasePrice: representativeParams.customBasePrice,
      dailyOvertimeHours: representativeParams.maxOvertimeHours,

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
      minCashReserveDays: Math.round(representativeParams.cashReserveTarget / 5000), // Estimate
      debtPaydownAggressiveness: 0.80,
      preemptiveWageLoanDays: 4,
      maxDebtThreshold: 200000,
      emergencyLoanBuffer: representativeParams.cashReserveTarget,

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
 * Generate Weekly Parameter Space for 52-week optimization
 *
 * Creates parameter space with 780 dimensions (15 params × 52 weeks)
 * Format: week1_reorderPoint, week1_orderQuantity, ..., week52_customBasePrice
 *
 * @returns Parameter space object with 780 parameter definitions
 */
export function generateWeeklyParameterSpace(): Record<string, { min: number; max: number; type: 'integer' | 'real' }> {
  const weeklySpace: Record<string, { min: number; max: number; type: 'integer' | 'real' }> = {};

  // Generate parameter space for each of 52 weeks
  for (let week = 1; week <= 52; week++) {
    const prefix = `week${week}_`;

    // Inventory parameters
    weeklySpace[`${prefix}reorderPoint`] = { min: 200, max: 600, type: 'integer' };
    weeklySpace[`${prefix}orderQuantity`] = { min: 300, max: 800, type: 'integer' };
    weeklySpace[`${prefix}safetyStock`] = { min: 100, max: 300, type: 'integer' };

    // Allocation
    weeklySpace[`${prefix}mceCustomAllocation`] = { min: 0.4, max: 0.7, type: 'real' };

    // Batching
    weeklySpace[`${prefix}standardBatchSize`] = { min: 50, max: 120, type: 'integer' };
    weeklySpace[`${prefix}batchInterval`] = { min: 6, max: 12, type: 'integer' };

    // Workforce
    weeklySpace[`${prefix}targetExperts`] = { min: 1, max: 50, type: 'integer' };
    weeklySpace[`${prefix}hireThreshold`] = { min: 0.3, max: 1.0, type: 'real' };
    weeklySpace[`${prefix}maxOvertimeHours`] = { min: 0.0, max: 12.0, type: 'real' };
    weeklySpace[`${prefix}overtimeThreshold`] = { min: 0.5, max: 1.0, type: 'real' };

    // Financial
    weeklySpace[`${prefix}cashReserveTarget`] = { min: 15000, max: 35000, type: 'integer' };
    weeklySpace[`${prefix}loanAmount`] = { min: 20000, max: 50000, type: 'integer' };
    weeklySpace[`${prefix}repayThreshold`] = { min: 70000, max: 120000, type: 'integer' };

    // Pricing
    weeklySpace[`${prefix}standardPriceMultiplier`] = { min: 0.9, max: 1.1, type: 'real' };
    weeklySpace[`${prefix}customBasePrice`] = { min: 105.0, max: 115.0, type: 'real' };
  }

  return weeklySpace;
}

/**
 * Convert flat weekly parameter object to WeeklyPolicyParameters structure
 *
 * @param flatParams Flat object with keys like week1_reorderPoint, week2_orderQuantity, etc.
 * @returns Nested WeeklyPolicyParameters structure
 */
export function flatParamsToWeeklyPolicy(flatParams: Record<string, number>): WeeklyPolicyParameters {
  const weeklyParams: WeeklyPolicyParameters = { weeks: {} };

  for (let week = 1; week <= 52; week++) {
    const prefix = `week${week}_`;

    weeklyParams.weeks[week] = {
      reorderPoint: flatParams[`${prefix}reorderPoint`],
      orderQuantity: flatParams[`${prefix}orderQuantity`],
      safetyStock: flatParams[`${prefix}safetyStock`],
      mceCustomAllocation: flatParams[`${prefix}mceCustomAllocation`],
      standardBatchSize: flatParams[`${prefix}standardBatchSize`],
      batchInterval: flatParams[`${prefix}batchInterval`],
      targetExperts: flatParams[`${prefix}targetExperts`],
      hireThreshold: flatParams[`${prefix}hireThreshold`],
      maxOvertimeHours: flatParams[`${prefix}maxOvertimeHours`],
      overtimeThreshold: flatParams[`${prefix}overtimeThreshold`],
      cashReserveTarget: flatParams[`${prefix}cashReserveTarget`],
      loanAmount: flatParams[`${prefix}loanAmount`],
      repayThreshold: flatParams[`${prefix}repayThreshold`],
      standardPriceMultiplier: flatParams[`${prefix}standardPriceMultiplier`],
      customBasePrice: flatParams[`${prefix}customBasePrice`],
    };
  }

  return weeklyParams;
}

/**
 * Convert WeeklyPolicyParameters to flat parameter object
 *
 * @param weeklyParams Nested WeeklyPolicyParameters structure
 * @returns Flat object for Bayesian optimizer
 */
export function weeklyPolicyToFlatParams(weeklyParams: WeeklyPolicyParameters): Record<string, number> {
  const flatParams: Record<string, number> = {};

  for (let week = 1; week <= 52; week++) {
    const prefix = `week${week}_`;
    const params = weeklyParams.weeks[week];

    if (!params) {
      throw new Error(`Missing parameters for week ${week}`);
    }

    flatParams[`${prefix}reorderPoint`] = params.reorderPoint;
    flatParams[`${prefix}orderQuantity`] = params.orderQuantity;
    flatParams[`${prefix}safetyStock`] = params.safetyStock;
    flatParams[`${prefix}mceCustomAllocation`] = params.mceCustomAllocation;
    flatParams[`${prefix}standardBatchSize`] = params.standardBatchSize;
    flatParams[`${prefix}batchInterval`] = params.batchInterval;
    flatParams[`${prefix}targetExperts`] = params.targetExperts;
    flatParams[`${prefix}hireThreshold`] = params.hireThreshold;
    flatParams[`${prefix}maxOvertimeHours`] = params.maxOvertimeHours;
    flatParams[`${prefix}overtimeThreshold`] = params.overtimeThreshold;
    flatParams[`${prefix}cashReserveTarget`] = params.cashReserveTarget;
    flatParams[`${prefix}loanAmount`] = params.loanAmount;
    flatParams[`${prefix}repayThreshold`] = params.repayThreshold;
    flatParams[`${prefix}standardPriceMultiplier`] = params.standardPriceMultiplier;
    flatParams[`${prefix}customBasePrice`] = params.customBasePrice;
  }

  return flatParams;
}

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
