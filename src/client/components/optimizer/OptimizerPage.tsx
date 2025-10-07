import { useState } from 'react';
import AdvancedOptimizer from '../strategy/AdvancedOptimizer';
import BottleneckRecommendations from './BottleneckRecommendations';

export default function OptimizerPage() {
  // Hold the applyRecommendation function from AdvancedOptimizer
  const [applyRecommendationFn, setApplyRecommendationFn] = useState<((parameter: string, toggle: 'minimum' | 'maximum') => void) | null>(null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-6 border border-purple-600">
        <h2 className="text-3xl font-bold text-white mb-2">
          🎯 Unified Two-Phase Optimizer
        </h2>
        <p className="text-gray-200 text-sm">
          Click "Run Two-Phase Optimizer" to automatically execute both phases: broad exploration → focused refinement
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div className="bg-blue-900/30 border border-blue-600/50 rounded p-3">
            <div className="font-semibold text-blue-300 mb-1">🔵 Phase 1: Broad Exploration</div>
            <div className="text-gray-300">Wide search of solution space to discover promising strategies</div>
          </div>
          <div className="bg-green-900/30 border border-green-600/50 rounded p-3">
            <div className="font-semibold text-green-300 mb-1">🟢 Phase 2: Focused Refinement</div>
            <div className="text-gray-300">Automatic refinement of top 3 Phase 1 results with ±5-15% mutations</div>
          </div>
        </div>
      </div>

      {/* Bottleneck Recommendations */}
      <BottleneckRecommendations onApplyRecommendation={applyRecommendationFn} />

      {/* Unified Optimizer - Runs Both Phases Automatically */}
      <AdvancedOptimizer
        onExposeApplyRecommendation={(fn) => setApplyRecommendationFn(() => fn)}
      />
    </div>
  );
}
