/**
 * Bayesian Optimization Panel Component
 *
 * Allows users to run policy-based Bayesian Optimization with configurable iterations.
 */

import { useState } from 'react';
import type { PolicyParameters } from '../../../optimization/policyEngine.js';

interface BayesianOptimizerPanelProps {
  onOptimizationComplete?: (result: OptimizationResult) => void;
}

interface OptimizationResult {
  bestPolicy: PolicyParameters;
  bestNetWorth: number;
  bestFitness: number;
  convergenceHistory: number[];
  duration: number;
}

export default function BayesianOptimizerPanel({ onOptimizationComplete }: BayesianOptimizerPanelProps) {
  const [totalIterations, setTotalIterations] = useState<string | number>(150);
  const [randomExploration, setRandomExploration] = useState<string | number>(30);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleStartOptimization = async () => {
    if (isRunning) return;

    // Parse and validate before starting
    const totalIter = typeof totalIterations === 'string' ? parseInt(totalIterations) || 150 : totalIterations;
    const randomExp = typeof randomExploration === 'string' ? parseInt(randomExploration) || 30 : randomExploration;

    setIsRunning(true);
    setProgress({ current: 0, total: totalIter, phase: 'Initializing...' });
    setResult(null);

    try {
      const response = await fetch('/api/bayesian-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalIterations: totalIter,
          randomExploration: randomExp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
      onOptimizationComplete?.(data);
    } catch (error) {
      console.error('Bayesian optimization error:', error);
      alert(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-lg p-6 border border-indigo-600">
      <h3 className="text-2xl font-bold text-white mb-4">
        🧠 Bayesian Policy Optimization
      </h3>
      <p className="text-gray-300 text-sm mb-6">
        Policy-based optimization using Bayesian methods to find optimal business rules.
        Optimizes 15 high-level parameters instead of 3,650 daily decisions.
      </p>

      {/* Configuration */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Total Iterations
            <span className="ml-2 text-xs text-gray-400">
              (150-200 recommended, ~45ms each)
            </span>
          </label>
          <input
            type="number"
            value={totalIterations}
            onChange={(e) => setTotalIterations(e.target.value)}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              if (isNaN(val) || val < 10) {
                setTotalIterations(150);
              } else if (val > 500) {
                setTotalIterations(500);
              } else {
                setTotalIterations(val);
              }
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
            min="10"
            max="500"
            disabled={isRunning}
          />
          <div className="text-xs text-gray-400 mt-1">
            Estimated time: ~{(((typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150) * 45) / 1000).toFixed(1)}s
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Random Exploration Iterations
            <span className="ml-2 text-xs text-gray-400">
              (20-30% of total recommended)
            </span>
          </label>
          <input
            type="number"
            value={randomExploration}
            onChange={(e) => setRandomExploration(e.target.value)}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              const maxIter = typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150;
              if (isNaN(val) || val < 5) {
                setRandomExploration(30);
              } else if (val > maxIter) {
                setRandomExploration(maxIter);
              } else {
                setRandomExploration(val);
              }
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
            min="5"
            max={typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150}
            disabled={isRunning}
          />
          <div className="text-xs text-gray-400 mt-1">
            Guided search: {(typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150) - (typeof randomExploration === 'number' ? randomExploration : parseInt(randomExploration) || 30)} iterations
          </div>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={handleStartOptimization}
        disabled={isRunning}
        className={`w-full py-3 rounded font-semibold text-white transition-colors ${
          isRunning
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {isRunning ? '⏳ Optimizing...' : '🚀 Start Bayesian Optimization'}
      </button>

      {/* Progress */}
      {isRunning && progress.total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-300 mb-2">
            <span>{progress.phase}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-3">Optimization Results</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Best Net Worth</div>
              <div className="text-xl font-bold text-green-400">
                ${result.bestNetWorth.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Fitness Score</div>
              <div className="text-lg font-semibold text-blue-400">
                {result.bestFitness.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Duration</div>
              <div className="text-lg text-white">
                {(result.duration / 1000).toFixed(1)}s
              </div>
            </div>
            <div>
              <div className="text-gray-400">Avg per Iteration</div>
              <div className="text-lg text-white">
                {(result.duration / (typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150)).toFixed(0)}ms
              </div>
            </div>
          </div>

          {/* Top Parameters */}
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-300 mb-2">Key Parameters:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-900/50 p-2 rounded">
                <span className="text-gray-400">MCE Custom Allocation:</span>
                <span className="ml-2 text-white font-medium">
                  {(result.bestPolicy.mceCustomAllocation * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-gray-900/50 p-2 rounded">
                <span className="text-gray-400">Standard Price:</span>
                <span className="ml-2 text-white font-medium">
                  ${(225 * result.bestPolicy.standardPriceMultiplier).toFixed(2)}
                </span>
              </div>
              <div className="bg-gray-900/50 p-2 rounded">
                <span className="text-gray-400">Reorder Point:</span>
                <span className="ml-2 text-white font-medium">
                  {result.bestPolicy.reorderPoint}
                </span>
              </div>
              <div className="bg-gray-900/50 p-2 rounded">
                <span className="text-gray-400">Target Experts:</span>
                <span className="ml-2 text-white font-medium">
                  {result.bestPolicy.targetExperts}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              // TODO: Apply best policy to strategy
              alert('Apply policy feature coming soon!');
            }}
            className="mt-4 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
          >
            Apply Best Policy to Strategy
          </button>
        </div>
      )}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-900/20 border border-blue-600/30 rounded p-4">
        <div className="text-xs text-gray-300 space-y-2">
          <div className="font-semibold text-blue-300">What gets optimized:</div>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Inventory policy (reorder point, order quantity, safety stock)</li>
            <li>Production mix (MCE allocation between custom/standard)</li>
            <li>Batching strategy (batch size, interval)</li>
            <li>Workforce policy (target experts, hire thresholds, overtime)</li>
            <li>Financial policy (cash reserves, loan amounts, repayment)</li>
            <li>Pricing strategy (standard price multiplier, custom base price)</li>
          </ul>
          <div className="mt-3 font-semibold text-blue-300">Sensitive analysis shows:</div>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Most critical:</strong> MCE Custom Allocation (17.5% impact)</li>
            <li><strong>Important:</strong> Standard Price Multiplier (7.4% impact)</li>
            <li><strong>Moderate:</strong> Order Quantity (1.5% impact)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
