import { loadHistoricalData } from '../src/client/utils/historicalDataLoader.js';

console.log('🔍 Validating Historical Data Accuracy\n');

const result = loadHistoricalData();

if (!result) {
  console.error('❌ Failed to load historical data');
  process.exit(1);
}

const { state } = result;
const finalDayIndex = state.history.dailyStandardWIP.length - 1;

console.log('📊 Data Source Information:');
console.log(`   Total Days: ${finalDayIndex + 1}`);
console.log(`   Expected: 50 days (0-49)\n`);

console.log('📈 Final Day (Day 49) Values:');
console.log(`   Standard WIP: ${state.history.dailyStandardWIP[finalDayIndex]?.value}`);
console.log(`   Expected: 489 (24+36+414+3+12)\n`);

console.log(`   Custom WIP: ${state.history.dailyCustomWIP[finalDayIndex]?.value}`);
console.log(`   Expected: 300 (264+12+12+12)\n`);

console.log(`   Raw Material: ${state.history.dailyRawMaterial[finalDayIndex]?.value}`);
console.log(`   Cash: $${state.history.dailyCash[finalDayIndex]?.value.toLocaleString()}`);
console.log(`   Net Worth: $${state.history.dailyNetWorth[finalDayIndex]?.value.toLocaleString()}\n`);

console.log(`   Experts: ${state.history.dailyExperts[finalDayIndex]?.value}`);
console.log(`   Rookies: ${state.history.dailyRookies[finalDayIndex]?.value}\n`);

console.log(`   MCE Machines: ${state.history.dailyMCECount[finalDayIndex]?.value}`);
console.log(`   WMA Machines: ${state.history.dailyWMACount[finalDayIndex]?.value}`);
console.log(`   PUC Machines: ${state.history.dailyPUCCount[finalDayIndex]?.value}\n`);

// Validation checks
const checks = [
  {
    name: 'Total Days',
    actual: finalDayIndex + 1,
    expected: 50,
  },
  {
    name: 'Standard WIP (Day 49)',
    actual: state.history.dailyStandardWIP[finalDayIndex]?.value,
    expected: 489,
  },
  {
    name: 'Custom WIP (Day 49)',
    actual: state.history.dailyCustomWIP[finalDayIndex]?.value,
    expected: 300,
  },
];

console.log('✅ Validation Results:');
let allPassed = true;
checks.forEach(check => {
  const passed = check.actual === check.expected;
  if (!passed) allPassed = false;
  const status = passed ? '✅' : '❌';
  console.log(`   ${status} ${check.name}: ${check.actual} (expected ${check.expected})`);
});

console.log('\n' + (allPassed ? '🎉 All validation checks passed!' : '⚠️ Some validation checks failed!'));

process.exit(allPassed ? 0 : 1);
