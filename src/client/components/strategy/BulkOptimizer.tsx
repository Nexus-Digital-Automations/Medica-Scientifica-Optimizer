import React, { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy, StrategyAction, SimulationResult } from '../../types/ui.types';
import {
  generateFormulaBasedActions,
  generateRandomActions,
  mutateActions,
  crossoverActions,
  generateRandomStrategyParams,
  mutateStrategyParams,
  ensureSufficientCash,
  type OptimizationCandidate,
  type OptimizationConfig,
} from '../../utils/geneticOptimizer';

interface OptimizerResults {
  topCandidates: OptimizationCandidate[];
  generation: number;
  totalCandidates: number;
}

export default function BulkOptimizer() {
  const { strategy } = useStrategyStore();
  const [testDay, setTestDay] = useState<number>(75);

  // Version check - log when component loads
  React.useEffect(() => {
    console.log('🚀 BulkOptimizer v2.0-ENHANCED loaded successfully!');
    console.log('📍 If you see this, the new code is active');
  }, []);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, generation: 0 });
  const [results, setResults] = useState<OptimizerResults | null>(null);

  const [config, setConfig] = useState<OptimizationConfig>({
    populationSize: 20,
    generations: 10,
    mutationRate: 0.2,
    elitePercentage: 0.3,
  });

  const [formulaPercentage, setFormulaPercentage] = useState(0.4); // 40% formula-based
  const [topResultsCount, setTopResultsCount] = useState(10);

  const runSimulation = async (testStrategy: Strategy, testDay: number): Promise<number> => {
    try {
      // Log strategy details for debugging
      const actionsOnTestDay = testStrategy.timedActions.filter(a => a.day === testDay);
      console.log('[Genetic Optimizer] Running simulation with strategy:', {
        timedActionsCount: testStrategy.timedActions.length,
        actionsOnTestDay: actionsOnTestDay.length,
        testDay,
        orderQuantity: testStrategy.orderQuantity,
        reorderPoint: testStrategy.reorderPoint,
        standardPrice: testStrategy.standardPrice,
        actionsDetails: actionsOnTestDay,
      });

      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: testStrategy }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Genetic Optimizer] API error:', response.status, errorText);
        throw new Error(`Simulation failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[Genetic Optimizer] API response:', {
        success: data.success,
        hasResult: !!data.result,
        error: data.error,
      });

      // Check if simulation succeeded
      if (!data.success || !data.result) {
        console.error('[Genetic Optimizer] Simulation failed:', data.error);
        throw new Error(`Simulation failed: ${data.error}`);
      }

      const result: SimulationResult = data.result;
      console.log('[Genetic Optimizer] Simulation completed:', {
        finalNetWorth: result.finalNetWorth,
        dailyNetWorthCount: result.state.history.dailyNetWorth.length,
      });

      // Calculate peak net worth after test day
      const dailyNetWorth = result.state.history.dailyNetWorth;
      const netWorthAfterTestDay = dailyNetWorth.filter(d => d.day >= testDay);

      if (netWorthAfterTestDay.length === 0) {
        console.warn('[Genetic Optimizer] No net worth data after test day, using final net worth');
        return result.finalNetWorth || 0;
      }

      const peakNetWorth = Math.max(...netWorthAfterTestDay.map(d => d.value));
      const netWorthOnTestDay = dailyNetWorth.find(d => d.day === testDay)?.value || 0;
      const improvement = peakNetWorth - netWorthOnTestDay;

      console.log('[Genetic Optimizer] Net worth analysis:', {
        netWorthOnTestDay: netWorthOnTestDay.toLocaleString(),
        peakNetWorth: peakNetWorth.toLocaleString(),
        finalNetWorth: result.finalNetWorth.toLocaleString(),
        improvement: improvement.toLocaleString(),
        testDay,
      });

      return peakNetWorth;
    } catch (error) {
      console.error('[Genetic Optimizer] Simulation error:', error);
      return -Infinity; // Failed simulations get worst fitness
    }
  };

  const runOptimization = async () => {
    setIsRunning(true);
    setResults(null);
    setProgress({ current: 0, total: config.populationSize * config.generations, generation: 0 });

    try {
      // Generate initial population with varied strategy parameters
      let population: OptimizationCandidate[] = [];

      // ALWAYS include baseline (no changes)
      population.push({
        id: 'gen0-baseline',
        actions: [],
        fitness: 0,
        netWorth: 0,
        strategyParams: undefined, // Use base strategy as-is
      });

      // Generate diverse candidates with varied strategy parameters
      for (let i = 1; i < config.populationSize; i++) {
        const useFormulaActions = Math.random() < formulaPercentage;
        const rawActions = useFormulaActions
          ? generateFormulaBasedActions(testDay, strategy)
          : (Math.random() < 0.5 ? generateRandomActions(testDay) : []);

        // Add automatic loan management to prevent cash violations
        const actions = ensureSufficientCash(rawActions, 100000, 50000);

        population.push({
          id: `gen0-${i}`,
          actions,
          fitness: 0,
          netWorth: 0,
          strategyParams: generateRandomStrategyParams(), // VARY base strategy parameters
        });
      }

      // Evolutionary loop
      for (let gen = 0; gen < config.generations; gen++) {
        setProgress(prev => ({ ...prev, generation: gen + 1 }));

        // Evaluate fitness for all candidates
        for (let i = 0; i < population.length; i++) {
          const candidate = population[i];

          console.log(`[Genetic Optimizer] Evaluating candidate ${i + 1}/${population.length}:`, {
            candidateId: candidate.id,
            actionsCount: candidate.actions.length,
            actions: candidate.actions,
            strategyParams: candidate.strategyParams,
          });

          // Create test strategy: base strategy + parameter overrides + actions
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
          const testStrategy: Strategy = {
            ...strategy,
            // Apply strategy parameter overrides if provided
            ...(candidate.strategyParams && {
              reorderPoint: candidate.strategyParams.reorderPoint ?? strategy.reorderPoint,
              orderQuantity: candidate.strategyParams.orderQuantity ?? strategy.orderQuantity,
              standardPrice: candidate.strategyParams.standardPrice ?? strategy.standardPrice,
              standardBatchSize: candidate.strategyParams.standardBatchSize ?? strategy.standardBatchSize,
              mceAllocationCustom: candidate.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
              dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
            }),
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions,
            ].sort((a, b) => a.day - b.day),
          };

          console.log(`[Genetic Optimizer] Test strategy for candidate ${i + 1}:`, {
            totalActions: testStrategy.timedActions.length,
            actionsBeforeTestDay: actionsBeforeTestDay.length,
            candidateActions: candidate.actions.length,
            reorderPoint: testStrategy.reorderPoint,
            orderQuantity: testStrategy.orderQuantity,
            standardPrice: testStrategy.standardPrice,
            batchSize: testStrategy.standardBatchSize,
            mceAllocation: testStrategy.mceAllocationCustom,
          });

          // Run simulation and get peak net worth after test day
          const peakNetWorth = await runSimulation(testStrategy, testDay);
          population[i].fitness = peakNetWorth;
          population[i].netWorth = peakNetWorth;

          console.log(`[Genetic Optimizer] Candidate ${i + 1} result: $${peakNetWorth.toLocaleString()}`);

          setProgress(prev => ({
            ...prev,
            current: gen * config.populationSize + i + 1,
          }));
        }

        // Sort by fitness (descending)
        population.sort((a, b) => b.fitness - a.fitness);

        // If last generation, save results and break
        if (gen === config.generations - 1) {
          setResults({
            topCandidates: population.slice(0, topResultsCount),
            generation: gen + 1,
            totalCandidates: population.length,
          });
          break;
        }

        // Selection: Keep top performers
        const eliteCount = Math.floor(config.populationSize * config.elitePercentage);
        const elite = population.slice(0, eliteCount);

        // Create next generation
        const nextGen: OptimizationCandidate[] = [...elite];

        while (nextGen.length < config.populationSize) {
          // Select two parents from elite
          const parent1 = elite[Math.floor(Math.random() * elite.length)];
          const parent2 = elite[Math.floor(Math.random() * elite.length)];

          // Crossover actions
          let childActions = crossoverActions(parent1.actions, parent2.actions);

          // Mutate actions
          childActions = mutateActions(childActions, config.mutationRate);

          // Crossover strategy parameters (inherit from random parent)
          const inheritFromParent = Math.random() < 0.5 ? parent1 : parent2;
          let childStrategyParams = inheritFromParent.strategyParams
            ? { ...inheritFromParent.strategyParams }
            : generateRandomStrategyParams();

          // Mutate strategy parameters
          childStrategyParams = mutateStrategyParams(childStrategyParams, config.mutationRate);

          nextGen.push({
            id: `gen${gen + 1}-${nextGen.length}`,
            actions: childActions,
            fitness: 0,
            netWorth: 0,
            strategyParams: childStrategyParams,
          });
        }

        population = nextGen;
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Optimization failed. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const formatActions = (actions: StrategyAction[]): React.JSX.Element => {
    if (actions.length === 0) {
      return <div className="text-gray-400 italic">No actions (baseline - do nothing on day {testDay})</div>;
    }
    return (
      <div className="space-y-2">
        {actions.map((a, idx) => {
          let actionLabel = '';
          let actionDetails = '';

          switch (a.type) {
            case 'HIRE_ROOKIE': {
              actionLabel = '👷 Hire Rookie Workers';
              const count = 'count' in a ? a.count : 0;
              actionDetails = `Hire ${count} rookie worker${count > 1 ? 's' : ''}`;
              break;
            }
            case 'BUY_MACHINE': {
              actionLabel = '🏭 Buy Machine';
              const count = 'count' in a ? a.count : 0;
              const machineType = 'machineType' in a ? a.machineType : 'Unknown';
              actionDetails = `Purchase ${count} ${machineType} machine${count > 1 ? 's' : ''}`;
              break;
            }
            case 'SET_ORDER_QUANTITY': {
              actionLabel = '📦 Set Order Quantity';
              const qty = 'newOrderQuantity' in a ? a.newOrderQuantity : 0;
              actionDetails = `Change material order quantity to ${qty} units`;
              break;
            }
            case 'SET_REORDER_POINT': {
              actionLabel = '🔔 Set Reorder Point';
              const point = 'newReorderPoint' in a ? a.newReorderPoint : 0;
              actionDetails = `Change reorder trigger point to ${point} units`;
              break;
            }
            case 'ADJUST_BATCH_SIZE': {
              actionLabel = '⚙️ Adjust Batch Size';
              const size = 'newSize' in a ? a.newSize : 0;
              actionDetails = `Change production batch size to ${size} units`;
              break;
            }
            case 'ADJUST_PRICE': {
              actionLabel = '💰 Adjust Product Price';
              const productType = 'productType' in a ? a.productType : 'unknown';
              const price = 'newPrice' in a ? a.newPrice : 0;
              actionDetails = `Set ${productType} product price to $${price}`;
              break;
            }
            case 'ADJUST_MCE_ALLOCATION': {
              actionLabel = '🔧 Adjust MCE Allocation';
              const allocation = 'newAllocation' in a ? a.newAllocation : 0;
              const customPct = (allocation * 100).toFixed(0);
              const standardPct = (100 - allocation * 100).toFixed(0);
              actionDetails = `${standardPct}% standard / ${customPct}% custom`;
              break;
            }
            default:
              actionLabel = a.type;
              actionDetails = JSON.stringify(a);
          }

          return (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-blue-400 font-medium min-w-[200px]">{actionLabel}:</span>
              <span className="text-gray-300">{actionDetails}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          🧬 Genetic Algorithm Optimizer <span className="text-xs text-green-400 ml-2">v2.0-ENHANCED</span>
        </h3>
        <p className="text-sm text-gray-400">
          Find optimal actions for a specific day using evolutionary optimization
        </p>
        <p className="text-xs text-yellow-400 mt-1">
          ✨ Enhanced: 50% hiring, 50% machine purchases, automatic loan management
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-600">
        <h4 className="text-sm font-semibold text-white mb-3">Algorithm Configuration</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Population Size</label>
            <input
              type="number"
              value={isNaN(config.populationSize) ? '' : config.populationSize}
              onChange={(e) => setConfig(prev => ({ ...prev, populationSize: e.target.valueAsNumber }))}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setConfig(prev => ({ ...prev, populationSize: 10 }));
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="10"
              max="50"
            />
            <p className="text-xs text-gray-500 mt-1">Strategies per generation</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Generations</label>
            <input
              type="number"
              value={isNaN(config.generations) ? '' : config.generations}
              onChange={(e) => setConfig(prev => ({ ...prev, generations: e.target.valueAsNumber }))}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setConfig(prev => ({ ...prev, generations: 5 }));
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="5"
              max="30"
            />
            <p className="text-xs text-gray-500 mt-1">Evolution cycles</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Mutation Rate (%)</label>
            <input
              type="number"
              value={isNaN(config.mutationRate * 100) ? '' : config.mutationRate * 100}
              onChange={(e) => setConfig(prev => ({ ...prev, mutationRate: e.target.valueAsNumber / 100 }))}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setConfig(prev => ({ ...prev, mutationRate: 0.1 }));
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="10"
              max="50"
              step="5"
            />
            <p className="text-xs text-gray-500 mt-1">Random variation rate</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Elite Survival (%)</label>
            <input
              type="number"
              value={isNaN(config.elitePercentage * 100) ? '' : config.elitePercentage * 100}
              onChange={(e) => setConfig(prev => ({ ...prev, elitePercentage: e.target.valueAsNumber / 100 }))}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setConfig(prev => ({ ...prev, elitePercentage: 0.2 }));
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="20"
              max="50"
              step="10"
            />
            <p className="text-xs text-gray-500 mt-1">Top % kept each gen</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Formula-Based (%)</label>
            <input
              type="number"
              value={isNaN(formulaPercentage * 100) ? '' : formulaPercentage * 100}
              onChange={(e) => setFormulaPercentage(e.target.valueAsNumber / 100)}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setFormulaPercentage(0.2);
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="20"
              max="80"
              step="10"
            />
            <p className="text-xs text-gray-500 mt-1">Use OR formulas vs random</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Top Results to Show</label>
            <input
              type="number"
              value={isNaN(topResultsCount) ? '' : topResultsCount}
              onChange={(e) => setTopResultsCount(e.target.valueAsNumber)}
              onBlur={(e) => {
                if (isNaN(e.target.valueAsNumber)) {
                  setTopResultsCount(5);
                }
              }}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm disabled:opacity-50"
              min="5"
              max="20"
            />
            <p className="text-xs text-gray-500 mt-1">Best performers displayed</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Test Starting Day
          </label>
          <input
            type="number"
            value={isNaN(testDay) ? '' : testDay}
            onChange={(e) => setTestDay(e.target.valueAsNumber)}
            onBlur={(e) => {
              if (isNaN(e.target.valueAsNumber)) {
                setTestDay(51);
              }
            }}
            disabled={isRunning}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            min="51"
            max="365"
          />
          <p className="text-xs text-gray-500 mt-1">
            Algorithm will find optimal actions to execute on this day forward (using current strategy state as context)
          </p>
          {testDay > 150 && (
            <div className="mt-2 p-3 bg-red-900/40 border-2 border-red-500/70 rounded-lg">
              <p className="text-sm font-semibold text-red-200 mb-2">
                🚨 CRITICAL: Late-stage testing detected (day {testDay})
              </p>
              <p className="text-xs text-red-300 mb-2">
                <strong>Why all results are identical:</strong> If your company is already bankrupt by day {testDay},
                actions on that day cannot change the outcome. The "peak net worth after day {testDay}" will be the
                same for all strategies because they all start from the same failing position.
              </p>
              <p className="text-xs text-red-300 font-semibold">
                ✅ <strong>Solution:</strong> Change "Test Starting Day" to 51-100 for meaningful optimization.
                Early actions have time to prevent bankruptcy and produce varied results.
              </p>
            </div>
          )}
          {testDay <= 150 && testDay >= 51 && (
            <div className="mt-2 p-2 bg-green-900/20 border border-green-600/40 rounded">
              <p className="text-xs text-green-300">
                ✅ Good test day range - early enough to make meaningful changes
              </p>
            </div>
          )}
        </div>

        <button
          onClick={runOptimization}
          disabled={isRunning}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Evolving... Gen {progress.generation}/{config.generations} ({progress.current}/{progress.total})
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Optimization ({config.populationSize} × {config.generations} = {config.populationSize * config.generations} simulations)
            </>
          )}
        </button>

        {results && (
          <div className="mt-6 space-y-4">
            {/* Top Recommendation */}
            <div className="bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 rounded-lg border-2 border-yellow-600 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">👑</span>
                <div>
                  <h4 className="text-xl font-bold text-yellow-400">Recommended Strategy</h4>
                  <p className="text-sm text-gray-300">Best performing actions for day {testDay}</p>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 mb-3">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  ${results.topCandidates[0].netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-sm text-gray-400">Peak Net Worth After Day {testDay}</div>
              </div>
              <div className="text-sm space-y-3">
                {results.topCandidates[0].strategyParams && (
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded p-3">
                    <span className="font-semibold text-blue-300 block mb-2">Strategy Parameters:</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Reorder Point:</span> <span className="text-white">{results.topCandidates[0].strategyParams.reorderPoint} units</span></div>
                      <div><span className="text-gray-400">Order Quantity:</span> <span className="text-white">{results.topCandidates[0].strategyParams.orderQuantity} units</span></div>
                      <div><span className="text-gray-400">Standard Price:</span> <span className="text-white">${results.topCandidates[0].strategyParams.standardPrice}</span></div>
                      <div><span className="text-gray-400">Batch Size:</span> <span className="text-white">{results.topCandidates[0].strategyParams.standardBatchSize} units</span></div>
                      <div><span className="text-gray-400">MCE to Custom:</span> <span className="text-white">{(results.topCandidates[0].strategyParams.mceAllocationCustom! * 100).toFixed(0)}%</span></div>
                      <div><span className="text-gray-400">Daily Overtime:</span> <span className="text-white">{results.topCandidates[0].strategyParams.dailyOvertimeHours}h</span></div>
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-white block mb-2">Timed Actions for Day {testDay}:</span>
                  <div className="bg-gray-900/30 rounded p-3">
                    {formatActions(results.topCandidates[0].actions)}
                  </div>
                </div>
              </div>
            </div>

            {/* Other Top Performers */}
            {results.topCandidates.length > 1 && (
              <div>
                <h4 className="text-md font-semibold text-white mb-3">
                  📊 Other Top Performers (Generation {results.generation})
                </h4>
                <div className="space-y-2">
                  {results.topCandidates.slice(1).map((candidate, idx) => (
                    <div
                      key={candidate.id}
                      className="p-4 rounded-lg border bg-gray-750 border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            #{idx + 2}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-400">
                            ${candidate.netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs text-gray-500">Peak Net Worth After Day {testDay}</div>
                        </div>
                      </div>
                      <div className="text-xs space-y-2">
                        {candidate.strategyParams && (
                          <div className="bg-blue-900/10 border border-blue-600/20 rounded p-2">
                            <span className="font-semibold text-blue-400 block mb-1">Strategy Params:</span>
                            <div className="grid grid-cols-3 gap-1 text-xs ml-1">
                              <div className="text-gray-400">ROP: <span className="text-gray-300">{candidate.strategyParams.reorderPoint}</span></div>
                              <div className="text-gray-400">Qty: <span className="text-gray-300">{candidate.strategyParams.orderQuantity}</span></div>
                              <div className="text-gray-400">Price: <span className="text-gray-300">${candidate.strategyParams.standardPrice}</span></div>
                              <div className="text-gray-400">Batch: <span className="text-gray-300">{candidate.strategyParams.standardBatchSize}</span></div>
                              <div className="text-gray-400">MCE: <span className="text-gray-300">{(candidate.strategyParams.mceAllocationCustom! * 100).toFixed(0)}%</span></div>
                              <div className="text-gray-400">OT: <span className="text-gray-300">{candidate.strategyParams.dailyOvertimeHours}h</span></div>
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-gray-400 block mb-1">Actions on Day {testDay}:</span>
                          <div className="ml-2">{formatActions(candidate.actions)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
