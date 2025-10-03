/**
 * Phase-Aware Batch Size Optimizer
 * Calculates optimal batch sizes for different business phases
 */

import { AnalyticalOptimizer } from './analyticalOptimizer.js';
import type { StrategyAction } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';

/**
 * Business phases based on demand patterns
 */
export interface BusinessPhase {
  name: string;
  startDay: number;
  endDay: number;
  avgDemandPerDay: number;
  demandVariability: number; // Coefficient of variation
}

/**
 * Default business phases for Medica Scientifica
 */
export const DEFAULT_PHASES: BusinessPhase[] = [
  {
    name: 'Low Demand Phase',
    startDay: 51,
    endDay: 172,
    avgDemandPerDay: 25, // Custom demand mean1
    demandVariability: 0.2, // 20% CV (stdDev/mean = 5/25)
  },
  {
    name: 'Transition Phase',
    startDay: 172,
    endDay: 218,
    avgDemandPerDay: 28.75, // Midpoint between 25 and 32.5
    demandVariability: 0.25, // Slightly higher during transition
  },
  {
    name: 'High Demand Phase',
    startDay: 218,
    endDay: 400,
    avgDemandPerDay: 32.5, // Custom demand mean2
    demandVariability: 0.2, // 20% CV (stdDev/mean = 6.5/32.5)
  },
  {
    name: 'Runoff Phase',
    startDay: 450,
    endDay: 500,
    avgDemandPerDay: 15, // Winding down, reduced orders
    demandVariability: 0.3, // Higher uncertainty in runoff
  },
];

/**
 * Batch size recommendation for a phase
 */
export interface BatchSizeRecommendation {
  phase: string;
  optimalSize: number;
  reasoning: string;
  expectedSetupCost: number;
  expectedHoldingCost: number;
  totalCost: number;
}

/**
 * Phase-Aware Batch Size Optimizer
 */
export class PhaseAwareBatchOptimizer {
  private analyticalOptimizer: AnalyticalOptimizer;
  private phases: BusinessPhase[];

  constructor(phases: BusinessPhase[] = DEFAULT_PHASES) {
    this.analyticalOptimizer = new AnalyticalOptimizer();
    this.phases = phases;
  }

  /**
   * Calculate optimal batch size for a specific phase
   */
  optimizeBatchForPhase(phase: BusinessPhase): BatchSizeRecommendation {
    const setupCost = 50; // Cost to change batch setup
    const rawMaterialCost = CONSTANTS.RAW_MATERIAL_UNIT_COST * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT;
    const holdingCostPerUnit = rawMaterialCost * 0.20; // 20% annual holding cost
    const productionCapacity = 100; // MCE capacity per day

    // Calculate optimal batch using EPQ
    const optimalBatch = this.analyticalOptimizer.optimizeStandardBatchSize({
      avgDemandPerDay: phase.avgDemandPerDay,
      productionCapacity,
      setupCost,
      holdingCostPerUnit,
    });

    // Calculate costs for this batch size
    const phaseDuration = phase.endDay - phase.startDay;
    const totalDemand = phase.avgDemandPerDay * phaseDuration;
    const numBatches = Math.ceil(totalDemand / optimalBatch);
    const expectedSetupCost = numBatches * setupCost;

    // Average inventory = (batch size / 2) * (1 - demand rate / production rate)
    const avgInventory = (optimalBatch / 2) * (1 - phase.avgDemandPerDay / productionCapacity);
    const dailyHoldingCost = avgInventory * (holdingCostPerUnit / 365);
    const expectedHoldingCost = dailyHoldingCost * phaseDuration;

    const totalCost = expectedSetupCost + expectedHoldingCost;

    // Generate reasoning
    let reasoning = `Phase ${phase.name} (Days ${phase.startDay}-${phase.endDay}): `;
    reasoning += `Avg demand ${phase.avgDemandPerDay} units/day. `;
    reasoning += `EPQ formula suggests ${optimalBatch} units to minimize total cost. `;
    reasoning += `Expected ${numBatches} batches over ${phaseDuration} days.`;

    return {
      phase: phase.name,
      optimalSize: optimalBatch,
      reasoning,
      expectedSetupCost,
      expectedHoldingCost,
      totalCost,
    };
  }

  /**
   * Get recommendations for all phases
   */
  getAllRecommendations(): BatchSizeRecommendation[] {
    return this.phases.map(phase => this.optimizeBatchForPhase(phase));
  }

  /**
   * Generate timed batch size adjustment actions
   * Creates ADJUST_BATCH_SIZE actions at the start of each phase
   */
  generateBatchAdjustmentActions(): StrategyAction[] {
    const actions: StrategyAction[] = [];

    for (const phase of this.phases) {
      const recommendation = this.optimizeBatchForPhase(phase);

      actions.push({
        day: phase.startDay,
        type: 'ADJUST_BATCH_SIZE',
        newSize: recommendation.optimalSize,
      });
    }

    return actions.sort((a, b) => a.day - b.day);
  }

  /**
   * Compare batch optimization strategies
   */
  compareStrategies(): {
    fixedBatch: { size: number; totalCost: number };
    phaseAware: { totalCost: number; avgSize: number };
    savings: number;
    savingsPercent: number;
  } {
    // Calculate cost with fixed batch size (current default: 60)
    const fixedSize = 60;
    const fixedCost = this.calculateTotalCostForFixedBatch(fixedSize);

    // Calculate cost with phase-aware batching
    const recommendations = this.getAllRecommendations();
    const phaseAwareCost = recommendations.reduce((sum, rec) => sum + rec.totalCost, 0);
    const avgPhaseAwareSize = recommendations.reduce((sum, rec) => sum + rec.optimalSize, 0) / recommendations.length;

    const savings = fixedCost - phaseAwareCost;
    const savingsPercent = (savings / fixedCost) * 100;

    return {
      fixedBatch: { size: fixedSize, totalCost: fixedCost },
      phaseAware: { totalCost: phaseAwareCost, avgSize: Math.round(avgPhaseAwareSize) },
      savings,
      savingsPercent,
    };
  }

  /**
   * Calculate total cost for fixed batch size across all phases
   */
  private calculateTotalCostForFixedBatch(batchSize: number): number {
    const setupCost = 50;
    const rawMaterialCost = CONSTANTS.RAW_MATERIAL_UNIT_COST * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT;
    const holdingCostPerUnit = rawMaterialCost * 0.20;
    const productionCapacity = 100;

    let totalCost = 0;

    for (const phase of this.phases) {
      const phaseDuration = phase.endDay - phase.startDay;
      const totalDemand = phase.avgDemandPerDay * phaseDuration;
      const numBatches = Math.ceil(totalDemand / batchSize);
      const phaseSetupCost = numBatches * setupCost;

      const avgInventory = (batchSize / 2) * (1 - phase.avgDemandPerDay / productionCapacity);
      const dailyHoldingCost = avgInventory * (holdingCostPerUnit / 365);
      const phaseHoldingCost = dailyHoldingCost * phaseDuration;

      totalCost += phaseSetupCost + phaseHoldingCost;
    }

    return totalCost;
  }
}
