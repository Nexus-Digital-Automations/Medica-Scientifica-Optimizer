import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { useSimulation } from '../../hooks/useSimulation';

export default function SimulationRunner() {
  const { strategy, isSimulating, simulationError } = useStrategyStore();
  const { runSimulation } = useSimulation();
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const handleRunSimulation = async () => {
    await runSimulation();
    setLastRun(new Date());
  };

  const hasActions = strategy.timedActions.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl border-4 border-emerald-500 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-black text-white flex items-center gap-3">
            <span className="text-4xl">▶️</span> Run Simulation
          </h3>
          <p className="text-emerald-100 text-lg mt-1 font-medium">
            Execute your strategy and see how it performs over 450 days
          </p>
        </div>
        {lastRun && (
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl">
            <p className="text-xs text-emerald-700 font-bold">Last run</p>
            <p className="text-lg text-gray-900 font-black">{lastRun.toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
        {/* Strategy Summary */}
        <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-300">
          <p className="text-sm text-emerald-700 font-black mb-5 tracking-widest uppercase">Strategy Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl p-5 border-2 border-gray-300 shadow-md">
              <p className="text-xs text-gray-600 mb-2 font-bold">MCE Allocation</p>
              <p className="text-gray-900 font-black text-2xl">{(strategy.mceAllocationCustom * 100).toFixed(0)}% Custom</p>
            </div>
            <div className="bg-white rounded-xl p-5 border-2 border-gray-300 shadow-md">
              <p className="text-xs text-gray-600 mb-2 font-bold">Standard Price</p>
              <p className="text-gray-900 font-black text-2xl">${strategy.standardPrice}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border-2 border-gray-300 shadow-md">
              <p className="text-xs text-gray-600 mb-2 font-bold">Overtime</p>
              <p className="text-gray-900 font-black text-2xl">{strategy.dailyOvertimeHours}h/day</p>
            </div>
            <div className="bg-white rounded-xl p-5 border-2 border-gray-300 shadow-md">
              <p className="text-xs text-gray-600 mb-2 font-bold">Timed Actions</p>
              <p className="text-gray-900 font-black text-2xl">{strategy.timedActions.length}</p>
            </div>
          </div>
        </div>

        {/* Warning if no actions */}
        {!hasActions && (
          <div className="bg-yellow-100 border-4 border-yellow-500 rounded-2xl p-6 shadow-lg">
            <p className="text-gray-900 text-lg flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <span>
                <strong className="font-black">Tip:</strong> Add some timed actions (loans, hiring, material orders) to prevent cash flow issues!
              </span>
            </p>
          </div>
        )}

        {/* Error Display */}
        {simulationError && (
          <div className="bg-red-100 border-4 border-red-500 rounded-2xl p-6 shadow-lg">
            <p className="text-gray-900 text-lg flex items-start gap-3">
              <span className="text-3xl">🚨</span>
              <span>
                <strong className="font-black">Error:</strong> {simulationError}
              </span>
            </p>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className={`w-full py-8 rounded-2xl font-black text-white text-2xl transition-all shadow-2xl ${
            isSimulating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-[1.02]'
          }`}
        >
          {isSimulating ? (
            <span className="flex items-center justify-center gap-3">
              <span className="animate-spin text-3xl">⚙️</span>
              Running Simulation...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-3">
              <span className="text-3xl">▶️</span>
              Run Simulation
            </span>
          )}
        </button>

        {/* Progress Indicator */}
        {isSimulating && (
          <div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border-2 border-emerald-400">
              <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 h-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <p className="text-center text-base text-emerald-700 mt-4 font-black animate-pulse">
              Simulating 450 days of factory operations...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
