import { useEffect, useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { generateConstraintSuggestions, type ConstraintSuggestion, type LockStateToggle } from '../../utils/constraintSuggestions';

interface GroupedRecommendations {
  Inventory: ConstraintSuggestion[];
  Production: ConstraintSuggestion[];
  Workforce: ConstraintSuggestion[];
  Machines: ConstraintSuggestion[];
}

// Lock state storage interface
interface LockStateStorage {
  policies: Record<string, LockStateToggle>;
  workforce?: LockStateToggle;
  machines: Record<string, LockStateToggle>;
}

export default function BottleneckRecommendations() {
  const { simulationResult } = useStrategyStore();
  const [recommendations, setRecommendations] = useState<ConstraintSuggestion[]>([]);
  const [appliedToggles, setAppliedToggles] = useState<Set<string>>(new Set());

  // Load recommendations from most recent simulation
  useEffect(() => {
    if (simulationResult) {
      const bottleneckAnalysis = analyzeBottlenecks(simulationResult);
      const suggestionSet = generateConstraintSuggestions(bottleneckAnalysis);
      setRecommendations(suggestionSet.suggestions);
    }
  }, [simulationResult]);

  // Group recommendations by category
  const groupedRecommendations: GroupedRecommendations = {
    Inventory: recommendations.filter(r => r.category === 'Inventory'),
    Production: recommendations.filter(r => r.category === 'Production'),
    Workforce: recommendations.filter(r => r.category === 'Workforce'),
    Machines: recommendations.filter(r => r.category === 'Machines'),
  };

  const handleApplyToggle = (suggestion: ConstraintSuggestion) => {
    // Get existing lock states from localStorage
    const stored = localStorage.getItem('optimizerLockStates');
    const lockStates: LockStateStorage = stored ? JSON.parse(stored) : { policies: {}, machines: {} };

    // Apply the toggle based on parameter type
    if (suggestion.parameter === 'workforce') {
      lockStates.workforce = suggestion.toggle;
    } else if (suggestion.parameter === 'MCE' || suggestion.parameter === 'WMA' || suggestion.parameter === 'PUC') {
      lockStates.machines[suggestion.parameter] = suggestion.toggle;
    } else {
      // Policy parameter
      lockStates.policies[suggestion.parameter] = suggestion.toggle;
    }

    // Save to localStorage
    localStorage.setItem('optimizerLockStates', JSON.stringify(lockStates));

    // Update local state
    setAppliedToggles(prev => new Set([...prev, suggestion.id]));

    // Trigger page reload to apply lock states
    window.location.reload();
  };

  const handleApplyAll = () => {
    const lockStates: LockStateStorage = { policies: {}, machines: {} };

    // Apply all recommendations
    recommendations.forEach(suggestion => {
      if (suggestion.parameter === 'workforce') {
        lockStates.workforce = suggestion.toggle;
      } else if (suggestion.parameter === 'MCE' || suggestion.parameter === 'WMA' || suggestion.parameter === 'PUC') {
        lockStates.machines[suggestion.parameter] = suggestion.toggle;
      } else {
        lockStates.policies[suggestion.parameter] = suggestion.toggle;
      }
    });

    // Save to localStorage
    localStorage.setItem('optimizerLockStates', JSON.stringify(lockStates));

    // Trigger page reload to apply lock states
    window.location.reload();
  };

  const handleClearAll = () => {
    localStorage.removeItem('optimizerLockStates');
    setAppliedToggles(new Set());
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

  const getParameterDisplayName = (param: string): string => {
    const names: Record<string, string> = {
      reorderPoint: 'Reorder Point',
      orderQuantity: 'Order Quantity',
      standardBatchSize: 'Batch Size',
      mceAllocationCustom: 'MCE Allocation (Custom)',
      dailyOvertimeHours: 'Overtime Hours',
      standardPrice: 'Standard Price',
      workforce: 'Workforce Size',
      MCE: 'MCE Machines',
      WMA: 'WMA Machines',
      PUC: 'PUC Machines',
    };
    return names[param] || param;
  };

  const renderRecommendation = (suggestion: ConstraintSuggestion) => {
    const isApplied = appliedToggles.has(suggestion.id);
    const isMin = suggestion.toggle === 'minimum';

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
    const toggleEmoji = isMin ? '⬆️' : '⬇️';
    const toggleText = isMin ? 'MINIMUM' : 'MAXIMUM';

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

            <div className="mb-3">
              <p className={`${config.textColor} text-sm mb-1`}>
                {suggestion.reason}
              </p>
            </div>

            <div className="bg-white/80 rounded-lg p-3 border border-gray-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{toggleEmoji}</span>
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase">Toggle to {toggleText}</div>
                    <div className="text-sm font-bold text-gray-900">{getParameterDisplayName(suggestion.parameter)}</div>
                  </div>
                </div>
                <div className={`text-xs font-bold px-3 py-1 rounded ${isMin ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                  {toggleText}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleApplyToggle(suggestion)}
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
            <span>💡</span> Optimizer Recommendations
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Toggle lock states based on bottleneck analysis • {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
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
        {renderCategory('Machines', '⚙️')}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <p className="text-blue-900 font-medium mb-1">
          ℹ️ How Recommendations Work
        </p>
        <ul className="text-blue-800 space-y-1 text-xs">
          <li><strong>⬆️ Toggle to MINIMUM:</strong> Bottleneck detected - optimizer will keep this parameter high</li>
          <li><strong>⬇️ Toggle to MAXIMUM:</strong> Surplus detected - optimizer will keep this parameter low</li>
          <li><strong>Apply:</strong> Sets lock states in optimizer - the optimizer handles all calculations</li>
        </ul>
      </div>
    </div>
  );
}
