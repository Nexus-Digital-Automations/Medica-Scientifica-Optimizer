import { useState, useEffect } from 'react';
import type { SimulationResult } from '../../types/ui.types';
import { loadSavedResults, deleteSavedResult, type SavedSimulationResult } from '../../utils/savedResults';
import { loadHistoricalData } from '../../utils/historicalDataLoader';
import { useStrategyStore } from '../../stores/strategyStore';

interface ProcessMapSelectorProps {
  currentResult: SimulationResult | null;
  onSelectResult: (result: SimulationResult | null, source: DataSource) => void;
}

export interface DataSource {
  type: 'historical' | 'current' | 'saved' | 'strategy';
  id?: string;
  label: string;
  timestamp?: number;
  metadata?: {
    finalNetWorth?: number;
    strategyName?: string;
    description?: string;
  };
}

export default function ProcessMapSelector({ currentResult, onSelectResult }: ProcessMapSelectorProps) {
  const { savedStrategies } = useStrategyStore();
  const [savedResults, setSavedResults] = useState<SavedSimulationResult[]>([]);
  const [selectedSource, setSelectedSource] = useState<DataSource>({
    type: 'historical',
    label: '📊 Historical Data (Excel Baseline)',
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  useEffect(() => {
    // Load saved results from localStorage
    const results = loadSavedResults();
    setSavedResults(results);

    // If there's a current result, select it by default
    if (currentResult) {
      setSelectedSource({
        type: 'current',
        label: '🔬 Latest Simulation',
        timestamp: Date.now(),
        metadata: {
          finalNetWorth: currentResult.finalNetWorth,
        },
      });
    }
  }, [currentResult]);

  const handleSelectSource = async (source: DataSource) => {
    setSelectedSource(source);
    setShowDropdown(false);

    if (source.type === 'historical') {
      const historicalData = loadHistoricalData();
      onSelectResult(historicalData, source);
    } else if (source.type === 'current') {
      onSelectResult(currentResult, source);
    } else if (source.type === 'saved' && source.id) {
      const saved = savedResults.find(r => r.id === source.id);
      if (saved) {
        onSelectResult(saved.result, source);
      }
    } else if (source.type === 'strategy' && source.id) {
      // Run simulation for selected strategy
      setLoadingStrategy(true);
      try {
        const strategy = savedStrategies.find(s => s.id === source.id);
        if (strategy) {
          const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              strategy: strategy.strategy,
              scenarioId: strategy.scenarioId
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.result) {
              onSelectResult(data.result, source);
            }
          }
        }
      } catch (error) {
        console.error('Failed to run simulation for strategy:', error);
      } finally {
        setLoadingStrategy(false);
      }
    }
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this saved simulation?')) {
      deleteSavedResult(id);
      const updatedResults = loadSavedResults();
      setSavedResults(updatedResults);

      // If we deleted the currently selected result, switch to historical
      if (selectedSource.type === 'saved' && selectedSource.id === id) {
        handleSelectSource({
          type: 'historical',
          label: '📊 Historical Data (Excel Baseline)',
        });
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getSourceIcon = (type: DataSource['type']) => {
    switch (type) {
      case 'historical':
        return '📊';
      case 'current':
        return '🔬';
      case 'saved':
        return '💾';
      case 'strategy':
        return '📚';
      default:
        return '📈';
    }
  };

  const getSourceBadgeColor = (type: DataSource['type']) => {
    switch (type) {
      case 'historical':
        return 'bg-amber-600 text-white';
      case 'current':
        return 'bg-blue-600 text-white';
      case 'saved':
        return 'bg-purple-600 text-white';
      case 'strategy':
        return 'bg-green-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="relative">
      {/* Current Selection Display */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-gray-600 hover:border-gray-500 rounded-xl p-4 transition-all duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-lg ${getSourceBadgeColor(selectedSource.type)} text-sm font-bold`}>
              {getSourceIcon(selectedSource.type)} {selectedSource.type.toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-white font-semibold">{selectedSource.label}</div>
              {selectedSource.metadata && (
                <div className="text-xs text-gray-400">
                  {selectedSource.metadata.finalNetWorth !== undefined && (
                    <>Net Worth: {formatCurrency(selectedSource.metadata.finalNetWorth)}</>
                  )}
                  {selectedSource.metadata.description && (
                    <>{selectedSource.metadata.finalNetWorth !== undefined ? ' • ' : ''}{selectedSource.metadata.description}</>
                  )}
                  {selectedSource.timestamp && ` • ${formatTimestamp(selectedSource.timestamp)}`}
                </div>
              )}
            </div>
          </div>
          <div className="text-gray-400 text-xl">
            {showDropdown ? '▲' : '▼'}
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border-2 border-gray-600 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {/* Historical Data Option */}
          <button
            onClick={() => handleSelectSource({
              type: 'historical',
              label: '📊 Historical Data (Excel Baseline)',
            })}
            className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 ${
              selectedSource.type === 'historical' ? 'bg-gray-700' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-lg ${getSourceBadgeColor('historical')} text-sm font-bold`}>
                📊 HISTORICAL
              </div>
              <div>
                <div className="text-white font-semibold">Historical Data (Excel Baseline)</div>
                <div className="text-xs text-gray-400">Real factory data from Excel file • 50 days</div>
              </div>
            </div>
          </button>

          {/* Current Simulation Option */}
          {currentResult && (
            <button
              onClick={() => handleSelectSource({
                type: 'current',
                label: '🔬 Latest Simulation',
                timestamp: Date.now(),
                metadata: {
                  finalNetWorth: currentResult.finalNetWorth,
                },
              })}
              className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 ${
                selectedSource.type === 'current' ? 'bg-gray-700' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-lg ${getSourceBadgeColor('current')} text-sm font-bold`}>
                  🔬 CURRENT
                </div>
                <div>
                  <div className="text-white font-semibold">Latest Simulation</div>
                  <div className="text-xs text-gray-400">
                    Net Worth: {formatCurrency(currentResult.finalNetWorth)} • Just completed
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Strategy Library */}
          {savedStrategies.length > 0 && (
            <>
              <div className="px-4 py-2 bg-gray-900 border-y border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase">Strategy Library ({savedStrategies.length})</div>
              </div>
              {savedStrategies.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => handleSelectSource({
                    type: 'strategy',
                    id: strategy.id,
                    label: strategy.name,
                    metadata: {
                      strategyName: strategy.name,
                      description: strategy.description,
                    },
                  })}
                  className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 ${
                    selectedSource.type === 'strategy' && selectedSource.id === strategy.id ? 'bg-gray-700' : ''
                  }`}
                  disabled={loadingStrategy}
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-lg ${getSourceBadgeColor('strategy')} text-sm font-bold`}>
                      📚 STRATEGY
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold">{strategy.name}</div>
                      {strategy.description && (
                        <div className="text-xs text-gray-400">{strategy.description}</div>
                      )}
                    </div>
                    {loadingStrategy && selectedSource.type === 'strategy' && selectedSource.id === strategy.id && (
                      <div className="text-blue-400 text-xs">Running simulation...</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Saved Simulations */}
          {savedResults.length > 0 && (
            <>
              <div className="px-4 py-2 bg-gray-900 border-y border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase">Saved Simulations ({savedResults.length})</div>
              </div>
              {savedResults.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => handleSelectSource({
                    type: 'saved',
                    id: saved.id,
                    label: saved.strategyName,
                    timestamp: saved.timestamp,
                    metadata: {
                      finalNetWorth: saved.metadata.finalNetWorth,
                      strategyName: saved.strategyName,
                    },
                  })}
                  className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 group ${
                    selectedSource.type === 'saved' && selectedSource.id === saved.id ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`px-3 py-1 rounded-lg ${getSourceBadgeColor('saved')} text-sm font-bold`}>
                        💾 SAVED
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{saved.strategyName}</div>
                        <div className="text-xs text-gray-400">
                          Net Worth: {formatCurrency(saved.metadata.finalNetWorth)} • {formatTimestamp(saved.timestamp)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSaved(saved.id, e)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Empty State */}
          {savedResults.length === 0 && !currentResult && (
            <div className="p-6 text-center text-gray-500">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-sm">No saved simulations yet</div>
              <div className="text-xs mt-1">Run simulations and save them to build your portfolio</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
