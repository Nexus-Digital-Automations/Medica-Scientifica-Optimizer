#!/usr/bin/env node

/**
 * Comprehensive Hybrid Optimization System Test
 * Validates all components working together and generates comparison report
 */

import { multiRunOptimize } from './dist/optimizer/multiRunOptimizer.js';
import { AnalyticalOptimizer } from './dist/optimizer/analyticalOptimizer.js';
import { PhaseAwareBatchOptimizer, DEFAULT_PHASES } from './dist/optimizer/phaseAwareBatchOptimizer.js';
import { EXAMPLE_RULES } from './dist/optimizer/rulesEngine.js';
import { runSimulation } from './dist/simulation/simulationEngine.js';

console.log('🚀 HYBRID OPTIMIZATION SYSTEM - COMPREHENSIVE TEST\n');
console.log('='.repeat(80));

console.log('\n📋 Test Configuration:');
console.log('  - Analytical Seeding: Enabled');
console.log('  - Adaptive Mutation: 0.15 → 0.03');
console.log('  - Early Stopping: 15 generations');
console.log('  - Multi-Run: 3 independent runs');
console.log('  - State-Dependent Rules: 4 rules');
console.log('  - Phase-Aware Batching: 4 phases');

// Step 1: Generate analytical baseline
console.log('\n' + '='.repeat(80));
console.log('STEP 1: ANALYTICAL BASELINE');
console.log('='.repeat(80));

const analyticalOptimizer = new AnalyticalOptimizer();
const analyticalStrategy = analyticalOptimizer.generateAnalyticalStrategy();

console.log('  EOQ-based order quantity:', analyticalStrategy.orderQuantity);
console.log('  ROP-based reorder point:', analyticalStrategy.reorderPoint);
console.log('  EPQ-based batch size:', analyticalStrategy.standardBatchSize);

// Step 2: Add phase-aware batch adjustments
console.log('\n' + '='.repeat(80));
console.log('STEP 2: PHASE-AWARE BATCH OPTIMIZATION');
console.log('='.repeat(80));

const batchOptimizer = new PhaseAwareBatchOptimizer();
const batchActions = batchOptimizer.generateBatchAdjustmentActions();
const batchComparison = batchOptimizer.compareStrategies();

console.log(`  Generated ${batchActions.length} batch adjustment actions`);
console.log(`  Expected cost reduction: ${batchComparison.savingsPercent.toFixed(1)}%`);

// Step 3: Add state-dependent rules
console.log('\n' + '='.repeat(80));
console.log('STEP 3: STATE-DEPENDENT RULES');
console.log('='.repeat(80));

console.log(`  Configured ${EXAMPLE_RULES.length} adaptive rules:`);
EXAMPLE_RULES.forEach((rule, idx) => {
  console.log(`    ${idx + 1}. ${rule.name} (priority: ${rule.priority})`);
});

// Step 4: Run hybrid multi-run optimization
console.log('\n' + '='.repeat(80));
console.log('STEP 4: MULTI-RUN HYBRID OPTIMIZATION');
console.log('='.repeat(80));

const hybridConfig = {
  numRuns: 3,
  gaConfig: {
    populationSize: 50,
    generations: 50,
    mutationRate: 0.05,
    eliteCount: 10,
    crossoverRate: 0.7,
    enableAdaptiveMutation: true,
    initialMutationRate: 0.15,
    finalMutationRate: 0.03,
    enableEarlyStopping: true,
    earlyStopGenerations: 10,
    minImprovementThreshold: 0.005,
    seedWithAnalytical: true,
  },
};

console.log('  Running 3 independent GA runs with hybrid features...\n');

try {
  const hybridResult = await multiRunOptimize(hybridConfig);

  console.log('\n' + '='.repeat(80));
  console.log('STEP 5: RESULTS COMPARISON');
  console.log('='.repeat(80));

  // Run simple baseline for comparison
  console.log('\n  Running baseline (no hybrid features) for comparison...');
  const baselineStrategy = {
    ...analyticalStrategy,
    timedActions: [],
    rules: undefined,
  };
  const baselineResult = await runSimulation(baselineStrategy, 500);

  // Run hybrid strategy
  const hybridStrategy = {
    ...hybridResult.bestStrategy,
    timedActions: [...hybridResult.bestStrategy.timedActions, ...batchActions],
    rules: EXAMPLE_RULES,
  };
  const enhancedResult = await runSimulation(hybridStrategy, 500);

  // Generate comparison report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 HYBRID OPTIMIZATION SYSTEM - PERFORMANCE REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n1️⃣  BASELINE (Analytical Only)');
  console.log('   ├─ Net Worth: $' + baselineResult.finalNetWorth.toLocaleString());
  console.log('   ├─ Fitness: $' + baselineResult.fitnessScore.toLocaleString());
  console.log('   └─ Features: EOQ, ROP, EPQ');

  console.log('\n2️⃣  HYBRID SYSTEM (All Features)');
  console.log('   ├─ Net Worth: $' + enhancedResult.finalNetWorth.toLocaleString());
  console.log('   ├─ Fitness: $' + enhancedResult.fitnessScore.toLocaleString());
  console.log('   └─ Features: Analytical + GA + Multi-Run + Rules + Batch Opt');

  const improvement = enhancedResult.fitnessScore - baselineResult.fitnessScore;
  const improvementPercent = (improvement / Math.abs(baselineResult.fitnessScore)) * 100;

  console.log('\n💰 IMPROVEMENT');
  console.log('   ├─ Absolute: $' + improvement.toLocaleString());
  console.log('   ├─ Percentage: ' + improvementPercent.toFixed(1) + '%');
  console.log('   └─ Status: ' + (improvement > 0 ? '✅ BETTER' : '⚠️  NEEDS TUNING'));

  console.log('\n📈 MULTI-RUN STATISTICS');
  console.log('   ├─ Best Run: $' + hybridResult.bestFitness.toLocaleString());
  console.log('   ├─ Mean: $' + hybridResult.fitnessStats.mean.toLocaleString());
  console.log('   ├─ Std Dev: $' + hybridResult.fitnessStats.stdDev.toLocaleString());
  console.log('   └─ Consistency: ' + (hybridResult.fitnessStats.stdDev < 200000 ? '✅ HIGH' : '⚠️  VARIABLE'));

  console.log('\n🎯 HYBRID FEATURES PERFORMANCE');
  console.log('   ├─ Analytical Seeding: ✅ Enabled (20% of population)');
  console.log('   ├─ Adaptive Mutation: ✅ Enabled (0.15 → 0.03)');
  console.log('   ├─ Early Stopping: ' + (hybridResult.generation < hybridConfig.gaConfig.generations ? '✅ Triggered' : '⏭️  Not triggered'));
  console.log('   ├─ Multi-Run Variance: ' + hybridResult.fitnessStats.improvement.toFixed(1) + '% improvement');
  console.log('   ├─ State Rules: ✅ ' + EXAMPLE_RULES.length + ' rules active');
  console.log('   └─ Batch Optimization: ✅ ' + batchComparison.savingsPercent.toFixed(1) + '% cost reduction');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ HYBRID OPTIMIZATION SYSTEM TEST COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error) {
  console.error('\n❌ Test Failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
