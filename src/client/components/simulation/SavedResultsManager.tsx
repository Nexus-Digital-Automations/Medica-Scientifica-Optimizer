import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';

export default function SavedResultsManager() {
  const {
    savedResults,
    currentViewingResultId,
    loadSavedResult,
    deleteSavedResultById,
    viewCurrentSimulation,
    simulationResult,
  } = useStrategyStore();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = (id: string) => {
    deleteSavedResultById(id);
    setConfirmDeleteId(null);
  };

  const getPerformanceColor = (profit: number): string => {
    if (profit > 0) return 'text-green-400';
    if (profit < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const isViewingCurrent = currentViewingResultId === null;

  return (
    <div className="space-y-4">
      {/* Current Simulation */}
      {simulationResult && (
        <div
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            isViewingCurrent
              ? 'border-blue-500 bg-blue-900/20'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
          }`}
          onClick={() => viewCurrentSimulation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-blue-400">
                  📊 Current Simulation
                </span>
                {isViewingCurrent && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                    Viewing
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 grid grid-cols-2 gap-2">
                <div>Day: {simulationResult.state.currentDay}</div>
                <div>
                  Cash:{' '}
                  {formatCurrency(
                    simulationResult.state.history.dailyCash[
                      simulationResult.state.history.dailyCash.length - 1
                    ]?.value || 0
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Results */}
      {savedResults.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No saved simulation results yet.</p>
          <p className="text-xs mt-2">
            Run a simulation and save it to compare different strategies.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {savedResults.map((savedResult) => (
            <div
              key={savedResult.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                currentViewingResultId === savedResult.id
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
              onClick={() => loadSavedResult(savedResult.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">
                      {savedResult.strategyName}
                    </span>
                    {currentViewingResultId === savedResult.id && (
                      <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded">
                        Viewing
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    {formatDate(savedResult.timestamp)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Net Worth: </span>
                      <span className="text-white font-medium">
                        {formatCurrency(savedResult.metadata.finalNetWorth)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Profit: </span>
                      <span
                        className={`font-medium ${getPerformanceColor(
                          savedResult.metadata.totalProfit
                        )}`}
                      >
                        {formatCurrency(savedResult.metadata.totalProfit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue: </span>
                      <span className="text-white">
                        {formatCurrency(savedResult.metadata.totalRevenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Utilization: </span>
                      <span className="text-white">
                        {(savedResult.metadata.averageUtilization * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(savedResult.id);
                  }}
                  className="ml-3 p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  title="Delete result"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">
              Delete Saved Result?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This action cannot be undone. The saved simulation result will be
              permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
