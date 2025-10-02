/**
 * Demand Module - Models realistic market demand constraints
 * Implements demand forecasting based on business case timeline
 * Uses data-driven demand model with normal distribution for custom line
 */

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
 */
export function getDemandForDay(day: number, customForecast?: DemandForecast[]): DemandLimits {
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

  // Default business case demand curve (data-driven model)

  // Days 51-172: Baseline demand phase
  // Custom: Normal distribution (mean=25, std=5) based on historical analysis
  // Standard: Unlimited (production-constrained, not market-constrained)
  if (day < 173) {
    const customDemand = Math.max(0, generateNormalRandom(25, 5));
    return {
      standard: 999999, // Effectively unlimited - can sell everything produced
      custom: customDemand,
    };
  }

  // Days 173-400: Demand shock phase (30% increase)
  // Custom: Normal distribution (mean=32.5, std=6.5) - 30% increase from baseline
  // Standard: Still unlimited
  if (day <= 400) {
    const customDemand = Math.max(0, generateNormalRandom(32.5, 6.5));
    return {
      standard: 999999, // Effectively unlimited - can sell everything produced
      custom: customDemand,
    };
  }

  // Days 401-500: Declining runoff period (plant shutdown approaching)
  // Demand declines gradually as market knows business is closing
  const daysIntoRunoff = day - 400;
  const declineRate = 0.95; // 5% decline every 30 days
  const periods = daysIntoRunoff / 30;
  const baseCustomDemand = 32.5; // Start from shock phase level

  return {
    standard: 999999, // Unlimited until final shutdown
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
  standardPrice: number,
  customPrice: number,
  customForecast?: DemandForecast[]
): number {
  let totalPotentialRevenue = 0;

  for (let day = startDay; day <= endDay; day++) {
    const demand = getDemandForDay(day, customForecast);
    totalPotentialRevenue += demand.standard * standardPrice + demand.custom * customPrice;
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
