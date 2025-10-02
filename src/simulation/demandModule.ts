/**
 * Demand Module - Models realistic market demand constraints
 * Implements demand forecasting based on business case timeline
 * Uses data-driven demand model with normal distribution for custom line
 */

import type { Strategy } from './types.js';

export interface DemandForecast {
  day: number;
  standardDemand: number;
  customDemand: number;
}

export interface DemandLimits {
  standard: number;
  custom: number;
}

/**
 * Box-Muller transform to generate normally distributed random numbers
 * Returns a value from a normal distribution with given mean and standard deviation
 */
function generateNormalRandom(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.round(mean + z0 * stdDev);
}

/**
 * Gets demand limits for a specific day
 * Can use custom forecast or default business case demand curve
 * Demand parameters come from strategy (market conditions)
 */
export function getDemandForDay(day: number, strategy: Strategy, customForecast?: DemandForecast[]): DemandLimits {
  // If custom forecast provided, use it
  if (customForecast) {
    const demand = customForecast.find((d) => d.day === day);
    if (demand) {
      return {
        standard: demand.standardDemand,
        custom: demand.customDemand,
      };
    }
  }

  // Default business case demand curve (data-driven model using strategy parameters)

  // Calculate standard demand using linear demand curve: Q = intercept + slope * P
  const standardDemand = Math.max(
    0,
    Math.round(strategy.standardDemandIntercept + strategy.standardDemandSlope * strategy.standardPrice)
  );

  // CUSTOM DEMAND THREE-PHASE MODEL (based on business case forecast):
  // Phase 1 (Days 51-172): Stable low demand
  // Phase 2 (Days 172-218): Linear increase transition period
  // Phase 3 (Days 218-400): Stable high demand

  // STANDARD DEMAND: Price-sensitive throughout (linear demand curve)

  // Phase 1: Days 51-172 - Stable baseline demand
  if (day <= 172) {
    const customDemand = Math.max(0, generateNormalRandom(strategy.customDemandMean1, strategy.customDemandStdDev1));
    return {
      standard: standardDemand,
      custom: customDemand,
    };
  }

  // Phase 2: Days 172-218 - Linear increase transition (46 days)
  // Demand increases linearly from mean1 to mean2
  if (day <= 218) {
    const transitionProgress = (day - 172) / (218 - 172); // 0.0 to 1.0
    const currentMean = strategy.customDemandMean1 +
                        (strategy.customDemandMean2 - strategy.customDemandMean1) * transitionProgress;
    const currentStdDev = strategy.customDemandStdDev1 +
                         (strategy.customDemandStdDev2 - strategy.customDemandStdDev1) * transitionProgress;
    const customDemand = Math.max(0, generateNormalRandom(currentMean, currentStdDev));
    return {
      standard: standardDemand,
      custom: customDemand,
    };
  }

  // Phase 3: Days 218-400 - Stable high demand
  if (day <= 400) {
    const customDemand = Math.max(0, generateNormalRandom(strategy.customDemandMean2, strategy.customDemandStdDev2));
    return {
      standard: standardDemand,
      custom: customDemand,
    };
  }

  // Days 401-500: Declining runoff period (plant shutdown approaching)
  // Demand declines gradually as market knows business is closing
  const daysIntoRunoff = day - 400;
  const declineRate = 0.95; // 5% decline every 30 days
  const periods = daysIntoRunoff / 30;
  const baseCustomDemand = strategy.customDemandMean2; // Start from shock phase level

  return {
    standard: standardDemand, // Price-sensitive demand throughout lifecycle
    custom: Math.max(2, Math.floor(baseCustomDemand * Math.pow(declineRate, periods))),
  };
}

/**
 * Calculates total potential revenue for remaining simulation period
 * Useful for strategic planning and what-if analysis
 */
export function calculateRemainingDemandPotential(
  startDay: number,
  endDay: number,
  strategy: Strategy,
  customForecast?: DemandForecast[]
): number {
  let totalPotentialRevenue = 0;

  for (let day = startDay; day <= endDay; day++) {
    const demand = getDemandForDay(day, strategy, customForecast);
    totalPotentialRevenue += demand.standard * strategy.standardPrice + demand.custom * strategy.customBasePrice;
  }

  return totalPotentialRevenue;
}

/**
 * Validates a custom demand forecast
 * Ensures all required fields are present and values are reasonable
 */
export function validateDemandForecast(forecast: DemandForecast[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(forecast)) {
    errors.push('Forecast must be an array');
    return { valid: false, errors };
  }

  for (let i = 0; i < forecast.length; i++) {
    const entry = forecast[i];

    if (typeof entry.day !== 'number' || entry.day < 51 || entry.day > 500) {
      errors.push(`Entry ${i}: day must be a number between 51 and 500`);
    }

    if (typeof entry.standardDemand !== 'number' || entry.standardDemand < 0) {
      errors.push(`Entry ${i}: standardDemand must be a non-negative number`);
    }

    if (typeof entry.customDemand !== 'number' || entry.customDemand < 0) {
      errors.push(`Entry ${i}: customDemand must be a non-negative number`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
