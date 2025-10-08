/**
 * API Route for Bayesian Optimization
 *
 * Provides endpoint for running Bayesian Optimization from the UI
 */

import { Router, type Request, type Response } from 'express';
import { BayesianOptimizer } from '../../optimization/bayesianOptimizer.js';
import { PolicyEngine, type PolicyParameters } from '../../optimization/policyEngine.js';
import { INITIAL_STATE_HISTORICAL } from '../../simulation/constants.js';
import { memoryManager, type DemandContext } from '../../optimization/memoryManager.js';

const router = Router();

/**
 * POST /api/bayesian-optimize
 *
 * Run Bayesian Optimization with specified configuration
 * Supports Server-Sent Events for real-time progress updates
 */
router.post('/bayesian-optimize', async (req: Request, res: Response) => {
  try {
    const { totalIterations = 150, randomExploration = 30, stream = false, useMemory = false, demandContext } = req.body;

    // Validate inputs
    if (totalIterations < 10) {
      return res.status(400).json({
        error: 'totalIterations must be at least 10',
      });
    }

    if (randomExploration < 5 || randomExploration > totalIterations) {
      return res.status(400).json({
        error: `randomExploration must be between 5 and ${totalIterations}`,
      });
    }

    // Load warm-start policies from memory if enabled
    let warmStartPolicies: PolicyParameters[] | undefined;
    if (useMemory && demandContext) {
      warmStartPolicies = memoryManager.getTopPolicies(10, demandContext as DemandContext);
      console.log(`🧠 Loaded ${warmStartPolicies.length} policies from memory for warm-start`);
    }

    // If streaming is requested, set up SSE
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        // Progress callback for SSE
        const onProgress = (iteration: number, total: number, phase: string, bestFitness: number) => {
          if (!res.writableEnded) {
            const progressData = { iteration, total, phase, bestFitness };
            console.log('📊 SSE Progress:', progressData);
            res.write(`data: ${JSON.stringify(progressData)}\n\n`);
          }
        };

        // Create optimizer with progress callback
        const optimizer = new BayesianOptimizer({
          totalIterations,
          randomExploration,
          verbose: false,
          saveCheckpoints: false,
          onProgress,
          useMemory,
          warmStartPolicies,
        });

        // Run optimization
        const startTime = Date.now();
        const bestPolicy = await optimizer.optimize();
        const duration = Date.now() - startTime;

        // Get convergence history
        const progress = optimizer.getProgress();

        // Generate complete strategy from best policy
        const policyEngine = new PolicyEngine(bestPolicy.params);
        const fullStrategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);

        // Create action summary
        const actionSummary = {
          totalActions: fullStrategy.timedActions.length,
          byType: fullStrategy.timedActions.reduce((acc, action) => {
            acc[action.type] = (acc[action.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };

        // Send final result
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            done: true,
            result: {
              bestPolicy: bestPolicy.params,
              bestStrategy: fullStrategy,
              bestNetWorth: bestPolicy.netWorth,
              bestFitness: bestPolicy.fitnessScore,
              bestIteration: bestPolicy.iteration,
              convergenceHistory: progress.convergenceHistory,
              actionSummary,
              duration,
              totalIterations,
              randomExploration,
            },
          })}\n\n`);
          res.end();
        }
        return;
      } catch (error) {
        console.error('Streaming optimization error:', error);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`);
          res.end();
        }
        return;
      }
    }

    // Non-streaming mode (original behavior)
    // Create optimizer
    const optimizer = new BayesianOptimizer({
      totalIterations,
      randomExploration,
      verbose: false, // Don't log to console in API mode
      saveCheckpoints: false, // Don't save checkpoints in API mode
      useMemory,
      warmStartPolicies,
    });

    // Run optimization
    const startTime = Date.now();
    const bestPolicy = await optimizer.optimize();
    const duration = Date.now() - startTime;

    // Get convergence history
    const progress = optimizer.getProgress();

    // Generate complete strategy from best policy
    const policyEngine = new PolicyEngine(bestPolicy.params);
    const fullStrategy = policyEngine.toStrategy(INITIAL_STATE_HISTORICAL);

    // Create action summary
    const actionSummary = {
      totalActions: fullStrategy.timedActions.length,
      byType: fullStrategy.timedActions.reduce((acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Return results with complete strategy
    return res.json({
      bestPolicy: bestPolicy.params,
      bestStrategy: fullStrategy,
      bestNetWorth: bestPolicy.netWorth,
      bestFitness: bestPolicy.fitnessScore,
      bestIteration: bestPolicy.iteration,
      convergenceHistory: progress.convergenceHistory,
      actionSummary,
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

/**
 * POST /api/bayesian-memory/save
 *
 * Save optimization run to historical memory
 */
router.post('/bayesian-memory/save', async (req: Request, res: Response) => {
  try {
    const { policy, fitness, netWorth, demandContext, totalIterations } = req.body;

    if (!policy || !demandContext) {
      return res.status(400).json({ error: 'Policy and demandContext required' });
    }

    const saved = memoryManager.addEvaluation(
      policy,
      fitness,
      netWorth,
      demandContext,
      totalIterations
    );

    if (saved) {
      const stats = memoryManager.getStats();
      return res.json({
        success: true,
        message: 'Evaluation saved to memory',
        stats,
      });
    } else {
      return res.json({
        success: false,
        message: 'Evaluation did not meet quality threshold',
      });
    }
  } catch (error) {
    console.error('Memory save error:', error);
    return res.status(500).json({
      error: 'Failed to save to memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/bayesian-memory/stats
 *
 * Get memory statistics
 */
router.get('/bayesian-memory/stats', (_req: Request, res: Response) => {
  try {
    const stats = memoryManager.getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Memory stats error:', error);
    return res.status(500).json({
      error: 'Failed to get memory stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/bayesian-memory/matching
 *
 * Get count of matching evaluations for given demand context
 */
router.get('/bayesian-memory/matching', (req: Request, res: Response) => {
  try {
    const demandContext = req.query as unknown as DemandContext;

    if (!demandContext) {
      return res.status(400).json({ error: 'demandContext query parameters required' });
    }

    const matching = memoryManager.getMatchingEvaluations(demandContext);
    const topPolicies = memoryManager.getTopPolicies(10, demandContext);

    return res.json({
      count: matching.length,
      avgFitness: matching.reduce((sum, e) => sum + e.fitness, 0) / matching.length || 0,
      topFitness: Math.max(...matching.map(e => e.fitness), 0),
      topPolicies,
    });
  } catch (error) {
    console.error('Memory matching error:', error);
    return res.status(500).json({
      error: 'Failed to get matching evaluations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/bayesian-memory/clear
 *
 * Clear all historical memory
 */
router.delete('/bayesian-memory/clear', (_req: Request, res: Response) => {
  try {
    memoryManager.clear();
    return res.json({
      success: true,
      message: 'Memory cleared successfully',
    });
  } catch (error) {
    console.error('Memory clear error:', error);
    return res.status(500).json({
      error: 'Failed to clear memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
