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
    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-3xl border border-emerald-400/30 overflow-hidden shadow-2xl">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="text-3xl">▶️</span> Run Simulation
          </h3>
          <p className="text-emerald-100 text-base mt-1">
            Execute your strategy and see how it performs over 450 days
          </p>
        </div>
        {lastRun && (
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl px-6 py-3 border border-white/30">
            <p className="text-xs text-white/80 font-semibold">Last run</p>
            <p className="text-base text-white font-black">{lastRun.toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
        {/* Strategy Summary */}
        <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
          <p className="text-xs text-emerald-300 font-black mb-5 tracking-widest uppercase">Strategy Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-white/60 mb-2 font-bold">MCE Allocation</p>
              <p className="text-white font-black text-lg">{(strategy.mceAllocationCustom * 100).toFixed(0)}% Custom</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-white/60 mb-2 font-bold">Standard Price</p>
              <p className="text-white font-black text-lg">${strategy.standardPrice}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-white/60 mb-2 font-bold">Overtime</p>
              <p className="text-white font-black text-lg">{strategy.dailyOvertimeHours}h/day</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-white/60 mb-2 font-bold">Timed Actions</p>
              <p className="text-white font-black text-lg">{strategy.timedActions.length}</p>
            </div>
          </div>
        </div>

        {/* Warning if no actions */}
        {!hasActions && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/40 rounded-2xl p-5 backdrop-blur">
            <p className="text-yellow-100 text-base flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <span>
                <strong className="font-black">Tip:</strong> Add some timed actions (loans, hiring, material orders) to prevent cash flow issues!
              </span>
            </p>
          </div>
        )}

        {/* Error Display */}
        {simulationError && (
          <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-400/40 rounded-2xl p-5 backdrop-blur">
            <p className="text-red-100 text-base flex items-start gap-3">
              <span className="text-2xl">🚨</span>
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
          className={`w-full py-6 rounded-2xl font-black text-white text-xl transition-all shadow-2xl ${
            isSimulating
              ? 'bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:scale-[1.02] hover:shadow-emerald-500/50'
          }`}
        >
          {isSimulating ? (
            <span className="flex items-center justify-center gap-3">
              <span className="animate-spin text-2xl">⚙️</span>
              Running Simulation...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-3">
              <span className="text-2xl">▶️</span>
              Run Simulation
            </span>
          )}
        </button>

        {/* Progress Indicator */}
        {isSimulating && (
          <div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-emerald-400/30">
              <div className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 h-full animate-pulse shadow-lg shadow-emerald-500/50" style={{ width: '100%' }}></div>
            </div>
            <p className="text-center text-sm text-emerald-300 mt-3 font-bold animate-pulse">
              Simulating 450 days of factory operations...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
