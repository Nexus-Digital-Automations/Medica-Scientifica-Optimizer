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
  constraintType: 'minReorderPoint' | 'minOrderQuantity' | 'minWorkers' | 'minMachines' | 'maxReorderPoint' | 'maxOrderQuantity';
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
 * Generate suggestions for Raw Materials bottleneck
 * If there's a shortage, set current values as minimums
 */
function generateRawMaterialSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const suggestions: ConstraintSuggestion[] = [];
  const { strategy } = simulationResult;

  // Shortage = set current as minimum (optimizer should go higher)
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

  return suggestions;
}

/**
 * Generate suggestions for ARCP Workforce bottleneck
 * If there's congestion, set current workforce as minimum
 */
function generateARCPWorkforceSuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const { state } = simulationResult;
  const finalDayIndex = state.history.dailyCash.length - 1;
  const currentExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const currentRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;
  const currentTotal = currentExperts + currentRookies;

  // Set current workforce as minimum (optimizer should add more)
  return [{
    id: `min-workers-${Date.now()}`,
    stationSource: 'ARCP Workforce',
    constraintType: 'minWorkers',
    currentValue: currentTotal,
    reason: 'Reduce ARCP congestion - current workforce as minimum',
    priority: metric.severity === 'critical' ? 'high' : 'medium',
    category: 'Workforce',
  }];
}

/**
 * Generate suggestions for Custom Line WIP (WMA capacity)
 */
function generateCustomLineWMASuggestions(
  metric: BottleneckMetrics,
  simulationResult: SimulationResult
): ConstraintSuggestion[] {
  if (metric.severity === 'optimal') return [];

  const { state } = simulationResult;
  const currentWmaMachines = state.machines.WMA || 1;

  // Set current machines as minimum (optimizer should add more)
  return [{
    id: `min-wma-${Date.now()}`,
    stationSource: 'Custom Line',
    constraintType: 'minMachines',
    parameter: 'WMA',
    currentValue: currentWmaMachines,
    reason: 'Reduce custom line congestion - current WMA count as minimum',
    priority: metric.severity === 'critical' ? 'high' : 'medium',
    category: 'Equipment',
  }];
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
