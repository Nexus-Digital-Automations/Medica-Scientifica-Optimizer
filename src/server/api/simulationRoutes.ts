/**
 * Simulation API Routes
 * Handles POST /api/simulate requests
 */

import type { Request, Response } from 'express';
import { executeSimulation, type SimulationRequest } from '../services/simulationService.js';

export async function handleSimulate(req: Request, res: Response) {
  try {
    const simulationRequest: SimulationRequest = req.body;

    // Validate request has strategy
    if (!simulationRequest.strategy) {
      res.status(400).json({
        success: false,
        error: 'Missing strategy in request body',
      });
      return;
    }

    // Execute simulation
    const response = await executeSimulation(simulationRequest);

    res.json(response);
  } catch (error) {
    console.error('Simulation API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
