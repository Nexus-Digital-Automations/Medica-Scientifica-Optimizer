/**
 * Simple test to verify basic PolicyEngine functionality
 */

import { PolicyEngine, getDefaultPolicy } from './policyEngine.js';
import { runSimulation } from '../simulation/simulationEngine.js';
import { INITIAL_STATE_HISTORICAL } from '../simulation/constants.js';

async function main() {
  console.log('Starting simple PolicyEngine test...');

  try {
    const defaultPolicy = getDefaultPolicy();
    console.log('Default policy created:', JSON.stringify(defaultPolicy, null, 2));

    const policyEngine = new PolicyEngine(defaultPolicy);
    console.log('PolicyEngine created');

    const strategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);
    console.log('Strategy generated. Timed actions:', strategy.timedActions.length);
    console.log('First 5 actions:', strategy.timedActions.slice(0, 5));

    console.log('Running simulation...');
    const result = await runSimulation(strategy);
    console.log('Simulation complete!');
    console.log('Final cash:', result.state.cash);
    console.log('Final debt:', result.state.debt);
    console.log('Net worth:', result.state.cash - result.state.debt);
    console.log('Fitness:', result.fitnessScore);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
