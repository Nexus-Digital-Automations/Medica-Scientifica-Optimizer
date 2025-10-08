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
 * Business State - Used for State-Conditional Policies
 *
 * Policies adapt based on the current financial health of the business.
 */
export type CashState = 'lowCash' | 'medCash' | 'highCash';

/**
 * Detect current business state based on net cash position
 */
export function detectBusinessState(state: SimulationState): CashState {
  const netCash = state.cash - state.debt;

  if (netCash < 100000) return 'lowCash';    // Survival mode - conservative
  if (netCash < 300000) return 'medCash';   // Balanced operations
  return 'highCash';                        // Aggressive growth
}


/**
 * 45 State-Conditional Policy Parameters - Phase 1
 *
 * Each of the 15 base parameters now has 3 variants for different cash states:
 * - lowCash:  Conservative policies for survival (netCash < $100k)
 * - medCash:  Balanced policies for steady growth ($100k-$300k)
 * - highCash: Aggressive policies for expansion (netCash > $300k)
 *
 * Total: 15 base × 3 states = 45 parameters
 */
export interface PolicyParameters {
  // ============================================================================
  // INVENTORY MANAGEMENT (3 × 3 = 9 parameters)
  // ============================================================================
  reorderPoint_lowCash: number;
  reorderPoint_medCash: number;
  reorderPoint_highCash: number;

  orderQuantity_lowCash: number;
  orderQuantity_medCash: number;
  orderQuantity_highCash: number;

  safetyStock_lowCash: number;
  safetyStock_medCash: number;
  safetyStock_highCash: number;

  // ============================================================================
  // PRODUCTION ALLOCATION (1 × 3 = 3 parameters) - CRITICAL
  // ============================================================================
  mceCustomAllocation_lowCash: number;
  mceCustomAllocation_medCash: number;
  mceCustomAllocation_highCash: number;

  // ============================================================================
  // BATCH PRODUCTION (2 × 3 = 6 parameters)
  // ============================================================================
  standardBatchSize_lowCash: number;
  standardBatchSize_medCash: number;
  standardBatchSize_highCash: number;

  batchInterval_lowCash: number;
  batchInterval_medCash: number;
  batchInterval_highCash: number;

  // ============================================================================
  // WORKFORCE MANAGEMENT (4 × 3 = 12 parameters)
  // ============================================================================
  targetExperts_lowCash: number;
  targetExperts_medCash: number;
  targetExperts_highCash: number;

  hireThreshold_lowCash: number;
  hireThreshold_medCash: number;
  hireThreshold_highCash: number;

  maxOvertimeHours_lowCash: number;
  maxOvertimeHours_medCash: number;
  maxOvertimeHours_highCash: number;

  overtimeThreshold_lowCash: number;
  overtimeThreshold_medCash: number;
  overtimeThreshold_highCash: number;

  // ============================================================================
  // FINANCIAL MANAGEMENT (3 × 3 = 9 parameters)
  // ============================================================================
  cashReserveTarget_lowCash: number;
  cashReserveTarget_medCash: number;
  cashReserveTarget_highCash: number;

  loanAmount_lowCash: number;
  loanAmount_medCash: number;
  loanAmount_highCash: number;

  repayThreshold_lowCash: number;
  repayThreshold_medCash: number;
  repayThreshold_highCash: number;

  // ============================================================================
  // PRICING STRATEGY (2 × 3 = 6 parameters)
  // ============================================================================
  standardPriceMultiplier_lowCash: number;
  standardPriceMultiplier_medCash: number;
  standardPriceMultiplier_highCash: number;

  customBasePrice_lowCash: number;
  customBasePrice_medCash: number;
  customBasePrice_highCash: number;
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
   * Get state-conditional parameter value
   *
   * Dynamically selects the appropriate parameter variant based on current business state.
   * This enables policies to adapt to financial conditions.
   *
   * @param baseParam Base parameter name (e.g., 'reorderPoint')
   * @param state Current simulation state
   * @returns The state-appropriate parameter value
   */
  private getStateConditionalParameter(baseParam: string, state: SimulationState): number {
    const cashState = detectBusinessState(state);
    const paramKey = `${baseParam}_${cashState}` as keyof PolicyParameters;
    return this.params[paramKey];
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
    // 1. INVENTORY MANAGEMENT (State-Conditional)
    // ========================================================================
    const reorderPoint = this.getStateConditionalParameter('reorderPoint', state);
    const orderQuantity = this.getStateConditionalParameter('orderQuantity', state);

    if (state.rawMaterialInventory <= reorderPoint) {
      // Only order if we haven't ordered recently (avoid spam)
      if (day - this.lastInventoryOrderDay >= 5) {
        actions.push({
          day,
          type: 'ORDER_MATERIALS',
          quantity: orderQuantity,
        });
        this.lastInventoryOrderDay = day;
      }
    }

    // ========================================================================
    // 2. BATCH PRODUCTION SCHEDULING (State-Conditional)
    // ========================================================================
    const batchInterval = this.getStateConditionalParameter('batchInterval', state);
    const standardBatchSize = this.getStateConditionalParameter('standardBatchSize', state);

    if (day - this.lastBatchDay >= batchInterval) {
      actions.push({
        day,
        type: 'ADJUST_BATCH_SIZE',
        newSize: standardBatchSize,
      });
      this.lastBatchDay = day;
    }

    // ========================================================================
    // 3. MCE ALLOCATION (CRITICAL - DAILY ADJUSTMENT, State-Conditional)
    // ========================================================================
    let allocation = this.getStateConditionalParameter('mceCustomAllocation', state);

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
    // 4. WORKFORCE MANAGEMENT (State-Conditional)
    // ========================================================================
    const targetExperts = this.getStateConditionalParameter('targetExperts', state);
    const hireThreshold = this.getStateConditionalParameter('hireThreshold', state);

    const currentExperts = state.workforce.experts;
    const rookiesInTraining = state.workforce.rookiesInTraining.length;
    const futureExperts = currentExperts + rookiesInTraining;

    // Hiring decision: Maintain target expert count
    if (futureExperts < targetExperts * hireThreshold) {
      const hireCount = Math.ceil(targetExperts - futureExperts);
      if (hireCount > 0 && hireCount <= 5) { // Safety cap
        actions.push({
          day,
          type: 'HIRE_ROOKIE',
          count: hireCount,
        });
      }
    }

    // Overtime decision (handled via strategy parameter in toStrategy() method)
    // The strategy.dailyOvertimeHours is set from state-conditional maxOvertimeHours

    // ========================================================================
    // 5. FINANCIAL MANAGEMENT (State-Conditional)
    // ========================================================================
    const cashReserveTarget = this.getStateConditionalParameter('cashReserveTarget', state);
    const loanAmount = this.getStateConditionalParameter('loanAmount', state);
    const repayThreshold = this.getStateConditionalParameter('repayThreshold', state);

    // Take loan if cash is getting low (but debt not too high)
    if (state.cash < cashReserveTarget && state.debt < 200000) {
      actions.push({
        day,
        type: 'TAKE_LOAN',
        amount: loanAmount,
      });
    }

    // Repay debt if we have excess cash
    if (state.cash > repayThreshold && state.debt > 0) {
      const excessCash = state.cash - cashReserveTarget;
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
    // 6. PRICING STRATEGY (Set once at start, State-Conditional)
    // ========================================================================
    if (day === CONSTANTS.SIMULATION_START_DAY) {
      const standardPriceMultiplier = this.getStateConditionalParameter('standardPriceMultiplier', state);

      const marketPrice = 225; // From Medica case
      const standardPrice = Math.round(marketPrice * standardPriceMultiplier);

      actions.push({
        day,
        type: 'ADJUST_PRICE',
        productType: 'standard',
        newPrice: standardPrice,
      });

      // Note: Custom price is auto-calculated by simulation based on delivery performance
      // customPrice = customBasePrice × (1 - 0.27 × max(0, avgDeliveryTime - 5))
      // The customBasePrice is set in the Strategy object via toStrategy() method
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
   * Static strategy fields use initial state's cash state for defaults.
   */
  public toStrategy(initialState: SimulationState, baseStrategy?: Strategy): Strategy {
    const actions = this.generateAllActions(initialState);

    // Use initial state to determine which state-conditional params to use as defaults
    const cashState = detectBusinessState(initialState);

    return {
      // Copy base strategy defaults
      ...(baseStrategy || {}),

      // Override with state-conditional policy parameters (using initial state)
      reorderPoint: this.params[`reorderPoint_${cashState}`],
      orderQuantity: this.params[`orderQuantity_${cashState}`],
      standardBatchSize: this.params[`standardBatchSize_${cashState}`],
      mceAllocationCustom: this.params[`mceCustomAllocation_${cashState}`],
      standardPrice: Math.round(225 * this.params[`standardPriceMultiplier_${cashState}`]),
      customBasePrice: this.params[`customBasePrice_${cashState}`],
      dailyOvertimeHours: this.params[`maxOvertimeHours_${cashState}`],

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

      // Debt management (use state-conditional policy parameters from initial state)
      autoDebtPaydown: true,
      minCashReserveDays: Math.round(this.params[`cashReserveTarget_${cashState}`] / 5000), // Estimate
      debtPaydownAggressiveness: 0.80,
      preemptiveWageLoanDays: 4,
      maxDebtThreshold: 200000,
      emergencyLoanBuffer: this.params[`cashReserveTarget_${cashState}`],

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
 * Base Parameter Space (before state-conditional expansion)
 *
 * These are the original search ranges for each parameter type.
 * Will be expanded to create state-conditional versions.
 */
const BASE_PARAMETER_SPACE = {
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
 * Generate state-conditional parameter space
 *
 * Expands each base parameter into 3 variants (lowCash, medCash, highCash)
 * Total: 15 base × 3 states = 45 parameters
 */
function generateStateConditionalSpace() {
  const space: Record<string, { min: number; max: number; type: 'integer' | 'real' }> = {};
  const states: CashState[] = ['lowCash', 'medCash', 'highCash'];

  for (const [baseParam, bounds] of Object.entries(BASE_PARAMETER_SPACE)) {
    for (const state of states) {
      const paramName = `${baseParam}_${state}`;
      space[paramName] = { ...bounds };
    }
  }

  return space;
}

/**
 * Parameter Space Definition for Bayesian Optimization (State-Conditional)
 *
 * 45 parameters total (15 base × 3 cash states)
 * Auto-generated from BASE_PARAMETER_SPACE
 */
export const PARAMETER_SPACE = generateStateConditionalSpace();

/**
 * Generate random policy parameters within bounds (State-Conditional)
 * Used for initial random exploration phase
 * Auto-generates all 45 parameters from PARAMETER_SPACE
 */
export function generateRandomPolicy(): PolicyParameters {
  const policy: any = {};

  for (const [paramName, bounds] of Object.entries(PARAMETER_SPACE)) {
    const range = bounds.max - bounds.min;
    const randomValue = Math.random() * range + bounds.min;

    policy[paramName] = bounds.type === 'integer'
      ? Math.floor(randomValue)
      : randomValue;
  }

  return policy as PolicyParameters;
}

/**
 * Get reasonable default/baseline policy parameters (State-Conditional)
 * Based on historical analysis and domain knowledge
 * Uses conservative, balanced, and aggressive defaults for lowCash, medCash, highCash
 */
export function getDefaultPolicy(): PolicyParameters {
  const baseDefaults = {
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

  const policy: any = {};
  const states: CashState[] = ['lowCash', 'medCash', 'highCash'];

  // Generate state-conditional defaults
  // lowCash = conservative (-20%), medCash = balanced (base), highCash = aggressive (+20%)
  for (const [baseParam, baseValue] of Object.entries(baseDefaults)) {
    for (const state of states) {
      const paramName = `${baseParam}_${state}`;
      let value = baseValue;

      // Adjust based on cash state
      if (state === 'lowCash') {
        // Conservative: reduce spending/risk parameters
        if (['orderQuantity', 'loanAmount', 'maxOvertimeHours', 'targetExperts'].includes(baseParam)) {
          value = baseValue * 0.8;
        }
      } else if (state === 'highCash') {
        // Aggressive: increase growth parameters
        if (['orderQuantity', 'targetExperts', 'maxOvertimeHours'].includes(baseParam)) {
          value = baseValue * 1.2;
        }
      }

      policy[paramName] = value;
    }
  }

  return policy as PolicyParameters;
}
