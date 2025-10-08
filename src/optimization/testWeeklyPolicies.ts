/**
 * Test Weekly State-Conditional Policies
 *
 * Tests the new weekly policy optimization with 780 parameters
 */

import { BayesianOptimizer } from './bayesianOptimizer.js';

async function testWeeklyPolicies(): Promise<void> {
  console.log('🧪 Testing Weekly State-Conditional Policies\n');
  console.log('Configuration:');
  console.log('  ✅ Weekly mode enabled (780 parameters)');
  console.log('  ✅ State-conditional multipliers (cash/inventory/debt)');
  console.log('  ✅ Testing with 50 iterations (quick test)');
  console.log('  ✅ Random exploration: 15 iterations\n');

  const optimizer = new BayesianOptimizer({
    totalIterations: 50,
    randomExploration: 15,
    verbose: true,
    saveCheckpoints: false,
    useWeeklyPolicies: true,
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
  console.log(`  Avg/iter:   ${(duration / 50).toFixed(0)}ms`);

  // Check if it's weekly policy
  if ('weeks' in result.params) {
    console.log(`\n✅ Confirmed: Weekly policy structure detected`);
    console.log(`   Parameters for all 52 weeks available`);

    // Show week 1 and week 26 parameters for comparison
    const week1 = result.params.weeks[1];
    const week26 = result.params.weeks[26];

    console.log(`\n📅 Week 1 Parameters:`);
    console.log(`   Target Experts:  ${week1.targetExperts}`);
    console.log(`   MCE Allocation:  ${(week1.mceCustomAllocation * 100).toFixed(1)}%`);
    console.log(`   Reorder Point:   ${week1.reorderPoint}`);

    console.log(`\n📅 Week 26 Parameters:`);
    console.log(`   Target Experts:  ${week26.targetExperts}`);
    console.log(`   MCE Allocation:  ${(week26.mceCustomAllocation * 100).toFixed(1)}%`);
    console.log(`   Reorder Point:   ${week26.reorderPoint}`);

    const isDifferent =
      week1.targetExperts !== week26.targetExperts ||
      Math.abs(week1.mceCustomAllocation - week26.mceCustomAllocation) > 0.01 ||
      week1.reorderPoint !== week26.reorderPoint;

    if (isDifferent) {
      console.log(`\n✅ VALIDATION PASSED: Parameters vary by week (expected behavior)`);
    } else {
      console.log(`\n⚠️  WARNING: Week 1 and Week 26 have identical parameters`);
      console.log(`   This is unusual but not necessarily wrong`);
    }
  } else {
    console.log(`\n❌ ERROR: Expected weekly policy but got single policy`);
  }

  const isProfitable = result.netWorth > 0;
  console.log(`\n${isProfitable ? '✅' : '❌'} Profitability: ${isProfitable ? 'POSITIVE' : 'NEGATIVE'}`);

  if (!isProfitable) {
    console.log('\n💡 Note: 50 iterations is too few for weekly optimization');
    console.log('   Recommended: 500-1000 iterations for production use');
  }
}

testWeeklyPolicies().catch(console.error);
