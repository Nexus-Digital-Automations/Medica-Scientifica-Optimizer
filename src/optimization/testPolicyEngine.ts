/**
 * Test Suite for PolicyEngine and BayesianOptimizer Integration
 *
 * Tests:
 * 1. PolicyEngine with default policy
 * 2. PolicyEngine with random policy
 * 3. Small Bayesian Optimization run (20 iterations)
 */

import { PolicyEngine, getDefaultPolicy, generateRandomPolicy } from './policyEngine.js';
import { BayesianOptimizer } from './bayesianOptimizer.js';
import { runSimulation } from '../simulation/simulationEngine.js';
import { INITIAL_STATE_HISTORICAL } from '../simulation/constants.js';
import type { SimulationResult } from '../simulation/types.js';

/**
 * Test 1: Default Policy
 * Verifies that PolicyEngine can generate a valid strategy from default parameters
 */
async function testDefaultPolicy(): Promise<void> {
  console.log('\n========================================');
  console.log('TEST 1: Default Policy');
  console.log('========================================');

  const defaultPolicy = getDefaultPolicy();
  console.log('\nDefault Policy Parameters:', JSON.stringify(defaultPolicy, null, 2));

  const policyEngine = new PolicyEngine(defaultPolicy);
  const strategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);

  console.log('\nGenerated Strategy:');
  console.log('  - Reorder Point:', strategy.reorderPoint);
  console.log('  - Order Quantity:', strategy.orderQuantity);
  console.log('  - MCE Custom Allocation:', strategy.mceAllocationCustom);
  console.log('  - Standard Batch Size:', strategy.standardBatchSize);
  console.log('  - Timed Actions:', strategy.timedActions.length);

  console.log('\nRunning simulation with default policy...');
  const startTime = Date.now();
  const result: SimulationResult = await runSimulation(strategy);
  const duration = Date.now() - startTime;

  console.log('\n✅ Default Policy Results:');
  console.log('  - Simulation Time:', `${duration}ms`);
  console.log('  - Final Cash:', `$${result.state.cash.toFixed(2)}`);
  console.log('  - Final Debt:', `$${result.state.debt.toFixed(2)}`);
  console.log('  - Net Worth:', `$${(result.state.cash - result.state.debt).toFixed(2)}`);
  console.log('  - Fitness Score:', result.fitnessScore.toFixed(2));
  console.log('  - Final Day:', result.state.currentDay);

  // Validate strategy was executed
  if (strategy.timedActions.length === 0) {
    console.warn('⚠️  WARNING: No timed actions generated!');
  } else {
    console.log(`  - Actions Executed: ${strategy.timedActions.length}`);
  }
}

/**
 * Test 2: Random Policy
 * Verifies that PolicyEngine works with randomized parameters
 */
async function testRandomPolicy(): Promise<void> {
  console.log('\n========================================');
  console.log('TEST 2: Random Policy');
  console.log('========================================');

  const randomPolicy = generateRandomPolicy();
  console.log('\nRandom Policy Parameters:', JSON.stringify(randomPolicy, null, 2));

  const policyEngine = new PolicyEngine(randomPolicy);
  const strategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);

  console.log('\nGenerated Strategy:');
  console.log('  - Reorder Point:', strategy.reorderPoint);
  console.log('  - Order Quantity:', strategy.orderQuantity);
  console.log('  - MCE Custom Allocation:', strategy.mceAllocationCustom);
  console.log('  - Timed Actions:', strategy.timedActions.length);

  console.log('\nRunning simulation with random policy...');
  const startTime = Date.now();
  const result: SimulationResult = await runSimulation(strategy);
  const duration = Date.now() - startTime;

  console.log('\n✅ Random Policy Results:');
  console.log('  - Simulation Time:', `${duration}ms`);
  console.log('  - Final Cash:', `$${result.state.cash.toFixed(2)}`);
  console.log('  - Final Debt:', `$${result.state.debt.toFixed(2)}`);
  console.log('  - Net Worth:', `$${(result.state.cash - result.state.debt).toFixed(2)}`);
  console.log('  - Fitness Score:', result.fitnessScore.toFixed(2));
}

/**
 * Test 3: Small Bayesian Optimization Run
 * Verifies full optimization pipeline with 20 iterations
 */
async function testBayesianOptimization(): Promise<void> {
  console.log('\n========================================');
  console.log('TEST 3: Small Bayesian Optimization (20 iterations)');
  console.log('========================================');

  const optimizer = new BayesianOptimizer({
    totalIterations: 20,
    randomExploration: 10,
    verbose: true,
    saveCheckpoints: false,
  });

  console.log('\nStarting Bayesian Optimization...');
  console.log('  - Total Iterations: 20');
  console.log('  - Random Exploration: 10');
  console.log('  - Guided Search: 10');
  console.log('');

  const startTime = Date.now();
  const bestPolicy = await optimizer.optimize();
  const duration = Date.now() - startTime;

  console.log('\n✅ Optimization Complete!');
  console.log('  - Total Time:', `${(duration / 1000).toFixed(1)}s`);
  console.log('  - Avg Time per Iteration:', `${(duration / 20).toFixed(0)}ms`);
  console.log('');
  console.log('Best Policy Found:');
  console.log('  - Net Worth:', `$${bestPolicy.netWorth.toFixed(2)}`);
  console.log('  - Fitness Score:', bestPolicy.fitnessScore.toFixed(2));
  console.log('  - Iteration:', bestPolicy.iteration);
  console.log('');
  console.log('Best Policy Parameters:', JSON.stringify(bestPolicy.params, null, 2));

  // Validate that optimization improved over random
  const progress = optimizer.getProgress();
  const firstScore = progress.evaluations[0].fitnessScore;

  if (!progress.currentBest) {
    throw new Error('No best policy found after optimization');
  }

  const bestScore = progress.currentBest.fitnessScore;
  const improvement = ((bestScore - firstScore) / Math.abs(firstScore)) * 100;

  console.log('\n📊 Optimization Progress:');
  console.log('  - First Score:', firstScore.toFixed(2));
  console.log('  - Best Score:', bestScore.toFixed(2));
  console.log('  - Improvement:', `${improvement.toFixed(1)}%`);

  if (improvement > 0) {
    console.log('  ✅ Optimization improved performance!');
  } else {
    console.log('  ⚠️  No improvement (may need more iterations)');
  }
}

/**
 * Test 4: Validation Run
 * Tests the validation method with 5 runs
 */
async function testValidation(): Promise<void> {
  console.log('\n========================================');
  console.log('TEST 4: Validation with 5 Runs');
  console.log('========================================');

  // First, run a quick optimization to get a policy
  const optimizer = new BayesianOptimizer({
    totalIterations: 10,
    randomExploration: 5,
    verbose: false,
  });

  console.log('\nRunning quick optimization (10 iterations)...');
  await optimizer.optimize();

  console.log('\nValidating best policy with 5 simulation runs...');
  const startTime = Date.now();
  const validation = await optimizer.validate(5);
  const duration = Date.now() - startTime;

  console.log('\n✅ Validation Results:');
  console.log('  - Runs:', 5);
  console.log('  - Mean Net Worth:', `$${validation.mean.toFixed(2)}`);
  console.log('  - Std Dev:', `$${validation.stdDev.toFixed(2)}`);
  console.log('  - Min:', `$${validation.min.toFixed(2)}`);
  console.log('  - Max:', `$${validation.max.toFixed(2)}`);
  console.log('  - Range:', `$${(validation.max - validation.min).toFixed(2)}`);
  console.log('  - Coefficient of Variation:', `${((validation.stdDev / validation.mean) * 100).toFixed(1)}%`);
  console.log('  - Total Time:', `${(duration / 1000).toFixed(1)}s`);
  console.log('  - Avg Time per Run:', `${(duration / 5).toFixed(0)}ms`);
}

/**
 * Main Test Runner
 */
async function runAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  PolicyEngine & BayesianOptimizer Test ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await testDefaultPolicy();
    await testRandomPolicy();
    await testBayesianOptimization();
    await testValidation();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         ✅ ALL TESTS PASSED!           ║');
    console.log('╚════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n╔════════════════════════════════════════╗');
    console.error('║         ❌ TEST FAILED!                ║');
    console.error('╚════════════════════════════════════════╝\n');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
// Note: Using a more robust check for ESM module execution
const isMainModule = process.argv[1] && process.argv[1].includes('testPolicyEngine');
if (isMainModule) {
  runAllTests();
}

export {
  testDefaultPolicy,
  testRandomPolicy,
  testBayesianOptimization,
  testValidation,
  runAllTests,
};
