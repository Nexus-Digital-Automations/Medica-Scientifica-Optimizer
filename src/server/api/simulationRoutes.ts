/**
 * Simulation API Routes
 * Handles POST /api/simulate requests
 */

import type { Request, Response } from 'express';
import { executeSimulation, type SimulationRequest } from '../services/simulationService.js';
import { writeFileSync, appendFileSync } from 'node:fs';

let requestCount = 0;

export async function handleSimulate(req: Request, res: Response) {
  const requestId = ++requestCount;
  const timestamp = new Date().toISOString();

  try {
    const simulationRequest: SimulationRequest = req.body;

    // Validate request has strategy
    if (!simulationRequest.strategy) {
      console.log(`[${timestamp}] ❌ Request #${requestId}: Missing strategy`);
      res.status(400).json({
        success: false,
        error: 'Missing strategy in request body',
      });
      return;
    }

    console.log(`[${timestamp}] 🚀 Request #${requestId}: Starting simulation with ${simulationRequest.strategy.timedActions.length} actions`);

    // Write to debug log
    if (requestId === 1) {
      writeFileSync('optimizer-debug.log',
        `Optimizer Debug Log - Started ${timestamp}\n` +
        `${'='.repeat(80)}\n\n`
      );
    }

    appendFileSync('optimizer-debug.log',
      `[${timestamp}] Request #${requestId}\n` +
      `  Actions: ${simulationRequest.strategy.timedActions.length}\n` +
      `  Actions Detail: ${JSON.stringify(simulationRequest.strategy.timedActions, null, 2)}\n\n`
    );

    // Execute simulation
    const response = await executeSimulation(simulationRequest);

    const endTime = new Date().toISOString();
    console.log(`[${endTime}] ✅ Request #${requestId}: Completed in ${response.executionTime}ms, Final Net Worth: $${response.result?.finalNetWorth.toFixed(2) || 'N/A'}`);

    appendFileSync('optimizer-debug.log',
      `[${endTime}] Request #${requestId} Complete\n` +
      `  Execution Time: ${response.executionTime}ms\n` +
      `  Final Net Worth: $${response.result?.finalNetWorth.toFixed(2) || 'N/A'}\n` +
      `  Success: ${response.success}\n\n`
    );

    res.json(response);
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] 💥 Request #${requestId}: Simulation API error:`, error);

    appendFileSync('optimizer-debug.log',
      `[${errorTime}] Request #${requestId} ERROR\n` +
      `  Error: ${error instanceof Error ? error.message : String(error)}\n\n`
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
