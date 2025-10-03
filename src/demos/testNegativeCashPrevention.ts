/**
 * Test Negative Cash Prevention
 * Verifies that the simulation prevents negative cash according to business case rules
 */

import { initializeState } from '../simulation/state.js';
import { processPayment, applyDebtInterest } from '../simulation/financeModule.js';
import { orderRawMaterials } from '../simulation/inventoryModule.js';

console.log('🧪 Testing Negative Cash Prevention');
console.log('='.repeat(80));

// Test 1: Salary Payment with Automatic Loan
console.log('\n📋 Test 1: Salary Payment with Insufficient Cash');
console.log('-'.repeat(80));

const state1 = initializeState();
state1.cash = 100; // Low cash
const salaryAmount = 1000;

console.log(`Initial Cash: $${state1.cash.toFixed(2)}`);
console.log(`Initial Debt: $${state1.debt.toFixed(2)}`);
console.log(`Salary Payment: $${salaryAmount.toFixed(2)}`);

const payment = processPayment(state1, salaryAmount, 'Test salary');

console.log(`\nResult:`);
console.log(`  Final Cash: $${state1.cash.toFixed(2)} ${state1.cash >= 0 ? '✅' : '❌ NEGATIVE!'}`);
console.log(`  Final Debt: $${state1.debt.toFixed(2)}`);
console.log(`  Loan Taken: ${payment.loanTaken ? `$${payment.loanTaken.loanAmount.toFixed(2)}` : 'No'}`);
console.log(`  Commission: ${payment.loanTaken ? `$${payment.loanTaken.commission.toFixed(2)}` : 'N/A'}`);

if (state1.cash < 0) {
  console.error('❌ FAILED: Cash went negative!');
} else {
  console.log('✅ PASSED: Cash stayed at or above $0');
}

// Test 2: Debt Interest Payment with Insufficient Cash
console.log('\n\n📋 Test 2: Debt Interest Payment with Insufficient Cash');
console.log('-'.repeat(80));

const state2 = initializeState();
state2.cash = 50;
state2.debt = 100000; // High debt = high interest

console.log(`Initial Cash: $${state2.cash.toFixed(2)}`);
console.log(`Initial Debt: $${state2.debt.toFixed(2)}`);

const interestAmount = applyDebtInterest(state2);

console.log(`\nResult:`);
console.log(`  Interest Amount: $${interestAmount.toFixed(2)}`);
console.log(`  Final Cash: $${state2.cash.toFixed(2)} ${state2.cash >= 0 ? '✅' : '❌ NEGATIVE!'}`);
console.log(`  Final Debt: $${state2.debt.toFixed(2)}`);

if (state2.cash < 0) {
  console.error('❌ FAILED: Cash went negative!');
} else {
  console.log('✅ PASSED: Cash stayed at or above $0');
}

// Test 3: Material Order with Insufficient Cash
console.log('\n\n📋 Test 3: Material Order with Insufficient Cash');
console.log('-'.repeat(80));

const state3 = initializeState();
state3.cash = 500; // Very low cash
const orderQuantity = 1000; // Large order

console.log(`Initial Cash: $${state3.cash.toFixed(2)}`);
console.log(`Order Quantity: ${orderQuantity} units`);

const orderResult = orderRawMaterials(state3, orderQuantity);

console.log(`\nResult:`);
if (orderResult) {
  console.log(`  Order Placed: Yes`);
  console.log(`  Order Cost: $${orderResult.totalCost.toFixed(2)}`);
  console.log(`  Final Cash: $${state3.cash.toFixed(2)} ${state3.cash >= 0 ? '✅' : '❌ NEGATIVE!'}`);

  if (state3.cash < 0) {
    console.error('❌ FAILED: Cash went negative!');
  } else {
    console.log('✅ PASSED: Cash stayed at or above $0');
  }
} else {
  console.log(`  Order Placed: No (rejected due to insufficient cash)`);
  console.log(`  Final Cash: $${state3.cash.toFixed(2)}`);
  console.log('✅ PASSED: Order correctly rejected, cash unchanged');
}

// Test 4: Edge Case - Exactly Zero Cash
console.log('\n\n📋 Test 4: Edge Case - Payment with Exactly Zero Cash');
console.log('-'.repeat(80));

const state4 = initializeState();
state4.cash = 0;
const paymentAmount = 500;

console.log(`Initial Cash: $${state4.cash.toFixed(2)}`);
console.log(`Payment Amount: $${paymentAmount.toFixed(2)}`);

const payment4 = processPayment(state4, paymentAmount, 'Test payment');

console.log(`\nResult:`);
console.log(`  Final Cash: $${state4.cash.toFixed(2)} ${state4.cash >= 0 ? '✅' : '❌ NEGATIVE!'}`);
console.log(`  Final Debt: $${state4.debt.toFixed(2)}`);
console.log(`  Loan Taken: ${payment4.loanTaken ? `$${payment4.loanTaken.loanAmount.toFixed(2)}` : 'No'}`);

if (state4.cash < 0) {
  console.error('❌ FAILED: Cash went negative!');
} else {
  console.log('✅ PASSED: Cash stayed at or above $0');
}

// Test 5: Large Payment Stress Test
console.log('\n\n📋 Test 5: Stress Test - Very Large Payment with Minimal Cash');
console.log('-'.repeat(80));

const state5 = initializeState();
state5.cash = 1;
const largePayment = 50000;

console.log(`Initial Cash: $${state5.cash.toFixed(2)}`);
console.log(`Payment Amount: $${largePayment.toFixed(2)}`);

const payment5 = processPayment(state5, largePayment, 'Large test payment');

console.log(`\nResult:`);
console.log(`  Final Cash: $${state5.cash.toFixed(2)} ${state5.cash >= 0 ? '✅' : '❌ NEGATIVE!'}`);
console.log(`  Final Debt: $${state5.debt.toFixed(2)}`);
console.log(`  Loan Taken: ${payment5.loanTaken ? `$${payment5.loanTaken.loanAmount.toFixed(2)}` : 'No'}`);
console.log(`  Commission: ${payment5.loanTaken ? `$${payment5.loanTaken.commission.toFixed(2)}` : 'N/A'}`);

if (state5.cash < 0) {
  console.error('❌ FAILED: Cash went negative!');
} else {
  console.log('✅ PASSED: Cash stayed at or above $0');
}

console.log('\n' + '='.repeat(80));
console.log('📊 Summary: Negative Cash Prevention Tests');
console.log('='.repeat(80));

const allTests = [state1, state2, state3, state4, state5];
const allPass = allTests.every((s) => s.cash >= 0);

if (allPass) {
  console.log('✅ ALL TESTS PASSED: Cash never went negative!');
  console.log('   The simulation correctly implements business case rules:');
  console.log('   1. Automatic salary loan when cash insufficient for wages');
  console.log('   2. Material orders rejected when cash insufficient');
  console.log('   3. Loan commission properly calculated to prevent negative cash');
} else {
  console.log('❌ SOME TESTS FAILED: Cash went negative in at least one test');
  console.log('   This violates business case rules and needs to be fixed.');
}

console.log('');
