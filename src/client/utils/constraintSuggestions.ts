/**
 * Constraint Suggestion System
 * Generates optimizer constraint suggestions based on flow analysis (trends)
 * Uses current values as min/max to steer the optimizer in the right direction
 * Detection is smart (trend-based), constraint values are simple (current value)
 */

import type { SimulationResult } from '../types/ui.types';
import type { BottleneckAnalysis, BottleneckMetrics } from './bottleneckAnalysis';

// ============================================================================
// TYPES
// ============================================================================

export interface ConstraintSuggestion {
  id: string;
  stationSource: string;
  constraintType: 'minReorderPoint' | 'minOrderQuantity' | 'minStandardBatchSize' | 'minMCEAllocationCustom' | 'minDailyOvertimeHours' | 'maxReorderPoint' | 'maxOrderQuantity' | 'maxStandardBatchSize' | 'maxMCEAllocationCustom' | 'maxDailyOvertimeHours';
  parameter?: string; // For future use
  currentValue: number;
  flowRate: number; // Units/day change rate (for display)
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'Inventory' | 'Production' | 'Workforce';
}

export interface ConstraintSuggestionSet {
  suggestions: ConstraintSuggestion[];
  generatedFrom: 'bottleneck-analysis';
  timestamp: number;
}

// ============================================================================
// SUGGESTION GENERATORS BY BOTTLENECK TYPE
// ============================================================================

/**
 * Generate suggestions for Raw Materials based on inventory flow
 * Decreasing trend = shortage, Increasing trend + high level = surplus
 */
function generateRawMaterialSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];
  const { strategy } = simulationResult;

  // SHORTAGE: Decreasing inventory trend OR low inventory (critical/warning)
  if (metric.trend === 'decreasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `reorder-point-${Date.now()}`,
      stationSource: 'Raw Materials',
      constraintType: 'minReorderPoint',
      currentValue: strategy.reorderPoint || 0,
      flowRate: metric.flowRate,
      reason: metric.trend === 'decreasing'
        ? 'Inventory depleting - set current as minimum'
        : 'Low inventory level - set current as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `order-quantity-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      constraintType: 'minOrderQuantity',
      currentValue: strategy.orderQuantity || 0,
      flowRate: metric.flowRate,
      reason: metric.trend === 'decreasing'
        ? 'Inventory depleting - set current as minimum'
        : 'Low inventory level - set current as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });
  }

  // SURPLUS: Increasing trend AND high inventory (optimal + high avgWIP)
  if (metric.trend === 'increasing' && metric.severity === 'optimal' && metric.averageWIP > 200) {
    suggestions.push({
      id: `max-reorder-point-${Date.now()}`,
      stationSource: 'Raw Materials',
      constraintType: 'maxReorderPoint',
      currentValue: strategy.reorderPoint || 0,
      flowRate: metric.flowRate,
      reason: 'Inventory accumulating - set current as maximum',
      priority: 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `max-order-quantity-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      constraintType: 'maxOrderQuantity',
      currentValue: strategy.orderQuantity || 0,
      flowRate: metric.flowRate,
      reason: 'Excess inventory tying up cash - set current as maximum',
      priority: 'medium',
      category: 'Inventory',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for ARCP Workforce based on capacity
 * Low capacity = need overtime, High capacity = reduce overtime
 */
function generateARCPWorkforceSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const { strategy } = simulationResult;
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Low ARCP capacity (critical/warning)
  if (metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `min-overtime-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      constraintType: 'minDailyOvertimeHours',
      currentValue: strategy.dailyOvertimeHours || 0,
      flowRate: metric.flowRate,
      reason: 'Insufficient ARCP capacity - set current overtime as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Workforce',
    });
  }

  // SURPLUS: High ARCP capacity (optimal + high avgCapacity)
  if (metric.severity === 'optimal' && metric.averageWIP > 60) {
    suggestions.push({
      id: `max-overtime-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      constraintType: 'maxDailyOvertimeHours',
      currentValue: strategy.dailyOvertimeHours || 0,
      flowRate: metric.flowRate,
      reason: 'Excess ARCP capacity - reduce overtime costs',
      priority: 'medium',
      category: 'Workforce',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for Custom Line based on WIP flow
 * Increasing WIP = need more MCE, Decreasing WIP + low level = too much MCE on custom
 */
function generateCustomLineSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const { strategy } = simulationResult;
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Increasing Custom WIP (critical/warning)
  if (metric.trend === 'increasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `min-mce-allocation-${Date.now()}`,
      stationSource: 'Custom Line',
      constraintType: 'minMCEAllocationCustom',
      currentValue: strategy.mceAllocationCustom || 0,
      flowRate: metric.flowRate,
      reason: metric.trend === 'increasing'
        ? 'Custom orders backing up - set current MCE allocation as minimum'
        : 'High custom WIP - set current MCE allocation as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Production',
    });
  }

  // SURPLUS: Decreasing WIP + low avgWIP (optimal + low WIP = starving standard line)
  if (metric.trend === 'decreasing' && metric.severity === 'optimal' && metric.averageWIP < 10) {
    suggestions.push({
      id: `max-mce-allocation-${Date.now()}`,
      stationSource: 'Custom Line',
      constraintType: 'maxMCEAllocationCustom',
      currentValue: strategy.mceAllocationCustom || 0,
      flowRate: metric.flowRate,
      reason: 'Low custom demand - reallocate MCE to standard line',
      priority: 'medium',
      category: 'Production',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for Standard Line based on WIP flow
 * Increasing WIP = batches too large (slowing throughput), Decreasing WIP + low = batches too small
 */
function generateStandardLineSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const { strategy } = simulationResult;
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Increasing Standard WIP (critical/warning) = batches too large
  if (metric.trend === 'increasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `max-batch-size-${Date.now()}`,
      stationSource: 'Standard Line',
      constraintType: 'maxStandardBatchSize',
      currentValue: strategy.standardBatchSize || 0,
      flowRate: metric.flowRate,
      reason: metric.trend === 'increasing'
        ? 'Queue building up - batches too large, reduce batch size'
        : 'High WIP - set current batch size as maximum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Production',
    });
  }

  // SURPLUS: Decreasing WIP + low avgWIP (optimal + low WIP = batches too small)
  if (metric.trend === 'decreasing' && metric.severity === 'optimal' && metric.averageWIP < 20) {
    suggestions.push({
      id: `min-batch-size-${Date.now()}`,
      stationSource: 'Standard Line',
      constraintType: 'minStandardBatchSize',
      currentValue: strategy.standardBatchSize || 0,
      flowRate: metric.flowRate,
      reason: 'Empty queue - batches too small, increase for efficiency',
      priority: 'medium',
      category: 'Production',
    });
  }

  return suggestions;
}

// ============================================================================
// MAIN SUGGESTION GENERATOR
// ============================================================================

/**
 * Generate all constraint suggestions based on flow analysis
 * Uses trend-based detection, constraint values are always current values
 */
export function generateConstraintSuggestions(
  bottleneckAnalysis: BottleneckAnalysis,
  simulationResult: SimulationResult
): ConstraintSuggestionSet {
  const allSuggestions: ConstraintSuggestion[] = [];

  // Generate suggestions for each station based on flow dynamics
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
        suggestions = generateCustomLineSuggestions(metric, simulationResult);
        break;

      case 'Standard Line':
        suggestions = generateStandardLineSuggestions(metric, simulationResult);
        break;

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
