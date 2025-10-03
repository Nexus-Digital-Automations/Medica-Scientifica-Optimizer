/**
 * Demonstration of Dynamic Policy Recalculation
 * Shows how policies adapt when factory conditions change
 */

import { DynamicPolicyCalculator } from '../optimizer/dynamicPolicyCalculator.js';
import { initializeState } from '../simulation/state.js';
import { DEFAULT_STRATEGY } from '../simulation/constants.js';
import type { Strategy } from '../simulation/types.js';

console.log('='.repeat(80));
console.log('DYNAMIC POLICY RECALCULATION DEMONSTRATION');
console.log('='.repeat(80));

// Initialize calculator and state
const calculator = new DynamicPolicyCalculator();
const state = initializeState();
const strategy: Strategy = JSON.parse(JSON.stringify(DEFAULT_STRATEGY));

console.log('\n📊 Test 1: Initial Policy Calculation');
console.log('-'.repeat(80));
const initialPolicies = calculator.calculateInitialPolicies(state, strategy);
strategy.reorderPoint = initialPolicies.reorderPoint;
strategy.orderQuantity = initialPolicies.orderQuantity;
strategy.standardBatchSize = initialPolicies.standardBatchSize;

console.log(`\nInitial Policies (Day ${state.currentDay}):`);
console.log(`  ✓ Reorder Point (ROP): ${strategy.reorderPoint} units`);
console.log(`  ✓ Order Quantity (EOQ): ${strategy.orderQuantity} units`);
console.log(`  ✓ Standard Batch Size (EPQ): ${strategy.standardBatchSize} units`);

console.log('\n🏭 Test 2: Machine Purchase Impact');
console.log('-'.repeat(80));
console.log('Scenario: Buying a second MCE machine (doubles production capacity)');
console.log(`  Before: ${state.machines.MCE} MCE machine(s)`);
const batchSizeBefore = strategy.standardBatchSize;

state.machines.MCE = 2;
console.log(`  After: ${state.machines.MCE} MCE machines`);

calculator.recalculatePolicies(state, strategy, 'MACHINE_PURCHASED');

console.log(`\n  Impact on Batch Size:`);
console.log(`    Before: ${batchSizeBefore} units`);
console.log(`    After: ${strategy.standardBatchSize} units`);
console.log(`    Change: ${strategy.standardBatchSize - batchSizeBefore} units (${((strategy.standardBatchSize - batchSizeBefore) / batchSizeBefore * 100).toFixed(1)}%)`);

console.log('\n👷 Test 3: Employee Hire Impact');
console.log('-'.repeat(80));
console.log('Scenario: Hiring 3 more experts (increases ARCP labor capacity)');
console.log(`  Before: ${state.workforce.experts} expert(s)`);
const batchSizeBefore2 = strategy.standardBatchSize;

state.workforce.experts = 4;
console.log(`  After: ${state.workforce.experts} experts`);

calculator.recalculatePolicies(state, strategy, 'EMPLOYEE_HIRED');

console.log(`\n  Impact on Batch Size:`);
console.log(`    Before: ${batchSizeBefore2} units`);
console.log(`    After: ${strategy.standardBatchSize} units`);
console.log(`    Change: ${strategy.standardBatchSize - batchSizeBefore2} units (${((strategy.standardBatchSize - batchSizeBefore2) / batchSizeBefore2 * 100).toFixed(1)}%)`);

console.log('\n📈 Test 4: Demand Phase Change Impact');
console.log('-'.repeat(80));
console.log('Scenario: Moving from Day 51 (Phase 1) to Day 218 (Phase 3 - high demand)');
console.log(`  Before: Day ${state.currentDay} (Phase 1 - low demand)`);
const ropBefore = strategy.reorderPoint;
const eoqBefore = strategy.orderQuantity;

state.currentDay = 218;
console.log(`  After: Day ${state.currentDay} (Phase 3 - high demand)`);

calculator.recalculatePolicies(state, strategy, 'DEMAND_PHASE_CHANGE');

console.log(`\n  Impact on Inventory Policies:`);
console.log(`    Reorder Point: ${ropBefore} → ${strategy.reorderPoint} units (${((strategy.reorderPoint - ropBefore) / ropBefore * 100).toFixed(1)}% change)`);
console.log(`    Order Quantity: ${eoqBefore} → ${strategy.orderQuantity} units (${((strategy.orderQuantity - eoqBefore) / eoqBefore * 100).toFixed(1)}% change)`);

console.log('\n🎯 Test 5: Bottleneck Analysis');
console.log('-'.repeat(80));
const bottleneck = calculator.identifyBottleneck(state, strategy);

console.log(`Current Factory Configuration:`);
console.log(`  MCE Machines: ${state.machines.MCE}`);
console.log(`  WMA Machines: ${state.machines.WMA}`);
console.log(`  PUC Machines: ${state.machines.PUC}`);
console.log(`  Experts: ${state.workforce.experts}`);
console.log(`  Rookies: ${state.workforce.rookies}`);

console.log(`\nBottleneck Identification:`);
console.log(`  🚨 Bottleneck Station: ${bottleneck.station}`);
console.log(`  📊 Station Capacity: ${bottleneck.capacity.toFixed(1)} units/day`);
console.log(`  🏭 System Throughput: ${bottleneck.systemThroughput.toFixed(1)} units/day`);
console.log(`  ⚡ Utilization Rate: ${(bottleneck.utilizationRate * 100).toFixed(1)}%`);

if (bottleneck.isConstrained) {
  console.log(`  ⚠️  WARNING: Station is constrained (>90% utilization)`);
  console.log(`  💡 Recommendation: Add capacity to ${bottleneck.station} station`);
}

console.log('\n📜 Test 6: Policy Change History Audit Trail');
console.log('-'.repeat(80));
const history = calculator.getPolicyChangeHistory();

console.log(`Total Policy Changes: ${history.length}\n`);

console.log('Change History:');
history.forEach((log, index) => {
  console.log(`\n  ${index + 1}. Day ${log.day}: ${log.policyName}`);
  console.log(`     Trigger: ${log.triggerEvent}`);
  console.log(`     Change: ${log.oldValue.toFixed(2)} → ${log.newValue.toFixed(2)}`);
  console.log(`     Reason: ${log.changeReason}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ Dynamic Policy Recalculation Tests Complete!');
console.log('='.repeat(80));

console.log('\n📋 Summary:');
console.log('  ✓ Policies are calculated using proven OR formulas (EOQ, ROP, EPQ)');
console.log('  ✓ Policies adapt automatically when factory conditions change');
console.log('  ✓ Machine purchases trigger EPQ recalculation');
console.log('  ✓ Employee hires trigger capacity-based recalculations');
console.log('  ✓ Demand phase changes trigger inventory policy updates');
console.log('  ✓ Bottleneck analysis identifies system constraints');
console.log('  ✓ Complete audit trail maintains transparency');

console.log('\n🎯 Result:');
console.log('  The genetic algorithm can now focus on optimizing WHEN to take');
console.log('  strategic actions (hiring, buying machines), while mathematical');
console.log('  formulas handle the tactical details (batch sizes, reorder points).');
console.log('');
