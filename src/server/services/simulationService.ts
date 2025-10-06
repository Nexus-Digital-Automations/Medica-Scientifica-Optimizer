/**
 * Simulation Service - Executes user-defined strategies
 * Runs the core simulation engine with user's strategy and returns results
 */

import { runSimulation } from '../../simulation/simulationEngine.js';
import { validateBusinessRules } from '../../simulation/businessRules.js';
import { CONSTANTS } from '../../simulation/constants.js';
import { getInitialStateByScenario, initializeState } from '../../simulation/state.js';
import type { Strategy, SimulationResult } from '../../simulation/types.js';

export interface SimulationRequest {
  strategy: Strategy;
  scenarioId?: string; // Optional scenario ID to select initial state
}

export interface SimulationResponse {
  success: boolean;
  result?: SimulationResult;
  businessRules?: {
    valid: boolean;
    violations: Array<{
      severity: 'CRITICAL' | 'MAJOR' | 'WARNING';
      rule: string;
      message: string;
    }>;
    criticalCount: number;
    majorCount: number;
    warningCount: number;
  };
  executionTime?: number;
  error?: string;
}

export async function executeSimulation(request: SimulationRequest): Promise<SimulationResponse> {
  const startTime = Date.now();

  try {
    // Get the appropriate initial state based on scenarioId
    const baseState = getInitialStateByScenario(request.scenarioId);
    const initialState = initializeState(baseState);

    // Run simulation with user's strategy and selected initial state
    const result = await runSimulation(
      request.strategy,
      CONSTANTS.SIMULATION_END_DAY,
      initialState
    );

    // Validate business rules
    const businessRulesResult = validateBusinessRules(result.state);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      result,
      businessRules: {
        valid: businessRulesResult.valid,
        violations: businessRulesResult.violations,
        criticalCount: businessRulesResult.criticalCount,
        majorCount: businessRulesResult.majorCount,
        warningCount: businessRulesResult.warningCount,
      },
      executionTime,
    };
  } catch (error) {
    console.error('Simulation execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      executionTime: Date.now() - startTime,
    };
  }
}
