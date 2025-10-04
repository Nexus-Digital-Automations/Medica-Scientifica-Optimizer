/**
 * Analytical Optimizer - Operations Research Formulas
 * Implements proven mathematical models for inventory and production optimization
 */

import type { Strategy } from '../simulation/types.js';
import { CONSTANTS } from '../simulation/constants.js';

export class AnalyticalOptimizer {
  /**
   * Economic Order Quantity (EOQ)
   * Minimizes total cost = ordering cost + holding cost
   *
   * Formula: EOQ = sqrt((2 * D * K) / h)
   * Where:
   *   D = Annual demand
   *   K = Fixed cost per order
   *   h = Holding cost per unit per year
   */
  calculateEOQ(params: {
    annualDemand: number;
    orderingCost: number;
    holdingCostPerUnit: number;
  }): number {
    const { annualDemand, orderingCost, holdingCostPerUnit } = params;

    if (holdingCostPerUnit === 0) {
      throw new Error('Holding cost cannot be zero');
    }

    return Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
  }

  /**
   * Reorder Point (ROP) with Safety Stock
   * Determines when to place new order to avoid stockouts
   *
   * Formula: ROP = (d * L) + (z * σ_L * sqrt(L))
   * Where:
   *   d = Average daily demand
   *   L = Lead time in days
   *   z = Z-score for service level
   *   σ_L = Standard deviation of demand
   */
  calculateReorderPoint(params: {
    avgDailyDemand: number;
    leadTimeDays: number;
    serviceLevel: number;
    demandStdDev: number;
  }): number {
    const { avgDailyDemand, leadTimeDays, serviceLevel, demandStdDev } = params;

    const zScore = this.getZScore(serviceLevel);
    const safetyStock = zScore * Math.sqrt(leadTimeDays) * demandStdDev;
    const averageDemandDuringLeadTime = avgDailyDemand * leadTimeDays;

    return averageDemandDuringLeadTime + safetyStock;
  }

  /**
   * Economic Production Quantity (EPQ)
   * Optimal batch size for production runs
   *
   * Formula: EPQ = sqrt((2 * D * K) / (h * (1 - d/p)))
   * Where:
   *   D = Annual demand
   *   K = Setup cost per production run
   *   h = Holding cost per unit per year
   *   d = Demand rate
   *   p = Production rate
   */
  calculateEPQ(params: {
    annualDemand: number;
    setupCost: number;
    holdingCost: number;
    productionRate: number;
    demandRate: number;
  }): number {
    const { annualDemand, setupCost, holdingCost, productionRate, demandRate } = params;

    if (productionRate <= demandRate) {
      throw new Error('Production rate must exceed demand rate');
    }

    const adjustmentFactor = 1 - (demandRate / productionRate);
    return Math.sqrt((2 * annualDemand * setupCost) / (holdingCost * adjustmentFactor));
  }

  /**
   * Get Z-score for given service level
   * Uses common values; could be extended with inverse normal CDF
   */
  private getZScore(serviceLevel: number): number {
    // Common service levels and their z-scores
    const zScores: Record<number, number> = {
      0.50: 0.00,
      0.80: 0.84,
      0.85: 1.04,
      0.90: 1.28,
      0.95: 1.65,
      0.97: 1.88,
      0.99: 2.33,
      0.995: 2.58,
      0.999: 3.09,
    };

    // Find closest service level
    const levels = Object.keys(zScores).map(Number);
    const closest = levels.reduce((prev, curr) => {
      return Math.abs(curr - serviceLevel) < Math.abs(prev - serviceLevel) ? curr : prev;
    });

    return zScores[closest];
  }

  /**
   * Generate complete strategy using analytical formulas
   * Provides mathematically optimal starting point for GA
   */
  generateAnalyticalStrategy(): Strategy {
    // Medica Scientifica parameters (from business case):
    // - MCE capacity: 30 units/day per machine
    // - Typical allocation: ~50% Standard, ~50% Custom
    // - Standard: 2 parts/unit, Custom: 1 part/order
    // - Lead time: 4 days
    // - Service level target: 95%

    // Calculate optimal order quantity (EOQ)
    // Base on MCE consumption capacity (actual material usage), NOT customer demand
    // Customer demand (300 units/day) vastly exceeds production capacity (3 units/day ARCP)
    // EOQ should reflect ACTUAL material consumption at MCE stage
    const mceCapacityPerMachine = CONSTANTS.MCE_UNITS_PER_MACHINE_PER_DAY; // 30 units/day
    const typicalAllocationStandard = 0.50; // Assume 50/50 split for baseline
    const standardMCEUnits = mceCapacityPerMachine * typicalAllocationStandard; // 15 units/day
    const customMCEUnits = mceCapacityPerMachine * (1 - typicalAllocationStandard); // 15 units/day
    const avgDailyRawMaterialDemand =
      (standardMCEUnits * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT) +
      (customMCEUnits * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT); // 30 + 15 = 45 parts/day

    // EOQ based on MCE consumption rate (~45 parts/day)
    // At this rate: EOQ ≈ 1,812 parts = $91,600 per order
    const eoq = this.calculateEOQ({
      annualDemand: avgDailyRawMaterialDemand * 365, // 45 * 365 = 16,425 parts/year
      orderingCost: CONSTANTS.RAW_MATERIAL_ORDER_FEE, // $1,000 per order
      holdingCostPerUnit: CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20, // $10 per part per year (20% holding cost)
    });

    // Calculate optimal reorder point (ROP)
    // Based on MCE consumption (45 parts/day) with 4-day lead time
    // ROP ≈ 217 parts (180 parts for lead time + 37 parts safety stock)
    const rop = this.calculateReorderPoint({
      avgDailyDemand: avgDailyRawMaterialDemand, // 45 parts/day
      leadTimeDays: 4, // Raw materials arrive in 4 days
      serviceLevel: 0.95, // 95% service level
      demandStdDev: avgDailyRawMaterialDemand * 0.25, // 11.25 parts/day std dev (25% variation)
    });

    // Calculate optimal batch size for standard line (EPQ)
    // Use MCE production rate (15 units/day Standard at 50% allocation)
    // Not customer demand (300 units/day) - factory is capacity-constrained
    const epq = this.calculateEPQ({
      annualDemand: standardMCEUnits * 365, // 15 units/day × 365 = 5,475 units/year
      setupCost: CONSTANTS.STANDARD_PRODUCTION_ORDER_FEE, // $100 per batch
      holdingCost: CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20, // $10 per unit per year
      productionRate: mceCapacityPerMachine, // 30 units/day MCE capacity
      demandRate: standardMCEUnits, // 15 units/day actual Standard production
    });

    // Return strategy with analytically-derived parameters
    return {
      // Inventory management (from EOQ/ROP analysis)
      reorderPoint: Math.round(rop),
      orderQuantity: Math.round(eoq),

      // Production (from EPQ analysis)
      standardBatchSize: Math.round(epq),

      // Capacity allocation (baseline - to be optimized by GA)
      mceAllocationCustom: 0.30, // 30% to custom, 70% to standard

      // Pricing (market-driven - fixed per business case)
      standardPrice: 45,
      customBasePrice: 80,
      customPenaltyPerDay: 1,
      customTargetDeliveryDays: 14,

      // Workforce policy (baseline - to be optimized by GA)
      dailyOvertimeHours: 0, // Start with no overtime
      overtimeTriggerDays: 5,
      dailyQuitProbability: 0.10,

      // Demand model (fixed per business case)
      customDemandMean1: 3,
      customDemandStdDev1: 1,
      customDemandMean2: 35,
      customDemandStdDev2: 5,

      // Standard demand curve (fixed per business case)
      standardDemandIntercept: 600,
      standardDemandSlope: -5,

      // Timed actions (empty - to be optimized by GA)
      timedActions: [],
    };
  }

  /**
   * Optimize standard line batch size using EPQ formula
   * Smaller batches reduce WIP holding costs
   */
  optimizeStandardBatchSize(params: {
    avgDemandPerDay: number;
    productionCapacity: number;
    setupCost: number;
    holdingCostPerUnit: number;
  }): number {
    const { avgDemandPerDay, productionCapacity, setupCost, holdingCostPerUnit } = params;

    const annualDemand = avgDemandPerDay * 365;
    const productionRate = productionCapacity;
    const demandRate = avgDemandPerDay;

    if (productionRate <= demandRate) {
      // If production can't keep up, produce at maximum capacity
      return Math.floor(productionCapacity);
    }

    const optimalBatch = Math.sqrt(
      (2 * annualDemand * setupCost) /
      (holdingCostPerUnit * (1 - demandRate / productionRate))
    );

    return Math.round(optimalBatch);
  }
}
