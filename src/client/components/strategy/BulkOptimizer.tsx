import React, { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy, StrategyAction, SimulationResult } from '../../types/ui.types';
import {
  generateFormulaBasedActions,
  generateRandomActions,
  mutateActions,
  crossoverActions,
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
  const [testDay, setTestDay] = useState<number>(200);
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

      const response = await fetch('http://localhost:3000/api/simulate', {
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
      console.log('[Genetic Optimizer] Peak net worth after day', testDay, ':', peakNetWorth);
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
      // Generate initial population with user-specified formula percentage
      // Reserve 1 slot for "do nothing" baseline
      const populationWithoutBaseline = config.populationSize - 1;
      const formulaCount = Math.floor(populationWithoutBaseline * formulaPercentage);
      const variationCount = Math.floor(populationWithoutBaseline * 0.3);
      const randomCount = populationWithoutBaseline - formulaCount - variationCount;

      const initialPop: StrategyAction[][] = [];

      // ALWAYS include "do nothing" baseline as first candidate
      initialPop.push([]);

      // Formula-based
      for (let i = 0; i < formulaCount; i++) {
        initialPop.push(generateFormulaBasedActions(testDay, strategy));
      }

      // Variations around formulas
      for (let i = 0; i < variationCount; i++) {
        const base = generateFormulaBasedActions(testDay, strategy);
        initialPop.push(mutateActions(base, 0.5));
      }

      // Random exploration
      for (let i = 0; i < randomCount; i++) {
        initialPop.push(generateRandomActions(testDay));
      }

      let population = initialPop.map((actions, idx) => ({
        id: `gen0-${idx}`,
        actions,
        fitness: 0,
        netWorth: 0,
      }));

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
          });

          // Create test strategy: base strategy + actions up to testDay + candidate actions
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
          const testStrategy: Strategy = {
            ...strategy,
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions,
            ].sort((a, b) => a.day - b.day),
          };

          console.log(`[Genetic Optimizer] Test strategy for candidate ${i + 1}:`, {
            totalActions: testStrategy.timedActions.length,
            actionsBeforeTestDay: actionsBeforeTestDay.length,
            candidateActions: candidate.actions.length,
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

          // Crossover
          let childActions = crossoverActions(parent1.actions, parent2.actions);

          // Mutate
          childActions = mutateActions(childActions, config.mutationRate);

          nextGen.push({
            id: `gen${gen + 1}-${nextGen.length}`,
            actions: childActions,
            fitness: 0,
            netWorth: 0,
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
            case 'HIRE_EXPERT': {
              actionLabel = '🎓 Hire Expert Workers';
              const count = 'count' in a ? a.count : 0;
              actionDetails = `Hire ${count} expert worker${count > 1 ? 's' : ''}`;
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
              actionDetails = `Set MCE allocation to custom line: ${(allocation * 100).toFixed(0)}%`;
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
          🧬 Genetic Algorithm Optimizer
        </h3>
        <p className="text-sm text-gray-400">
          Find optimal actions for a specific day using evolutionary optimization
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
            max="450"
          />
          <p className="text-xs text-gray-500 mt-1">
            Algorithm will find optimal actions to execute on this day forward (using current strategy state as context)
          </p>
          {testDay > 150 && (
            <div className="mt-2 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
              <p className="text-xs text-yellow-300">
                ⚠️ <strong>Warning:</strong> Testing actions late in the simulation (day {testDay}) may produce identical results if your base strategy has already failed by then.
                Actions requiring cash (buying machines, ordering materials) won't execute if the company is bankrupt.
                Consider testing earlier (day 51-100) for more meaningful optimization.
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
              <div className="text-sm">
                <span className="font-semibold text-white mb-2 block">Recommended Actions for Day {testDay}:</span>
                <div className="mt-2 bg-gray-900/30 rounded p-3">
                  {formatActions(results.topCandidates[0].actions)}
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
                      <div className="text-xs">
                        <span className="font-semibold text-gray-400 block mb-1">Actions on Day {testDay}:</span>
                        <div className="ml-2">{formatActions(candidate.actions)}</div>
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
