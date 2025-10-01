/**
 * Pricing and Sales Module - Handles product pricing and revenue calculations
 * Manages dynamic pricing for custom orders based on delivery time
 */

import type { SimulationState, Strategy } from './types.js';
import { addRevenue } from './financeModule.js';

export interface PricingResult {
  standardPrice: number;
  customPrice: number;
  avgDeliveryTime: number;
}

export interface SalesResult {
  standardUnitsSold: number;
  customOrdersSold: number;
  standardRevenue: number;
  customRevenue: number;
  totalRevenue: number;
}

/**
 * Calculates custom product price based on delivery time
 * Price decreases with longer delivery times (penalty model)
 */
export function calculateCustomPrice(strategy: Strategy, avgDeliveryTime: number): number {
  const { customBasePrice, customPenaltyPerDay, customTargetDeliveryDays } = strategy;

  // Calculate penalty for exceeding target delivery time
  const daysOverTarget = Math.max(0, avgDeliveryTime - customTargetDeliveryDays);
  const penalty = daysOverTarget * customPenaltyPerDay;

  // Price = base price - penalty (minimum floor of 50% base price)
  const price = Math.max(customBasePrice * 0.5, customBasePrice - penalty);

  return price;
}

/**
 * Calculates current pricing for both product lines
 */
export function getCurrentPricing(strategy: Strategy, avgCustomDeliveryTime: number): PricingResult {
  return {
    standardPrice: strategy.standardPrice,
    customPrice: calculateCustomPrice(strategy, avgCustomDeliveryTime),
    avgDeliveryTime: avgCustomDeliveryTime,
  };
}

/**
 * Processes sales and generates revenue from finished goods
 * Assumes all finished goods are sold immediately (simplified model)
 */
export function processSales(state: SimulationState, strategy: Strategy, avgCustomDeliveryTime: number): SalesResult {
  const standardUnitsSold = state.finishedGoods.standard;
  const customOrdersSold = state.finishedGoods.custom;

  // Calculate revenue
  const standardRevenue = standardUnitsSold * strategy.standardPrice;
  const customPrice = calculateCustomPrice(strategy, avgCustomDeliveryTime);
  const customRevenue = customOrdersSold * customPrice;
  const totalRevenue = standardRevenue + customRevenue;

  // Add revenue to cash
  if (standardRevenue > 0) {
    addRevenue(state, standardRevenue, 'Standard Product Sales');
  }
  if (customRevenue > 0) {
    addRevenue(state, customRevenue, 'Custom Product Sales');
  }

  // Clear finished goods (sold)
  state.finishedGoods.standard = 0;
  state.finishedGoods.custom = 0;

  return {
    standardUnitsSold,
    customOrdersSold,
    standardRevenue,
    customRevenue,
    totalRevenue,
  };
}

/**
 * Calculates projected revenue for planning purposes
 */
export function projectRevenue(
  strategy: Strategy,
  projectedStandardUnits: number,
  projectedCustomOrders: number,
  avgDeliveryTime: number
): number {
  const standardRevenue = projectedStandardUnits * strategy.standardPrice;
  const customPrice = calculateCustomPrice(strategy, avgDeliveryTime);
  const customRevenue = projectedCustomOrders * customPrice;

  return standardRevenue + customRevenue;
}

/**
 * Analyzes pricing effectiveness
 */
export function analyzePricingEffectiveness(
  state: SimulationState,
  strategy: Strategy
): {
  standardPricePerUnit: number;
  customPricePerUnit: number;
  customPricingEfficiency: number;
  revenueOptimizationScore: number;
} {
  // Get average custom delivery time from history
  const recentDeliveryTimes = state.history.dailyCustomDeliveryTime.slice(-30);
  const avgDeliveryTime =
    recentDeliveryTimes.length > 0
      ? recentDeliveryTimes.reduce((sum, item) => sum + item.value, 0) / recentDeliveryTimes.length
      : strategy.customTargetDeliveryDays;

  const customPrice = calculateCustomPrice(strategy, avgDeliveryTime);

  // Calculate pricing efficiency (how close to base price)
  const customPricingEfficiency = customPrice / strategy.customBasePrice;

  // Calculate revenue optimization score (weighted by volumes)
  const recentStandardProduction = state.history.dailyStandardProduction.slice(-30);
  const recentCustomProduction = state.history.dailyCustomProduction.slice(-30);

  const avgStandardProduction =
    recentStandardProduction.length > 0
      ? recentStandardProduction.reduce((sum, item) => sum + item.value, 0) / recentStandardProduction.length
      : 0;

  const avgCustomProduction =
    recentCustomProduction.length > 0
      ? recentCustomProduction.reduce((sum, item) => sum + item.value, 0) / recentCustomProduction.length
      : 0;

  const totalProduction = avgStandardProduction + avgCustomProduction;
  const revenueOptimizationScore =
    totalProduction > 0
      ? ((avgStandardProduction * strategy.standardPrice + avgCustomProduction * customPrice) / totalProduction) /
        strategy.customBasePrice
      : 0;

  return {
    standardPricePerUnit: strategy.standardPrice,
    customPricePerUnit: customPrice,
    customPricingEfficiency,
    revenueOptimizationScore,
  };
}
