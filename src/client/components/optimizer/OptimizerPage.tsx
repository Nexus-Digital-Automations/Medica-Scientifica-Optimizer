import { useState } from 'react';
import AdvancedOptimizer from '../strategy/AdvancedOptimizer';
import Phase2Optimizer from './Phase2Optimizer';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';

export default function OptimizerPage() {
  const [phase1Results, setPhase1Results] = useState<OptimizationCandidate[]>([]);

  // User-selected strategies for Phase 2 seeding
  const [selectedStrategies, setSelectedStrategies] = useState<OptimizationCandidate[]>([]);

  const handlePhase1Complete = (results: OptimizationCandidate[]) => {
    setPhase1Results(results);
    // Auto-select top strategy by growth rate as default
    if (results.length > 0) {
      setSelectedStrategies([results[0]]);
    }
    console.log('Phase 1 results received in OptimizerPage:', results);
  };

  const handleStrategySelection = (strategy: OptimizationCandidate, checked: boolean) => {
    if (checked) {
      setSelectedStrategies(prev => [...prev, strategy]);
    } else {
      setSelectedStrategies(prev => prev.filter(s => s.id !== strategy.id));
    }
  };

  const hasPhase1Results = phase1Results.length > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-6 border border-purple-600">
        <h2 className="text-3xl font-bold text-white mb-2">
          🎯 Two-Phase Optimizer
        </h2>
        <p className="text-gray-200 text-sm">
          Phase 1: Broad exploration with genetic algorithm → Phase 2: Focused refinement around best solutions
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div className="bg-blue-900/30 border border-blue-600/50 rounded p-3">
            <div className="font-semibold text-blue-300 mb-1">🔵 Phase 1: Initial Optimization</div>
            <div className="text-gray-300">Wide exploration of solution space to discover promising strategies</div>
          </div>
          <div className="bg-green-900/30 border border-green-600/50 rounded p-3">
            <div className="font-semibold text-green-300 mb-1">🟢 Phase 2: Refinement</div>
            <div className="text-gray-300">Fine-tune Phase 1 results with guided mutations (±5-15% variations)</div>
          </div>
        </div>
      </div>

      {/* Phase 1 Section */}
      <section className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              🔵 Phase 1: Initial Optimization
            </h3>
            <p className="text-sm text-gray-400">
              Configure constraints, genetic algorithm parameters, and run broad exploration
            </p>
          </div>
          {hasPhase1Results && (
            <div className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ready for Phase 2
            </div>
          )}
        </div>
        <AdvancedOptimizer onResultsReady={handlePhase1Complete} />
      </section>

      {/* Strategy Selection for Phase 2 */}
      {hasPhase1Results && (
        <section className="bg-gray-800 rounded-lg border border-purple-600 p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white mb-2">
              📋 Select Strategies for Phase 2 Refinement
            </h3>
            <p className="text-sm text-gray-400">
              Choose which Phase 1 strategies to use as seeds for Phase 2. Selected: {selectedStrategies.length}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-blue-300 mb-3">🚀 Top Strategies by Growth Rate</h4>
            <div className="space-y-2">
              {phase1Results.slice(0, 5).map((strategy, idx) => (
                <label
                  key={strategy.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedStrategies.some(s => s.id === strategy.id)
                      ? 'bg-blue-900/40 border-2 border-blue-500'
                      : 'bg-gray-700/50 border-2 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStrategies.some(s => s.id === strategy.id)}
                    onChange={(e) => handleStrategySelection(strategy, e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                      <span className="text-sm font-semibold text-white">#{idx + 1}</span>
                    </div>
                    <p className="text-sm text-green-400 font-bold">
                      ${strategy.growthRate?.toFixed(0)}/day
                    </p>
                    <p className="text-xs text-gray-400">
                      Net Worth: ${strategy.netWorth.toLocaleString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded">
            <p className="text-xs text-blue-300">
              💡 Tip: Select multiple strategies to explore different refinement paths. Phase 2 will create variations around each selected strategy.
            </p>
          </div>
        </section>
      )}

      {/* Phase 2 Section - Always Unlocked and Functional */}
      <section className={`bg-gray-800 rounded-lg border p-6 transition-all ${
        selectedStrategies.length > 0
          ? 'border-green-600'
          : 'border-gray-600'
      }`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              🟢 Phase 2: Refinement
            </h3>
            <p className="text-sm text-gray-400">
              Fine-tune selected strategies with focused mutations and pattern-guided exploration
            </p>
          </div>
          {selectedStrategies.length > 0 && (
            <div className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {selectedStrategies.length} Strateg{selectedStrategies.length === 1 ? 'y' : 'ies'} Selected
            </div>
          )}
        </div>
        <Phase2Optimizer selectedStrategies={selectedStrategies} />
      </section>
    </div>
  );
}
