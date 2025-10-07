import { useEffect, useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { generateConstraintSuggestions, type ConstraintSuggestion } from '../../utils/constraintSuggestions';

interface GroupedRecommendations {
  Inventory: ConstraintSuggestion[];
  Production: ConstraintSuggestion[];
  Workforce: ConstraintSuggestion[];
}

export default function BottleneckRecommendations() {
  const { simulationResult } = useStrategyStore();
  const [recommendations, setRecommendations] = useState<ConstraintSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  // Load recommendations from most recent simulation
  useEffect(() => {
    if (simulationResult) {
      const bottleneckAnalysis = analyzeBottlenecks(simulationResult);
      const suggestionSet = generateConstraintSuggestions(bottleneckAnalysis, simulationResult);
      setRecommendations(suggestionSet.suggestions);
    }
  }, [simulationResult]);

  // Group recommendations by category
  const groupedRecommendations: GroupedRecommendations = {
    Inventory: recommendations.filter(r => r.category === 'Inventory'),
    Production: recommendations.filter(r => r.category === 'Production'),
    Workforce: recommendations.filter(r => r.category === 'Workforce'),
  };

  const handleApplySuggestion = (suggestion: ConstraintSuggestion) => {
    // Store in localStorage for AdvancedOptimizer to pick up
    const stored = localStorage.getItem('appliedConstraintSuggestions');
    const existing: ConstraintSuggestion[] = stored ? JSON.parse(stored) : [];

    // Check if already applied
    const alreadyApplied = existing.some(s => s.id === suggestion.id);
    if (alreadyApplied) return;

    // Add to stored suggestions
    const updated = [...existing, suggestion];
    localStorage.setItem('appliedConstraintSuggestions', JSON.stringify(updated));

    // Update local state
    setAppliedSuggestions(prev => new Set([...prev, suggestion.id]));

    // Trigger page reload to apply suggestions
    window.location.reload();
  };

  const handleApplyAll = () => {
    // Store all suggestions in localStorage
    localStorage.setItem('appliedConstraintSuggestions', JSON.stringify(recommendations));

    // Trigger page reload to apply suggestions
    window.location.reload();
  };

  const handleClearAll = () => {
    localStorage.removeItem('appliedConstraintSuggestions');
    setAppliedSuggestions(new Set());
    window.location.reload();
  };

  // If no simulation result, show placeholder
  if (!simulationResult) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="text-center text-gray-600">
          <p className="text-lg font-medium mb-2">💡 No Recommendations Yet</p>
          <p className="text-sm">Run a simulation to generate bottleneck-based recommendations</p>
        </div>
      </div>
    );
  }

  // If no recommendations, show success state
  if (recommendations.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
        <div className="text-center text-gray-800">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-lg font-medium mb-1">All Systems Optimal</p>
          <p className="text-sm text-gray-600">No bottlenecks or surpluses detected</p>
        </div>
      </div>
    );
  }

  const renderRecommendation = (suggestion: ConstraintSuggestion) => {
    const isApplied = appliedSuggestions.has(suggestion.id);
    const isMin = suggestion.constraintType.startsWith('min');

    // Priority colors
    const priorityConfig = {
      high: {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-400',
        textColor: 'text-red-900',
        badgeColor: 'bg-red-600',
        icon: '🔴',
      },
      medium: {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-900',
        badgeColor: 'bg-yellow-600',
        icon: '🟡',
      },
      low: {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-900',
        badgeColor: 'bg-blue-600',
        icon: '🔵',
      },
    };

    const config = priorityConfig[suggestion.priority];
    const actionEmoji = isMin ? '⬆️' : '⬇️';
    const actionText = isMin ? 'Increase (Set Minimum)' : 'Decrease (Set Maximum)';

    return (
      <div
        key={suggestion.id}
        className={`${config.bgColor} border-l-4 ${config.borderColor} rounded-lg p-4 shadow-sm ${
          isApplied ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{config.icon}</span>
              <span className={`${config.badgeColor} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
                {suggestion.priority}
              </span>
              <span className="text-xs font-semibold text-gray-600 bg-white/70 px-2 py-1 rounded">
                {suggestion.stationSource}
              </span>
            </div>

            <p className={`${config.textColor} text-sm font-medium mb-2`}>
              {actionEmoji} {actionText}: {suggestion.reason}
            </p>

            <div className="bg-white/60 rounded p-3 border border-gray-300">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-700">Constraint:</span>
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  {suggestion.constraintType} = {suggestion.currentValue}
                </code>
              </div>
              {suggestion.flowRate !== 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  Flow rate: {suggestion.flowRate > 0 ? '+' : ''}{suggestion.flowRate.toFixed(2)} units/day
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleApplySuggestion(suggestion)}
            disabled={isApplied}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
              isApplied
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isApplied ? '✓ Applied' : 'Apply'}
          </button>
        </div>
      </div>
    );
  };

  const renderCategory = (category: keyof GroupedRecommendations, icon: string) => {
    const items = groupedRecommendations[category];
    if (items.length === 0) return null;

    return (
      <div key={category} className="space-y-3">
        <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
          <span>{icon}</span> {category} ({items.length})
        </h4>
        {items.map(renderRecommendation)}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>💡</span> Bottleneck Recommendations
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Based on analysis of your latest simulation • {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium text-sm transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApplyAll}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Apply All ({recommendations.length})
          </button>
        </div>
      </div>

      {/* Recommendations by Category */}
      <div className="space-y-6">
        {renderCategory('Inventory', '📦')}
        {renderCategory('Production', '🏭')}
        {renderCategory('Workforce', '👥')}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="text-blue-900 font-medium mb-1">
          ℹ️ How Recommendations Work
        </p>
        <ul className="text-blue-800 space-y-1 text-xs">
          <li><strong>Minimums (⬆️):</strong> Bottlenecks detected - increase resources to improve flow</li>
          <li><strong>Maximums (⬇️):</strong> Surpluses detected - reduce waste to improve efficiency</li>
          <li><strong>Apply:</strong> Sets constraints for the optimizer to respect during optimization</li>
        </ul>
      </div>
    </div>
  );
}
