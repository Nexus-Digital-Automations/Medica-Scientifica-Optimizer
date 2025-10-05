import type { Strategy, StrategyAction } from '../../simulation/types';
import type { Recommendation } from './recommendationEngine';

/**
 * Apply selected recommendations to a strategy by extracting and executing their actions
 *
 * @param baseStrategy - The current strategy to modify
 * @param selectedRecommendations - Array of recommendations to apply
 * @returns A new strategy object with the applied changes
 */
export function applyRecommendations(
  baseStrategy: Strategy,
  selectedRecommendations: Recommendation[]
): Strategy {
  // Clone the base strategy to avoid mutations
  const newStrategy: Strategy = JSON.parse(JSON.stringify(baseStrategy));

  // Extract all actions from selected recommendations
  const allActions = selectedRecommendations.flatMap(rec => rec.actions);

  // Group actions by type for efficient processing
  const actionsByType = new Map<string, typeof allActions>();
  allActions.forEach(action => {
    const existing = actionsByType.get(action.type) || [];
    actionsByType.set(action.type, [...existing, action]);
  });

  // Process each action type
  actionsByType.forEach((actions, type) => {
    switch (type) {
      case 'hire_rookie': {
        // Sum all rookie hiring actions
        const totalRookies = actions.reduce((sum, action) =>
          sum + (action.targetValue - action.currentValue), 0
        );
        if (totalRookies > 0) {
          const day = actions[0].day || 51;
          newStrategy.timedActions.push({
            day,
            type: 'HIRE_ROOKIE',
            count: Math.round(totalRookies),
          });
        }
        break;
      }

      case 'purchase_machine': {
        // Group by machine parameter
        const machinesByParam = new Map<string, typeof actions>();
        actions.forEach(action => {
          const existing = machinesByParam.get(action.parameter) || [];
          machinesByParam.set(action.parameter, [...existing, action]);
        });

        machinesByParam.forEach((machineActions, param) => {
          const totalMachines = machineActions.reduce((sum, action) =>
            sum + (action.targetValue - action.currentValue), 0
          );
          if (totalMachines > 0) {
            const day = machineActions[0].day || 51;
            // Map parameter to machine type
            const machineTypeMap: Record<string, 'MCE' | 'WMA' | 'PUC'> = {
              mceMachines: 'MCE',
              wmaMachines: 'WMA',
              pucMachines: 'PUC',
            };
            const machineType = machineTypeMap[param] || 'WMA';

            newStrategy.timedActions.push({
              day,
              type: 'BUY_MACHINE',
              machineType,
              count: Math.round(totalMachines),
            });
          }
        });
        break;
      }

      case 'adjust_inventory': {
        // Apply inventory adjustments to static genes
        actions.forEach(action => {
          if (action.parameter === 'reorderPoint') {
            newStrategy.reorderPoint = action.targetValue;
          } else if (action.parameter === 'orderQuantity') {
            newStrategy.orderQuantity = action.targetValue;
          }
        });
        break;
      }

      case 'adjust_pricing': {
        // Apply pricing adjustments
        actions.forEach(action => {
          const day = action.day || 51;
          if (action.parameter === 'standardPrice') {
            newStrategy.timedActions.push({
              day,
              type: 'ADJUST_PRICE',
              productType: 'standard',
              newPrice: action.targetValue,
            });
          } else if (action.parameter === 'customBasePrice') {
            newStrategy.timedActions.push({
              day,
              type: 'ADJUST_PRICE',
              productType: 'custom',
              newPrice: action.targetValue,
            });
          }
        });
        break;
      }

      case 'adjust_allocation': {
        // Apply MCE allocation adjustments
        actions.forEach(action => {
          if (action.parameter === 'mceAllocationCustom') {
            const day = action.day || 51;
            newStrategy.timedActions.push({
              day,
              type: 'ADJUST_MCE_ALLOCATION',
              newAllocation: action.targetValue,
            });
          }
        });
        break;
      }

      case 'adjust_batch_size': {
        // Apply batch size adjustments
        actions.forEach(action => {
          if (action.parameter === 'standardBatchSize') {
            const day = action.day || 51;
            newStrategy.timedActions.push({
              day,
              type: 'ADJUST_BATCH_SIZE',
              newSize: Math.round(action.targetValue),
            });
          }
        });
        break;
      }
    }
  });

  // Sort timed actions by day to maintain chronological order
  newStrategy.timedActions.sort((a, b) => a.day - b.day);

  // Remove duplicate actions (same type and day)
  const uniqueActions: StrategyAction[] = [];
  const actionKeys = new Set<string>();

  newStrategy.timedActions.forEach(action => {
    const key = `${action.day}-${action.type}-${JSON.stringify(action)}`;
    if (!actionKeys.has(key)) {
      actionKeys.add(key);
      uniqueActions.push(action);
    }
  });

  newStrategy.timedActions = uniqueActions;

  return newStrategy;
}
