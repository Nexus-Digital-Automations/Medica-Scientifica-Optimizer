/**
 * Constraint Suggestion System
 * Generates optimizer constraint suggestions based on bottleneck analysis
 * Simply uses current values as min/max to steer the optimizer in the right direction
 */

import type { SimulationResult } from '../types/ui.types';
import type { BottleneckAnalysis, BottleneckMetrics } from './bottleneckAnalysis';

// ============================================================================
// TYPES
// ============================================================================

export interface ConstraintSuggestion {
  id: string;
  stationSource: string;
  constraintType: 'minReorderPoint' | 'minOrderQuantity' | 'minWorkers' | 'minMachines' | 'maxReorderPoint' | 'maxOrderQuantity' | 'maxWorkers' | 'maxMachines';
  parameter?: string; // 'MCE' | 'WMA' | 'PUC' for machines
  currentValue: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'Inventory' | 'Workforce' | 'Equipment';
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
 * Generate suggestions for Raw Materials bottleneck or excess
 * Shortage = set current as minimum, Excess = set current as maximum
 */
function generateRawMaterialSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];
  const { strategy } = simulationResult;

  // Shortage (critical/warning) = set current as minimum (optimizer should go higher)
  if (metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `reorder-point-${Date.now()}`,
      stationSource: 'Raw Materials',
      constraintType: 'minReorderPoint',
      currentValue: strategy.reorderPoint || 0,
      reason: 'Prevent stockouts - current level as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `order-quantity-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      constraintType: 'minOrderQuantity',
      currentValue: strategy.orderQuantity || 0,
      reason: 'Maintain inventory - current level as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });
  }

  // Excess inventory (avgInventory > 200, which is 2x warning threshold)
  // Use averageWIP field which holds avgInventory for this metric
  if (metric.severity === 'optimal' && metric.averageWIP > 200) {
    suggestions.push({
      id: `max-reorder-point-${Date.now()}`,
      stationSource: 'Raw Materials',
      constraintType: 'maxReorderPoint',
      currentValue: strategy.reorderPoint || 0,
      reason: 'Reduce excess inventory - current level as maximum',
      priority: 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `max-order-quantity-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      constraintType: 'maxOrderQuantity',
      currentValue: strategy.orderQuantity || 0,
      reason: 'Free up cash - current level as maximum',
      priority: 'medium',
      category: 'Inventory',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for ARCP Workforce bottleneck or excess
 * Shortage = set current as minimum, Excess = set current as maximum
 */
function generateARCPWorkforceSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const { state } = simulationResult;
  const finalDayIndex = state.history.dailyCash.length - 1;
  const currentExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const currentRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;
  const currentTotal = currentExperts + currentRookies;

  const suggestions: ConstraintSuggestion[] = [];

  // Shortage (critical/warning) = set current as minimum (optimizer should add more)
  if (metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `min-workers-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      constraintType: 'minWorkers',
      currentValue: currentTotal,
      reason: 'Reduce ARCP congestion - current workforce as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Workforce',
    });
  }

  // Excess capacity (avgCapacity > 60, which is 3x optimal threshold of 20)
  // Use averageWIP field which holds avgCapacity for this metric
  if (metric.severity === 'optimal' && metric.averageWIP > 60) {
    suggestions.push({
      id: `max-workers-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      constraintType: 'maxWorkers',
      currentValue: currentTotal,
      reason: 'Reduce labor costs - current workforce as maximum',
      priority: 'medium',
      category: 'Workforce',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for Custom Line WIP (WMA capacity)
 * High WIP = set current machines as minimum, Low WIP = set current as maximum
 */
function generateCustomLineWMASuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  const { state } = simulationResult;
  const currentWmaMachines = state.machines.WMA || 1;
  const suggestions: ConstraintSuggestion[] = [];

  // High WIP (critical/warning) = set current as minimum (optimizer should add more machines)
  if (metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `min-wma-${Date.now()}`,
      stationSource: 'Custom Line',
      constraintType: 'minMachines',
      parameter: 'WMA',
      currentValue: currentWmaMachines,
      reason: 'Reduce custom line congestion - current WMA count as minimum',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Equipment',
    });
  }

  // Excess capacity (avgWIP < 10 with optimal severity = very low WIP, too many machines)
  if (metric.severity === 'optimal' && metric.averageWIP < 10) {
    suggestions.push({
      id: `max-wma-${Date.now()}`,
      stationSource: 'Custom Line',
      constraintType: 'maxMachines',
      parameter: 'WMA',
      currentValue: currentWmaMachines,
      reason: 'Reduce capital costs - current WMA count as maximum',
      priority: 'medium',
      category: 'Equipment',
    });
  }

  return suggestions;
}

// ============================================================================
// MAIN SUGGESTION GENERATOR
// ============================================================================

/**
 * Generate all constraint suggestions based on bottleneck analysis
 * Simply uses current values as min/max constraints to steer optimizer
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
