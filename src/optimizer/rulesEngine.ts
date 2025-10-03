/**
 * State-Dependent Rules Engine
 * Enables adaptive strategies that respond to simulation state
 */

import type { SimulationState, StrategyAction } from '../simulation/types.js';

/**
 * Rule condition types
 */
export type RuleConditionType =
  | 'CASH_BELOW'          // Trigger when cash < threshold
  | 'CASH_ABOVE'          // Trigger when cash > threshold
  | 'INVENTORY_BELOW'     // Trigger when raw materials < threshold
  | 'INVENTORY_ABOVE'     // Trigger when raw materials > threshold
  | 'BACKLOG_ABOVE'       // Trigger when custom backlog > threshold
  | 'BACKLOG_BELOW'       // Trigger when custom backlog < threshold
  | 'DAY_RANGE'           // Trigger within specific day range
  | 'DEBT_ABOVE'          // Trigger when debt > threshold
  | 'NET_WORTH_BELOW';    // Trigger when net worth < threshold

/**
 * Rule condition definition
 */
export interface RuleCondition {
  type: RuleConditionType;
  threshold?: number;      // Numeric threshold for comparisons
  minDay?: number;         // For DAY_RANGE
  maxDay?: number;         // For DAY_RANGE
}

/**
 * Complete rule definition
 */
export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];  // All conditions must be true (AND logic)
  action: StrategyAction;
  cooldownDays?: number;        // Minimum days between rule triggers (default: 0)
  maxTriggers?: number;         // Maximum times rule can trigger (default: unlimited)
  priority?: number;            // Higher priority rules evaluated first (default: 0)
}

/**
 * Rule execution state tracking
 */
interface RuleExecutionState {
  ruleId: string;
  lastTriggeredDay: number;
  triggerCount: number;
}

/**
 * Rules Engine - Evaluates state-dependent rules and triggers actions
 */
export class RulesEngine {
  private rules: Rule[] = [];
  private executionState: Map<string, RuleExecutionState> = new Map();

  constructor(rules: Rule[] = []) {
    // Sort rules by priority (higher first)
    this.rules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Initialize execution state
    this.rules.forEach(rule => {
      this.executionState.set(rule.id, {
        ruleId: rule.id,
        lastTriggeredDay: -1,
        triggerCount: 0,
      });
    });
  }

  /**
   * Evaluate all rules for current simulation state
   * Returns actions to execute for this day
   */
  evaluateRules(state: SimulationState, currentDay: number): StrategyAction[] {
    const actionsToExecute: StrategyAction[] = [];

    for (const rule of this.rules) {
      const execState = this.executionState.get(rule.id)!;

      // Check cooldown
      if (rule.cooldownDays && currentDay - execState.lastTriggeredDay < rule.cooldownDays) {
        continue;
      }

      // Check max triggers
      if (rule.maxTriggers && execState.triggerCount >= rule.maxTriggers) {
        continue;
      }

      // Evaluate all conditions (AND logic)
      if (this.evaluateConditions(rule.conditions, state, currentDay)) {
        // Rule triggered!
        actionsToExecute.push({ ...rule.action, day: currentDay });

        // Update execution state
        execState.lastTriggeredDay = currentDay;
        execState.triggerCount++;
      }
    }

    return actionsToExecute;
  }

  /**
   * Evaluate rule conditions against current state
   */
  private evaluateConditions(
    conditions: RuleCondition[],
    state: SimulationState,
    currentDay: number
  ): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, state, currentDay));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: RuleCondition,
    state: SimulationState,
    currentDay: number
  ): boolean {
    switch (condition.type) {
      case 'CASH_BELOW':
        return state.cash < (condition.threshold ?? 0);

      case 'CASH_ABOVE':
        return state.cash > (condition.threshold ?? 0);

      case 'INVENTORY_BELOW':
        return state.rawMaterialInventory < (condition.threshold ?? 0);

      case 'INVENTORY_ABOVE':
        return state.rawMaterialInventory > (condition.threshold ?? 0);

      case 'BACKLOG_ABOVE':
        return state.customLineWIP.orders.length > (condition.threshold ?? 0);

      case 'BACKLOG_BELOW':
        return state.customLineWIP.orders.length < (condition.threshold ?? 0);

      case 'DAY_RANGE':
        return currentDay >= (condition.minDay ?? 0) && currentDay <= (condition.maxDay ?? Infinity);

      case 'DEBT_ABOVE':
        return state.debt > (condition.threshold ?? 0);

      case 'NET_WORTH_BELOW': {
        const netWorth = state.cash - state.debt;
        return netWorth < (condition.threshold ?? 0);
      }

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Add new rule at runtime
   */
  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.executionState.set(rule.id, {
      ruleId: rule.id,
      lastTriggeredDay: -1,
      triggerCount: 0,
    });
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.executionState.delete(ruleId);
  }

  /**
   * Get rule execution statistics
   */
  getExecutionStats(): Array<{ ruleId: string; triggerCount: number; lastTriggeredDay: number }> {
    return Array.from(this.executionState.values());
  }

  /**
   * Reset execution state (useful for multi-run optimizations)
   */
  resetExecutionState(): void {
    this.executionState.forEach(state => {
      state.lastTriggeredDay = -1;
      state.triggerCount = 0;
    });
  }
}

/**
 * Example rule definitions for common scenarios
 */
export const EXAMPLE_RULES: Rule[] = [
  {
    id: 'emergency-materials',
    name: 'Emergency Material Order',
    conditions: [
      { type: 'INVENTORY_BELOW', threshold: 100 },
      { type: 'CASH_ABOVE', threshold: 50000 },
    ],
    action: {
      day: 0, // Will be set by rules engine
      type: 'ORDER_MATERIALS',
      quantity: 500,
    },
    cooldownDays: 5,
    priority: 100, // High priority
  },
  {
    id: 'expand-capacity',
    name: 'Expand Capacity When Profitable',
    conditions: [
      { type: 'CASH_ABOVE', threshold: 200000 },
      { type: 'BACKLOG_ABOVE', threshold: 50 },
      { type: 'DAY_RANGE', minDay: 100, maxDay: 300 },
    ],
    action: {
      day: 0,
      type: 'BUY_MACHINE',
      machineType: 'MCE',
      count: 1,
    },
    maxTriggers: 2,
    cooldownDays: 30,
    priority: 50,
  },
  {
    id: 'hire-when-backlog-high',
    name: 'Hire Rookie When Backlog High',
    conditions: [
      { type: 'BACKLOG_ABOVE', threshold: 75 },
      { type: 'CASH_ABOVE', threshold: 100000 },
    ],
    action: {
      day: 0,
      type: 'HIRE_ROOKIE',
      count: 1,
    },
    maxTriggers: 3,
    cooldownDays: 20,
    priority: 75,
  },
  {
    id: 'take-loan-when-cash-low',
    name: 'Take Emergency Loan',
    conditions: [
      { type: 'CASH_BELOW', threshold: 30000 },
      { type: 'DEBT_ABOVE', threshold: 0 }, // Only if we already have some debt (established credit)
    ],
    action: {
      day: 0,
      type: 'TAKE_LOAN',
      amount: 50000,
    },
    maxTriggers: 2,
    cooldownDays: 40,
    priority: 90, // High priority for emergency
  },
];
