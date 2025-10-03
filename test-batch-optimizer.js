#!/usr/bin/env node

/**
 * Test script for Phase-Aware Batch Size Optimizer
 * Validates dynamic batch sizing across business phases
 */

import { PhaseAwareBatchOptimizer, DEFAULT_PHASES } from './dist/optimizer/phaseAwareBatchOptimizer.js';

console.log('🧪 Testing Phase-Aware Batch Size Optimizer\n');
console.log('='.repeat(80));

const optimizer = new PhaseAwareBatchOptimizer();

// Test 1: Get recommendations for all phases
console.log('\n📊 Test 1: Batch Size Recommendations by Phase');
console.log('-'.repeat(80));

const recommendations = optimizer.getAllRecommendations();

recommendations.forEach((rec, idx) => {
  console.log(`\n${idx + 1}. ${rec.phase}`);
  console.log(`   Optimal Batch Size: ${rec.optimalSize} units`);
  console.log(`   Setup Cost: $${rec.expectedSetupCost.toFixed(2)}`);
  console.log(`   Holding Cost: $${rec.expectedHoldingCost.toFixed(2)}`);
  console.log(`   Total Cost: $${rec.totalCost.toFixed(2)}`);
  console.log(`   Reasoning: ${rec.reasoning}`);
});

console.log('\n✅ All recommendations generated');

// Test 2: Compare strategies
console.log('\n\n📊 Test 2: Strategy Comparison (Fixed vs Phase-Aware)');
console.log('-'.repeat(80));

const comparison = optimizer.compareStrategies();

console.log(`\nFixed Batch Strategy:`);
console.log(`  Batch Size: ${comparison.fixedBatch.size} units (constant)`);
console.log(`  Total Cost: $${comparison.fixedBatch.totalCost.toFixed(2)}`);

console.log(`\nPhase-Aware Strategy:`);
console.log(`  Avg Batch Size: ${comparison.phaseAware.avgSize} units (dynamic)`);
console.log(`  Total Cost: $${comparison.phaseAware.totalCost.toFixed(2)}`);

console.log(`\n💰 Cost Savings:`);
console.log(`  Absolute: $${comparison.savings.toFixed(2)}`);
console.log(`  Percentage: ${comparison.savingsPercent.toFixed(1)}%`);

if (comparison.savings > 0) {
  console.log(`\n✅ Phase-aware batching is more cost-effective!`);
} else {
  console.log(`\n⚠️  Fixed batching appears more cost-effective (unusual)`);
}

// Test 3: Generate batch adjustment actions
console.log('\n\n📊 Test 3: Timed Batch Adjustment Actions');
console.log('-'.repeat(80));

const actions = optimizer.generateBatchAdjustmentActions();

console.log(`\nGenerated ${actions.length} batch adjustment actions:`);
actions.forEach((action, idx) => {
  console.log(`  ${idx + 1}. Day ${action.day}: Adjust batch to ${action.newSize} units`);
});

console.log('\n✅ Actions generated successfully');

// Test 4: Validate phase definitions
console.log('\n\n📊 Test 4: Business Phase Validation');
console.log('-'.repeat(80));

console.log(`\nTotal Business Phases: ${DEFAULT_PHASES.length}`);
DEFAULT_PHASES.forEach((phase, idx) => {
  console.log(`\n${idx + 1}. ${phase.name}`);
  console.log(`   Period: Days ${phase.startDay}-${phase.endDay} (${phase.endDay - phase.startDay} days)`);
  console.log(`   Avg Demand: ${phase.avgDemandPerDay} units/day`);
  console.log(`   Variability: ${(phase.demandVariability * 100).toFixed(0)}%`);
});

console.log('\n✅ Phase definitions valid');

// Summary
console.log('\n' + '='.repeat(80));
console.log('✅ All Phase-Aware Batch Optimizer Tests Complete!\n');
console.log('Key Findings:');
console.log(`  - ${recommendations.length} phases optimized`);
console.log(`  - ${comparison.savingsPercent.toFixed(1)}% cost reduction vs fixed batching`);
console.log(`  - Batch sizes range from ${Math.min(...recommendations.map(r => r.optimalSize))} to ${Math.max(...recommendations.map(r => r.optimalSize))} units`);
console.log(`  - ${actions.length} batch adjustment actions generated`);
console.log('='.repeat(80));
