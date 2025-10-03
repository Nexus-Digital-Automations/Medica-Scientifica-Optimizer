/**
 * Quick Optimization Test
 * Verifies that optimizer output is clean and focused on performance
 */

import { optimize, DEFAULT_GA_CONFIG } from '../optimizer/geneticAlgorithm.js';

console.log('🧬 Testing Genetic Algorithm Output Clarity');
console.log('='.repeat(80));

// Run a very short optimization test (small population, few generations)
const testConfig = {
  ...DEFAULT_GA_CONFIG,
  populationSize: 10, // Small for quick test
  generations: 3, // Just a few generations
  enableEarlyStopping: false, // Disable for consistent test
  seedWithAnalytical: false, // Disable to avoid extra logging
};

console.log('\nRunning optimization with clean output...\n');

await optimize(
  testConfig,
  (generation, stats) => {
    // This callback shows what the user sees during optimization
    console.log(`Generation ${generation}:`);
    console.log(`  Best: $${stats.bestFitness.toFixed(2)}`);
    console.log(`  Avg:  $${stats.avgFitness.toFixed(2)}`);
    console.log(`  Worst: $${stats.worstFitness.toFixed(2)}`);
    console.log('');
  }
);

console.log('='.repeat(80));
console.log('✅ Optimization test complete!');
console.log('   Output should show ONLY performance metrics, no policy calculations.');
console.log('');
