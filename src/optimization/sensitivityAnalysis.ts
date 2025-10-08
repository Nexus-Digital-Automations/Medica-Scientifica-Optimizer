/**
 * Sensitivity Analysis for Optimized Policy Parameters
 *
 * Tests each parameter by varying it ±10% and ±20% while keeping others constant
 * to determine which parameters have the most impact on performance.
 */

import { PolicyEngine, type PolicyParameters, PARAMETER_SPACE } from './policyEngine.js';
import { runSimulation } from '../simulation/simulationEngine.js';
import { INITIAL_STATE_HISTORICAL } from '../simulation/constants.js';
import * as fs from 'fs';
import * as path from 'path';

interface SensitivityResult {
  parameter: keyof PolicyParameters;
  baseValue: number;
  baseFitness: number;
  tests: Array<{
    variation: string;
    value: number;
    fitness: number;
    impact: number; // % change in fitness
  }>;
  avgImpact: number; // Average absolute impact
}

/**
 * Run sensitivity analysis on a given policy
 */
async function analyzeSensitivity(
  basePolicy: PolicyParameters,
  variations: number[] = [-0.2, -0.1, 0.1, 0.2]
): Promise<SensitivityResult[]> {
  console.log('\n' + '='.repeat(80));
  console.log('SENSITIVITY ANALYSIS');
  console.log('='.repeat(80));
  console.log('\nBase Policy:');
  console.log(JSON.stringify(basePolicy, null, 2));
  console.log('');

  // Calculate base fitness
  console.log('Calculating baseline fitness...');
  const basePolicyEngine = new PolicyEngine(basePolicy);
  const baseStrategy = basePolicyEngine.toStrategy(INITIAL_STATE_HISTORICAL);
  const baseResult = await runSimulation(baseStrategy);
  const baseFitness = baseResult.fitnessScore;
  console.log(`Baseline fitness: ${baseFitness.toLocaleString()}\n`);

  const results: SensitivityResult[] = [];
  const parameterKeys = Object.keys(basePolicy) as Array<keyof PolicyParameters>;

  for (const param of parameterKeys) {
    console.log(`Testing parameter: ${param}`);
    console.log(`  Base value: ${basePolicy[param]}`);

    const paramSpace = PARAMETER_SPACE[param];
    const tests: SensitivityResult['tests'] = [];

    for (const variation of variations) {
      const testPolicy = { ...basePolicy };
      const baseValue = basePolicy[param] as number;
      let newValue = baseValue * (1 + variation);

      // Clamp to parameter bounds
      newValue = Math.max(paramSpace.min, Math.min(paramSpace.max, newValue));

      // Round integers
      if (paramSpace.type === 'integer') {
        newValue = Math.round(newValue);
      }

      testPolicy[param] = newValue as number;

      // Run simulation
      const testEngine = new PolicyEngine(testPolicy);
      const testStrategy = testEngine.toStrategy(INITIAL_STATE_HISTORICAL);
      const testResult = await runSimulation(testStrategy);
      const testFitness = testResult.fitnessScore;
      const impact = ((testFitness - baseFitness) / baseFitness) * 100;

      tests.push({
        variation: `${variation > 0 ? '+' : ''}${(variation * 100).toFixed(0)}%`,
        value: newValue,
        fitness: testFitness,
        impact,
      });

      console.log(`    ${variation > 0 ? '+' : ''}${(variation * 100).toFixed(0)}%: ${newValue.toFixed(2)} → fitness ${testFitness.toLocaleString()} (${impact > 0 ? '+' : ''}${impact.toFixed(2)}% impact)`);
    }

    const avgImpact = tests.reduce((sum, t) => sum + Math.abs(t.impact), 0) / tests.length;

    results.push({
      parameter: param,
      baseValue: basePolicy[param] as number,
      baseFitness,
      tests,
      avgImpact,
    });

    console.log(`  Average absolute impact: ${avgImpact.toFixed(2)}%\n`);
  }

  return results;
}

/**
 * Display sensitivity analysis results sorted by impact
 */
function displayResults(results: SensitivityResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('SENSITIVITY ANALYSIS RESULTS - RANKED BY IMPACT');
  console.log('='.repeat(80));
  console.log('');

  // Sort by average impact (descending)
  const sorted = [...results].sort((a, b) => b.avgImpact - a.avgImpact);

  console.log('┌────────────────────────────────┬──────────────┬──────────────────┐');
  console.log('│ Parameter                      │ Base Value   │ Avg Impact (%)   │');
  console.log('├────────────────────────────────┼──────────────┼──────────────────┤');

  for (const result of sorted) {
    const paramName = result.parameter.padEnd(30);
    const baseValue = result.baseValue.toFixed(2).padStart(12);
    const avgImpact = result.avgImpact.toFixed(2).padStart(16);
    console.log(`│ ${paramName} │ ${baseValue} │ ${avgImpact} │`);
  }

  console.log('└────────────────────────────────┴──────────────┴──────────────────┘');
  console.log('');

  // Top 5 most sensitive parameters
  console.log('🎯 TOP 5 MOST SENSITIVE PARAMETERS:\n');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const result = sorted[i];
    console.log(`${i + 1}. ${result.parameter}`);
    console.log(`   Base: ${result.baseValue.toFixed(2)}`);
    console.log(`   Avg Impact: ${result.avgImpact.toFixed(2)}%`);
    console.log(`   Variations:`);
    for (const test of result.tests) {
      console.log(`     ${test.variation}: ${test.value.toFixed(2)} → ${test.impact > 0 ? '+' : ''}${test.impact.toFixed(2)}% fitness change`);
    }
    console.log('');
  }

  // Bottom 5 least sensitive parameters
  console.log('📊 BOTTOM 5 LEAST SENSITIVE PARAMETERS:\n');
  const bottom = sorted.slice(-5).reverse();
  for (let i = 0; i < bottom.length; i++) {
    const result = bottom[i];
    console.log(`${i + 1}. ${result.parameter}`);
    console.log(`   Base: ${result.baseValue.toFixed(2)}`);
    console.log(`   Avg Impact: ${result.avgImpact.toFixed(2)}%`);
    console.log('');
  }
}

/**
 * Main entry point
 */
async function main() {
  // Load best policy from optimization results
  const resultsDir = path.join(process.cwd(), 'optimization-results');
  const files = fs.readdirSync(resultsDir).filter(f => f.includes('with-validation.json'));

  if (files.length === 0) {
    console.error('No optimization results found. Run full optimization first.');
    process.exit(1);
  }

  // Use most recent result
  files.sort().reverse();
  const latestFile = path.join(resultsDir, files[0]);
  console.log(`Loading best policy from: ${latestFile}`);

  const optimizationResults = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
  const bestPolicy = optimizationResults.bestPolicy as PolicyParameters;

  console.log(`Loaded policy with fitness: ${optimizationResults.bestFitness.toLocaleString()}`);

  // Run sensitivity analysis
  const startTime = Date.now();
  const results = await analyzeSensitivity(bestPolicy);
  const duration = Date.now() - startTime;

  // Display results
  displayResults(results);

  console.log(`\n⏱️  Total analysis time: ${(duration / 1000).toFixed(1)}s`);
  console.log(`   Tests per parameter: 4`);
  console.log(`   Total simulations: ${results.length * 4 + 1}\n`);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(resultsDir, `sensitivity-analysis-${timestamp}.json`);

  fs.writeFileSync(
    outputFile,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      basePolicy: bestPolicy,
      baseFitness: optimizationResults.bestFitness,
      results: results.map(r => ({
        parameter: r.parameter,
        baseValue: r.baseValue,
        avgImpact: r.avgImpact,
        tests: r.tests,
      })),
      duration,
    }, null, 2)
  );

  console.log(`✅ Sensitivity analysis saved to: ${outputFile}\n`);
}

main().catch((error) => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
