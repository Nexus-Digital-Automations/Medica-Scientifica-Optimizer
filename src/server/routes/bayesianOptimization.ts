/**
 * API Route for Bayesian Optimization
 *
 * Provides endpoint for running Bayesian Optimization from the UI
 */

import { Router, type Request, type Response } from 'express';
import { BayesianOptimizer } from '../../optimization/bayesianOptimizer.js';

const router = Router();

/**
 * POST /api/bayesian-optimize
 *
 * Run Bayesian Optimization with specified configuration
 */
router.post('/bayesian-optimize', async (req: Request, res: Response) => {
  try {
    const { totalIterations = 150, randomExploration = 30 } = req.body;

    // Validate inputs
    if (totalIterations < 10 || totalIterations > 500) {
      return res.status(400).json({
        error: 'totalIterations must be between 10 and 500',
      });
    }

    if (randomExploration < 5 || randomExploration > totalIterations) {
      return res.status(400).json({
        error: `randomExploration must be between 5 and ${totalIterations}`,
      });
    }

    // Create optimizer
    const optimizer = new BayesianOptimizer({
      totalIterations,
      randomExploration,
      verbose: false, // Don't log to console in API mode
      saveCheckpoints: false, // Don't save checkpoints in API mode
    });

    // Run optimization
    const startTime = Date.now();
    const bestPolicy = await optimizer.optimize();
    const duration = Date.now() - startTime;

    // Get convergence history
    const progress = optimizer.getProgress();

    // Return results
    return res.json({
      bestPolicy: bestPolicy.params,
      bestNetWorth: bestPolicy.netWorth,
      bestFitness: bestPolicy.fitnessScore,
      bestIteration: bestPolicy.iteration,
      convergenceHistory: progress.convergenceHistory,
      duration,
      totalIterations,
      randomExploration,
    });
  } catch (error) {
    console.error('Bayesian optimization error:', error);
    return res.status(500).json({
      error: 'Optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/bayesian-validate
 *
 * Validate a policy with multiple simulation runs
 */
router.post('/bayesian-validate', async (req: Request, res: Response) => {
  try {
    const { policy, runs = 30 } = req.body;

    if (!policy) {
      return res.status(400).json({ error: 'Policy parameters required' });
    }

    if (runs < 1 || runs > 100) {
      return res.status(400).json({ error: 'Runs must be between 1 and 100' });
    }

    // Create optimizer with the policy
    const optimizer = new BayesianOptimizer({
      totalIterations: 1,
      randomExploration: 1,
      verbose: false,
    });

    // Run optimization just to initialize, then validate
    await optimizer.optimize();
    const validation = await optimizer.validate(runs);

    return res.json({
      runs,
      mean: validation.mean,
      stdDev: validation.stdDev,
      min: validation.min,
      max: validation.max,
      results: validation.results,
    });
  } catch (error) {
    console.error('Policy validation error:', error);
    return res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
