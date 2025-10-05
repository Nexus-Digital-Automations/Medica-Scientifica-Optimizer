import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { useSimulation } from '../../hooks/useSimulation';

export default function SimulationRunner() {
  const { isSimulating, simulationError } = useStrategyStore();
  const { runSimulation } = useSimulation();
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const handleRunSimulation = async () => {
    await runSimulation();
    setLastRun(new Date());
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">▶️</span> Run Simulation
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Execute your strategy and see how it performs over 450 days
          </p>
        </div>
        {lastRun && (
          <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Last run</p>
            <p className="text-lg text-gray-900 font-black">{lastRun.toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
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
