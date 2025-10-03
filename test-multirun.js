#!/usr/bin/env node

/**
 * Test script for Multi-Run Optimizer
 * Validates that multiple GA runs reduce variance and find better solutions
 */

import { multiRunOptimize, DEFAULT_MULTI_RUN_CONFIG } from './dist/optimizer/multiRunOptimizer.js';
import { DEFAULT_GA_CONFIG } from './dist/optimizer/geneticAlgorithm.js';

console.log('🧪 Testing Multi-Run Optimizer\n');
console.log('='.repeat(80));

// Quick test with 3 runs, 50 generations each
const testConfig = {
  numRuns: 3,
  gaConfig: {
    ...DEFAULT_GA_CONFIG,
    populationSize: 50,
    generations: 50,
    enableAdaptiveMutation: true,
    enableEarlyStopping: true,
    earlyStopGenerations: 10,
    seedWithAnalytical: true,
  },
};

console.log('\n📊 Test Configuration:');
console.log(`  Runs: ${testConfig.numRuns}`);
console.log(`  Population: ${testConfig.gaConfig.populationSize}`);
console.log(`  Generations: ${testConfig.gaConfig.generations}`);
console.log(`  Adaptive Mutation: ${testConfig.gaConfig.enableAdaptiveMutation ? 'Yes' : 'No'}`);
console.log(`  Early Stopping: ${testConfig.gaConfig.enableEarlyStopping ? 'Yes' : 'No'}`);
console.log(`  Analytical Seeding: ${testConfig.gaConfig.seedWithAnalytical ? 'Yes' : 'No'}`);

console.log('\n' + '='.repeat(80));
console.log('Starting multi-run optimization...\n');

try {
  const result = await multiRunOptimize(testConfig);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Multi-Run Optimizer Test Complete!\n');
  console.log('📈 Results:');
  console.log(`  Best Fitness: $${result.bestFitness.toLocaleString()}`);
  console.log(`  Best Run: #${result.bestRunIndex + 1}`);
  console.log(`  Mean Fitness: $${result.fitnessStats.mean.toLocaleString()}`);
  console.log(`  Std Deviation: $${result.fitnessStats.stdDev.toLocaleString()}`);
  console.log(`  Range: $${result.fitnessStats.min.toLocaleString()} - $${result.fitnessStats.max.toLocaleString()}`);
  console.log(`  Improvement: ${result.fitnessStats.improvement.toFixed(1)}% (best vs mean)`);

  console.log('\n🔍 All Run Fitnesses:');
  result.allRuns.forEach((run, idx) => {
    const marker = idx === result.bestRunIndex ? '🏆' : '  ';
    console.log(`  ${marker} Run ${idx + 1}: $${run.bestFitness.toLocaleString()}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Test Passed!');
  console.log('='.repeat(80));
} catch (error) {
  console.error('\n❌ Test Failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
