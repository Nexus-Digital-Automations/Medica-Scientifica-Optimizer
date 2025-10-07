/**
 * Strategy Converter: Analytical → Timed Actions
 *
 * Converts analytical strategy (EOQ, target machines, hiring schedule, prices)
 * into concrete timed actions that the simulator can execute.
 */

import type { AnalyticalStrategy } from './analyticalOptimizer.js';
import type { StrategyAction } from '../simulation/types.js';

export interface InitialState {
  machines: { MCE: number; WMA: number; PUC: number };
  workforce: { experts: number; rookies: number };
  cash: number;
  currentDay?: number;
}

/**
 * Convert analytical strategy to timed actions
 */
export function convertAnalyticalToActions(
  analytical: AnalyticalStrategy,
  initialState: InitialState
): StrategyAction[] {
  const actions: StrategyAction[] = [];
  const startDay = initialState.currentDay || 51;

  // 1. Set inventory policy (day 51)
  actions.push({
    day: startDay,
    type: 'SET_ORDER_QUANTITY',
    newOrderQuantity: analytical.inventoryPolicy.orderQuantity
  });

  actions.push({
    day: startDay,
    type: 'SET_REORDER_POINT',
    newReorderPoint: analytical.inventoryPolicy.reorderPoint
  });

  // 2. Machine purchases (spread over time to avoid cash crunch)
  const machineDelta = {
    MCE: analytical.capacityPlan.targetMachines.MCE - initialState.machines.MCE,
    WMA: analytical.capacityPlan.targetMachines.WMA - initialState.machines.WMA,
    PUC: analytical.capacityPlan.targetMachines.PUC - initialState.machines.PUC
  };

  // Buy machines gradually (1 per month)
  Object.entries(machineDelta).forEach(([type, count]) => {
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const purchaseDay = startDay + i * 30; // Spread 30 days apart
        if (purchaseDay < 380) { // Don't buy too close to shutdown
          actions.push({
            day: purchaseDay,
            type: 'BUY_MACHINE',
            machineType: type as 'MCE' | 'WMA' | 'PUC',
            count: 1
          });
        }
      }
    } else if (count < 0) {
      // Sell excess machines
      const sellDay = startDay + 30;
      actions.push({
        day: sellDay,
        type: 'SELL_MACHINE',
        machineType: type as 'MCE' | 'WMA' | 'PUC',
        count: Math.abs(count)
      });
    }
  });

  // 3. Hiring schedule
  analytical.workforcePlan.hiringSchedule.forEach(hire => {
    if (hire.rookies > 0 && hire.day < 380) { // Don't hire too late
      actions.push({
        day: hire.day,
        type: 'HIRE_ROOKIE',
        count: hire.rookies
      });
    }
  });

  // 4. Pricing
  actions.push({
    day: startDay,
    type: 'ADJUST_PRICE',
    productType: 'standard',
    newPrice: analytical.pricingPolicy.standardPrice
  });

  // Note: Custom price and debt management parameters are set at Strategy level,
  // not as timed actions. These come from genes directly.

  return actions.sort((a, b) => a.day - b.day);
}

/**
 * Validate that converted actions won't cause issues
 */
export function validateConvertedActions(
  actions: StrategyAction[],
  _initialState: InitialState
): { valid: boolean; reason?: string } {
  // Check for duplicate actions on same day
  const actionsByDay = new Map<number, StrategyAction[]>();

  for (const action of actions) {
    const dayActions = actionsByDay.get(action.day) || [];
    dayActions.push(action);
    actionsByDay.set(action.day, dayActions);
  }

  // Check for conflicting actions
  for (const [day, dayActions] of actionsByDay.entries()) {
    // Check for duplicate policy settings
    const policyTypes = dayActions.filter(a =>
      a.type === 'SET_ORDER_QUANTITY' ||
      a.type === 'SET_REORDER_POINT' ||
      a.type === 'ADJUST_BATCH_SIZE'
    ).map(a => a.type);

    if (new Set(policyTypes).size !== policyTypes.length) {
      return {
        valid: false,
        reason: `Duplicate policy actions on day ${day}`
      };
    }
  }

  return { valid: true };
}
