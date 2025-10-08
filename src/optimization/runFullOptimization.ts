/**
 * Full 150-Iteration Bayesian Optimization Run
 *
 * This script runs the complete optimization to find the best policy parameters
 * for the Medica Scientifica simulation.
 */

import { BayesianOptimizer } from './bayesianOptimizer.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('MEDICA SCIENTIFICA - FULL BAYESIAN OPTIMIZATION');
  console.log('='.repeat(80));
  console.log('\nConfiguration:');
  console.log('  - Total Iterations: 150');
  console.log('  - Random Exploration: 30 iterations');
  console.log('  - Guided Search: 120 iterations');
  console.log('  - Expected Duration: 5-7 minutes');
  console.log('  - Checkpoints: Every 10 iterations');
  console.log('\n' + '='.repeat(80));
  console.log('');

  const startTime = Date.now();

  // Create optimizer
  const optimizer = new BayesianOptimizer({
    totalIterations: 150,
    randomExploration: 30,
    verbose: true,
    saveCheckpoints: true,
    checkpointInterval: 10,
  });

  // Run optimization
  console.log('Starting optimization...\n');
  const bestPolicy = await optimizer.optimize();
  const optimizationDuration = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('OPTIMIZATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nTotal Time: ${(optimizationDuration / 1000).toFixed(1)}s`);
  console.log(`Average per Iteration: ${(optimizationDuration / 150).toFixed(0)}ms`);
  console.log('');

  // Save results to file
  const resultsDir = path.join(process.cwd(), 'optimization-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(resultsDir, `optimization-${timestamp}.json`);

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      totalIterations: 150,
      randomExploration: 30,
    },
    duration: optimizationDuration,
    bestPolicy: bestPolicy.params,
    bestNetWorth: bestPolicy.netWorth,
    bestFitness: bestPolicy.fitnessScore,
    bestIteration: bestPolicy.iteration,
    convergenceHistory: optimizer.getProgress().convergenceHistory,
  };

  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to: ${resultsFile}`);

  // Run validation
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION - 30 RUNS');
  console.log('='.repeat(80));
  console.log('');

  const validationStartTime = Date.now();
  const validation = await optimizer.validate(30);
  const validationDuration = Date.now() - validationStartTime;

  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));
  console.log('\n📊 Best Policy Performance:');
  console.log(`   Net Worth:     $${bestPolicy.netWorth.toLocaleString()}`);
  console.log(`   Fitness Score: ${bestPolicy.fitnessScore.toLocaleString()}`);
  console.log(`   Found at:      Iteration ${bestPolicy.iteration}`);
  console.log('');
  console.log('📈 Validation (30 runs):');
  console.log(`   Mean:          $${Math.round(validation.mean).toLocaleString()}`);
  console.log(`   Std Dev:       $${Math.round(validation.stdDev).toLocaleString()}`);
  console.log(`   Min:           $${validation.min.toLocaleString()}`);
  console.log(`   Max:           $${validation.max.toLocaleString()}`);
  console.log(`   Range:         $${(validation.max - validation.min).toLocaleString()}`);
  console.log(`   CV:            ${((validation.stdDev / validation.mean) * 100).toFixed(1)}%`);
  console.log('');
  console.log('⏱️  Performance:');
  console.log(`   Optimization:  ${(optimizationDuration / 1000).toFixed(1)}s`);
  console.log(`   Validation:    ${(validationDuration / 1000).toFixed(1)}s`);
  console.log(`   Total:         ${((optimizationDuration + validationDuration) / 1000).toFixed(1)}s`);
  console.log('');
  console.log('🎯 Best Policy Parameters:');
  console.log(JSON.stringify(bestPolicy.params, null, 2));
  console.log('\n' + '='.repeat(80));
  console.log('');

  // Save full results with validation
  const fullResultsFile = path.join(resultsDir, `optimization-${timestamp}-with-validation.json`);
  const fullResults = {
    ...results,
    validation: {
      runs: 30,
      mean: validation.mean,
      stdDev: validation.stdDev,
      min: validation.min,
      max: validation.max,
      results: validation.results,
      duration: validationDuration,
    },
    totalDuration: optimizationDuration + validationDuration,
  };

  fs.writeFileSync(fullResultsFile, JSON.stringify(fullResults, null, 2));
  console.log(`✅ Full results saved to: ${fullResultsFile}\n`);
}

main().catch((error) => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
