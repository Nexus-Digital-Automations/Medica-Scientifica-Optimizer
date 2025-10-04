import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';

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

  // Saved strategies state - will be populated when optimizer results are saved
  const [savedStrategies] = useState<Array<{
    id: string;
    name: string;
    strategy: Strategy;
    netWorth: number;
    timestamp: Date;
  }>>([]);

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
          Configure exactly which parameters the optimizer can change. Mark policies and actions as "Fixed" (locked) or "Variable" (optimizable).
          Save recommended strategies for later use.
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
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          onClick={() => alert('Optimization with constraints will be implemented next!')}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Run Constrained Optimization
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Will only optimize the {Object.values(constraints.fixedPolicies).filter(v => !v).length} variable policies,
          respecting all fixed policies and {constraints.fixedActions.size} locked actions
        </p>
      </div>

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
