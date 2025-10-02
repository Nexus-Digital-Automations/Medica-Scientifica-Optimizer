/**
 * Demand Module - Models realistic market demand constraints
 * Implements demand forecasting based on business case timeline
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

  // Default business case demand curve
  // Days 51-171: Low steady demand (market development phase)
  if (day < 172) {
    return {
      standard: 10, // Low initial standard demand
      custom: 5, // Low initial custom demand
    };
  }

  // Days 172-268: High demand (active management period)
  if (day < 269) {
    return {
      standard: 50, // High active period standard demand
      custom: 20, // High active period custom demand
    };
  }

  // Days 269-500: Declining runoff period (plant shutdown approaching)
  // Demand declines gradually as market knows business is closing
  const daysIntoRunoff = day - 269;
  const declineRate = 0.95; // 5% decline every 30 days
  const periods = daysIntoRunoff / 30;

  return {
    standard: Math.max(5, Math.floor(50 * Math.pow(declineRate, periods))),
    custom: Math.max(2, Math.floor(20 * Math.pow(declineRate, periods))),
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
