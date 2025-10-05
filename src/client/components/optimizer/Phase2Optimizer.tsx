import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';
import {
  generateSeededPopulation,
  mutateRefinement,
  generateLocalVariations,
} from '../../utils/geneticOptimizer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ExcelJS from 'exceljs';

interface Phase2OptimizerProps {
  selectedStrategies: OptimizationCandidate[];
  evaluationWindow: number;
}

export default function Phase2Optimizer({ selectedStrategies, evaluationWindow }: Phase2OptimizerProps) {
  const { strategy, loadStrategy } = useStrategyStore();

  // Phase 2 Configuration - All Granular Controls
  const [refinementIntensity, setRefinementIntensity] = useState(0.10); // 10% default
  const [populationSize, setPopulationSize] = useState(25);
  const [generations, setGenerations] = useState(10);
  const [mutationRate, setMutationRate] = useState(0.25); // 25% default for Phase 2
  const [eliteCount, setEliteCount] = useState(3);

  // Optimization state
  const [isRefining, setIsRefining] = useState(false);
  const [phase2Results, setPhase2Results] = useState<OptimizationCandidate[]>([]);
  const [refinementProgress, setRefinementProgress] = useState({ current: 0, total: 0 });

  // Get test day and end day from Phase 1 results (assuming consistent across all candidates)
  const testDay = 51; // Default, can be extracted from Phase 1 if needed
  const endDay = 415;

  const hasPhase2Results = phase2Results.length > 0;

  const runPhase2Refinement = async () => {
    // Check if we have selected strategies to work with
    if (selectedStrategies.length === 0) {
      alert('⚠️ No strategies selected. Please select at least one Phase 1 strategy to refine.');
      return;
    }

    setIsRefining(true);
    setPhase2Results([]);
    setRefinementProgress({ current: 0, total: populationSize * generations });

    try {
      // Generate seeded population from selected strategies
      let population = generateSeededPopulation(selectedStrategies, populationSize, refinementIntensity);

      if (population.length === 0) {
        alert('⚠️ Failed to generate population from Phase 1 results.');
        setIsRefining(false);
        return;
      }

      console.log(`🟢 Starting Phase 2 refinement with ${population.length} candidates`);

      // Evolution loop
      for (let gen = 0; gen < generations; gen++) {
        console.log(`🧬 Phase 2 Generation ${gen + 1}/${generations}`);
        setRefinementProgress(prev => ({ ...prev, generation: gen + 1 }));

        // Evaluate fitness for all candidates
        for (let i = 0; i < population.length; i++) {
          const candidate = population[i];

          // Build test strategy from candidate
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
          const testStrategy: Strategy = {
            ...strategy,
            // Apply strategy parameter overrides
            ...(candidate.strategyParams && {
              dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
            }),
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions,
            ].sort((a, b) => a.day - b.day),
          };

          try {
            const response = await fetch('/api/simulate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
              cache: 'no-store',
              body: JSON.stringify({ strategy: testStrategy }),
            });

            if (!response.ok) {
              throw new Error(`Simulation failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success || !data.result) {
              throw new Error(`Simulation failed: ${data.error}`);
            }

            const result = data.result;
            candidate.fullState = result;

            // Calculate fitness metric (growth rate)
            let growthRate = 0;
            let endNetWorth = result.finalNetWorth;

            if (result.state?.history?.dailyNetWorth) {
              const dailyNetWorth = result.state.history.dailyNetWorth;
              const startDay = testDay;
              const evaluationEndDay = Math.min(startDay + evaluationWindow, endDay);

              const startNetWorth = dailyNetWorth.find((d: { day: number; value: number }) => d.day === startDay)?.value || 0;

              // Growth Rate (average $/day over evaluation window)
              const endDayData = dailyNetWorth.find((d: { day: number; value: number }) => d.day === evaluationEndDay);
              endNetWorth = endDayData?.value || result.finalNetWorth;
              growthRate = (endNetWorth - startNetWorth) / evaluationWindow;

              candidate.history = dailyNetWorth;
            }

            candidate.netWorth = endNetWorth;
            candidate.growthRate = growthRate;
            candidate.fitness = growthRate; // Primary fitness

            console.log(`Phase 2 Candidate ${candidate.id}: $${growthRate.toFixed(0)}/day`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Phase 2 simulation error for ${candidate.id}:`, errorMsg);
            candidate.fitness = -Infinity;
            candidate.netWorth = -Infinity;
            candidate.error = errorMsg;
          }

          setRefinementProgress(prev => ({
            ...prev,
            current: gen * populationSize + i + 1,
          }));
        }

        // Check if all failed
        const allFailed = population.every(c => c.fitness === -Infinity);
        if (allFailed) {
          throw new Error('All Phase 2 simulations failed! Check backend server.');
        }

        // Sort by fitness
        population.sort((a, b) => b.fitness - a.fitness);

        // If last generation, save results
        if (gen === generations - 1) {
          const topResults = [...population]
            .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
            .slice(0, 5);

          setPhase2Results(topResults);
          console.log('✅ Phase 2 refinement complete!');
          console.log('🚀 Top 5 Results:', topResults);
          break;
        }

        // Selection: Keep elite
        const elite = population.slice(0, eliteCount);

        // Generate next generation
        const nextGen: OptimizationCandidate[] = [...elite];

        while (nextGen.length < populationSize) {
          // Tournament selection
          const parent1 = population[Math.floor(Math.random() * Math.min(10, population.length))];
          const parent2 = population[Math.floor(Math.random() * Math.min(10, population.length))];

          // Crossover actions
          const splitPoint = Math.floor(Math.random() * Math.min(parent1.actions.length, parent2.actions.length));
          let childActions = [
            ...parent1.actions.slice(0, splitPoint),
            ...parent2.actions.slice(splitPoint),
          ];

          // Mutate with refinement intensity
          if (Math.random() < mutationRate) {
            childActions = generateLocalVariations(childActions, refinementIntensity);
          }

          // Crossover strategy parameters
          let childParams: OptimizationCandidate['strategyParams'] = undefined;
          if (parent1.strategyParams && parent2.strategyParams) {
            childParams = {};
            Object.keys(parent1.strategyParams).forEach(key => {
              const k = key as keyof typeof parent1.strategyParams;
              if (parent1.strategyParams![k] !== undefined && parent2.strategyParams![k] !== undefined) {
                childParams![k] = Math.random() < 0.5 ? parent1.strategyParams![k] : parent2.strategyParams![k];
              }
            });

            // Mutate with refinement
            if (Math.random() < mutationRate) {
              childParams = mutateRefinement(childParams, refinementIntensity);
            }
          }

          nextGen.push({
            id: `phase2-gen${gen + 1}-${nextGen.length}`,
            actions: childActions,
            fitness: 0,
            netWorth: 0,
            strategyParams: childParams,
          });
        }

        population = nextGen;
      }
    } catch (error) {
      console.error('❌ Phase 2 refinement failed:', error);
      alert('Phase 2 refinement failed. Check console for details.');
    } finally {
      setIsRefining(false);
      setRefinementProgress({ current: 0, total: 0 });
    }
  };

  const downloadComprehensiveXLSX = async (candidate: OptimizationCandidate, idx: number, phase: string) => {
    if (!candidate.fullState) {
      alert('No simulation data available for this result');
      return;
    }

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Daily History
    const dailyHistorySheet = workbook.addWorksheet('Daily History');
    const simulationHistory = candidate.fullState.state?.history || {};
    const simulationMetrics = Object.keys(simulationHistory).filter(key => Array.isArray(simulationHistory[key]));

    const headerRow: string[] = ['Day', 'Data Source'];
    simulationMetrics.forEach(metric => {
      const formatted = metric.replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/daily /i, '');
      headerRow.push(formatted);
    });
    dailyHistorySheet.addRow(headerRow);

    for (let day = 1; day <= 500; day++) {
      const row: (string | number)[] = [day];
      row.push(day <= 50 ? 'Historical' : 'Simulation');

      simulationMetrics.forEach(metric => {
        if (day <= 50) {
          row.push('');
        } else {
          const simulationDayIndex = day - 1;
          const dataPoint = simulationHistory[metric][simulationDayIndex];
          if (dataPoint && typeof dataPoint === 'object' && 'value' in dataPoint) {
            row.push(dataPoint.value);
          } else if (typeof dataPoint === 'number') {
            row.push(dataPoint);
          } else {
            row.push('');
          }
        }
      });

      dailyHistorySheet.addRow(row);
    }

    // Sheet 2: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['=== SIMULATION SUMMARY ===']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Strategy ID', candidate.id]);
    summarySheet.addRow(['Phase', phase]);
    summarySheet.addRow(['Rank', `#${idx + 1}`]);
    summarySheet.addRow(['Growth Rate', `$${candidate.growthRate?.toFixed(0)}/day`]);
    summarySheet.addRow(['Net Worth', `$${candidate.netWorth.toLocaleString()}`]);
    summarySheet.addRow([]);

    // Actions
    summarySheet.addRow(['=== TIMED ACTIONS ===']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Day', 'Action Type', 'Details']);
    candidate.actions.forEach(action => {
      let details = '';
      if ('newReorderPoint' in action) details = `New Reorder Point: ${action.newReorderPoint} units`;
      else if ('newOrderQuantity' in action) details = `New Order Quantity: ${action.newOrderQuantity} units`;
      else if ('newPrice' in action) details = `New Price: $${action.newPrice}`;
      else if ('newSize' in action) details = `New Batch Size: ${action.newSize} units`;
      else if ('count' in action) details = `Count: ${action.count}`;

      summarySheet.addRow([action.day, action.type, details]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${phase}-strategy-${idx + 1}-${candidate.id}-${Date.now()}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportStrategy = (candidate: OptimizationCandidate) => {
    const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
    const exportStrategy = {
      ...strategy,
      timedActions: [
        ...actionsBeforeTestDay,
        ...candidate.actions,
      ].sort((a, b) => a.day - b.day),
    };

    const dataStr = JSON.stringify(exportStrategy, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `phase2-strategy-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      {/* Seed Information */}
      {selectedStrategies.length > 0 ? (
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-blue-300 mb-2">
            📊 Seeded from {selectedStrategies.length} Selected Strateg{selectedStrategies.length === 1 ? 'y' : 'ies'}
          </h4>
          <div className="grid grid-cols-1 gap-3 text-sm">
            {selectedStrategies.map((strategy, idx) => (
              <div key={strategy.id} className="bg-gray-900/40 rounded p-3 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                    <span className="text-xs text-gray-500">ID: {strategy.id}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400 font-bold">
                      ${strategy.growthRate?.toFixed(0)}/day
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Net Worth: ${strategy.netWorth.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Phase 2 will create variations around these {selectedStrategies.length} strateg{selectedStrategies.length === 1 ? 'y' : 'ies'} using
            ±{(refinementIntensity * 100).toFixed(0)}% mutations and pattern-guided exploration
          </p>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-yellow-300 mb-2">📊 No Strategies Selected</h4>
          <p className="text-sm text-gray-300">
            Select at least one Phase 1 strategy above to use as a seed for Phase 2 refinement.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Phase 2 works by creating focused variations around successful Phase 1 strategies.
          </p>
        </div>
      )}

      {/* Refinement Controls - Full Granular Configuration */}
      <div className="bg-gray-750 rounded-lg border border-gray-600 p-4">
        <h4 className="text-md font-semibold text-white mb-3">⚙️ Phase 2 Configuration (Granular Controls)</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="refinement-intensity" className="block text-sm font-medium text-white mb-2">
              Refinement Intensity
            </label>
            <input
              id="refinement-intensity"
              type="range"
              min="5"
              max="30"
              step="5"
              value={refinementIntensity * 100}
              onChange={(e) => setRefinementIntensity(e.target.valueAsNumber / 100)}
              disabled={isRefining}
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              ±{(refinementIntensity * 100).toFixed(0)}% variation
            </p>
            <p className="text-xs text-gray-500">
              Lower = fine-tuning, Higher = more exploration
            </p>
          </div>

          <div>
            <label htmlFor="phase2-population" className="block text-sm font-medium text-white mb-2">
              Population Size
            </label>
            <input
              id="phase2-population"
              type="number"
              min="15"
              max="50"
              value={populationSize}
              onChange={(e) => setPopulationSize(e.target.valueAsNumber)}
              disabled={isRefining}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Candidates per generation
            </p>
          </div>

          <div>
            <label htmlFor="phase2-generations" className="block text-sm font-medium text-white mb-2">
              Generations
            </label>
            <input
              id="phase2-generations"
              type="number"
              min="5"
              max="20"
              value={generations}
              onChange={(e) => setGenerations(e.target.valueAsNumber)}
              disabled={isRefining}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Evolution cycles
            </p>
          </div>

          <div>
            <label htmlFor="phase2-mutation-rate" className="block text-sm font-medium text-white mb-2">
              Mutation Rate
            </label>
            <input
              id="phase2-mutation-rate"
              type="number"
              min="10"
              max="50"
              step="5"
              value={mutationRate * 100}
              onChange={(e) => setMutationRate(e.target.valueAsNumber / 100)}
              disabled={isRefining}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              {(mutationRate * 100).toFixed(0)}% chance of mutation
            </p>
          </div>

          <div>
            <label htmlFor="phase2-elite-count" className="block text-sm font-medium text-white mb-2">
              Elite Count
            </label>
            <input
              id="phase2-elite-count"
              type="number"
              min="1"
              max="10"
              value={eliteCount}
              onChange={(e) => setEliteCount(e.target.valueAsNumber)}
              disabled={isRefining}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Top candidates preserved
            </p>
          </div>

          <div className="flex items-end">
            <div className="w-full">
              <p className="text-xs text-gray-400 mb-2">Total Simulations:</p>
              <p className="text-lg font-bold text-green-400">
                {populationSize * generations}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runPhase2Refinement}
        disabled={isRefining}
        className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
      >
        {isRefining ? (
          <>
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Refining... ({refinementProgress.current}/{refinementProgress.total})
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Phase 2 Refinement
          </>
        )}
      </button>

      {/* Results */}
      {hasPhase2Results && (
        <div className="space-y-6">
          {/* Improvement Summary */}
          {selectedStrategies.length > 0 && selectedStrategies[0] && phase2Results[0] && (
            <div className="bg-green-900/20 border-2 border-green-600 rounded-lg p-4">
              <h4 className="text-lg font-bold text-green-300 mb-3">🟢 Phase 2 Best Result</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Growth Rate</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${phase2Results[0]?.growthRate?.toFixed(0)}/day
                  </p>
                  {(() => {
                    const improvement = (phase2Results[0]?.growthRate || 0) - (selectedStrategies[0]?.growthRate || 0);
                    const improvementPct = selectedStrategies[0]?.growthRate
                      ? (improvement / selectedStrategies[0].growthRate) * 100
                      : 0;
                    return improvement !== 0 ? (
                      <p className={`text-sm font-semibold ${improvement > 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {improvement > 0 ? '+' : ''}${improvement.toFixed(0)}/day ({improvementPct > 0 ? '+' : ''}{improvementPct.toFixed(1)}%)
                      </p>
                    ) : null;
                  })()}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Net Worth</p>
                  <p className="text-xl font-semibold text-white">
                    ${phase2Results[0]?.netWorth.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">vs Phase 1 Best</p>
                  <p className="text-lg text-gray-300">
                    ${selectedStrategies[0]?.growthRate?.toFixed(0)}/day
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2 Top Results */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">📊 Phase 2 Top Results</h4>
            <div className="space-y-3">
              {phase2Results.slice(0, 5).map((result, idx) => (
                <div
                  key={result.id}
                  className="p-4 bg-gradient-to-r from-gray-750 to-gray-800 border border-gray-600 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                        <h5 className="text-white font-semibold">Phase 2 Strategy #{idx + 1}</h5>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-lg text-green-400 font-bold">
                          ${result.growthRate?.toFixed(0)}/day growth rate
                        </p>
                        <p className="text-sm text-gray-400">
                          Net Worth: ${result.netWorth.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
                          loadStrategy({
                            ...strategy,
                            timedActions: [
                              ...actionsBeforeTestDay,
                              ...result.actions,
                            ].sort((a, b) => a.day - b.day),
                          });
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                      >
                        Add to Strategy
                      </button>
                      <button
                        onClick={() => exportStrategy(result)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => downloadComprehensiveXLSX(result, idx, 'Phase2')}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
                      >
                        📊 Excel
                      </button>
                    </div>
                  </div>

                  {result.actions && result.actions.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-400 mb-2 font-semibold">
                        📋 Actions on Day {testDay}:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {result.actions.slice(0, 6).map((action, actionIdx) => {
                          let actionText = '';
                          if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
                            actionText = `Hire ${action.count} rookies`;
                          } else if (action.type === 'BUY_MACHINE' && 'machineType' in action && 'count' in action) {
                            actionText = `Buy ${action.count}x ${action.machineType}`;
                          } else if (action.type === 'ADJUST_PRICE' && 'newPrice' in action) {
                            actionText = `Price: $${action.newPrice}`;
                          } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
                            actionText = `Batch: ${action.newSize}`;
                          } else {
                            actionText = action.type;
                          }

                          return (
                            <div key={actionIdx} className="text-gray-300 flex items-center gap-2">
                              <span className="text-blue-400">•</span>
                              {actionText}
                            </div>
                          );
                        })}
                      </div>
                      {result.actions.length > 6 && (
                        <p className="text-xs text-gray-500 mt-2">
                          +{result.actions.length - 6} more actions...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Net Worth Graph */}
                  {result.history && result.history.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-900/50 rounded">
                      <div className="text-xs text-gray-400 mb-3 font-semibold">
                        📈 Net Worth Over Time
                      </div>
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={result.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="day"
                            stroke="#9CA3AF"
                            style={{ fontSize: '10px' }}
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            style={{ fontSize: '10px' }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '6px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                            labelFormatter={(label) => `Day ${label}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#10B981"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
