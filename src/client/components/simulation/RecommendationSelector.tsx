import { useState } from 'react';
import type { Recommendation } from '../../utils/recommendationEngine';
import { applyRecommendations } from '../../utils/applyRecommendations';
import { useStrategyStore } from '../../stores/strategyStore';

interface RecommendationSelectorProps {
  recommendations: Recommendation[];
}

export default function RecommendationSelector({ recommendations }: RecommendationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { strategy, updateStrategy } = useStrategyStore();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 border-red-500 text-white';
      case 'high': return 'bg-orange-600 border-orange-500 text-white';
      case 'medium': return 'bg-yellow-600 border-yellow-500 text-white';
      case 'low': return 'bg-blue-600 border-blue-500 text-white';
      default: return 'bg-gray-600 border-gray-500 text-white';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workforce': return '👷';
      case 'inventory': return '📦';
      case 'capacity': return '⚙️';
      case 'strategy': return '🎯';
      case 'financial': return '💰';
      default: return '📊';
    }
  };

  const toggleRecommendation = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map(r => r.id)));
    }
  };

  const applySelected = () => {
    const selectedRecommendations = recommendations.filter(r => selectedIds.has(r.id));
    if (selectedRecommendations.length === 0) return;

    const newStrategy = applyRecommendations(strategy, selectedRecommendations);
    updateStrategy(newStrategy);

    // Close modal and reset selections
    setIsOpen(false);
    setSelectedIds(new Set());
  };

  return (
    <>
      {/* Apply Recommendations Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 rounded-lg font-bold text-white text-lg shadow-lg transition-all hover:scale-105 bg-gradient-to-r from-purple-900 to-purple-800 border-2 border-purple-500"
      >
        🎯 Apply Recommendations
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500 rounded-2xl shadow-2xl max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-purple-800 border-b-2 border-purple-500 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    🎯 Apply Recommendations to Strategy
                  </h2>
                  <p className="text-gray-200">
                    Select recommendations to automatically update your strategy
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-300 hover:text-white text-4xl font-bold leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="bg-gray-800 border-b-2 border-purple-500 p-4 flex items-center justify-between">
              <div className="text-white">
                <span className="font-bold text-purple-300">{selectedIds.size}</span> of {recommendations.length} selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={toggleAll}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                >
                  {selectedIds.size === recommendations.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={applySelected}
                  disabled={selectedIds.size === 0}
                  className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${
                    selectedIds.size === 0
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg'
                  }`}
                >
                  Apply Selected ({selectedIds.size})
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {recommendations.map((rec) => {
                  const isSelected = selectedIds.has(rec.id);
                  return (
                    <div
                      key={rec.id}
                      onClick={() => toggleRecommendation(rec.id)}
                      className={`
                        border-2 rounded-xl p-5 cursor-pointer transition-all
                        ${isSelected
                          ? 'border-purple-500 bg-purple-900 bg-opacity-30 shadow-lg scale-[1.02]'
                          : 'border-gray-600 bg-gray-800 hover:border-purple-400 hover:bg-gray-750'
                        }
                      `}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="mt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by div onClick
                            className="w-6 h-6 rounded border-2 border-purple-500 bg-gray-700 checked:bg-purple-600 checked:border-purple-500 cursor-pointer"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          {/* Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`px-3 py-1 rounded-lg border-2 ${getPriorityColor(rec.priority)} text-xs font-bold uppercase`}>
                              {rec.priority}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-white mb-1">{rec.title}</h3>
                              <div className="text-sm text-gray-400">
                                {getCategoryIcon(rec.category)} {rec.category}
                              </div>
                            </div>
                          </div>

                          {/* Metrics */}
                          <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4 mb-3">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-gray-400 mb-1">Current</div>
                                <div className="text-lg font-bold text-red-400">
                                  {rec.metrics.currentValue.toFixed(1)} {rec.metrics.unit}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Target</div>
                                <div className="text-lg font-bold text-green-400">
                                  {rec.metrics.targetValue.toFixed(1)} {rec.metrics.unit}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-400 mb-1">Change</div>
                                <div className="text-lg font-bold text-purple-400">
                                  {((Math.abs(rec.metrics.targetValue - rec.metrics.currentValue) / rec.metrics.currentValue) * 100).toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions Summary */}
                          {rec.actions.length > 0 && (
                            <div className="bg-purple-900 bg-opacity-20 border border-purple-600 rounded-lg p-3">
                              <div className="text-xs font-bold text-purple-300 mb-2">
                                📋 Actions to Apply ({rec.actions.length})
                              </div>
                              <div className="space-y-1">
                                {rec.actions.map((action, idx) => (
                                  <div key={idx} className="text-sm text-gray-300">
                                    • {action.type.replace(/_/g, ' ')}: {action.parameter} ({action.currentValue.toFixed(1)} → {action.targetValue.toFixed(1)})
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Problem & Solution (condensed) */}
                          <div className="mt-3 space-y-2 text-sm">
                            <div>
                              <span className="font-semibold text-red-300">Problem:</span>{' '}
                              <span className="text-gray-300">{rec.problem}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-green-300">Solution:</span>{' '}
                              <span className="text-gray-300">{rec.solution}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-800 border-t-2 border-purple-500 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Click on any recommendation to select/deselect
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applySelected}
                  disabled={selectedIds.size === 0}
                  className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${
                    selectedIds.size === 0
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg'
                  }`}
                >
                  Apply Selected ({selectedIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
