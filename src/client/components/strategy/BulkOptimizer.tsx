import { useState } from 'react';
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
      const response = await fetch('http://localhost:3000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: testStrategy }),
      });

      if (!response.ok) throw new Error('Simulation failed');

      const result: SimulationResult = await response.json();

      // Calculate peak net worth after test day
      const dailyNetWorth = result.state.history.dailyNetWorth;
      const netWorthAfterTestDay = dailyNetWorth.filter(d => d.day >= testDay);

      if (netWorthAfterTestDay.length === 0) {
        return result.finalNetWorth || 0;
      }

      const peakNetWorth = Math.max(...netWorthAfterTestDay.map(d => d.value));
      return peakNetWorth;
    } catch (error) {
      console.error('Simulation error:', error);
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

          // Create test strategy: base strategy + actions up to testDay + candidate actions
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < testDay);
          const testStrategy: Strategy = {
            ...strategy,
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions,
            ].sort((a, b) => a.day - b.day),
          };

          // Run simulation and get peak net worth after test day
          const peakNetWorth = await runSimulation(testStrategy, testDay);
          population[i].fitness = peakNetWorth;
          population[i].netWorth = peakNetWorth;

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

  const formatActions = (actions: StrategyAction[]) => {
    if (actions.length === 0) {
      return 'No actions (baseline - do nothing)';
    }
    return actions.map(a => {
      let details = `${a.type}`;
      if ('count' in a) details += ` (${a.count})`;
      if ('newPrice' in a) details += ` ($${a.newPrice})`;
      if ('newOrderQuantity' in a) details += ` (${a.newOrderQuantity} units)`;
      if ('newReorderPoint' in a) details += ` (${a.newReorderPoint} units)`;
      if ('newSize' in a) details += ` (${a.newSize} units)`;
      if ('machineType' in a) details += ` (${a.machineType})`;
      return details;
    }).join(', ');
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
              value={config.populationSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setConfig(prev => ({ ...prev, populationSize: val }));
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
              value={config.generations}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setConfig(prev => ({ ...prev, generations: val }));
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
              value={config.mutationRate * 100}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setConfig(prev => ({ ...prev, mutationRate: val / 100 }));
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
              value={config.elitePercentage * 100}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setConfig(prev => ({ ...prev, elitePercentage: val / 100 }));
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
              value={formulaPercentage * 100}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) setFormulaPercentage(val / 100);
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
              value={topResultsCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setTopResultsCount(val);
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
            value={testDay}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) setTestDay(val);
            }}
            disabled={isRunning}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            min="51"
            max="450"
          />
          <p className="text-xs text-gray-500 mt-1">
            Algorithm will find optimal actions to execute on this day forward (using current strategy state as context)
          </p>
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
                <span className="font-semibold text-white">Recommended Actions:</span>
                <div className="mt-2 text-gray-300 bg-gray-900/30 rounded p-3">
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
                      <div className="text-xs text-gray-400">
                        <span className="font-semibold">Actions on Day {testDay}:</span> {formatActions(candidate.actions)}
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
