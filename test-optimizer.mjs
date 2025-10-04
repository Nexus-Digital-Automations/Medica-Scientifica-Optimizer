/**
 * Test script to verify optimizer with corrected EOQ calculations
 * Tests that strategies now have correct capital requirements based on MCE capacity
 */

import { optimize, DEFAULT_GA_CONFIG } from './dist/optimizer/geneticAlgorithm.js';

console.log('🧬 Testing Genetic Algorithm Optimizer with Corrected EOQ Calculations\n');
console.log('Expected behavior:');
console.log('  - EOQ based on MCE capacity (45 parts/day) ≈ $92K per order');
console.log('  - Early loans: $240K-$300K total (was $900K-$1.2M)');
console.log('  - Quick validation threshold: $80K minimum (was $300K)\n');

const config = {
  ...DEFAULT_GA_CONFIG,
  populationSize: 20,
  generations: 5,
  enableEarlyStopping: false,
};

console.log('Running optimizer with test configuration:');
console.log(`  Population: ${config.populationSize}`);
console.log(`  Generations: ${config.generations}`);
console.log(`  Seed with analytical: ${config.seedWithAnalytical}\n`);

try {
  const result = await optimize(config);

  console.log('\n✅ Optimization complete!');
  console.log(`Best fitness: $${result.bestFitness.toFixed(2)}`);
  console.log(`Final net worth: $${result.bestStrategy ? 'calculated' : 'N/A'}`);

  if (result.bestStrategy) {
    console.log('\n📊 Best Strategy Summary:');
    console.log(`  MCE Allocation to Custom: ${(result.bestStrategy.mceAllocationCustom * 100).toFixed(1)}%`);
    console.log(`  Standard Price: $${result.bestStrategy.standardPrice}`);
    console.log(`  Daily Overtime: ${result.bestStrategy.dailyOvertimeHours} hours`);

    const earlyLoans = result.bestStrategy.timedActions
      .filter(a => a.type === 'TAKE_LOAN' && a.day < 70);
    const totalEarlyCapital = earlyLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0);

    console.log(`\n💰 Capital Structure:`);
    console.log(`  Early loans (Day < 70): ${earlyLoans.length} loans`);
    console.log(`  Total early capital: $${totalEarlyCapital.toLocaleString()}`);
    console.log(`  Expected range: $240K-$300K`);

    if (totalEarlyCapital >= 80000 && totalEarlyCapital <= 400000) {
      console.log('  ✅ Capital in reasonable range');
    } else {
      console.log('  ⚠️ Capital outside expected range');
    }
  }

} catch (error) {
  console.error('\n❌ Optimization failed:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
