import { useState } from 'react';
import type { ConstraintSuggestionSet } from '../../utils/constraintSuggestions';

interface ConstraintSuggestionsModalProps {
  suggestions: ConstraintSuggestionSet;
  onClose: () => void;
}

export default function ConstraintSuggestionsModal({
  suggestions,
  onClose,
}: ConstraintSuggestionsModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    // Auto-select all high priority suggestions
    const initial: Record<string, boolean> = {};
    suggestions.suggestions.forEach(s => {
      initial[s.id] = s.priority === 'high';
    });
    return initial;
  });

  const toggleSelection = (id: string) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApplyAndNavigate = () => {
    const selectedIds = Object.keys(selected).filter(id => selected[id]);
    if (selectedIds.length > 0) {
      // Get the actual selected suggestion objects
      const selectedSuggestions = suggestions.suggestions.filter(s =>
        selectedIds.includes(s.id)
      );

      // Store in localStorage for cross-page transfer to optimizer
      localStorage.setItem('appliedConstraintSuggestions', JSON.stringify(selectedSuggestions));

      // Navigate to optimizer page
      window.location.hash = '#/optimizer';
    }
    onClose();
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // Group suggestions by category
  const inventorySuggestions = suggestions.suggestions.filter(s => s.category === 'Inventory');
  const workforceSuggestions = suggestions.suggestions.filter(s => s.category === 'Workforce');
  const equipmentSuggestions = suggestions.suggestions.filter(s => s.category === 'Equipment');

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const renderSuggestionGroup = (title: string, icon: string, groupSuggestions: typeof suggestions.suggestions) => {
    if (groupSuggestions.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <span>{icon}</span>
          {title} ({groupSuggestions.length} {groupSuggestions.length === 1 ? 'suggestion' : 'suggestions'})
        </h3>
        <div className="space-y-3">
          {groupSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => toggleSelection(suggestion.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected[suggestion.id] || false}
                  onChange={() => toggleSelection(suggestion.id)}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white">{suggestion.reason}</div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityBadge(suggestion.priority)}`}>
                      {suggestion.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 mb-2">
                    <span className="font-semibold">Current: {suggestion.currentValue}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold text-green-400">Suggested: {suggestion.suggestedValue}</span>
                  </div>
                  <div className="text-xs text-gray-400">{suggestion.rationale}</div>
                  <div className="text-xs text-gray-500 mt-1 italic">Source: {suggestion.stationSource}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 border-b-2 border-blue-500 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                💡 Suggested Optimizer Constraints
              </h2>
              <p className="text-gray-200">
                Select constraints to apply based on bottleneck analysis • {selectedCount} selected
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white text-4xl font-bold leading-none"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderSuggestionGroup('📦 Inventory Policies', '📦', inventorySuggestions)}
          {renderSuggestionGroup('👷 Workforce', '👷', workforceSuggestions)}
          {renderSuggestionGroup('⚙️ Equipment', '⚙️', equipmentSuggestions)}

          {suggestions.suggestions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-2">No Constraint Suggestions</h3>
              <p>All bottlenecks are at optimal levels!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.suggestions.length > 0 && (
          <div className="border-t border-gray-700 p-6 bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-400">
                💡 Constraints based on market demand analysis (not constrained production data)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyAndNavigate}
                  disabled={selectedCount === 0}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    selectedCount > 0
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply {selectedCount} {selectedCount === 1 ? 'Constraint' : 'Constraints'} & Open Optimizer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
