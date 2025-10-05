import { useState } from 'react';
import type { Recommendation } from '../../utils/recommendationEngine';

interface RecommendationsPopupProps {
  recommendations: Recommendation[];
  overallHealth: 'critical' | 'warning' | 'optimal';
}

export default function RecommendationsPopup({ recommendations, overallHealth }: RecommendationsPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 border-red-500 text-white';
      case 'high': return 'bg-orange-600 border-orange-500 text-white';
      case 'medium': return 'bg-yellow-600 border-yellow-500 text-white';
      case 'low': return 'bg-blue-600 border-blue-500 text-white';
      default: return 'bg-gray-600 border-gray-500 text-white';
    }
  };

  const getHealthColor = () => {
    switch (overallHealth) {
      case 'critical': return 'from-red-900 to-red-800 border-red-500';
      case 'warning': return 'from-orange-900 to-orange-800 border-orange-500';
      case 'optimal': return 'from-green-900 to-green-800 border-green-500';
    }
  };

  const getHealthIcon = () => {
    switch (overallHealth) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'optimal': return '✅';
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

  return (
    <>
      {/* Recommendations Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`px-6 py-3 rounded-lg font-bold text-white text-lg shadow-lg transition-all hover:scale-105 bg-gradient-to-r ${getHealthColor()}`}
      >
        {getHealthIcon()} {recommendations.length} Recommendation{recommendations.length !== 1 ? 's' : ''} Available
      </button>

      {/* Popup Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4"
          onClick={() => {
            setIsOpen(false);
            setSelectedRec(null);
          }}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-2xl shadow-2xl max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${getHealthColor()} border-b-2 p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {getHealthIcon()} Intelligent Recommendations
                  </h2>
                  <p className="text-gray-200">
                    AI-analyzed bottlenecks and optimization strategies
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedRec(null);
                  }}
                  className="text-gray-300 hover:text-white text-4xl font-bold leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedRec ? (
                /* Detailed View */
                <div className="p-6">
                  <button
                    onClick={() => setSelectedRec(null)}
                    className="mb-4 text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    ← Back to all recommendations
                  </button>

                  <div className="space-y-6">
                    {/* Title with Priority Badge */}
                    <div className="flex items-start gap-4">
                      <div className={`px-4 py-2 rounded-lg border-2 ${getPriorityColor(selectedRec.priority)} text-sm font-bold uppercase`}>
                        {selectedRec.priority}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">{selectedRec.title}</h3>
                        <div className="text-sm text-gray-400">
                          {getCategoryIcon(selectedRec.category)} {selectedRec.category}
                        </div>
                      </div>
                    </div>

                    {/* Current vs Target Metrics */}
                    <div className="bg-gray-800 rounded-xl p-6 border-2 border-blue-600">
                      <h4 className="text-lg font-semibold text-blue-300 mb-4">📊 Key Metrics</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Current Value</div>
                          <div className="text-3xl font-bold text-red-400">
                            {selectedRec.metrics.currentValue.toFixed(1)} {selectedRec.metrics.unit}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Target Value</div>
                          <div className="text-3xl font-bold text-green-400">
                            {selectedRec.metrics.targetValue.toFixed(1)} {selectedRec.metrics.unit}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <span>Gap:</span>
                          <span className="font-bold text-white">
                            {Math.abs(selectedRec.metrics.targetValue - selectedRec.metrics.currentValue).toFixed(1)} {selectedRec.metrics.unit}
                          </span>
                          <span>({((Math.abs(selectedRec.metrics.targetValue - selectedRec.metrics.currentValue) / selectedRec.metrics.currentValue) * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Problem Statement */}
                    <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-red-400 mb-3">🚨 Problem Statement</h4>
                      <p className="text-gray-200">{selectedRec.problem}</p>
                    </div>

                    {/* Analysis */}
                    <div className="bg-blue-900/30 border-2 border-blue-600 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-blue-400 mb-3">🔍 Detailed Analysis</h4>
                      <p className="text-gray-200">{selectedRec.analysis}</p>
                    </div>

                    {/* Solution */}
                    <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-green-400 mb-3">💡 Recommended Solution</h4>
                      <p className="text-gray-200 mb-4">{selectedRec.solution}</p>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h5 className="text-md font-semibold text-green-300 mb-3">Implementation Steps:</h5>
                        <ol className="space-y-2">
                          {selectedRec.implementation.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-gray-200">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {/* Expected Impact */}
                    <div className="bg-purple-900/30 border-2 border-purple-600 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-purple-400 mb-3">📈 Expected Impact</h4>
                      <p className="text-gray-200">{selectedRec.expectedImpact}</p>
                    </div>

                    {/* Risks */}
                    {selectedRec.risks.length > 0 && (
                      <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-yellow-400 mb-3">⚠️ Risks & Considerations</h4>
                        <ul className="space-y-2">
                          {selectedRec.risks.map((risk, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-gray-200">
                              <span className="text-yellow-400">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* List View */
                <div className="p-6">
                  {recommendations.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-2xl font-bold text-green-400 mb-2">
                        Factory Operating Optimally!
                      </h3>
                      <p className="text-gray-400">
                        No critical bottlenecks detected. All systems performing within acceptable parameters.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => setSelectedRec(rec)}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`px-3 py-1 rounded-lg border ${getPriorityColor(rec.priority)} text-xs font-bold uppercase`}>
                              {rec.priority}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-white mb-2">{rec.title}</h3>
                              <p className="text-gray-300 text-sm mb-3">{rec.problem}</p>
                              <div className="flex items-center gap-6 text-sm">
                                <div>
                                  <span className="text-gray-400">Current: </span>
                                  <span className="font-bold text-red-400">
                                    {rec.metrics.currentValue.toFixed(1)} {rec.metrics.unit}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Target: </span>
                                  <span className="font-bold text-green-400">
                                    {rec.metrics.targetValue.toFixed(1)} {rec.metrics.unit}
                                  </span>
                                </div>
                                <div className="ml-auto text-blue-400">
                                  Click for details →
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-gray-700 p-4 bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {selectedRec ? (
                    <span>Viewing detailed recommendation</span>
                  ) : (
                    <span>{recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} based on bottleneck analysis</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedRec(null);
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
