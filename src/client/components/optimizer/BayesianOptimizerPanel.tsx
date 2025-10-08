/**
 * Bayesian Optimization Panel Component
 *
 * Allows users to run policy-based Bayesian Optimization with configurable iterations.
 */

import { useState, useEffect } from 'react';
import type { PolicyParameters } from '../../../optimization/policyEngine.js';
import type { Strategy, StrategyAction } from '../../../simulation/types.js';
import { useStrategyStore } from '../../stores/strategyStore';

interface MemoryStats {
  totalRuns: number;
  avgFitness: number;
  topFitness: number;
  lastUpdated: string;
}

interface MemoryMatching {
  count: number;
  avgFitness: number;
  topFitness: number;
}

interface BayesianOptimizerPanelProps {
  onOptimizationComplete?: (result: OptimizationResult) => void;
  onLoadIntoBuilder?: () => void;
}

interface OptimizationResult {
  bestPolicy: PolicyParameters;
  bestStrategy: Strategy;
  bestNetWorth: number;
  bestFitness: number;
  convergenceHistory: number[];
  duration: number;
  actionSummary: {
    totalActions: number;
    byType: Record<string, number>;
  };
}

export default function BayesianOptimizerPanel({ onOptimizationComplete, onLoadIntoBuilder }: BayesianOptimizerPanelProps) {
  const [totalIterations, setTotalIterations] = useState<string | number>(150);
  const [randomExploration, setRandomExploration] = useState<string | number>(30);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [useMemory, setUseMemory] = useState(false);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [memoryMatching, setMemoryMatching] = useState<MemoryMatching | null>(null);

  const { loadStrategy, strategy } = useStrategyStore();

  // Fetch memory stats on mount
  useEffect(() => {
    fetchMemoryStats();
  }, []);

  // Fetch matching evaluations when memory toggle changes
  useEffect(() => {
    if (useMemory) {
      fetchMatchingEvaluations();
    }
  }, [useMemory]);

  const fetchMemoryStats = async () => {
    try {
      const response = await fetch('/api/bayesian-memory/stats');
      if (response.ok) {
        const stats = await response.json();
        setMemoryStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch memory stats:', error);
    }
  };

  const fetchMatchingEvaluations = async () => {
    try {
      const demandContext = {
        customDemandMean1: strategy.customDemandMean1,
        customDemandStdDev1: strategy.customDemandStdDev1,
        customDemandMean2: strategy.customDemandMean2,
        customDemandStdDev2: strategy.customDemandStdDev2,
        standardDemandIntercept: strategy.standardDemandIntercept,
        standardDemandSlope: strategy.standardDemandSlope,
      };

      const params = new URLSearchParams(
        Object.entries(demandContext).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>)
      );
      const response = await fetch(`/api/bayesian-memory/matching?${params}`);
      if (response.ok) {
        const matching = await response.json();
        setMemoryMatching(matching);
      }
    } catch (error) {
      console.error('Failed to fetch matching evaluations:', error);
    }
  };

  // Helper function to format actions for display
  const formatAction = (action: StrategyAction): string => {
    switch (action.type) {
      case 'ORDER_MATERIALS':
        return `📦 Order ${action.quantity} materials`;
      case 'TAKE_LOAN':
        return `💰 Take loan $${action.amount.toLocaleString()}`;
      case 'PAY_DEBT':
        return `💰 Repay debt $${action.amount.toLocaleString()}`;
      case 'ADJUST_PRICE':
        return `💲 Set ${action.productType} price $${action.newPrice.toFixed(2)}`;
      case 'ADJUST_MCE_ALLOCATION':
        return `🏭 Set MCE allocation ${(action.newAllocation * 100).toFixed(1)}% custom`;
      case 'ADJUST_BATCH_SIZE':
        return `📊 Set batch size ${action.newSize}`;
      case 'HIRE_ROOKIE':
        return `👤 Hire ${action.count} rookie${action.count > 1 ? 's' : ''}`;
      case 'FIRE_EMPLOYEE':
        return `👤 Fire ${action.count} ${action.employeeType}${action.count > 1 ? 's' : ''}`;
      case 'BUY_MACHINE':
        return `🏭 Buy ${action.count} ${action.machineType} machine${action.count > 1 ? 's' : ''}`;
      case 'SELL_MACHINE':
        return `🏭 Sell ${action.count} ${action.machineType} machine${action.count > 1 ? 's' : ''}`;
      case 'SET_REORDER_POINT':
        return `📦 Set reorder point ${action.newReorderPoint}`;
      case 'SET_ORDER_QUANTITY':
        return `📦 Set order quantity ${action.newOrderQuantity}`;
      case 'STOP_MATERIAL_ORDERS':
        return `🛑 Stop material orders`;
    }
  };

  const handleStartOptimization = async () => {
    if (isRunning) return;

    // Parse and validate before starting
    const totalIter = typeof totalIterations === 'string' ? parseInt(totalIterations) || 150 : totalIterations;
    const randomExp = typeof randomExploration === 'string' ? parseInt(randomExploration) || 30 : randomExploration;

    setIsRunning(true);
    setProgress({ current: 0, total: totalIter, phase: 'Initializing...' });
    setResult(null);

    try {
      // Extract demand context from strategy
      const demandContext = {
        customDemandMean1: strategy.customDemandMean1,
        customDemandStdDev1: strategy.customDemandStdDev1,
        customDemandMean2: strategy.customDemandMean2,
        customDemandStdDev2: strategy.customDemandStdDev2,
        standardDemandIntercept: strategy.standardDemandIntercept,
        standardDemandSlope: strategy.standardDemandSlope,
      };

      // Use fetch with streaming for progress updates
      const response = await fetch('/api/bayesian-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalIterations: totalIter,
          randomExploration: randomExp,
          stream: true,
          useMemory,
          demandContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.statusText}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              console.log('📊 Received SSE data:', data);

              if (data.error) {
                // Error from server
                throw new Error(data.message || 'Optimization failed on server');
              }

              if (data.done) {
                // Final result received
                console.log('✅ Optimization complete, setting result');
                setResult(data.result);
                onOptimizationComplete?.(data.result);
                setIsRunning(false);
              } else {
                // Progress update
                console.log('📈 Updating progress:', data.iteration, '/', data.total);
                setProgress({
                  current: data.iteration,
                  total: data.total,
                  phase: data.phase,
                });
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', line, parseError);
              throw parseError;
            }
          }
        }
      }
    } catch (error) {
      console.error('Bayesian optimization error:', error);
      alert(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      {/* Historical Memory Toggle - Always Visible */}
      <div className="mb-6 bg-blue-900/20 border border-blue-600/30 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useMemory"
              checked={useMemory}
              onChange={(e) => setUseMemory(e.target.checked)}
              disabled={isRunning || !memoryStats || memoryStats.totalRuns === 0}
              className="w-5 h-5 rounded"
            />
            <label htmlFor="useMemory" className="text-sm font-semibold text-white cursor-pointer">
              🧠 Use Historical Memory
            </label>
          </div>
          <div className="text-xs text-gray-400">
            {memoryStats ? `${memoryStats.totalRuns} runs saved` : 'Loading...'}
          </div>
        </div>

        {/* No memory message */}
        {memoryStats && memoryStats.totalRuns === 0 && (
          <div className="mt-3 text-xs text-gray-400">
            💡 No historical data yet. Run optimization and use "Save to Memory" button to build up knowledge base.
          </div>
        )}

        {/* Memory available and enabled */}
        {useMemory && memoryMatching && memoryStats && memoryStats.totalRuns > 0 && (
          <div className="mt-3 text-xs text-gray-300 space-y-1">
            <div className="font-semibold text-blue-300">
              {memoryMatching.count > 0 ?
                `✅ Found ${memoryMatching.count} matching evaluations` :
                '⚠️ No matching evaluations (different demand parameters)'
              }
            </div>
            {memoryMatching.count > 0 && (
              <>
                <div>Avg Historical Fitness: {memoryMatching.avgFitness.toLocaleString()}</div>
                <div>Top Historical Fitness: {memoryMatching.topFitness.toLocaleString()}</div>
                <div className="text-green-300 mt-2">
                  Memory will reduce random exploration and start from best historical policies
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Total Iterations
            <span className="ml-2 text-xs text-gray-400">
              (150-200 recommended, ~45ms each, no limit)
            </span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={totalIterations}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string or numbers only
              if (value === '' || /^\d+$/.test(value)) {
                setTotalIterations(value);
              }
            }}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              if (isNaN(val) || val < 10) {
                setTotalIterations(150);
              } else {
                setTotalIterations(val);
              }
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
            disabled={isRunning}
            placeholder="150"
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
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={randomExploration}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string or numbers only
              if (value === '' || /^\d+$/.test(value)) {
                setRandomExploration(value);
              }
            }}
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
            disabled={isRunning}
            placeholder="30"
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

          {/* Complete Policy Parameters */}
          <div className="mt-6 space-y-3">
            <h5 className="font-semibold text-white text-base">Complete Optimized Policy (All 15 Parameters)</h5>

            {/* Inventory Management */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-blue-300 mb-2">📦 Inventory Management</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-400">Reorder Point:</span> <span className="text-white font-medium">{result.bestPolicy.reorderPoint}</span></div>
                <div><span className="text-gray-400">Order Quantity:</span> <span className="text-white font-medium">{result.bestPolicy.orderQuantity}</span></div>
                <div><span className="text-gray-400">Safety Stock:</span> <span className="text-white font-medium">{result.bestPolicy.safetyStock}</span></div>
              </div>
            </div>

            {/* Production Allocation */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-purple-300 mb-2">🏭 Production Allocation</div>
              <div className="text-xs"><span className="text-gray-400">MCE Custom Allocation:</span> <span className="text-white font-medium">{(result.bestPolicy.mceCustomAllocation * 100).toFixed(1)}%</span></div>
            </div>

            {/* Batching Strategy */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-green-300 mb-2">📊 Batching Strategy</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Batch Size:</span> <span className="text-white font-medium">{result.bestPolicy.standardBatchSize}</span></div>
                <div><span className="text-gray-400">Batch Interval:</span> <span className="text-white font-medium">{result.bestPolicy.batchInterval} days</span></div>
              </div>
            </div>

            {/* Workforce Policy */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-yellow-300 mb-2">👥 Workforce Policy</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Target Experts:</span> <span className="text-white font-medium">{result.bestPolicy.targetExperts}</span></div>
                <div><span className="text-gray-400">Hire Threshold:</span> <span className="text-white font-medium">{(result.bestPolicy.hireThreshold * 100).toFixed(0)}%</span></div>
                <div><span className="text-gray-400">Max Overtime:</span> <span className="text-white font-medium">{result.bestPolicy.maxOvertimeHours.toFixed(1)}h</span></div>
                <div><span className="text-gray-400">OT Threshold:</span> <span className="text-white font-medium">{(result.bestPolicy.overtimeThreshold * 100).toFixed(0)}%</span></div>
              </div>
            </div>

            {/* Financial Policy */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-cyan-300 mb-2">💰 Financial Policy</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-400">Cash Reserve:</span> <span className="text-white font-medium">${result.bestPolicy.cashReserveTarget.toLocaleString()}</span></div>
                <div><span className="text-gray-400">Loan Amount:</span> <span className="text-white font-medium">${result.bestPolicy.loanAmount.toLocaleString()}</span></div>
                <div><span className="text-gray-400">Repay At:</span> <span className="text-white font-medium">${result.bestPolicy.repayThreshold.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Pricing Strategy */}
            <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="text-sm font-semibold text-pink-300 mb-2">💲 Pricing Strategy</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Standard Price:</span> <span className="text-white font-medium">${(225 * result.bestPolicy.standardPriceMultiplier).toFixed(2)}</span></div>
                <div><span className="text-gray-400">Custom Base:</span> <span className="text-white font-medium">${result.bestPolicy.customBasePrice.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {/* Actions Timeline Summary */}
          <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h5 className="font-semibold text-white mb-3">Generated Actions Timeline (Days 51-365)</h5>

            {/* Summary Statistics */}
            <div className="grid grid-cols-4 gap-3 text-xs mb-4">
              <div className="bg-blue-900/30 p-2 rounded">
                <div className="text-gray-400">Total Actions</div>
                <div className="text-lg font-bold text-white">{result.actionSummary.totalActions}</div>
              </div>
              <div className="bg-purple-900/30 p-2 rounded">
                <div className="text-gray-400">Material Orders</div>
                <div className="text-lg font-bold text-white">{result.actionSummary.byType.orderMaterials || 0}</div>
              </div>
              <div className="bg-yellow-900/30 p-2 rounded">
                <div className="text-gray-400">Workforce Changes</div>
                <div className="text-lg font-bold text-white">
                  {(result.actionSummary.byType.hireExpert || 0) + (result.actionSummary.byType.fireExpert || 0)}
                </div>
              </div>
              <div className="bg-green-900/30 p-2 rounded">
                <div className="text-gray-400">Financial Actions</div>
                <div className="text-lg font-bold text-white">
                  {(result.actionSummary.byType.takeOutLoan || 0) + (result.actionSummary.byType.repayLoan || 0)}
                </div>
              </div>
            </div>

            {/* Expandable Detailed Timeline */}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
                📋 View All {result.bestStrategy.timedActions.length} Actions (Click to expand)
              </summary>

              <div className="mt-3 max-h-96 overflow-y-auto bg-gray-900/50 rounded p-3 space-y-1">
                {result.bestStrategy.timedActions.map((action, idx) => (
                  <div key={idx} className="text-xs text-gray-300 flex items-start gap-2 py-1 border-b border-gray-800">
                    <span className="text-gray-500 font-mono min-w-[60px]">Day {action.day}:</span>
                    <span className="flex-1">{formatAction(action)}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Action Type Breakdown */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Action Type Breakdown:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(result.actionSummary.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between bg-gray-900/30 px-2 py-1 rounded">
                    <span className="text-gray-400">{type}:</span>
                    <span className="text-white font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export & Save Buttons */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                if (!result) return;

                // Load the optimized strategy into the builder
                loadStrategy(result.bestStrategy);

                // Switch to builder tab if callback provided
                onLoadIntoBuilder?.();
              }}
              className="py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
            >
              📥 Load Into Strategy Builder
            </button>

            <button
              onClick={() => {
                if (!result) return;

                // Create complete export data
                const exportData = {
                  exportedAt: new Date().toISOString(),
                  optimizationResults: {
                    bestNetWorth: result.bestNetWorth,
                    bestFitness: result.bestFitness,
                    duration: result.duration,
                    convergenceHistory: result.convergenceHistory,
                  },
                  policy: result.bestPolicy,
                  strategy: result.bestStrategy,
                  actionSummary: result.actionSummary,
                };

                // Create blob and download
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bayesian-optimization-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
            >
              💾 Download JSON
            </button>

            <button
              onClick={async () => {
                if (!result) return;

                // Extract demand context
                const demandContext = {
                  customDemandMean1: strategy.customDemandMean1,
                  customDemandStdDev1: strategy.customDemandStdDev1,
                  customDemandMean2: strategy.customDemandMean2,
                  customDemandStdDev2: strategy.customDemandStdDev2,
                  standardDemandIntercept: strategy.standardDemandIntercept,
                  standardDemandSlope: strategy.standardDemandSlope,
                };

                try {
                  const response = await fetch('/api/bayesian-memory/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      policy: result.bestPolicy,
                      fitness: result.bestFitness,
                      netWorth: result.bestNetWorth,
                      demandContext,
                      totalIterations: typeof totalIterations === 'number' ? totalIterations : parseInt(totalIterations) || 150,
                    }),
                  });

                  const data = await response.json();

                  if (data.success) {
                    alert(`✅ Saved to memory!\n\nTotal runs in memory: ${data.stats.totalRuns}\nAvg fitness: ${data.stats.avgFitness.toLocaleString()}`);
                    await fetchMemoryStats(); // Refresh stats
                  } else {
                    alert(`⚠️ ${data.message}`);
                  }
                } catch (error) {
                  console.error('Failed to save to memory:', error);
                  alert('Failed to save to memory');
                }
              }}
              className="py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold"
            >
              🧠 Save to Memory
            </button>
          </div>
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
