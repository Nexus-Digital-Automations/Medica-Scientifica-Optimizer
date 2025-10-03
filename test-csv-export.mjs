import { runSimulation } from './dist/simulation/simulationEngine.js';
import { exportSimulationToCSV } from './dist/utils/csvExporter.js';
import { writeFileSync } from 'fs';

// Test strategy with dynamic policies
const strategy = {
  // These will be calculated dynamically
  reorderPoint: 0,
  orderQuantity: 0,
  standardBatchSize: 0,

  // GA-optimizable
  mceAllocationCustom: 0.7,
  standardPrice: 800,
  dailyOvertimeHours: 0,

  // Fixed market conditions
  customBasePrice: 106.56,
  customPenaltyPerDay: 0.27,
  customTargetDeliveryDays: 5,
  customDemandMean1: 25,
  customDemandStdDev1: 5,
  customDemandMean2: 32.5,
  customDemandStdDev2: 6.5,
  standardDemandIntercept: 500,
  standardDemandSlope: -0.25,
  overtimeTriggerDays: 5,
  dailyQuitProbability: 0.10,

  // Timed actions
  timedActions: [
    { day: 55, type: 'ORDER_MATERIALS', quantity: 100 },
    { day: 100, type: 'TAKE_LOAN', amount: 50000 },
    { day: 150, type: 'HIRE_ROOKIE', count: 2 },
    { day: 200, type: 'ADJUST_PRICE', productType: 'standard', newPrice: 900 },
  ],
};

console.log('Running simulation with dynamic policy tracking...');

const result = await runSimulation(strategy, 250);

console.log('\nGenerating enhanced CSV export...');
const csv = exportSimulationToCSV(result);

const filename = 'medica-scientifica-dynamic-policies.csv';
writeFileSync(filename, csv);

console.log(`\n✅ CSV exported to: ${filename}`);
console.log('\nPolicy Changes:');
result.state.history.policyChanges.forEach(change => {
  console.log(`  Day ${change.day}: ${change.policyType} ${change.oldValue}→${change.newValue}`);
  console.log(`    Reason: ${change.reason}`);
});

console.log(`\nFinal Net Worth: $${result.finalNetWorth.toFixed(2)}`);
console.log(`Fitness Score: $${result.fitnessScore.toFixed(2)}`);
