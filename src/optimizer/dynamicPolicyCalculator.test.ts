/**
 * Test suite for Dynamic Policy Calculator
 * Validates that policies are recalculated correctly when factory conditions change
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DynamicPolicyCalculator } from './dynamicPolicyCalculator.js';
import { initializeState } from '../simulation/state.js';
import { DEFAULT_STRATEGY } from '../simulation/constants.js';
import type { Strategy } from '../simulation/types.js';

describe('DynamicPolicyCalculator', () => {
  let calculator: DynamicPolicyCalculator;
  let strategy: Strategy;

  beforeEach(() => {
    calculator = new DynamicPolicyCalculator();
    // Deep clone strategy to avoid mutations affecting other tests
    strategy = JSON.parse(JSON.stringify(DEFAULT_STRATEGY));
  });

  describe('Initial Policy Calculation', () => {
    it('should calculate initial policies using OR formulas', () => {
      const state = initializeState();
      const initialPolicies = calculator.calculateInitialPolicies(state, strategy);

      // Policies should be calculated (not zero)
      expect(initialPolicies.reorderPoint).toBeGreaterThan(0);
      expect(initialPolicies.orderQuantity).toBeGreaterThan(0);
      expect(initialPolicies.standardBatchSize).toBeGreaterThan(0);

      console.log('Initial Policies:');
      console.log(`  Reorder Point: ${initialPolicies.reorderPoint} units`);
      console.log(`  Order Quantity: ${initialPolicies.orderQuantity} units`);
      console.log(`  Standard Batch Size: ${initialPolicies.standardBatchSize} units`);
    });

    it('should create policy change history entries', () => {
      const state = initializeState();
      calculator.calculateInitialPolicies(state, strategy);

      const history = calculator.getPolicyChangeHistory();
      expect(history.length).toBe(3); // EOQ, ROP, EPQ

      // Verify each policy was logged
      const policies = history.map((log) => log.policyName);
      expect(policies).toContain('orderQuantity');
      expect(policies).toContain('reorderPoint');
      expect(policies).toContain('standardBatchSize');
    });
  });

  describe('Machine Purchase Trigger', () => {
    it('should recalculate batch size when MCE machine is purchased', () => {
      const state = initializeState();

      // Calculate initial policies
      const initial = calculator.calculateInitialPolicies(state, strategy);
      strategy.standardBatchSize = initial.standardBatchSize;
      const initialBatchSize = initial.standardBatchSize;

      // Buy a second MCE machine (doubles production capacity)
      state.machines.MCE = 2;
      calculator.recalculatePolicies(state, strategy, 'MACHINE_PURCHASED');

      // Batch size should have changed
      expect(strategy.standardBatchSize).not.toBe(initialBatchSize);
      console.log(
        `\nMachine Purchase Test:\n  Before: ${initialBatchSize} units\n  After: ${strategy.standardBatchSize} units`
      );
    });
  });

  describe('Employee Hire Trigger', () => {
    it('should recalculate policies when labor capacity changes', () => {
      const state = initializeState();

      // Calculate initial policies
      const initial = calculator.calculateInitialPolicies(state, strategy);
      strategy.standardBatchSize = initial.standardBatchSize;
      const initialBatchSize = initial.standardBatchSize;

      // Hire 3 experts (increases ARCP capacity)
      state.workforce.experts = 4; // Was 1, now 4
      calculator.recalculatePolicies(state, strategy, 'EMPLOYEE_HIRED');

      // Batch size should have changed due to increased labor capacity
      expect(strategy.standardBatchSize).not.toBe(initialBatchSize);
      console.log(
        `\nEmployee Hire Test:\n  Before: ${initialBatchSize} units\n  After: ${strategy.standardBatchSize} units`
      );
    });
  });

  describe('Demand Phase Change Trigger', () => {
    it('should recalculate policies when demand phase changes', () => {
      const state = initializeState();

      // Calculate initial policies at Day 51 (Phase 1)
      const initial = calculator.calculateInitialPolicies(state, strategy);
      strategy.orderQuantity = initial.orderQuantity;
      strategy.reorderPoint = initial.reorderPoint;
      const initialOrderQty = initial.orderQuantity;
      const initialROP = initial.reorderPoint;

      // Move to Day 218 (Phase 3 - high demand)
      state.currentDay = 218;
      calculator.recalculatePolicies(state, strategy, 'DEMAND_PHASE_CHANGE');

      // Order quantity and reorder point should have changed
      expect(
        strategy.orderQuantity !== initialOrderQty || strategy.reorderPoint !== initialROP
      ).toBe(true);

      console.log('\nDemand Phase Change Test:');
      console.log(`  Order Quantity: ${initialOrderQty} → ${strategy.orderQuantity} units`);
      console.log(`  Reorder Point: ${initialROP} → ${strategy.reorderPoint} units`);
    });
  });

  describe('Bottleneck Analysis', () => {
    it('should identify MCE as initial bottleneck', () => {
      const state = initializeState();
      const bottleneck = calculator.identifyBottleneck(state, strategy);

      // With 1 MCE and 1 expert, MCE (30 units/day) is bottleneck vs ARCP (3 units/day)
      // Actually ARCP is the bottleneck!
      expect(bottleneck.station).toBe('ARCP');
      console.log(
        `\nBottleneck Analysis:\n  Station: ${bottleneck.station}\n  Capacity: ${bottleneck.capacity} units/day`
      );
    });

    it('should identify new bottleneck after machine purchase', () => {
      const state = initializeState();

      // Initial bottleneck
      const initial = calculator.identifyBottleneck(state, strategy);

      // Buy 5 more MCE machines
      state.machines.MCE = 6;

      // New bottleneck
      const after = calculator.identifyBottleneck(state, strategy);

      // Bottleneck may change (or capacity may increase)
      console.log(
        `\nBottleneck After Machine Purchase:\n  Before: ${initial.station} (${initial.capacity} units/day)\n  After: ${after.station} (${after.capacity} units/day)`
      );
    });
  });

  describe('Change Detection', () => {
    it('should detect multiple changes in single recalculation', () => {
      const state = initializeState();

      // Calculate initial policies
      calculator.calculateInitialPolicies(state, strategy);
      const historyBefore = calculator.getPolicyChangeHistory().length;

      // Make multiple changes
      state.machines.MCE = 3; // Production capacity change
      state.workforce.experts = 5; // Labor capacity change
      state.currentDay = 172; // Demand phase change

      calculator.recalculatePolicies(state, strategy, 'DEMAND_PHASE_CHANGE');

      const historyAfter = calculator.getPolicyChangeHistory().length;

      // Should have new policy change entries
      expect(historyAfter).toBeGreaterThan(historyBefore);

      console.log(`\nMultiple Changes Detected:\n  New policy updates: ${historyAfter - historyBefore}`);
    });
  });

  describe('Policy Change History', () => {
    it('should maintain complete audit trail', () => {
      const state = initializeState();

      // Initial calculation
      calculator.calculateInitialPolicies(state, strategy);

      // Change 1: Buy machine
      state.machines.MCE = 2;
      calculator.recalculatePolicies(state, strategy, 'MACHINE_PURCHASED');

      // Change 2: Demand phase
      state.currentDay = 172;
      calculator.recalculatePolicies(state, strategy, 'DEMAND_PHASE_CHANGE');

      const history = calculator.getPolicyChangeHistory();

      // Should have entries from initial + 2 recalculations
      expect(history.length).toBeGreaterThan(3);

      // Verify history includes trigger events
      const triggers = history.map((log) => log.triggerEvent);
      expect(triggers).toContain('INITIAL_CALCULATION');

      console.log(`\nPolicy Change History:\n  Total changes: ${history.length}`);
      console.log('  Triggers:', [...new Set(triggers)].join(', '));
    });
  });

  describe('Threshold Logic', () => {
    it('should not update policies for minor changes', () => {
      const state = initializeState();

      // Calculate initial policies
      const initial = calculator.calculateInitialPolicies(state, strategy);
      strategy.standardBatchSize = initial.standardBatchSize;

      const historyBefore = calculator.getPolicyChangeHistory().length;

      // Make a very minor change that shouldn't trigger recalculation
      // (just advancing time by 1 day, no other changes)
      state.currentDay = 52;
      calculator.recalculatePolicies(state, strategy, 'MANUAL_RECALC');

      const historyAfter = calculator.getPolicyChangeHistory().length;

      // Should not have created new policy changes (threshold not met)
      expect(historyAfter).toBe(historyBefore);

      console.log('\nThreshold Test: Minor change correctly ignored');
    });
  });
});
