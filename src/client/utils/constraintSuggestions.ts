/**
 * Constraint Suggestion System
 * Generates intelligent optimizer constraint suggestions based on bottleneck analysis
 *
 * CRITICAL: Uses DEMAND-based calculations (not production-based) to avoid circular logic
 */

import type { SimulationResult } from '../types/ui.types';
import type { BottleneckAnalysis, BottleneckMetrics } from './bottleneckAnalysis';
import { getDemandForDay } from '../../simulation/demandModule';

// ============================================================================
// TYPES
// ============================================================================

export interface ConstraintSuggestion {
  id: string;
  stationSource: string; // Which bottleneck generated this suggestion
  constraintType: 'minReorderPoint' | 'minOrderQuantity' | 'minWorkers' | 'minMachines';
  parameter?: string; // 'MCE' | 'WMA' | 'PUC' for machines
  currentValue: number;
  suggestedValue: number;
  reason: string; // Short description
  rationale: string; // Detailed explanation
  priority: 'high' | 'medium' | 'low';
  category: 'Inventory' | 'Workforce' | 'Equipment';
}

export interface ConstraintSuggestionSet {
  suggestions: ConstraintSuggestion[];
  generatedFrom: 'bottleneck-analysis';
  timestamp: number;
}

// ============================================================================
// DEMAND CALCULATION HELPERS
// ============================================================================

/**
 * Calculate average demand over a time period
 * CRITICAL: Uses getDemandForDay (independent variable), NOT actual production
 */
function calculateAverageDemand(
  strategy: SimulationResult['strategy'],
  productType: 'standard' | 'custom',
  startDay: number,
  endDay: number
): number {
  let totalDemand = 0;
  let days = 0;

  for (let day = startDay; day <= endDay; day++) {
    const demand = getDemandForDay(day, strategy);
    totalDemand += productType === 'standard' ? demand.standard : demand.custom;
    days++;
  }

  return totalDemand / days;
}

/**
 * Calculate total daily material consumption based on DEMAND (not production)
 */
function calculateDailyMaterialConsumption(
  avgStandardDemand: number,
  avgCustomDemand: number
): number {
  // Standard products use 2 raw materials, Custom uses 1
  return (avgStandardDemand * 2) + (avgCustomDemand * 1);
}

// ============================================================================
// SUGGESTION GENERATORS BY BOTTLENECK TYPE
// ============================================================================

/**
 * Generate suggestions for Raw Materials shortage
 */
function generateRawMaterialSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const suggestions: ConstraintSuggestion[] = [];
  const { strategy } = simulationResult;

  // Calculate demand-based consumption (NOT production-based!)
  const avgStandardDemand = calculateAverageDemand(strategy, 'standard', 51, 415);
  const avgCustomDemand = calculateAverageDemand(strategy, 'custom', 51, 415);
  const dailyConsumption = calculateDailyMaterialConsumption(avgStandardDemand, avgCustomDemand);

  // Suggest minimum reorder point: 7 days of demand
  const suggestedReorderPoint = Math.ceil(dailyConsumption * 7);
  suggestions.push({
    id: `reorder-point-${Date.now()}`,
    stationSource: 'Raw Materials',
    constraintType: 'minReorderPoint',
    currentValue: strategy.reorderPoint || 0,
    suggestedValue: suggestedReorderPoint,
    reason: 'Prevent stockouts based on market demand',
    rationale: `Market demand requires ${dailyConsumption.toFixed(1)} parts/day. 7-day buffer = ${suggestedReorderPoint} parts minimum reorder point.`,
    priority: metric.severity === 'critical' ? 'high' : 'medium',
    category: 'Inventory',
  });

  // Suggest minimum order quantity: 10 days of demand
  const suggestedOrderQuantity = Math.ceil(dailyConsumption * 10);
  suggestions.push({
    id: `order-quantity-${Date.now()}`,
    stationSource: 'Raw Materials',
    constraintType: 'minOrderQuantity',
    currentValue: strategy.orderQuantity || 0,
    suggestedValue: suggestedOrderQuantity,
    reason: 'Maintain adequate inventory levels',
    rationale: `Market demand requires ${dailyConsumption.toFixed(1)} parts/day. 10-day supply = ${suggestedOrderQuantity} parts minimum per order.`,
    priority: metric.severity === 'critical' ? 'high' : 'medium',
    category: 'Inventory',
  });

  return suggestions;
}

/**
 * Generate suggestions for ARCP Workforce bottleneck
 */
function generateARCPWorkforceSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const { strategy, state } = simulationResult;
  const finalDayIndex = state.history.dailyCash.length - 1;
  const currentExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const currentRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;
  const currentTotal = currentExperts + currentRookies;

  // Calculate demand-based capacity needs (NOT production-based!)
  const avgStandardDemand = calculateAverageDemand(strategy, 'standard', 51, 415);
  const avgCustomDemand = calculateAverageDemand(strategy, 'custom', 51, 415);
  const totalDemand = avgStandardDemand + avgCustomDemand;

  // Each expert can process 3 units/day, rookies 1.2 units/day
  // Add 20% buffer for variability
  const neededCapacity = totalDemand * 1.2;
  const neededWorkers = Math.ceil(neededCapacity / 3); // Assume hiring experts or fully trained rookies

  if (neededWorkers > currentTotal) {
    return [{
      id: `min-workers-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      constraintType: 'minWorkers',
      currentValue: currentTotal,
      suggestedValue: neededWorkers,
      reason: 'Match ARCP capacity to market demand',
      rationale: `Market demand: ${totalDemand.toFixed(1)} units/day requires ${neededCapacity.toFixed(1)} capacity. Need minimum ${neededWorkers} workers.`,
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Workforce',
    }];
  }

  return [];
}

/**
 * Generate suggestions for Custom Line WIP (WMA capacity)
 */
function generateCustomLineWMASuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const { strategy, state } = simulationResult;
  const currentWmaMachines = state.machines.WMA || 1;

  // Calculate demand-based WMA needs
  const avgCustomDemand = calculateAverageDemand(strategy, 'custom', 51, 415);

  // Each WMA processes 6 units/day, custom orders pass through twice
  // So effective capacity per WMA for custom = 6/2 = 3 orders/day
  const wmaCapacityPerMachine = 3;
  const neededWmaMachines = Math.ceil((avgCustomDemand / wmaCapacityPerMachine) * 1.2); // 20% buffer

  if (neededWmaMachines > currentWmaMachines) {
    return [{
      id: `min-wma-${Date.now()}`,
      stationSource: 'Custom Line',
      constraintType: 'minMachines',
      parameter: 'WMA',
      currentValue: currentWmaMachines,
      suggestedValue: Math.max(2, neededWmaMachines),
      reason: 'Reduce custom line congestion',
      rationale: `Market custom demand: ${avgCustomDemand.toFixed(1)} orders/day. Each WMA adds 3 orders/day effective capacity (6 units/day ÷ 2 passes). Suggest minimum ${neededWmaMachines} machines.`,
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Equipment',
    }];
  }

  return [];
}

// ============================================================================
// MAIN SUGGESTION GENERATOR
// ============================================================================

/**
 * Generate all constraint suggestions based on bottleneck analysis
 *
 * This is the main entry point - analyzes all bottlenecks and generates suggestions
 */
export function generateConstraintSuggestions(
  bottleneckAnalysis: BottleneckAnalysis,
  simulationResult: SimulationResult
): ConstraintSuggestionSet {
  const allSuggestions: ConstraintSuggestion[] = [];

  // Generate suggestions for each bottleneck
  bottleneckAnalysis.metrics.forEach(metric => {
    let suggestions: ConstraintSuggestion[] = [];

    switch (metric.station) {
      case 'Raw Materials':
        suggestions = generateRawMaterialSuggestions(metric, simulationResult);
        break;

      case 'ARCP Workforce':
        suggestions = generateARCPWorkforceSuggestions(metric, simulationResult);
        break;

      case 'Custom Line':
        suggestions = generateCustomLineWMASuggestions(metric, simulationResult);
        break;

      // Standard Line WIP is typically resolved by other fixes (ARCP, allocation)
      // so we don't generate direct suggestions for it
      default:
        break;
    }

    allSuggestions.push(...suggestions);
  });

  return {
    suggestions: allSuggestions,
    generatedFrom: 'bottleneck-analysis',
    timestamp: Date.now(),
  };
}
