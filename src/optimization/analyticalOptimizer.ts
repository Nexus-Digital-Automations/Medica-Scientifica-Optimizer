/**
 * Analytical Optimizer: Operations Research Models
 *
 * Implements proven analytical models:
 * 1. Economic Order Quantity (EOQ) + Reorder Point (ROP)
 * 2. Newsvendor Model (capacity planning)
 * 3. Dynamic Programming (workforce planning)
 * 4. Revenue Maximization (pricing)
 *
 * These models are tuned by strategy genes from the GA.
 */

import type { StrategyGenes } from './strategyGenes.js';

export interface AnalyticalStrategy {
  inventoryPolicy: {
    orderQuantity: number;
    reorderPoint: number;
    safetyStock: number;
  };
  capacityPlan: {
    targetMachines: { MCE: number; WMA: number; PUC: number };
    utilizationTarget: number;
  };
  workforcePlan: {
    hiringSchedule: Array<{ day: number; rookies: number }>;
    targetWorkforce: number;
  };
  pricingPolicy: {
    standardPrice: number;
    customBasePrice: number;
    priceElasticity: number;
  };
  genes: StrategyGenes; // Store genes for reference
}

export class AnalyticalOptimizer {
  /**
   * Generate complete strategy using analytical models tuned by genes
   */
  generateStrategy(
    demandForecast: { mean: number; std: number },
    genes: StrategyGenes,
    currentDay: number = 51
  ): AnalyticalStrategy {
    // 1. Inventory policy (tuned by safetyStockMultiplier)
    const inventoryPolicy = this.optimizeInventory(
      demandForecast.mean,
      4, // Lead time days
      genes.safetyStockMultiplier
    );

    // 2. Capacity planning (tuned by targetCapacityMultiplier)
    const capacityPlan = this.optimizeCapacity(
      demandForecast.mean,
      demandForecast.std,
      genes.targetCapacityMultiplier
    );

    // 3. Workforce planning (tuned by workforceAggressiveness)
    const capacityTargets = this.forecastCapacityNeeds(demandForecast, 365);
    const workforcePlan = this.optimizeWorkforce(
      capacityTargets,
      15, // Training days
      genes.workforceAggressiveness,
      currentDay
    );

    // 4. Pricing (tuned by priceAggressiveness)
    const standardPrice = this.optimizePricing(
      capacityPlan.targetMachines.MCE * 50, // Daily capacity
      500, // Demand intercept (from case)
      -0.5, // Demand slope (from case)
      genes.priceAggressiveness
    );

    const customPrice = 106.56 * genes.customPriceMultiplier;

    const pricingPolicy = {
      standardPrice,
      customBasePrice: customPrice,
      priceElasticity: -0.1
    };

    return {
      inventoryPolicy,
      capacityPlan,
      workforcePlan,
      pricingPolicy,
      genes
    };
  }

  /**
   * 1. Inventory Optimization: EOQ + ROP
   *
   * EOQ minimizes total cost = ordering cost + holding cost
   * ROP covers lead time demand + safety stock
   */
  private optimizeInventory(
    demandForecast: number,
    leadTimeDays: number = 4,
    safetyMultiplier: number = 1.2
  ): { orderQuantity: number; reorderPoint: number; safetyStock: number } {
    const HOLDING_COST_DAILY = 50 * 0.000365; // $50/unit * 36.5%/365 days
    const ORDER_COST = 1000; // Fixed cost per order

    // EOQ: √(2 × D × S / H)
    const annualDemand = demandForecast * 365;
    const eoq = Math.sqrt((2 * annualDemand * ORDER_COST) / (HOLDING_COST_DAILY * 365));

    // Safety stock: Z × σ × √(Lead Time)
    const demandStdDev = demandForecast * 0.2; // Assume 20% CV
    const zScore = 1.96; // 95% service level
    const safetyStock = zScore * demandStdDev * Math.sqrt(leadTimeDays) * safetyMultiplier;

    // ROP: Lead time demand + safety stock
    const leadTimeDemand = demandForecast * leadTimeDays;
    const rop = leadTimeDemand + safetyStock;

    return {
      orderQuantity: Math.round(eoq),
      reorderPoint: Math.round(rop),
      safetyStock: Math.round(safetyStock)
    };
  }

  /**
   * 2. Capacity Planning: Newsvendor Model
   *
   * Balance cost of excess capacity vs. cost of lost sales
   * Critical Ratio = (Revenue - Cost) / Revenue
   * Optimal Capacity = μ + Z(CR) × σ
   */
  private optimizeCapacity(
    demandMean: number,
    demandStd: number,
    capacityMultiplier: number = 1.2
  ): { targetMachines: { MCE: number; WMA: number; PUC: number }; utilizationTarget: number } {
    // Newsvendor critical ratio
    const revenuePerUnit = 800; // ~$800 avg per unit
    const variableCost = 200;   // ~$200 material + labor
    const criticalRatio = (revenuePerUnit - variableCost) / revenuePerUnit;

    // Z-score for critical ratio (simplified lookup)
    const zScore = this.inverseNormal(criticalRatio);

    // Optimal capacity = mean + z * std
    const optimalDailyCapacity = demandMean + zScore * demandStd;

    // Apply multiplier (GA-tuned)
    const targetCapacity = optimalDailyCapacity * capacityMultiplier;

    // Convert to machines (MCE bottleneck: 50 units/day per machine)
    const mceCount = Math.ceil(targetCapacity / 50);

    // WMA/PUC scale proportionally (avoid other bottlenecks)
    return {
      targetMachines: {
        MCE: Math.max(1, mceCount),
        WMA: Math.max(1, Math.ceil(mceCount * 1.2)),
        PUC: Math.max(1, Math.ceil(mceCount * 1.0))
      },
      utilizationTarget: optimalDailyCapacity / (mceCount * 50)
    };
  }

  /**
   * 3. Workforce Planning: Dynamic Programming
   *
   * Minimize total salary costs while meeting capacity targets
   * Account for 15-day rookie training lag
   */
  private optimizeWorkforce(
    capacityTargets: number[],
    trainingDays: number = 15,
    aggressiveness: number = 1.0,
    currentDay: number = 51
  ): { hiringSchedule: Array<{ day: number; rookies: number }>; targetWorkforce: number } {
    const hiringSchedule: Array<{ day: number; rookies: number }> = [];
    const SHUTDOWN_DAY = 415;

    // Work backwards from target to account for training lag
    for (let day = currentDay; day < 365; day += 30) {
      const futureDay = day + trainingDays + 15; // When trained rookies become experts

      // Don't hire if won't finish training before shutdown
      if (futureDay > SHUTDOWN_DAY - 30) {
        break;
      }

      const futureCapacityNeeded = capacityTargets[Math.min(futureDay, capacityTargets.length - 1)] || capacityTargets[capacityTargets.length - 1];

      // Estimate current expert capacity (simplified)
      const currentExperts = 5 + hiringSchedule.reduce((sum, h) => sum + h.rookies, 0);
      const capacityGap = (futureCapacityNeeded * aggressiveness) - currentExperts;

      if (capacityGap > 0) {
        // Hire enough rookies to close gap
        const rookiesToHire = Math.ceil(capacityGap);
        hiringSchedule.push({ day, rookies: rookiesToHire });
      }
    }

    const totalHires = hiringSchedule.reduce((sum, h) => sum + h.rookies, 0);

    return {
      hiringSchedule,
      targetWorkforce: 5 + totalHires // Initial 5 experts + hires
    };
  }

  /**
   * 4. Pricing Optimization: Revenue Maximization
   *
   * Maximize revenue = P × min(Q(P), capacity)
   * Q(P) = intercept + slope * P (linear demand curve)
   */
  private optimizePricing(
    capacity: number,
    demandIntercept: number,
    demandSlope: number,
    priceAggressiveness: number = 1.0
  ): number {
    // Demand curve: Q = intercept + slope * P (slope is negative)
    // Revenue: R = P * Q = P * (intercept + slope * P)
    // Unconstrained optimum: dR/dP = intercept + 2*slope*P = 0
    const unconstrainedPrice = -demandIntercept / (2 * demandSlope);

    // Check if unconstrained demand exceeds capacity
    const unconstrainedDemand = demandIntercept + demandSlope * unconstrainedPrice;

    let optimalPrice: number;

    if (unconstrainedDemand <= capacity) {
      // No capacity constraint, use unconstrained optimum
      optimalPrice = unconstrainedPrice;
    } else {
      // Capacity-constrained: Solve Q(P) = capacity
      // capacity = intercept + slope * P
      // P = (capacity - intercept) / slope
      optimalPrice = (capacity - demandIntercept) / demandSlope;
    }

    // Apply aggressiveness multiplier (GA tunes this)
    return Math.max(200, optimalPrice * priceAggressiveness);
  }

  /**
   * Forecast capacity needs based on demand forecast
   */
  private forecastCapacityNeeds(demandForecast: { mean: number; std: number }, days: number): number[] {
    const targets: number[] = [];

    for (let day = 0; day < days; day++) {
      // Simple phase-based forecast
      // Could be enhanced with time-varying demand from case
      if (day < 172) {
        targets.push(demandForecast.mean); // Phase 1
      } else if (day < 218) {
        targets.push(demandForecast.mean * 1.17); // Phase 2: Growth
      } else {
        targets.push(demandForecast.mean * 1.33); // Phase 3: Higher stable
      }
    }

    return targets;
  }

  /**
   * Inverse normal CDF (simplified lookup table)
   * For Newsvendor model
   */
  private inverseNormal(p: number): number {
    // Simplified approximation
    if (p >= 0.95) return 1.96;
    if (p >= 0.90) return 1.28;
    if (p >= 0.85) return 1.04;
    if (p >= 0.80) return 0.84;
    if (p >= 0.75) return 0.67;
    if (p >= 0.70) return 0.52;
    if (p >= 0.65) return 0.39;
    if (p >= 0.60) return 0.25;
    if (p >= 0.55) return 0.13;
    return 0;
  }
}
