/**
 * Dynamic Policy Calculator - Recalculates optimal policies using OR formulas
 *
 * This module implements the dynamic optimization framework where policies
 * (batch sizes, reorder points, etc.) are automatically recalculated using
 * proven operations research formulas whenever factory conditions change.
 *
 * Key Principles:
 * - Genetic Algorithm finds optimal TIMING of strategic events
 * - Mathematical formulas calculate optimal POLICIES in response to those events
 * - Policies adapt in real-time as production capacity and demand evolve
 */

import type { SimulationState, Strategy } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';
import { AnalyticalOptimizer } from './analyticalOptimizer.js';

/**
 * Types of events that trigger policy recalculation
 */
export type TriggerEvent =
  | 'MACHINE_PURCHASED'
  | 'MACHINE_SOLD'
  | 'EMPLOYEE_HIRED'
  | 'EMPLOYEE_QUIT'
  | 'DEMAND_PHASE_CHANGE'
  | 'INITIAL_CALCULATION'
  | 'MANUAL_RECALC';

/**
 * Metadata about when and why a policy was calculated
 */
export interface PolicyMetadata {
  controlled: 'FORMULA' | 'GA';
  lastRecalculated: number;
  lastValue: number;
  calculationCount: number;
}

/**
 * Complete log entry for a policy change
 */
export interface PolicyChangeLog {
  day: number;
  policyName: string;
  oldValue: number;
  newValue: number;
  changeReason: string;
  formulaInputs: Record<string, number>;
  triggerEvent: TriggerEvent;
}

/**
 * Bottleneck analysis result
 */
export interface BottleneckAnalysis {
  station: 'MCE' | 'ARCP' | 'WMA' | 'PUC';
  capacity: number;
  systemThroughput: number;
  utilizationRate: number;
  isConstrained: boolean;
}

/**
 * Demand statistics for a time window
 */
interface DemandStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sampleSize: number;
}

/**
 * Tracks the state of formula inputs to detect when recalculation is needed
 */
interface FormulaInputState {
  // Production capacity inputs
  mceCapacity: number;
  wmaCapacity: number;
  pucCapacity: number;
  arcpCapacity: number;

  // Workforce inputs
  expertCount: number;
  rookieCount: number;

  // Demand inputs
  avgDailyDemand: number;
  demandPhase: number;

  // Last recalculation day
  lastRecalcDay: number;
}

/**
 * Dynamic Policy Calculator Class
 *
 * Responsible for:
 * 1. Detecting when factory conditions change
 * 2. Recalculating optimal policies using OR formulas
 * 3. Logging policy changes with full transparency
 * 4. Performing bottleneck analysis
 */
export class DynamicPolicyCalculator {
  private analyticalOptimizer: AnalyticalOptimizer;
  private previousInputState: FormulaInputState | null = null;
  private policyChangeHistory: PolicyChangeLog[] = [];
  private debugMode: boolean = false;

  constructor(debugMode: boolean = false) {
    this.analyticalOptimizer = new AnalyticalOptimizer();
    this.debugMode = debugMode;
  }

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Calculate initial policies at start of simulation (Day 51)
   * Uses analytical optimizer to establish baseline optimal policies
   */
  calculateInitialPolicies(state: SimulationState, strategy: Strategy): {
    reorderPoint: number;
    orderQuantity: number;
    standardBatchSize: number;
  } {
    if (this.debugMode) {
      console.log(`\n🔬 [Day ${state.currentDay}] Calculating initial policies using OR formulas...`);
    }

    // Use analytical optimizer to generate initial policies
    const analyticalStrategy = this.analyticalOptimizer.generateAnalyticalStrategy();

    const policies = {
      reorderPoint: analyticalStrategy.reorderPoint,
      orderQuantity: analyticalStrategy.orderQuantity,
      standardBatchSize: analyticalStrategy.standardBatchSize,
    };

    if (this.debugMode) {
      console.log(`  ✓ Initial EOQ (Order Quantity): ${policies.orderQuantity} units`);
      console.log(`  ✓ Initial ROP (Reorder Point): ${policies.reorderPoint} units`);
      console.log(`  ✓ Initial EPQ (Batch Size): ${policies.standardBatchSize} units`);
    }

    // Initialize input state tracking
    this.previousInputState = this.captureInputState(state, strategy);

    // Log initial calculation
    this.logPolicyChange(state.currentDay, 'orderQuantity', 0, policies.orderQuantity,
      'EOQ formula', 'INITIAL_CALCULATION', {
        annualDemand: 50 * 365 * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
        orderingCost: CONSTANTS.RAW_MATERIAL_ORDER_FEE,
        holdingCost: CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20,
      });

    this.logPolicyChange(state.currentDay, 'reorderPoint', 0, policies.reorderPoint,
      'ROP with safety stock', 'INITIAL_CALCULATION', {
        avgDailyDemand: 50 * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
        leadTimeDays: CONSTANTS.RAW_MATERIAL_LEAD_TIME,
        serviceLevel: 0.95,
      });

    this.logPolicyChange(state.currentDay, 'standardBatchSize', 0, policies.standardBatchSize,
      'EPQ formula', 'INITIAL_CALCULATION', {
        annualDemand: 50 * 365,
        setupCost: CONSTANTS.STANDARD_PRODUCTION_ORDER_FEE,
        productionRate: this.calculateProductionRate(state, strategy),
        demandRate: 50,
      });

    return policies;
  }

  /**
   * Main recalculation function - called whenever factory conditions change
   * Determines which policies need recalculation and updates them
   */
  recalculatePolicies(
    state: SimulationState,
    strategy: Strategy,
    triggerEvent: TriggerEvent
  ): void {
    if (this.debugMode) {
      console.log(`\n🔄 [Day ${state.currentDay}] Policy recalculation triggered by: ${triggerEvent}`);
    }

    // Capture current input state
    const currentInputState = this.captureInputState(state, strategy);

    // If this is the first calculation, initialize and return
    if (!this.previousInputState) {
      this.previousInputState = currentInputState;
      return;
    }

    // Detect what changed
    const changes = this.detectChanges(this.previousInputState, currentInputState);

    if (changes.length === 0) {
      if (this.debugMode) {
        console.log('  ℹ️  No significant changes detected, skipping recalculation');
      }
      return;
    }

    if (this.debugMode) {
      console.log(`  📊 Detected changes: ${changes.join(', ')}`);
    }

    // Recalculate policies based on what changed
    let policiesUpdated = 0;

    // EOQ recalculation (affects orderQuantity)
    if (changes.includes('DEMAND') || changes.includes('DEMAND_PHASE')) {
      const newEOQ = this.calculateOptimalEOQ(state, strategy);
      if (this.shouldUpdatePolicy(strategy.orderQuantity, newEOQ, 50)) {
        this.logPolicyChange(
          state.currentDay,
          'orderQuantity',
          strategy.orderQuantity,
          newEOQ,
          'EOQ formula recalculation due to demand change',
          triggerEvent,
          this.getEOQInputs(state, strategy)
        );
        strategy.orderQuantity = newEOQ;
        policiesUpdated++;
      }
    }

    // ROP recalculation (affects reorderPoint)
    if (changes.includes('DEMAND') || changes.includes('DEMAND_PHASE')) {
      const newROP = this.calculateOptimalROP(state, strategy);
      if (this.shouldUpdatePolicy(strategy.reorderPoint, newROP, 20)) {
        this.logPolicyChange(
          state.currentDay,
          'reorderPoint',
          strategy.reorderPoint,
          newROP,
          'ROP formula recalculation due to demand change',
          triggerEvent,
          this.getROPInputs(state, strategy)
        );
        strategy.reorderPoint = newROP;
        policiesUpdated++;
      }
    }

    // EPQ recalculation (affects standardBatchSize)
    if (changes.includes('PRODUCTION_RATE') || changes.includes('DEMAND') ||
        changes.includes('WORKFORCE') || changes.includes('DEMAND_PHASE')) {
      const newEPQ = this.calculateOptimalEPQ(state, strategy);
      if (this.shouldUpdatePolicy(strategy.standardBatchSize, newEPQ, 5)) {
        this.logPolicyChange(
          state.currentDay,
          'standardBatchSize',
          strategy.standardBatchSize,
          newEPQ,
          'EPQ formula recalculation due to capacity/demand change',
          triggerEvent,
          this.getEPQInputs(state, strategy)
        );
        strategy.standardBatchSize = newEPQ;
        policiesUpdated++;
      }
    }

    // Bottleneck analysis (informational, doesn't change policies directly)
    if (this.debugMode && (changes.includes('PRODUCTION_RATE') || changes.includes('WORKFORCE'))) {
      const bottleneck = this.identifyBottleneck(state, strategy);
      console.log(`  🎯 Current bottleneck: ${bottleneck.station} (capacity: ${bottleneck.capacity.toFixed(1)} units/day)`);
      console.log(`  📈 System throughput: ${bottleneck.systemThroughput.toFixed(1)} units/day`);
      console.log(`  ⚡ Utilization rate: ${(bottleneck.utilizationRate * 100).toFixed(1)}%`);
    }

    // Update previous state
    this.previousInputState = currentInputState;

    if (this.debugMode && policiesUpdated > 0) {
      console.log(`  ✅ Policies updated: ${policiesUpdated}`);
    }
  }

  /**
   * Calculate optimal Economic Order Quantity (EOQ) for raw materials
   */
  private calculateOptimalEOQ(state: SimulationState, strategy: Strategy): number {
    const avgDailyDemand = this.estimateAverageDailyDemand(state, strategy);
    const annualDemand = avgDailyDemand * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * 365;

    const eoq = this.analyticalOptimizer.calculateEOQ({
      annualDemand,
      orderingCost: CONSTANTS.RAW_MATERIAL_ORDER_FEE,
      holdingCostPerUnit: CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20, // 20% annual holding cost
    });

    return Math.round(eoq);
  }

  /**
   * Calculate optimal Reorder Point (ROP) with safety stock
   */
  private calculateOptimalROP(state: SimulationState, strategy: Strategy): number {
    const avgDailyDemand = this.estimateAverageDailyDemand(state, strategy);
    const demandStats = this.estimateDemandVariability(state, strategy);

    const rop = this.analyticalOptimizer.calculateReorderPoint({
      avgDailyDemand: avgDailyDemand * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
      leadTimeDays: CONSTANTS.RAW_MATERIAL_LEAD_TIME,
      serviceLevel: 0.95, // 95% service level
      demandStdDev: demandStats.stdDev * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
    });

    return Math.round(rop);
  }

  /**
   * Calculate optimal Economic Production Quantity (EPQ) for standard batches
   */
  private calculateOptimalEPQ(state: SimulationState, strategy: Strategy): number {
    const productionRate = this.calculateProductionRate(state, strategy);
    const demandRate = this.estimateAverageDailyDemand(state, strategy);
    const annualDemand = demandRate * 365;

    // Ensure production rate exceeds demand rate (EPQ requirement)
    if (productionRate <= demandRate) {
      if (this.debugMode) {
        console.warn(`  ⚠️  Production rate (${productionRate}) <= demand rate (${demandRate}), using production capacity as batch size`);
      }
      return Math.floor(productionRate);
    }

    const epq = this.analyticalOptimizer.calculateEPQ({
      annualDemand,
      setupCost: CONSTANTS.STANDARD_PRODUCTION_ORDER_FEE,
      holdingCost: CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20,
      productionRate,
      demandRate,
    });

    return Math.round(epq);
  }

  /**
   * Identify current production bottleneck
   * Returns the station with the lowest capacity (constraining factor)
   */
  identifyBottleneck(state: SimulationState, strategy: Strategy): BottleneckAnalysis {
    // Calculate capacity of each station
    const mceCapacity = state.machines.MCE * CONSTANTS.MCE_UNITS_PER_MACHINE_PER_DAY;

    const expertProductivity = state.workforce.experts * CONSTANTS.ARCP_EXPERT_PRODUCTIVITY;
    const rookieProductivity = state.workforce.rookies *
      CONSTANTS.ARCP_EXPERT_PRODUCTIVITY *
      CONSTANTS.ARCP_ROOKIE_PRODUCTIVITY_FACTOR;
    const overtimeMultiplier = strategy.dailyOvertimeHours > 0 ?
      1 + (strategy.dailyOvertimeHours / 8) : 1;
    const arcpCapacity = (expertProductivity + rookieProductivity) * overtimeMultiplier;

    // WMA and PUC capacities are typically not bottlenecks due to batching
    // but we include them for completeness
    const wmaCapacity = 1000; // High capacity due to batching
    const pucCapacity = 1000; // High capacity due to batching

    const capacities = [
      { station: 'MCE' as const, capacity: mceCapacity },
      { station: 'ARCP' as const, capacity: arcpCapacity },
      { station: 'WMA' as const, capacity: wmaCapacity },
      { station: 'PUC' as const, capacity: pucCapacity },
    ];

    // Find minimum capacity (bottleneck)
    const bottleneck = capacities.reduce((min, curr) =>
      curr.capacity < min.capacity ? curr : min
    );

    const demandRate = this.estimateAverageDailyDemand(state, strategy);

    return {
      station: bottleneck.station,
      capacity: bottleneck.capacity,
      systemThroughput: bottleneck.capacity,
      utilizationRate: demandRate / bottleneck.capacity,
      isConstrained: demandRate > bottleneck.capacity * 0.9, // >90% utilization
    };
  }

  /**
   * Capture current state of all formula inputs
   */
  private captureInputState(state: SimulationState, strategy: Strategy): FormulaInputState {
    return {
      mceCapacity: state.machines.MCE * CONSTANTS.MCE_UNITS_PER_MACHINE_PER_DAY,
      wmaCapacity: state.machines.WMA,
      pucCapacity: state.machines.PUC,
      arcpCapacity: this.calculateARCPCapacity(state, strategy),
      expertCount: state.workforce.experts,
      rookieCount: state.workforce.rookies,
      avgDailyDemand: this.estimateAverageDailyDemand(state, strategy),
      demandPhase: this.getDemandPhase(state.currentDay),
      lastRecalcDay: state.currentDay,
    };
  }

  /**
   * Detect which inputs changed significantly between two states
   */
  private detectChanges(previous: FormulaInputState, current: FormulaInputState): string[] {
    const changes: string[] = [];

    // Production capacity changes
    if (current.mceCapacity !== previous.mceCapacity ||
        current.wmaCapacity !== previous.wmaCapacity ||
        current.pucCapacity !== previous.pucCapacity) {
      changes.push('PRODUCTION_RATE');
    }

    // Workforce changes
    if (current.expertCount !== previous.expertCount ||
        current.rookieCount !== previous.rookieCount ||
        current.arcpCapacity !== previous.arcpCapacity) {
      changes.push('WORKFORCE');
    }

    // Demand phase changes
    if (current.demandPhase !== previous.demandPhase) {
      changes.push('DEMAND_PHASE');
    }

    // Demand level changes (more than 10% change)
    const demandChange = Math.abs(current.avgDailyDemand - previous.avgDailyDemand);
    if (demandChange > previous.avgDailyDemand * 0.10) {
      changes.push('DEMAND');
    }

    return changes;
  }

  /**
   * Determine if a policy should be updated based on the new value
   * Uses threshold to avoid unnecessary micro-adjustments
   */
  private shouldUpdatePolicy(currentValue: number, newValue: number, threshold: number): boolean {
    const change = Math.abs(newValue - currentValue);
    return change >= threshold;
  }

  /**
   * Calculate effective production rate (bottleneck-adjusted)
   */
  private calculateProductionRate(state: SimulationState, strategy: Strategy): number {
    const bottleneck = this.identifyBottleneck(state, strategy);
    return bottleneck.systemThroughput;
  }

  /**
   * Calculate ARCP (labor) capacity
   */
  private calculateARCPCapacity(state: SimulationState, strategy: Strategy): number {
    const expertProductivity = state.workforce.experts * CONSTANTS.ARCP_EXPERT_PRODUCTIVITY;
    const rookieProductivity = state.workforce.rookies *
      CONSTANTS.ARCP_EXPERT_PRODUCTIVITY *
      CONSTANTS.ARCP_ROOKIE_PRODUCTIVITY_FACTOR;
    const overtimeMultiplier = strategy.dailyOvertimeHours > 0 ?
      1 + (strategy.dailyOvertimeHours / 8) : 1;

    return (expertProductivity + rookieProductivity) * overtimeMultiplier;
  }

  /**
   * Estimate average daily demand based on current demand phase
   */
  private estimateAverageDailyDemand(state: SimulationState, strategy: Strategy): number {
    const phase = this.getDemandPhase(state.currentDay);

    if (phase === 1) {
      // Phase 1: Days 51-172
      return strategy.customDemandMean1 + this.estimateStandardDemand(strategy);
    } else if (phase === 2) {
      // Phase 2: Days 172-218 (transition)
      const transitionProgress = (state.currentDay - 172) / (218 - 172);
      const customDemand = strategy.customDemandMean1 +
        (strategy.customDemandMean2 - strategy.customDemandMean1) * transitionProgress;
      return customDemand + this.estimateStandardDemand(strategy);
    } else if (phase === 3) {
      // Phase 3: Days 218-400
      return strategy.customDemandMean2 + this.estimateStandardDemand(strategy);
    } else {
      // Phase 4: Days 401-500 (runoff)
      const runoffFactor = 1 - ((state.currentDay - 400) / 100);
      return (strategy.customDemandMean2 * runoffFactor) +
        (this.estimateStandardDemand(strategy) * runoffFactor);
    }
  }

  /**
   * Estimate standard product demand from pricing curve
   */
  private estimateStandardDemand(strategy: Strategy): number {
    return Math.max(0, strategy.standardDemandIntercept +
      strategy.standardDemandSlope * strategy.standardPrice);
  }

  /**
   * Estimate demand variability (standard deviation)
   */
  private estimateDemandVariability(state: SimulationState, strategy: Strategy): DemandStatistics {
    const phase = this.getDemandPhase(state.currentDay);

    let stdDev: number;
    if (phase === 1) {
      stdDev = strategy.customDemandStdDev1;
    } else if (phase === 2) {
      const transitionProgress = (state.currentDay - 172) / (218 - 172);
      stdDev = strategy.customDemandStdDev1 +
        (strategy.customDemandStdDev2 - strategy.customDemandStdDev1) * transitionProgress;
    } else {
      stdDev = strategy.customDemandStdDev2;
    }

    const mean = this.estimateAverageDailyDemand(state, strategy);

    return {
      mean,
      stdDev,
      min: Math.max(0, mean - 2 * stdDev),
      max: mean + 2 * stdDev,
      sampleSize: 30, // Assumed 30-day sample
    };
  }

  /**
   * Determine current demand phase
   */
  private getDemandPhase(day: number): number {
    if (day <= 172) return 1;
    if (day <= 218) return 2;
    if (day <= 400) return 3;
    return 4; // Runoff
  }

  /**
   * Get formula inputs for EOQ calculation
   */
  private getEOQInputs(state: SimulationState, strategy: Strategy): Record<string, number> {
    const avgDailyDemand = this.estimateAverageDailyDemand(state, strategy);
    return {
      annualDemand: avgDailyDemand * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * 365,
      orderingCost: CONSTANTS.RAW_MATERIAL_ORDER_FEE,
      holdingCost: CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20,
    };
  }

  /**
   * Get formula inputs for ROP calculation
   */
  private getROPInputs(state: SimulationState, strategy: Strategy): Record<string, number> {
    const avgDailyDemand = this.estimateAverageDailyDemand(state, strategy);
    const demandStats = this.estimateDemandVariability(state, strategy);
    return {
      avgDailyDemand: avgDailyDemand * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
      leadTimeDays: CONSTANTS.RAW_MATERIAL_LEAD_TIME,
      serviceLevel: 0.95,
      demandStdDev: demandStats.stdDev * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT,
    };
  }

  /**
   * Get formula inputs for EPQ calculation
   */
  private getEPQInputs(state: SimulationState, strategy: Strategy): Record<string, number> {
    const productionRate = this.calculateProductionRate(state, strategy);
    const demandRate = this.estimateAverageDailyDemand(state, strategy);
    return {
      annualDemand: demandRate * 365,
      setupCost: CONSTANTS.STANDARD_PRODUCTION_ORDER_FEE,
      holdingCost: CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20,
      productionRate,
      demandRate,
    };
  }

  /**
   * Log a policy change with full context
   */
  private logPolicyChange(
    day: number,
    policyName: string,
    oldValue: number,
    newValue: number,
    changeReason: string,
    triggerEvent: TriggerEvent,
    formulaInputs: Record<string, number>
  ): void {
    const log: PolicyChangeLog = {
      day,
      policyName,
      oldValue,
      newValue,
      changeReason,
      formulaInputs,
      triggerEvent,
    };

    this.policyChangeHistory.push(log);

    // Console output (only in debug mode)
    if (this.debugMode) {
      console.log(`\n  📝 Policy Change: ${policyName}`);
      console.log(`     Old Value: ${oldValue.toFixed(2)}`);
      console.log(`     New Value: ${newValue.toFixed(2)}`);
      console.log(`     Change: ${((newValue - oldValue) / Math.max(oldValue, 1) * 100).toFixed(1)}%`);
      console.log(`     Reason: ${changeReason}`);
      console.log(`     Trigger: ${triggerEvent}`);
      console.log(`     Formula Inputs:`);
      for (const [key, value] of Object.entries(formulaInputs)) {
        console.log(`       - ${key}: ${value.toFixed(2)}`);
      }
    }
  }

  /**
   * Get complete policy change history
   */
  getPolicyChangeHistory(): PolicyChangeLog[] {
    return [...this.policyChangeHistory];
  }

  /**
   * Clear policy change history (for testing)
   */
  clearHistory(): void {
    this.policyChangeHistory = [];
    this.previousInputState = null;
  }
}
