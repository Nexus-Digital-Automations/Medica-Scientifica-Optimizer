/**
 * Constraint Suggestion System
 * Recommends toggling optimizer lock states to min/max based on bottleneck analysis
 * No calculations - just simple toggle recommendations for the optimizer
 */

import type { BottleneckAnalysis, BottleneckMetrics } from './bottleneckAnalysis';

// ============================================================================
// TYPES
// ============================================================================

export type LockStateToggle = 'minimum' | 'maximum';

export type PolicyParameter = 'reorderPoint' | 'orderQuantity' | 'standardBatchSize' | 'mceAllocationCustom' | 'dailyOvertimeHours' | 'standardPrice';

export interface ConstraintSuggestion {
  id: string;
  stationSource: string;
  parameter: PolicyParameter | 'workforce' | 'MCE' | 'WMA' | 'PUC';
  toggle: LockStateToggle; // 'minimum' or 'maximum'
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'Inventory' | 'Production' | 'Workforce' | 'Machines';
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
 * Decreasing trend = shortage → toggle minimum, Increasing trend + high = surplus → toggle maximum
 */
function generateRawMaterialSuggestions(
  metric: BottleneckMetrics
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Decreasing inventory trend OR low inventory (critical/warning) → MINIMUM
  if (metric.trend === 'decreasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `reorder-point-min-${Date.now()}`,
      stationSource: 'Raw Materials',
      parameter: 'reorderPoint',
      toggle: 'minimum',
      reason: 'Material shortage detected - prevent stockouts',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `order-quantity-min-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      parameter: 'orderQuantity',
      toggle: 'minimum',
      reason: 'Increase order quantities to maintain flow',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Inventory',
    });
  }

  // SURPLUS: Increasing trend AND high inventory (optimal + high avgWIP) → MAXIMUM
  if (metric.trend === 'increasing' && metric.severity === 'optimal' && metric.averageWIP > 200) {
    suggestions.push({
      id: `reorder-point-max-${Date.now()}`,
      stationSource: 'Raw Materials',
      parameter: 'reorderPoint',
      toggle: 'maximum',
      reason: 'Excess inventory accumulating - reduce to free cash',
      priority: 'medium',
      category: 'Inventory',
    });

    suggestions.push({
      id: `order-quantity-max-${Date.now() + 1}`,
      stationSource: 'Raw Materials',
      parameter: 'orderQuantity',
      toggle: 'maximum',
      reason: 'Reduce order quantities to prevent cash tie-up',
      priority: 'medium',
      category: 'Inventory',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for ARCP Workforce based on capacity
 * Low capacity → toggle minimum, High capacity → toggle maximum
 */
function generateARCPWorkforceSuggestions(
  metric: BottleneckMetrics
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Low ARCP capacity (critical/warning) → MINIMUM
  if (metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `workforce-min-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      parameter: 'workforce',
      toggle: 'minimum',
      reason: 'Labor bottleneck detected - increase workforce',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Workforce',
    });

    suggestions.push({
      id: `overtime-min-${Date.now() + 1}`,
      stationSource: 'ARCP Workforce',
      parameter: 'dailyOvertimeHours',
      toggle: 'minimum',
      reason: 'Insufficient capacity - increase overtime hours',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Workforce',
    });
  }

  // SURPLUS: High ARCP capacity (optimal + high avgCapacity) → MAXIMUM
  if (metric.severity === 'optimal' && metric.averageWIP > 60) {
    suggestions.push({
      id: `workforce-max-${Date.now()}`,
      stationSource: 'ARCP Workforce',
      parameter: 'workforce',
      toggle: 'maximum',
      reason: 'Excess labor capacity - reduce workforce costs',
      priority: 'medium',
      category: 'Workforce',
    });

    suggestions.push({
      id: `overtime-max-${Date.now() + 1}`,
      stationSource: 'ARCP Workforce',
      parameter: 'dailyOvertimeHours',
      toggle: 'maximum',
      reason: 'Reduce overtime to cut costs',
      priority: 'medium',
      category: 'Workforce',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for Custom Line based on WIP flow
 * Increasing WIP → toggle minimum, Decreasing WIP + low → toggle maximum
 */
function generateCustomLineSuggestions(
  metric: BottleneckMetrics
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Increasing Custom WIP (critical/warning) → MINIMUM
  if (metric.trend === 'increasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `mce-allocation-min-${Date.now()}`,
      stationSource: 'Custom Line',
      parameter: 'mceAllocationCustom',
      toggle: 'minimum',
      reason: 'Custom orders backing up - allocate more MCE capacity',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Production',
    });

    suggestions.push({
      id: `wma-machine-min-${Date.now() + 1}`,
      stationSource: 'Custom Line',
      parameter: 'WMA',
      toggle: 'minimum',
      reason: 'Increase WMA machines to improve custom line throughput',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Machines',
    });
  }

  // SURPLUS: Decreasing WIP + low avgWIP (optimal + low WIP = starving standard line) → MAXIMUM
  if (metric.trend === 'decreasing' && metric.severity === 'optimal' && metric.averageWIP < 10) {
    suggestions.push({
      id: `mce-allocation-max-${Date.now()}`,
      stationSource: 'Custom Line',
      parameter: 'mceAllocationCustom',
      toggle: 'maximum',
      reason: 'Low custom demand - reduce MCE allocation to custom line',
      priority: 'medium',
      category: 'Production',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for Standard Line based on WIP flow
 * Increasing WIP → toggle maximum (batches too large), Decreasing WIP + low → toggle minimum
 */
function generateStandardLineSuggestions(
  metric: BottleneckMetrics
): ConstraintSuggestion[] {
  const suggestions: ConstraintSuggestion[] = [];

  // SHORTAGE: Increasing Standard WIP (critical/warning) → MAXIMUM (reduce batch size)
  if (metric.trend === 'increasing' || metric.severity === 'critical' || metric.severity === 'warning') {
    suggestions.push({
      id: `batch-size-max-${Date.now()}`,
      stationSource: 'Standard Line',
      parameter: 'standardBatchSize',
      toggle: 'maximum',
      reason: 'Queue building up - reduce batch size for faster flow',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Production',
    });

    suggestions.push({
      id: `puc-machine-min-${Date.now() + 1}`,
      stationSource: 'Standard Line',
      parameter: 'PUC',
      toggle: 'minimum',
      reason: 'Increase PUC machines to improve batching capacity',
      priority: metric.severity === 'critical' ? 'high' : 'medium',
      category: 'Machines',
    });
  }

  // SURPLUS: Decreasing WIP + low avgWIP (optimal + low WIP = batches too small) → MINIMUM
  if (metric.trend === 'decreasing' && metric.severity === 'optimal' && metric.averageWIP < 20) {
    suggestions.push({
      id: `batch-size-min-${Date.now()}`,
      stationSource: 'Standard Line',
      parameter: 'standardBatchSize',
      toggle: 'minimum',
      reason: 'Low queue - increase batch size for efficiency gains',
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
  bottleneckAnalysis: BottleneckAnalysis
): ConstraintSuggestionSet {
  const allSuggestions: ConstraintSuggestion[] = [];

  // Generate suggestions for each station based on flow dynamics
  bottleneckAnalysis.metrics.forEach(metric => {
    let suggestions: ConstraintSuggestion[] = [];

    switch (metric.station) {
      case 'Raw Materials':
        suggestions = generateRawMaterialSuggestions(metric);
        break;

      case 'ARCP Workforce':
        suggestions = generateARCPWorkforceSuggestions(metric);
        break;

      case 'Custom Line':
        suggestions = generateCustomLineSuggestions(metric);
        break;

      case 'Standard Line':
        suggestions = generateStandardLineSuggestions(metric);
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
