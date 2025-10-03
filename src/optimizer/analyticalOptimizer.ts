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
    // - Standard production: ~4000 units/month = ~50 units/day
    // - Custom production: ~35 orders/day (Phase 2)
    // - Raw material: $0.003/unit
    // - Lead time: 4 days
    // - Service level target: 95%

    // Calculate optimal order quantity (EOQ)
    const avgDailyStandardDemand = 50; // units
    const rawMaterialPerStandardUnit = CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT; // 0.003 kg
    const avgDailyRawMaterialDemand = avgDailyStandardDemand * rawMaterialPerStandardUnit;

    const eoq = this.calculateEOQ({
      annualDemand: avgDailyRawMaterialDemand * 365,
      orderingCost: CONSTANTS.RAW_MATERIAL_ORDER_FEE, // Actual order fee from constants
      holdingCostPerUnit: CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20, // 20% annual holding cost
    });

    // Calculate optimal reorder point (ROP)
    const rop = this.calculateReorderPoint({
      avgDailyDemand: avgDailyRawMaterialDemand,
      leadTimeDays: 4, // Raw materials arrive in 4 days
      serviceLevel: 0.95, // 95% service level
      demandStdDev: avgDailyRawMaterialDemand * 0.25, // Assume 25% variation
    });

    // Calculate optimal batch size for standard line (EPQ)
    const epq = this.calculateEPQ({
      annualDemand: avgDailyStandardDemand * 365,
      setupCost: 50, // Estimated setup cost for batch change
      holdingCost: CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT * CONSTANTS.RAW_MATERIAL_UNIT_COST * 0.20,
      productionRate: 100, // MCE capacity
      demandRate: avgDailyStandardDemand,
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
