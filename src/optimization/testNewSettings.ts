/**
 * Quick test of new Bayesian Optimizer settings
 * Tests: unlimited iterations, expanded workforce ranges, reduced penalties, adaptive mutation
 */

import { BayesianOptimizer } from './bayesianOptimizer.js';

async function testNewSettings(): Promise<void> {
  console.log('🧪 Testing New Bayesian Optimizer Settings\n');
  console.log('Changes:');
  console.log('  ✅ Unlimited iterations (testing with 200)');
  console.log('  ✅ Workforce ranges expanded: experts 1-50, hire 0.3-1.0, overtime 0-12h, threshold 0.5-1.0');
  console.log('  ✅ Fitness penalties reduced by 50%');
  console.log('  ✅ Mutation intensity increased: 0.1 → 0.15');
  console.log('  ✅ Mutation probability increased: 30% → 40%');
  console.log('  ✅ Exploration ratios adjusted: 70/20/10 → 65/25/10');
  console.log('  ✅ Adaptive mutation: activates at 50 iterations without improvement\n');

  const optimizer = new BayesianOptimizer({
    totalIterations: 200,
    randomExploration: 40,
    verbose: true,
    saveCheckpoints: false,
  });

  console.log('Starting optimization...\n');
  const startTime = Date.now();
  const result = await optimizer.optimize();
  const duration = Date.now() - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(70));
  console.log(`\nBest Result:`);
  console.log(`  Net Worth:  $${result.netWorth.toLocaleString()}`);
  console.log(`  Fitness:    ${result.fitnessScore.toLocaleString()}`);
  console.log(`  Found at:   Iteration ${result.iteration}`);
  console.log(`  Duration:   ${(duration / 1000).toFixed(1)}s`);
  console.log(`  Avg/iter:   ${(duration / 200).toFixed(0)}ms`);

  console.log(`\nKey Parameters (State-Conditional):`);
  console.log(`  State:           🔴 LowCash    🟡 MedCash    🟢 HighCash`);
  console.log(`  Target Experts:  ${result.params.targetExperts_lowCash}            ${result.params.targetExperts_medCash}            ${result.params.targetExperts_highCash}`);
  console.log(`  Max Overtime:    ${result.params.maxOvertimeHours_lowCash.toFixed(1)}h         ${result.params.maxOvertimeHours_medCash.toFixed(1)}h         ${result.params.maxOvertimeHours_highCash.toFixed(1)}h`);
  console.log(`  MCE Allocation:  ${(result.params.mceCustomAllocation_lowCash * 100).toFixed(1)}%        ${(result.params.mceCustomAllocation_medCash * 100).toFixed(1)}%        ${(result.params.mceCustomAllocation_highCash * 100).toFixed(1)}%`);

  const isProfitable = result.netWorth > 0;
  console.log(`\n${isProfitable ? '✅' : '❌'} Profitability: ${isProfitable ? 'POSITIVE' : 'NEGATIVE'}`);

  if (!isProfitable) {
    console.log('\n⚠️  Still finding negative solutions. Recommendations:');
    console.log('  - Run with more iterations (500-1000)');
    console.log('  - Adaptive mutation should help escape local minima');
    console.log('  - Reduced penalties allow more exploration');
  }
}

testNewSettings().catch(console.error);
