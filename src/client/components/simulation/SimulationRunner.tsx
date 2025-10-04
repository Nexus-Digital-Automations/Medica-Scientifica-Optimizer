import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { useSimulation } from '../../hooks/useSimulation';

export default function SimulationRunner() {
  const { strategy, isSimulating, simulationError } = useStrategyStore();
  const { runSimulation } = useSimulation();
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const handleRunSimulation = async () => {
    const result = await runSimulation();
    if (result.success) {
      setLastRun(new Date());
    }
  };

  const hasActions = strategy.timedActions.length > 0;

  return (
    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 shadow-lg border border-blue-700/50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">▶️ Run Simulation</h3>
          <p className="text-gray-300 text-sm">
            Execute your strategy and see how it performs over 450 days
          </p>
        </div>
        {lastRun && (
          <div className="text-right text-xs text-gray-400">
            <p>Last run:</p>
            <p>{lastRun.toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      {/* Strategy Summary */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">MCE Allocation</p>
            <p className="text-white font-semibold">
              {(strategy.mceAllocationCustom * 100).toFixed(0)}% Custom
            </p>
          </div>
          <div>
            <p className="text-gray-400">Standard Price</p>
            <p className="text-white font-semibold">${strategy.standardPrice}</p>
          </div>
          <div>
            <p className="text-gray-400">Overtime</p>
            <p className="text-white font-semibold">{strategy.dailyOvertimeHours}h/day</p>
          </div>
          <div>
            <p className="text-gray-400">Timed Actions</p>
            <p className="text-white font-semibold">{strategy.timedActions.length}</p>
          </div>
        </div>
      </div>

      {/* Warning if no actions */}
      {!hasActions && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-sm">
            ⚠️ <strong>Tip:</strong> Add some timed actions (loans, hiring, material orders) to prevent cash flow issues!
          </p>
        </div>
      )}

      {/* Error Display */}
      {simulationError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4">
          <p className="text-red-200 text-sm">
            <strong>Error:</strong> {simulationError}
          </p>
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={handleRunSimulation}
        disabled={isSimulating}
        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
          isSimulating
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
        }`}
      >
        {isSimulating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⚙️</span>
            Running Simulation...
          </span>
        ) : (
          '▶️ Run Simulation'
        )}
      </button>

      {isSimulating && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
          <p className="text-center text-sm text-gray-400 mt-2">
            Simulating 450 days of factory operations...
          </p>
        </div>
      )}
    </div>
  );
}
