import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';
import { generateConstrainedStrategyParams, mutateConstrainedStrategyParams } from '../../utils/geneticOptimizer';

interface OptimizationConstraints {
  // Policy decisions - true means FIXED (don't change), false means VARIABLE (can optimize)
  fixedPolicies: {
    reorderPoint: boolean;
    orderQuantity: boolean;
    standardPrice: boolean;
    standardBatchSize: boolean;
    mceAllocationCustom: boolean;
    dailyOvertimeHours: boolean;
  };
  // Timed actions - can mark specific actions as fixed
  fixedActions: Set<string>; // Action IDs that cannot be changed
  // Test day configuration
  testDay: number;
  endDay: number;
}

export default function AdvancedOptimizer() {
  const { strategy, loadStrategy } = useStrategyStore();

  const [constraints, setConstraints] = useState<OptimizationConstraints>({
    fixedPolicies: {
      reorderPoint: false,
      orderQuantity: false,
      standardPrice: false,
      standardBatchSize: false,
      mceAllocationCustom: false,
      dailyOvertimeHours: false,
    },
    fixedActions: new Set(),
    testDay: 75,
    endDay: 500,
  });

  // Optimization state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationCandidate[]>([]);
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0 });

  // Saved strategies state
  const [savedStrategies, setSavedStrategies] = useState<Array<{
    id: string;
    name: string;
    strategy: Strategy;
    netWorth: number;
    timestamp: Date;
  }>>([]);

  const runConstrainedOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationResults([]);

    try {
      const populationSize = 30;
      const generations = 10;
      const mutationRate = 0.3;

      // Generate initial population with constrained strategy parameters
      let population: OptimizationCandidate[] = [];
      for (let i = 0; i < populationSize; i++) {
        const strategyParams = generateConstrainedStrategyParams(strategy, constraints);
        population.push({
          id: `gen0-${i}`,
          actions: [...strategy.timedActions],
          fitness: 0,
          netWorth: 0,
          strategyParams,
        });
      }

      // Evolution loop
      for (let gen = 0; gen < generations; gen++) {
        console.log(`🧬 Generation ${gen + 1}/${generations}`);
        setOptimizationProgress({ current: gen, total: generations });

        // Test each candidate in parallel
        const testPromises = population.map(async (candidate) => {
          const testStrategy: Strategy = {
            ...strategy,
            timedActions: candidate.actions,
            ...(candidate.strategyParams && {
              reorderPoint: candidate.strategyParams.reorderPoint ?? strategy.reorderPoint,
              orderQuantity: candidate.strategyParams.orderQuantity ?? strategy.orderQuantity,
              standardPrice: candidate.strategyParams.standardPrice ?? strategy.standardPrice,
              standardBatchSize: candidate.strategyParams.standardBatchSize ?? strategy.standardBatchSize,
              mceAllocationCustom: candidate.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
              dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
            }),
          };

          try {
            const response = await fetch('http://localhost:3001/api/simulate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ strategy: testStrategy }),
            });

            if (!response.ok) {
              throw new Error(`Simulation failed: ${response.statusText}`);
            }

            const result = await response.json();

            // Find peak net worth after test day
            let peakNetWorth = -Infinity;
            result.dailySnapshots.forEach((snapshot: { day: number; netWorth: number }) => {
              if (snapshot.day >= constraints.testDay && snapshot.day <= constraints.endDay) {
                peakNetWorth = Math.max(peakNetWorth, snapshot.netWorth);
              }
            });

            candidate.netWorth = peakNetWorth;
            candidate.fitness = peakNetWorth;
          } catch (error) {
            console.error('Simulation error:', error);
            candidate.fitness = -Infinity;
            candidate.netWorth = -Infinity;
          }
        });

        await Promise.all(testPromises);

        // Sort by fitness
        population.sort((a, b) => b.fitness - a.fitness);

        // If last generation, break
        if (gen === generations - 1) break;

        // Select elite (top 20%)
        const eliteCount = Math.floor(populationSize * 0.2);
        const elite = population.slice(0, eliteCount);

        // Generate new population
        const newPopulation: OptimizationCandidate[] = [...elite];

        while (newPopulation.length < populationSize) {
          // Tournament selection
          const parent1 = population[Math.floor(Math.random() * Math.min(10, population.length))];
          const parent2 = population[Math.floor(Math.random() * Math.min(10, population.length))];

          // Crossover strategy params
          let childParams: OptimizationCandidate['strategyParams'] = {};
          if (parent1.strategyParams && parent2.strategyParams) {
            Object.keys(parent1.strategyParams).forEach(key => {
              const k = key as keyof typeof parent1.strategyParams;
              if (parent1.strategyParams![k] !== undefined && parent2.strategyParams![k] !== undefined) {
                if (!childParams) childParams = {};
                childParams[k] = Math.random() < 0.5 ? parent1.strategyParams![k] : parent2.strategyParams![k];
              }
            });
          }

          // Mutate with constraints
          const mutatedParams = mutateConstrainedStrategyParams(childParams, constraints, mutationRate);
          childParams = mutatedParams;

          newPopulation.push({
            id: `gen${gen + 1}-${newPopulation.length}`,
            actions: [...strategy.timedActions], // Keep base actions
            fitness: 0,
            netWorth: 0,
            strategyParams: childParams,
          });
        }

        population = newPopulation;
      }

      // Set top 5 results
      setOptimizationResults(population.slice(0, 5));
      console.log('✅ Optimization complete! Top 5 results:', population.slice(0, 5));
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      alert('Optimization failed. Check console for details.');
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress({ current: 0, total: 0 });
    }
  };

  const saveRecommendedStrategy = (candidate: OptimizationCandidate) => {
    const name = prompt('Enter a name for this strategy:');
    if (!name) return;

    const strategyToSave: Strategy = {
      ...strategy,
      ...(candidate.strategyParams && {
        reorderPoint: candidate.strategyParams.reorderPoint ?? strategy.reorderPoint,
        orderQuantity: candidate.strategyParams.orderQuantity ?? strategy.orderQuantity,
        standardPrice: candidate.strategyParams.standardPrice ?? strategy.standardPrice,
        standardBatchSize: candidate.strategyParams.standardBatchSize ?? strategy.standardBatchSize,
        mceAllocationCustom: candidate.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
        dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
      }),
    };

    const newStrategy = {
      id: `saved-${Date.now()}`,
      name,
      strategy: strategyToSave,
      netWorth: candidate.netWorth,
      timestamp: new Date(),
    };

    setSavedStrategies(prev => [...prev, newStrategy]);
    alert(`Strategy "${name}" saved successfully!`);
  };

  const togglePolicyFixed = (policy: keyof OptimizationConstraints['fixedPolicies']) => {
    setConstraints(prev => ({
      ...prev,
      fixedPolicies: {
        ...prev.fixedPolicies,
        [policy]: !prev.fixedPolicies[policy],
      },
    }));
  };

  const toggleActionFixed = (actionId: string) => {
    setConstraints(prev => {
      const newFixedActions = new Set(prev.fixedActions);
      if (newFixedActions.has(actionId)) {
        newFixedActions.delete(actionId);
      } else {
        newFixedActions.add(actionId);
      }
      return {
        ...prev,
        fixedActions: newFixedActions,
      };
    });
  };

  // Placeholder for saving recommended strategies - will be connected to optimizer results
  // const saveRecommendedStrategy = (strategyToSave: Strategy, netWorth: number) => {
  //   const name = prompt('Enter a name for this strategy:');
  //   if (!name) return;

  //   const newStrategy = {
  //     id: `saved-${Date.now()}`,
  //     name,
  //     strategy: strategyToSave,
  //     netWorth,
  //     timestamp: new Date(),
  //   };

  //   setSavedStrategies(prev => [...prev, newStrategy]);
  //   alert(`Strategy "${name}" saved successfully!`);
  // };

  const exportStrategy = (strategyToExport: Strategy) => {
    const dataStr = JSON.stringify(strategyToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `strategy-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-600/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-2">🎯 Advanced Optimizer</h3>
        <p className="text-sm text-gray-300">
          Configure exactly which parameters the optimizer can change. The optimizer will use your current strategy values as a starting point,
          but only vary the parameters you mark as "Variable" (🔓). Mark policies and actions as "Fixed" (🔒) to lock them.
        </p>
      </div>

      {/* Policy Decision Controls */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">📋 Policy Decisions</h4>
        <p className="text-sm text-gray-400 mb-4">
          Toggle each policy to mark it as Fixed (🔒 locked value) or Variable (🔓 can be optimized)
        </p>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(constraints.fixedPolicies).map(([policy, isFixed]) => (
            <div
              key={policy}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                isFixed
                  ? 'bg-red-900/20 border-red-600/50'
                  : 'bg-green-900/20 border-green-600/50'
              }`}
              onClick={() => togglePolicyFixed(policy as keyof OptimizationConstraints['fixedPolicies'])}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">
                  {policy.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className="text-2xl">{isFixed ? '🔒' : '🔓'}</span>
              </div>
              <div className="text-xs text-gray-400">
                {isFixed ? 'Fixed - will not change' : 'Variable - can be optimized'}
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Current: {
                  policy === 'reorderPoint' ? `${strategy.reorderPoint} units` :
                  policy === 'orderQuantity' ? `${strategy.orderQuantity} units` :
                  policy === 'standardPrice' ? `$${strategy.standardPrice}` :
                  policy === 'standardBatchSize' ? `${strategy.standardBatchSize} units` :
                  policy === 'mceAllocationCustom' ? `${(strategy.mceAllocationCustom * 100).toFixed(0)}%` :
                  policy === 'dailyOvertimeHours' ? `${strategy.dailyOvertimeHours}h` :
                  'N/A'
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timed Actions Controls */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">⏰ Timed Actions</h4>
        <p className="text-sm text-gray-400 mb-4">
          Mark specific timed actions as fixed to prevent the optimizer from removing or modifying them
        </p>

        {strategy.timedActions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No timed actions defined. Go to Strategy Builder to add some.
          </div>
        ) : (
          <div className="space-y-2">
            {strategy.timedActions.map((action, idx) => {
              const actionId = `action-${action.day}-${action.type}-${idx}`;
              const isFixed = constraints.fixedActions.has(actionId);

              return (
                <div
                  key={actionId}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isFixed
                      ? 'bg-red-900/20 border-red-600/50'
                      : 'bg-gray-750 border-gray-600'
                  }`}
                  onClick={() => toggleActionFixed(actionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm text-white">
                        Day {action.day}: <strong>{action.type}</strong>
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {JSON.stringify(action).substring(0, 100)}...
                      </span>
                    </div>
                    <span className="text-xl ml-4">{isFixed ? '🔒' : '🔓'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Optimization Settings */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">⚙️ Optimization Settings</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Test Starting Day
            </label>
            <input
              type="number"
              value={constraints.testDay}
              onChange={(e) => setConstraints(prev => ({ ...prev, testDay: e.target.valueAsNumber }))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              min="51"
              max="450"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Simulation End Day
            </label>
            <input
              type="number"
              value={constraints.endDay}
              onChange={(e) => setConstraints(prev => ({ ...prev, endDay: e.target.valueAsNumber }))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              min="51"
              max="500"
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <h5 className="text-sm font-semibold text-blue-300 mb-2">Optimization Summary</h5>
          <div className="text-xs text-gray-300 space-y-1">
            <div>🔒 Fixed Policies: {Object.values(constraints.fixedPolicies).filter(Boolean).length} / 6</div>
            <div>🔓 Variable Policies: {Object.values(constraints.fixedPolicies).filter(v => !v).length} / 6</div>
            <div>🔒 Fixed Actions: {constraints.fixedActions.size}</div>
            <div>⏱️ Test Range: Days {constraints.testDay} - {constraints.endDay}</div>
          </div>
        </div>
      </div>

      {/* Run Optimization Button */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <button
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          onClick={runConstrainedOptimization}
          disabled={isOptimizing}
        >
          {isOptimizing ? (
            <>
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Optimizing... (Gen {optimizationProgress.current + 1}/{optimizationProgress.total})
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Constrained Optimization
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Will only optimize the {Object.values(constraints.fixedPolicies).filter(v => !v).length} variable policies,
          respecting all fixed policies and {constraints.fixedActions.size} locked actions
        </p>
      </div>

      {/* Optimization Results */}
      {optimizationResults.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">🎯 Optimization Results</h4>
          <p className="text-sm text-gray-400 mb-4">
            Top {optimizationResults.length} strategies found (tested from day {constraints.testDay} to {constraints.endDay})
          </p>
          <div className="space-y-3">
            {optimizationResults.map((result, idx) => (
              <div
                key={result.id}
                className="p-4 bg-gradient-to-r from-gray-750 to-gray-800 border border-gray-600 rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                      <h5 className="text-white font-semibold">Strategy #{idx + 1}</h5>
                    </div>
                    <p className="text-lg text-green-400 font-bold mt-1">
                      Peak Net Worth: ${result.netWorth.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        loadStrategy({
                          ...strategy,
                          ...(result.strategyParams && {
                            reorderPoint: result.strategyParams.reorderPoint ?? strategy.reorderPoint,
                            orderQuantity: result.strategyParams.orderQuantity ?? strategy.orderQuantity,
                            standardPrice: result.strategyParams.standardPrice ?? strategy.standardPrice,
                            standardBatchSize: result.strategyParams.standardBatchSize ?? strategy.standardBatchSize,
                            mceAllocationCustom: result.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
                            dailyOvertimeHours: result.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
                          }),
                        });
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => saveRecommendedStrategy(result)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => exportStrategy({
                        ...strategy,
                        ...(result.strategyParams && {
                          reorderPoint: result.strategyParams.reorderPoint ?? strategy.reorderPoint,
                          orderQuantity: result.strategyParams.orderQuantity ?? strategy.orderQuantity,
                          standardPrice: result.strategyParams.standardPrice ?? strategy.standardPrice,
                          standardBatchSize: result.strategyParams.standardBatchSize ?? strategy.standardBatchSize,
                          mceAllocationCustom: result.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom,
                          dailyOvertimeHours: result.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours,
                        }),
                      })}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                    >
                      Export
                    </button>
                  </div>
                </div>

                {result.strategyParams && (
                  <div className="grid grid-cols-3 gap-3 mt-3 p-3 bg-gray-900/50 rounded">
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Reorder Point</div>
                      <div className="text-sm text-white font-semibold">
                        {result.strategyParams.reorderPoint ?? strategy.reorderPoint} units
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Order Quantity</div>
                      <div className="text-sm text-white font-semibold">
                        {result.strategyParams.orderQuantity ?? strategy.orderQuantity} units
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Standard Price</div>
                      <div className="text-sm text-white font-semibold">
                        ${result.strategyParams.standardPrice ?? strategy.standardPrice}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Batch Size</div>
                      <div className="text-sm text-white font-semibold">
                        {result.strategyParams.standardBatchSize ?? strategy.standardBatchSize} units
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">MCE Custom %</div>
                      <div className="text-sm text-white font-semibold">
                        {((result.strategyParams.mceAllocationCustom ?? strategy.mceAllocationCustom) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Overtime Hours</div>
                      <div className="text-sm text-white font-semibold">
                        {result.strategyParams.dailyOvertimeHours ?? strategy.dailyOvertimeHours}h
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Strategies */}
      {savedStrategies.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">💾 Saved Strategies</h4>
          <div className="space-y-3">
            {savedStrategies.map(saved => (
              <div key={saved.id} className="p-4 bg-gray-750 border border-gray-600 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-white font-semibold">{saved.name}</h5>
                    <p className="text-xs text-gray-400">
                      Net Worth: ${saved.netWorth.toLocaleString()} |
                      Saved: {saved.timestamp.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadStrategy(saved.strategy)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => exportStrategy(saved.strategy)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
