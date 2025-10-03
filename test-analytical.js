#!/usr/bin/env node

/**
 * Validation script for Analytical Optimizer
 * Tests EOQ, ROP, EPQ formulas and analytical strategy generation
 */

import { AnalyticalOptimizer } from './dist/optimizer/analyticalOptimizer.js';
import { runSimulation } from './dist/simulation/simulationEngine.js';

console.log('🧪 Testing Analytical Optimizer\n');
console.log('='.repeat(80));

const optimizer = new AnalyticalOptimizer();

// Test 1: EOQ Calculation
console.log('\n📊 Test 1: Economic Order Quantity (EOQ)');
console.log('-'.repeat(80));
const eoq = optimizer.calculateEOQ({
  annualDemand: 18_250,
  orderingCost: 100,
  holdingCostPerUnit: 0.40,
});
console.log(`EOQ Result: ${Math.round(eoq)} units`);
console.log(`Expected: ~3000 units`);
console.log(eoq > 2500 && eoq < 3500 ? '✅ PASS' : '❌ FAIL');

// Test 2: ROP Calculation
console.log('\n📊 Test 2: Reorder Point (ROP)');
console.log('-'.repeat(80));
const rop = optimizer.calculateReorderPoint({
  avgDailyDemand: 10,
  leadTimeDays: 4,
  serviceLevel: 0.95,
  demandStdDev: 2,
});
console.log(`ROP Result: ${Math.round(rop)} units`);
console.log(`Expected: ~47 units (40 base + 7 safety stock)`);
console.log(rop > 40 && rop < 50 ? '✅ PASS' : '❌ FAIL');

// Test 3: EPQ Calculation
console.log('\n📊 Test 3: Economic Production Quantity (EPQ)');
console.log('-'.repeat(80));
const epq = optimizer.calculateEPQ({
  annualDemand: 18_250,
  setupCost: 50,
  holdingCost: 1,
  productionRate: 100,
  demandRate: 50,
});
console.log(`EPQ Result: ${Math.round(epq)} units`);
console.log(`Expected: ~1900 units`);
console.log(epq > 1500 && epq < 2500 ? '✅ PASS' : '❌ FAIL');

// Test 4: Batch Size Optimization
console.log('\n📊 Test 4: Optimal Batch Size');
console.log('-'.repeat(80));
const batchSize = optimizer.optimizeStandardBatchSize({
  avgDemandPerDay: 50,
  productionCapacity: 100,
  setupCost: 50,
  holdingCostPerUnit: 2,
});
console.log(`Optimal Batch: ${batchSize} units`);
console.log(`Current Default: 60 units`);
console.log(`Expected: 30-40 units (smaller = less WIP holding cost)`);
console.log(batchSize >= 20 && batchSize <= 50 ? '✅ PASS' : '❌ FAIL');

// Test 5: Generate Analytical Strategy
console.log('\n📊 Test 5: Generate Analytical Strategy');
console.log('-'.repeat(80));
const strategy = optimizer.generateAnalyticalStrategy();
console.log(`Reorder Point: ${strategy.reorderPoint}`);
console.log(`Order Quantity: ${strategy.orderQuantity}`);
console.log(`Batch Size: ${strategy.standardBatchSize}`);
console.log(`MCE Allocation (Custom): ${(strategy.mceAllocationCustom * 100).toFixed(0)}%`);
console.log(strategy.reorderPoint > 0 && strategy.orderQuantity > 0 ? '✅ PASS' : '❌ FAIL');

// Test 6: Run Simulation with Analytical Strategy
console.log('\n📊 Test 6: Simulation with Analytical Strategy (100 days)');
console.log('-'.repeat(80));
console.log('Running simulation...');
const result = await runSimulation(strategy, 100);
console.log(`\nResults after 100 days:`);
console.log(`  Cash: $${result.finalCash.toLocaleString()}`);
console.log(`  Debt: $${result.finalDebt.toLocaleString()}`);
console.log(`  Net Worth: $${result.finalNetWorth.toLocaleString()}`);
console.log(`  Fitness Score: $${result.fitnessScore.toLocaleString()}`);
console.log(result.finalNetWorth > -10_000_000 ? '✅ PASS' : '❌ FAIL');

console.log('\n' + '='.repeat(80));
console.log('✅ All Analytical Optimizer Tests Complete!');
console.log('='.repeat(80));
