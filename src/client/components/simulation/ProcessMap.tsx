import { useMemo, useState, useEffect } from 'react';
import type { SimulationResult } from '../../types/ui.types';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { generateConstraintSuggestions } from '../../utils/constraintSuggestions';
import ProcessMapSelector, { type DataSource } from './ProcessMapSelector';
import InfoPopup from './InfoPopup';
import AnimatedFlowArrow from './AnimatedFlowArrow';
import ConstraintSuggestionsModal from './ConstraintSuggestionsModal';
import CustomFlowMap from './CustomFlowMap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ProcessMapProps {
  simulationResult: SimulationResult | null;
}

export default function ProcessMap({ simulationResult }: ProcessMapProps) {
  // State to track selected data source and result
  const [selectedResult, setSelectedResult] = useState<SimulationResult | null>(simulationResult);
  const [dataSource, setDataSource] = useState<DataSource>({
    type: 'strategy',
    label: 'Loading...',
  });

  // Sync selectedResult with simulationResult prop when it changes
  useEffect(() => {
    if (simulationResult) {
      setSelectedResult(simulationResult);
      setDataSource({
        type: 'strategy',
        label: 'Current Simulation',
      });
    }
  }, [simulationResult]);

  // Handle data source selection from selector
  const handleSelectResult = (result: SimulationResult | null, source: DataSource) => {
    setSelectedResult(result);
    setDataSource(source);
  };

  // Use selected result for display
  const displayResult = selectedResult;

  // DEBUG: Track displayResult changes
  useEffect(() => {
    console.log('[ProcessMap] DEBUG - displayResult changed:', {
      hasResult: !!displayResult,
      dataSourceType: dataSource.type,
      dataSourceLabel: dataSource.label,
      historyLength: displayResult?.state.history.dailyCash.length,
      sampleProductionData: displayResult?.state.history.dailyStandardProduction.slice(-5),
    });
  }, [displayResult, dataSource]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Initialize state hooks
  const [showStatistics, setShowStatistics] = useState(true);
  const [showTrends, setShowTrends] = useState(false);
  const [showConstraintSuggestionsModal, setShowConstraintSuggestionsModal] = useState(false);
  const [viewMode, setViewMode] = useState<'dual-line' | 'custom-flow'>('custom-flow');

  // Perform comprehensive bottleneck analysis (with null safety)
  const bottleneckAnalysis = useMemo(() =>
    displayResult ? analyzeBottlenecks(displayResult) : { metrics: [], problems: [], overallHealth: 'optimal' as const, summaryStats: { totalBottlenecks: 0, criticalBottlenecks: 0, averageUtilization: 0, mostCriticalStation: null } },
    [displayResult]
  );

  // Generate constraint suggestions based on bottleneck analysis (with null safety)
  const constraintSuggestions = useMemo(
    () => displayResult && bottleneckAnalysis ? generateConstraintSuggestions(bottleneckAnalysis, displayResult) : { suggestions: [], generatedFrom: 'bottleneck-analysis' as const, timestamp: Date.now() },
    [bottleneckAnalysis, displayResult]
  );

  // Calculate average production rates (with null safety)
  const finalDayIndex = displayResult?.state.history.dailyCash.length ? displayResult.state.history.dailyCash.length - 1 : 0;
  const recentDays = 50;
  const startIdx = Math.max(0, finalDayIndex - recentDays);

  // DEBUG LOGGING
  console.log('[ProcessMap] DEBUG - Index calculations:', {
    finalDayIndex,
    recentDays,
    startIdx,
    totalDays: displayResult?.state.history.dailyCash.length,
  });

  const avgStandardProduction = useMemo(() => {
    if (!displayResult) return 0;
    const elements = displayResult.state.history.dailyStandardProduction.slice(startIdx, finalDayIndex + 1);
    const sum = elements.reduce((acc, d) => acc + d.value, 0);
    const avg = elements.length > 0 ? sum / elements.length : 0;

    console.log('[ProcessMap] DEBUG - Standard Production:', {
      totalArrayLength: displayResult.state.history.dailyStandardProduction.length,
      sliceStart: startIdx,
      sliceEnd: finalDayIndex + 1,
      elementsLength: elements.length,
      firstElement: elements[0],
      lastElement: elements[elements.length - 1],
      sum,
      avg,
    });

    return avg;
  }, [displayResult, startIdx, finalDayIndex]);

  const avgCustomProduction = useMemo(() => {
    if (!displayResult) return 0;
    const elements = displayResult.state.history.dailyCustomProduction.slice(startIdx, finalDayIndex + 1);
    const sum = elements.reduce((acc, d) => acc + d.value, 0);
    const avg = elements.length > 0 ? sum / elements.length : 0;

    console.log('[ProcessMap] DEBUG - Custom Production:', {
      totalArrayLength: displayResult.state.history.dailyCustomProduction.length,
      sliceStart: startIdx,
      sliceEnd: finalDayIndex + 1,
      elementsLength: elements.length,
      firstElement: elements[0],
      lastElement: elements[elements.length - 1],
      sum,
      avg,
    });

    return avg;
  }, [displayResult, startIdx, finalDayIndex]);

  // Prepare trend chart data (with null safety)
  const trendChartData = useMemo(() => {
    if (!displayResult) return [];
    const sampleInterval = Math.max(1, Math.floor(finalDayIndex / 50));
    return displayResult.state.history.dailyStandardWIP
      .filter((_, idx) => idx % sampleInterval === 0)
      .map((_, idx) => {
        const actualIdx = idx * sampleInterval;
        return {
          day: displayResult.state.history.dailyStandardWIP[actualIdx].day,
          standardWIP: displayResult.state.history.dailyStandardWIP[actualIdx].value,
          customWIP: displayResult.state.history.dailyCustomWIP[actualIdx]?.value || 0,
          rawMaterial: displayResult.state.history.dailyRawMaterial[actualIdx]?.value || 0,
        };
      });
  }, [displayResult, finalDayIndex]);

  // If still no result (shouldn't happen with historical data), show placeholder
  if (!displayResult) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏭</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Process Map</h3>
        <p className="text-gray-600">
          Run a simulation to see your factory's live process flow with bottleneck detection.
        </p>
      </div>
    );
  }

  const { state } = displayResult;

  // Get final day values (finalDayIndex already computed at top)
  const finalRawMaterial = state.history.dailyRawMaterial[finalDayIndex]?.value || 0;
  const finalStandardWIP = state.history.dailyStandardWIP[finalDayIndex]?.value || 0;
  const finalCustomWIP = state.history.dailyCustomWIP[finalDayIndex]?.value || 0;
  const finalFinishedStandard = state.history.dailyFinishedStandard[finalDayIndex]?.value || 0;
  const finalStandardProduction = state.history.dailyStandardProduction[finalDayIndex]?.value || 0;
  const finalCustomProduction = state.history.dailyCustomProduction[finalDayIndex]?.value || 0;
  const finalExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const finalRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;

  // Calculate ARCP capacity
  const arcpCapacity = (finalExperts * 3) + (finalRookies * 3 * 0.4);

  // Calculate flow rates and demand rates for animated arrows
  const mceAllocation = displayResult?.strategy?.mceAllocationCustom ?? 0.5;

  // Raw Material → MCE
  const rawMaterialFlowRate = (avgStandardProduction * 2) + (avgCustomProduction * 1);
  const rawMaterialDemandRate = rawMaterialFlowRate + 5; // Target buffer for continuous operation

  // MCE → Custom Line
  const mceToCustomFlowRate = avgCustomProduction;
  const mceToCustomDemandRate = 6; // WMA Pass 1 capacity (6 units/day total for both passes)

  // MCE → Standard Line
  const mceToStandardFlowRate = avgStandardProduction;
  const mceToStandardDemandRate = avgStandardProduction + 3; // Target to reduce WIP

  // Custom WMA Pass 1 → PUC
  const wmapass1ToPUCFlowRate = avgCustomProduction;
  const wmapass1ToPUCDemandRate = avgCustomProduction + 2; // PUC should keep up

  // PUC → Custom WMA Pass 2
  const pucToWMApass2FlowRate = avgCustomProduction;
  const pucToWMApass2DemandRate = 6; // WMA capacity shared with Pass 1

  // Custom WMA Pass 2 → ARCP
  const customToARCPFlowRate = avgCustomProduction;
  const customToARCPDemandRate = arcpCapacity * mceAllocation; // ARCP capacity allocated to custom

  // Standard Batching → ARCP
  const standardToARCPFlowRate = avgStandardProduction;
  const standardToARCPDemandRate = arcpCapacity * (1 - mceAllocation); // ARCP capacity allocated to standard

  // ARCP → Standard Batching 2
  const arcpToStandardBatch2FlowRate = avgStandardProduction;
  const arcpToStandardBatch2DemandRate = avgStandardProduction + 2;

  // Standard Batching 2 → Finished Goods
  const batch2ToFinishedFlowRate = avgStandardProduction;
  const batch2ToFinishedDemandRate = 21; // Maximum daily demand

  // Finished Goods → Customer
  const finishedToCustomerFlowRate = avgStandardProduction;
  const finishedToCustomerDemandRate = 21; // Maximum daily demand

  // Detect bottlenecks (WIP > 100 or capacity < 50% of demand)
  const isStandardBottleneck = finalStandardWIP > 100;
  const isCustomBottleneck = finalCustomWIP > 50;
  const isARCPBottleneck = arcpCapacity < 10;
  const isRawMaterialBottleneck = finalRawMaterial < 50;

  // Get severity color
  const getSeverityColor = (severity: 'critical' | 'warning' | 'optimal') => {
    return severity === 'critical' ? 'border-red-500 bg-red-900/90' :
           severity === 'warning' ? 'border-yellow-500 bg-yellow-900/90' :
           'border-green-500 bg-green-900/90';
  };

  const getSeverityBadge = (severity: 'critical' | 'warning' | 'optimal') => {
    return severity === 'critical' ? 'bg-red-600 text-white' :
           severity === 'warning' ? 'bg-yellow-600 text-white' :
           'bg-green-600 text-white';
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'optimal') => {
    return severity === 'critical' ? '🚨' :
           severity === 'warning' ? '⚠️' : '✅';
  };

  const getDataSourceTitle = () => {
    switch (dataSource.type) {
      case 'historical':
        return 'Factory Process Map (Historical Baseline)';
      case 'current':
        return 'Factory Process Map (Latest Simulation)';
      case 'saved':
        return `Factory Process Map (${dataSource.metadata?.strategyName || 'Saved Result'})`;
      default:
        return 'Factory Process Map';
    }
  };

  const getDataSourceDescription = () => {
    switch (dataSource.type) {
      case 'historical':
        return 'Real Excel data showing baseline factory performance • 50 days of operation';
      case 'current':
        return 'Latest simulation results with comprehensive bottleneck analysis';
      case 'saved':
        return 'Saved simulation results with bottleneck analysis';
      default:
        return 'Process flow visualization with bottleneck detection';
    }
  };

  return (
    <div className="space-y-4 w-full px-1">
      {/* Process Map Selector */}
      <ProcessMapSelector
        currentResult={simulationResult}
        onSelectResult={handleSelectResult}
      />

      {/* View Mode Toggle */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setViewMode('dual-line')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            viewMode === 'dual-line'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📊 Dual Production Lines
        </button>
        <button
          onClick={() => setViewMode('custom-flow')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            viewMode === 'custom-flow'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🔄 Custom Flow with Loop
        </button>
      </div>

      {/* Render based on view mode */}
      {viewMode === 'custom-flow' ? (
        <CustomFlowMap simulationResult={displayResult} />
      ) : (
        <>
      {/* Header with Overall Health */}
      <div className={`bg-gradient-to-r from-blue-900 to-purple-900 border-2 rounded-xl p-6 ${getSeverityColor(bottleneckAnalysis.overallHealth)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              🏭 {getDataSourceTitle()}
            </h2>
            <p className="text-gray-300 text-sm">
              {getDataSourceDescription()}
            </p>
          </div>
          <div className="text-right">
            <div className={`px-4 py-2 rounded-lg ${getSeverityBadge(bottleneckAnalysis.overallHealth)} text-sm font-bold mb-2`}>
              {getSeverityIcon(bottleneckAnalysis.overallHealth)} {bottleneckAnalysis.overallHealth.toUpperCase()}
            </div>
            <div className="text-xs text-gray-400">
              {bottleneckAnalysis.summaryStats.criticalBottlenecks} Critical • {bottleneckAnalysis.summaryStats.totalBottlenecks} Total Issues
            </div>
          </div>
        </div>
      </div>

      {/* Arrow Legend */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">📌 Flow Arrow Legend</h3>
        <div className="grid grid-cols-3 gap-6">
          {/* Shortage Arrow */}
          <div className="flex flex-col items-center">
            <div className="mb-3">
              <svg width="32" height="80" viewBox="0 0 32 80">
                <polygon points="14,0 18,0 24,60 8,60" fill="#ef4444" opacity="0.95" />
                <polygon points="16,80 4,60 28,60" fill="#ef4444" opacity="0.95" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-red-400 font-bold text-sm mb-1">⚠️ Supply Shortage</div>
              <div className="text-gray-400 text-xs">Thin top → Thick bottom</div>
              <div className="text-gray-500 text-xs mt-1">Not enough supply</div>
            </div>
          </div>

          {/* Balanced Arrow */}
          <div className="flex flex-col items-center">
            <div className="mb-3">
              <svg width="32" height="80" viewBox="0 0 32 80">
                <polygon points="10,0 22,0 22,60 10,60" fill="#3b82f6" opacity="0.95" />
                <polygon points="16,80 4,60 28,60" fill="#3b82f6" opacity="0.95" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold text-sm mb-1">✅ Balanced Flow</div>
              <div className="text-gray-400 text-xs">Uniform width</div>
              <div className="text-gray-500 text-xs mt-1">Healthy supply & demand</div>
            </div>
          </div>

          {/* Excess Arrow */}
          <div className="flex flex-col items-center">
            <div className="mb-3">
              <svg width="32" height="80" viewBox="0 0 32 80">
                <polygon points="4,0 28,0 18,60 14,60" fill="#22c55e" opacity="0.95" />
                <polygon points="16,80 4,60 28,60" fill="#22c55e" opacity="0.95" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-bold text-sm mb-1">📈 Excess Supply</div>
              <div className="text-gray-400 text-xs">Thick top → Thin bottom</div>
              <div className="text-gray-500 text-xs mt-1">Supply exceeds demand</div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-gray-400 text-xs">
          Click any arrow in the process map for detailed flow metrics
        </div>
      </div>

      {/* Comprehensive Statistics Panel */}
      {showStatistics && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">📊 Bottleneck Statistics</h3>
            <button
              onClick={() => setShowStatistics(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {bottleneckAnalysis.metrics.map((metric, idx) => (
              <div key={idx} className={`border-2 rounded-lg p-4 ${getSeverityColor(metric.severity)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-white">{metric.station}</div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${getSeverityBadge(metric.severity)}`}>
                    {metric.severity === 'critical' ? 'CRITICAL' : metric.severity === 'warning' ? 'WARNING' : 'OPTIMAL'}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-gray-300">
                  <div>Avg WIP/Level: <span className="text-white font-semibold">{metric.averageWIP.toFixed(1)}</span></div>
                  <div>Peak: <span className="text-white font-semibold">{metric.peakWIP.toFixed(0)}</span> (Day {metric.peakDay})</div>
                  <div>Bottlenecked: <span className="text-white font-semibold">{metric.percentageBottlenecked.toFixed(1)}%</span> ({metric.daysBottlenecked}/{metric.totalDays} days)</div>
                  <div>Trend: <span className={`font-semibold ${metric.trend === 'increasing' ? 'text-red-400' : metric.trend === 'decreasing' ? 'text-green-400' : 'text-gray-400'}`}>
                    {metric.trend === 'increasing' ? '📈 Worsening' : metric.trend === 'decreasing' ? '📉 Improving' : '➡️ Stable'}
                  </span></div>
                  <div>Health Score: <span className="text-white font-semibold">{metric.utilizationRate.toFixed(0)}%</span></div>
                  {metric.remedyHint && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="text-xs font-semibold text-blue-300 mb-1">{metric.remedyHint.icon} Remedy Hint</div>
                      <div className="text-xs text-gray-300 mb-1">
                        <span className="font-semibold text-white">{metric.remedyHint.category}</span>
                      </div>
                      <div className="text-xs text-gray-300 mb-1">→ {metric.remedyHint.action}</div>
                      <div className="text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          metric.remedyHint.complexity === 'Quick Fix' ? 'bg-green-600 text-white' :
                          metric.remedyHint.complexity === 'Capital Investment' ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {metric.remedyHint.complexity === 'Quick Fix' ? '🟢' : metric.remedyHint.complexity === 'Capital Investment' ? '🟡' : '🔴'} {metric.remedyHint.complexity}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Apply to Optimizer Button */}
          {constraintSuggestions.suggestions.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setShowConstraintSuggestionsModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2"
              >
                <span>🎯</span>
                <span>Apply {constraintSuggestions.suggestions.length} Suggested Constraint{constraintSuggestions.suggestions.length !== 1 ? 's' : ''} to Optimizer</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historical Trends Chart */}
      {showTrends && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">📈 Bottleneck Evolution Over Time</h3>
            <button
              onClick={() => setShowTrends(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Hide
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9ca3af" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Legend />
              <Line type="monotone" dataKey="standardWIP" stroke="#3b82f6" strokeWidth={2} name="Standard WIP" dot={false} />
              <Line type="monotone" dataKey="customWIP" stroke="#8b5cf6" strokeWidth={2} name="Custom WIP" dot={false} />
              <Line type="monotone" dataKey="rawMaterial" stroke="#f59e0b" strokeWidth={2} name="Raw Material" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Toggle Buttons */}
      <div className="flex gap-3 justify-center">
        {!showStatistics && (
          <button
            onClick={() => setShowStatistics(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Show Statistics
          </button>
        )}
        {!showTrends && (
          <button
            onClick={() => setShowTrends(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
          >
            Show Trends
          </button>
        )}
      </div>

      <div className="border-t-2 border-gray-700 pt-8">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Factory Flow Visualization</h3>
      </div>

      {/* Horizontal Scrollable Container for Process Flow */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[1400px]">
          {/* Raw Material Inventory - Top */}
          <div className="flex justify-center mb-12">
        <div className={`relative bg-gradient-to-br ${isRawMaterialBottleneck ? 'from-red-900 to-red-800 border-red-500' : 'from-amber-900 to-amber-800 border-amber-500'} border-3 rounded-3xl p-8 min-w-[400px] shadow-2xl`}>
          <div className="absolute top-4 right-4">
            <InfoPopup
              title="📦 Raw Material Inventory"
              content={
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">Overview</h4>
                    <p className="text-gray-300">
                      Raw material parts are the foundation of all production. Both production lines consume these parts at the MCE station to begin manufacturing.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">Current Status</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Inventory:</span>
                        <span className="text-white font-bold">{Math.round(finalRawMaterial)} parts</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">Ordering Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cost per Part:</span>
                        <span className="text-white font-bold">$50</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Order Fee:</span>
                        <span className="text-white font-bold">$1,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lead Time:</span>
                        <span className="text-white font-bold">4 days</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">Usage by Production Line</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-purple-300 font-semibold">Custom Line:</span>
                          <span className="text-white font-bold">1 part per order</span>
                        </div>
                        <p className="text-gray-400 text-xs">Make-to-order production with first priority on MCE</p>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-blue-300 font-semibold">Standard Line:</span>
                          <span className="text-white font-bold">2 parts per unit</span>
                        </div>
                        <p className="text-gray-400 text-xs">Make-to-stock production with second priority on MCE</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Bottleneck Indicators</h4>
                    <p className="text-gray-300 text-sm">
                      Low inventory (&lt;50 parts) indicates a bottleneck. This prevents new production from starting at the MCE station, causing both production lines to starve.
                    </p>
                  </div>
                </div>
              }
            />
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-300 mb-3">📦 RAW MATERIAL INVENTORY</div>
            <div className="text-5xl font-bold text-white mb-3">{Math.round(finalRawMaterial)}</div>
            <div className="text-sm text-white drop-shadow-lg mb-1">parts available</div>
            {isRawMaterialBottleneck && (
              <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                ⚠️ LOW INVENTORY BOTTLENECK
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animated Arrow: Raw Material → MCE */}
      <AnimatedFlowArrow
        fromStation="Raw Material"
        toStation="MCE Station"
        flowRate={rawMaterialFlowRate}
        demandRate={rawMaterialDemandRate}
        vertical={true}
      />

      {/* Unified MCE Station */}
      <div className="flex justify-center mb-12">
        <div className="relative bg-gradient-to-r from-purple-700 via-gray-700 to-blue-700 border-3 border-gray-500 rounded-3xl p-8 min-w-[900px] shadow-2xl">
          <div className="absolute top-4 right-4">
            <InfoPopup
              title="⚙️ Station 3 - MCE (Material Consumption & Forming)"
              content={
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">Overview</h4>
                    <p className="text-gray-300">
                      The MCE (Material Consumption & Forming) station is the shared entry point for both production lines. It consumes raw material parts and begins the forming process.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">Current Allocation</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-purple-300 font-semibold">Custom Line Allocation:</span>
                        <span className="text-white font-bold">{((displayResult?.strategy?.mceAllocationCustom ?? 0.5) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300 font-semibold">Standard Line Allocation:</span>
                        <span className="text-white font-bold">{((1 - (displayResult?.strategy?.mceAllocationCustom ?? 0.5)) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">Material Consumption</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-purple-300 font-semibold">Custom Line:</span>
                          <span className="text-white font-bold">1 part per order</span>
                        </div>
                        <p className="text-gray-400 text-xs">Lower material consumption, higher priority allocation</p>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-blue-300 font-semibold">Standard Line:</span>
                          <span className="text-white font-bold">2 parts per unit</span>
                        </div>
                        <p className="text-gray-400 text-xs">Higher material consumption, secondary priority</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">Process Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Processing Time:</span>
                        <span className="text-white font-bold">Immediate (Day 0)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Station Type:</span>
                        <span className="text-white font-bold">Automated (Machine)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Capacity Source:</span>
                        <span className="text-white font-bold">Number of MCE Machines</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">💡 Strategic Importance</h4>
                    <p className="text-gray-300 text-sm">
                      The MCE allocation percentage is a critical strategic parameter. It determines how machine capacity is divided between custom and standard production. Custom line has first priority on allocated capacity, while standard line uses remaining capacity.
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-blue-300 mb-2">Capital Investment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Purchase Cost:</span>
                        <span className="text-white font-bold">$20,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Resale Value:</span>
                        <span className="text-white font-bold">$10,000</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-3">⚙️ STATION 3 - MCE (SHARED)</div>
            <div className="text-lg text-gray-200 mb-4">Material Consumption & Forming</div>

            {/* Allocation Visual */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <div className="text-sm text-gray-300 mb-2">Capacity Allocation</div>
              <div className="flex h-8 rounded-lg overflow-hidden">
                <div
                  className="bg-purple-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${((displayResult?.strategy?.mceAllocationCustom ?? 0.5) * 100)}%` }}
                >
                  Custom ({((displayResult?.strategy?.mceAllocationCustom ?? 0.5) * 100).toFixed(0)}%)
                </div>
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${((1 - (displayResult?.strategy?.mceAllocationCustom ?? 0.5)) * 100)}%` }}
                >
                  Standard ({((1 - (displayResult?.strategy?.mceAllocationCustom ?? 0.5)) * 100).toFixed(0)}%)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-purple-900/50 rounded-lg p-3">
                <div className="text-purple-300 font-semibold">Custom Line</div>
                <div className="text-white">1 part per order</div>
              </div>
              <div className="bg-blue-900/50 rounded-lg p-3">
                <div className="text-blue-300 font-semibold">Standard Line</div>
                <div className="text-white">2 parts per unit</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Arrows: MCE → Custom Line & Standard Line */}
      <div className="flex justify-center my-8 gap-64">
        <AnimatedFlowArrow
          fromStation="MCE"
          toStation="Custom Line"
          flowRate={mceToCustomFlowRate}
          demandRate={mceToCustomDemandRate}
          vertical={true}
        />
        <AnimatedFlowArrow
          fromStation="MCE"
          toStation="Standard Line"
          flowRate={mceToStandardFlowRate}
          demandRate={mceToStandardDemandRate}
          vertical={true}
        />
      </div>

      {/* Two Production Lines */}
      <div className="grid grid-cols-2 gap-16 px-2">
        {/* CUSTOM LINE - Left */}
        <div className="space-y-6">
          <div className="border-3 border-purple-500 rounded-2xl p-8 bg-gradient-to-br from-purple-950 to-purple-900">
            <div className="relative text-center mb-8">
              <div className="absolute top-0 right-0">
                <InfoPopup
                  title="🎨 Custom Line - Complete Overview"
                  buttonClassName="bg-purple-600 hover:bg-purple-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Production Model</h4>
                        <p className="text-gray-300 text-sm">
                          Make-to-Order (MTO): Each customer order is manufactured individually and shipped directly upon completion. No finished goods inventory is maintained.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Pipeline Stages</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">1. MCE (Material Consumption):</span>
                            <span className="text-white font-bold">Day 0</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">2. WMA Pass 1:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">3. PUC (Precision Cutting):</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">4. WMA Pass 2:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">5. ARCP (Assembly):</span>
                            <span className="text-white font-bold">Variable</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">6. Direct Ship:</span>
                            <span className="text-white font-bold">Immediate</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Material Consumption</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Raw Material per Order:</span>
                            <span className="text-white font-bold">1 part</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">MCE Priority:</span>
                            <span className="text-white font-bold">FIRST (before Standard)</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Current Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Current WIP:</span>
                            <span className="text-white font-bold">{Math.round(finalCustomWIP)} orders</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Maximum Capacity:</span>
                            <span className="text-white font-bold">360 orders</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Capacity Utilization:</span>
                            <span className="text-white font-bold">{((finalCustomWIP / 360) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Daily Output:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Critical Constraints</h4>
                        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                          <li>WMA Pass 1 & 2 share same 6 units/day machine capacity</li>
                          <li>ARCP workforce bottleneck affects completion rate</li>
                          <li>High WIP (&gt;50 orders) indicates processing bottleneck</li>
                          <li>Delivery time increases with WIP backlog</li>
                        </ul>
                      </div>

                      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">💡 Strategic Insights</h4>
                        <p className="text-gray-300 text-sm">
                          Custom line pricing is based on delivery time - faster delivery commands premium pricing. Managing WIP and workforce capacity directly impacts profitability through delivery time reduction.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-3xl font-bold text-white mb-2 drop-shadow-lg">🎨 CUSTOM LINE</div>
              <div className="text-lg text-white mb-2 drop-shadow-md">(Make-to-Order)</div>
              <div className="text-sm text-white mt-2 drop-shadow-md">1 part/unit • FIRST priority on MCE</div>
            </div>

            {/* Custom Line Stats */}
            <div className={`relative bg-purple-800 rounded-xl p-6 mb-6 text-center ${isCustomBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="🎨 Custom Line - Work-In-Progress (WIP)"
                  buttonClassName="bg-purple-600 hover:bg-purple-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          Work-In-Progress (WIP) represents custom orders currently being processed through the production pipeline but not yet completed and shipped.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Current Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Current WIP:</span>
                            <span className="text-white font-bold">{Math.round(finalCustomWIP)} orders</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Average Daily Output:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Maximum WIP Capacity:</span>
                            <span className="text-white font-bold">360 orders</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(avgCustomProduction - mceToCustomDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(avgCustomProduction - mceToCustomDemandRate).toFixed(1)} orders/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-900/50 border border-purple-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">📊 WIP Breakdown</h4>
                        <p className="text-gray-300 text-sm mb-3">
                          The {Math.round(finalCustomWIP)} orders of WIP are distributed across the entire custom pipeline:
                        </p>
                        <div className="space-y-2 text-xs text-gray-300">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-teal-600 rounded"></div>
                            <span>WMA Pass 1 - Whittling & Micro Abrasion (2 days)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-pink-600 rounded"></div>
                            <span>PUC - Precision Ultra-fine Cutting (1 day)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-teal-600 rounded"></div>
                            <span>WMA Pass 2 - Final Adjustments (2 days)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-600 rounded"></div>
                            <span>ARCP - Assembly & Quality (variable time)</span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3 italic">
                          Total pipeline time: 5 days + ARCP processing time. All stations shown below are PART OF this total WIP.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Production Flow</h4>
                        <p className="text-gray-300 text-sm mb-3">
                          Custom line follows a make-to-order model. Each order flows through:
                        </p>
                        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                          <li>MCE - Material Consumption (Day 0)</li>
                          <li>WMA Pass 1 - Whittling & Micro Abrasion (2 days)</li>
                          <li>PUC - Precision Ultra-fine Cutting (1 day)</li>
                          <li>WMA Pass 2 - Final Adjustments (2 days)</li>
                          <li>ARCP - Assembly & Quality (variable)</li>
                          <li>Direct Ship to Customer</li>
                        </ol>
                      </div>

                      <div className="bg-purple-900 border border-purple-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">⚠️ Bottleneck Detection</h4>
                        <p className="text-gray-300 text-sm">
                          High WIP (&gt;50 orders) indicates a bottleneck. Common causes: insufficient ARCP capacity, low MCE allocation, or WMA capacity constraints.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-base font-semibold text-white mb-1 drop-shadow-lg">📊 Work-In-Progress (WIP)</div>
              <div className="text-xs text-purple-100 mb-3 drop-shadow-md">Orders currently being processed</div>
              <div className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{Math.round(finalCustomWIP)}</div>
              <div className="text-sm text-purple-100 drop-shadow-md">custom orders</div>
              <div className="border-t border-purple-600 mt-4 pt-3">
                <div className="text-xs text-purple-100 mb-1 drop-shadow-md">Average Daily Output</div>
                <div className="text-lg font-bold text-white drop-shadow-lg">{avgCustomProduction.toFixed(1)} orders/day</div>
              </div>
              {isCustomBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Station 2 - WMA Pass 1 */}
            <div className="relative bg-teal-700 rounded-xl p-5 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="Station 2 - WMA Pass 1 (Whittling & Micro Abrasion)"
                  buttonClassName="bg-teal-600 hover:bg-teal-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          First pass through the Whittling and Micro Abrasion station. This automated station performs initial surface preparation and micro-abrasion on custom orders.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Process Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Time:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Max Throughput:</span>
                            <span className="text-white font-bold">6 orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Station Type:</span>
                            <span className="text-white font-bold">Automated (Machine)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Current Flow Rate:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Capacity Utilization:</span>
                            <span className={`font-bold ${(avgCustomProduction / 6) > 0.8 ? 'text-red-400' : 'text-green-400'}`}>
                              {((avgCustomProduction / 6) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After MCE (Day 0)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Duration:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exit Point:</span>
                            <span className="text-white font-bold">To PUC (Day 2)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Orders In Process:</span>
                            <span className="text-white font-bold">~{Math.round(avgCustomProduction * 2)} orders</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow:</span>
                            <span className="text-white font-bold">{wmapass1ToPUCFlowRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Demand from PUC:</span>
                            <span className="text-white font-bold">{wmapass1ToPUCDemandRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(wmapass1ToPUCFlowRate - wmapass1ToPUCDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(wmapass1ToPUCFlowRate - wmapass1ToPUCDemandRate).toFixed(1)} orders/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Critical Note</h4>
                        <p className="text-gray-300 text-sm">
                          This station is shared with WMA Pass 2. Total capacity (6 orders/day) is split between both passes. Heavy usage in one pass reduces capacity for the other.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Capital Investment</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Purchase Cost:</span>
                            <span className="text-white font-bold">$15,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Resale Value:</span>
                            <span className="text-white font-bold">$7,500</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">Station 2 - WMA Pass 1</div>
              <div className="text-base text-white font-semibold mb-2">Whittling & Micro Abrasion</div>
            </div>

            {/* Animated Arrow: WMA Pass 1 → PUC */}
            <AnimatedFlowArrow
              fromStation="WMA Pass 1"
              toStation="PUC"
              flowRate={wmapass1ToPUCFlowRate}
              demandRate={wmapass1ToPUCDemandRate}
              vertical={true}
            />

            {/* Station 4 - PUC */}
            <div className="relative bg-pink-700 rounded-xl p-5 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="Station 4 - PUC (Precision Ultra-fine Cutting)"
                  buttonClassName="bg-pink-600 hover:bg-pink-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          The Precision Ultra-fine Cutting station performs high-precision cutting operations on custom orders between the two WMA passes.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">Process Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Time:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Station Type:</span>
                            <span className="text-white font-bold">Automated (Machine)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Current Flow Rate:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After WMA Pass 1 (Day 2)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Duration:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exit Point:</span>
                            <span className="text-white font-bold">To WMA Pass 2 (Day 3)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Orders In Process:</span>
                            <span className="text-white font-bold">~{Math.round(avgCustomProduction * 1)} orders</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{wmapass1ToPUCFlowRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow:</span>
                            <span className="text-white font-bold">{pucToWMApass2FlowRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Demand from WMA Pass 2:</span>
                            <span className="text-white font-bold">{pucToWMApass2DemandRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(pucToWMApass2FlowRate - pucToWMApass2DemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(pucToWMApass2FlowRate - pucToWMApass2DemandRate).toFixed(1)} orders/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">Position in Flow</h4>
                        <p className="text-gray-300 text-sm">
                          PUC sits between WMA Pass 1 and WMA Pass 2, performing ultra-fine cutting operations after initial micro-abrasion and before final adjustments.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">Capital Investment</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Purchase Cost:</span>
                            <span className="text-white font-bold">$12,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Resale Value:</span>
                            <span className="text-white font-bold">$4,000</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">Station 4 - PUC</div>
              <div className="text-base text-white font-semibold mb-2">Precision Ultra-fine Cutting</div>
            </div>

            {/* Curved Loopback Arrow: PUC → WMA Pass 2 */}
            <div className="flex justify-end my-6 relative" style={{ height: '120px' }}>
              <div className="relative">
                {/* Loopback Label */}
                <div className="absolute top-12 right-24 text-xs text-teal-300 font-bold bg-gray-900/90 px-3 py-2 rounded border border-teal-500 whitespace-nowrap z-10">
                  🔄 Loopback to WMA
                </div>

                {/* Flow/Demand Labels */}
                <div className="absolute top-0 right-16 text-xs text-blue-300 font-bold bg-blue-900/90 px-2 py-1 rounded border border-blue-600 whitespace-nowrap z-10">
                  Flow: {pucToWMApass2FlowRate.toFixed(1)}
                </div>
                <div className="absolute bottom-0 right-16 text-xs text-purple-300 font-bold bg-purple-900/90 px-2 py-1 rounded border border-purple-600 whitespace-nowrap z-10">
                  Demand: {pucToWMApass2DemandRate.toFixed(1)}
                </div>

                {/* Curved SVG Arrow */}
                <svg width="160" height="120" viewBox="0 0 160 120" className="overflow-visible">
                  {/* Curved path */}
                  <path
                    d="M 10 10 Q 120 10, 120 60 T 10 110"
                    fill="none"
                    stroke={pucToWMApass2FlowRate < pucToWMApass2DemandRate ? '#ef4444' : pucToWMApass2FlowRate > pucToWMApass2DemandRate + 0.5 ? '#22c55e' : '#3b82f6'}
                    strokeWidth="4"
                    opacity="0.9"
                  />
                  {/* Arrowhead pointing down */}
                  <polygon
                    points="10,110 5,100 15,100"
                    fill={pucToWMApass2FlowRate < pucToWMApass2DemandRate ? '#ef4444' : pucToWMApass2FlowRate > pucToWMApass2DemandRate + 0.5 ? '#22c55e' : '#3b82f6'}
                    opacity="0.9"
                  />
                  {/* Animated particles */}
                  <circle r="4" fill="white" opacity="0.8">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path="M 10 10 Q 120 10, 120 60 T 10 110"
                    />
                  </circle>
                  <circle r="4" fill="white" opacity="0.8">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.66s"
                      path="M 10 10 Q 120 10, 120 60 T 10 110"
                    />
                  </circle>
                  <circle r="4" fill="white" opacity="0.8">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.33s"
                      path="M 10 10 Q 120 10, 120 60 T 10 110"
                    />
                  </circle>
                </svg>
              </div>
            </div>

            {/* Station 2 - WMA Pass 2 */}
            <div className="relative bg-teal-700 rounded-xl p-5 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="Station 2 - WMA Pass 2 (Final Adjustments)"
                  buttonClassName="bg-teal-600 hover:bg-teal-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          Second pass through the Whittling and Micro Abrasion station. Performs final surface adjustments after PUC cutting operations.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Process Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Time:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Station Type:</span>
                            <span className="text-white font-bold">Automated (Machine)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Current Flow Rate:</span>
                            <span className="text-white font-bold">{avgCustomProduction.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Capacity Utilization:</span>
                            <span className={`font-bold ${(avgCustomProduction / 6) > 0.8 ? 'text-red-400' : 'text-green-400'}`}>
                              {((avgCustomProduction / 6) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After PUC (Day 3)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Duration:</span>
                            <span className="text-white font-bold">2 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exit Point:</span>
                            <span className="text-white font-bold">To ARCP (Day 5)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Orders In Process:</span>
                            <span className="text-white font-bold">~{Math.round(avgCustomProduction * 2)} orders</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{pucToWMApass2FlowRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow:</span>
                            <span className="text-white font-bold">{customToARCPFlowRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Demand from ARCP:</span>
                            <span className="text-white font-bold">{customToARCPDemandRate.toFixed(1)} orders/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(customToARCPFlowRate - customToARCPDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(customToARCPFlowRate - customToARCPDemandRate).toFixed(1)} orders/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-900 border border-red-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-red-300 mb-2">🚨 Shared Capacity Alert</h4>
                        <p className="text-gray-300 text-sm mb-2">
                          This is the SAME physical WMA machine as Pass 1. Both passes share a total capacity of 6 orders/day.
                        </p>
                        <div className="bg-gray-800 rounded p-2 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Combined Capacity:</span>
                            <span className="text-white font-bold">6 orders/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-teal-300 mb-2">Position in Flow</h4>
                        <p className="text-gray-300 text-sm">
                          Final station before ARCP assembly. Orders complete WMA Pass 2, then proceed to manual assembly and quality control before shipping.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">Station 2 - WMA Pass 2</div>
              <div className="text-base text-white font-semibold mb-2">Final Adjustments</div>
            </div>

            {/* Animated Arrow: WMA Pass 2 → ARCP → Ship */}
            <AnimatedFlowArrow
              fromStation="WMA Pass 2"
              toStation="ARCP → Ship"
              flowRate={customToARCPFlowRate}
              demandRate={customToARCPDemandRate}
              vertical={true}
            />

            {/* Ship Direct */}
            <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 text-center">
              <div className="text-base font-bold text-white drop-shadow-lg mb-2">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white mb-3">Direct Ship (No Inventory Held)</div>
              <div className="text-xs text-green-300 mb-2">Orders Completed Today</div>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(finalCustomProduction)}</div>
              <div className="text-sm text-green-300">custom orders shipped</div>
              <div className="border-t border-green-600 mt-3 pt-3">
                <div className="text-xs text-green-400">Maximum WIP Capacity: 360 orders</div>
              </div>
            </div>
          </div>
        </div>

        {/* STANDARD LINE - Right */}
        <div className="space-y-6">
          <div className="border-3 border-blue-500 rounded-2xl p-8 bg-gradient-to-br from-blue-950 to-blue-900">
            <div className="relative text-center mb-8">
              <div className="absolute top-0 right-0">
                <InfoPopup
                  title="💎 Standard Line - Complete Overview"
                  buttonClassName="bg-blue-600 hover:bg-blue-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Production Model</h4>
                        <p className="text-gray-300 text-sm">
                          Make-to-Stock (MTS): Units are manufactured in batches and added to finished goods inventory. Customer orders are fulfilled from inventory stock, not directly from production.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Pipeline Stages</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">1. MCE (Material Consumption):</span>
                            <span className="text-white font-bold">Day 0</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">2. First Batching Queue:</span>
                            <span className="text-white font-bold">4 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">3. ARCP (Assembly):</span>
                            <span className="text-white font-bold">Variable</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">4. Second Batching Queue:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">5. Finished Goods Inventory:</span>
                            <span className="text-white font-bold">Ready to Ship</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">6. Ship to Customer:</span>
                            <span className="text-white font-bold">From Inventory</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Material Consumption</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Raw Material per Unit:</span>
                            <span className="text-white font-bold">2 parts</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">MCE Priority:</span>
                            <span className="text-white font-bold">SECOND (after Custom)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Production Order Fee:</span>
                            <span className="text-white font-bold">$100</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Batching Parameters</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">First Batch Wait:</span>
                            <span className="text-white font-bold">4 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">First Batch Target:</span>
                            <span className="text-white font-bold">60 units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Second Batch Wait:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Second Batch Target:</span>
                            <span className="text-white font-bold">12 units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Batching Delay:</span>
                            <span className="text-white font-bold">5 days baseline</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Current Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Current WIP:</span>
                            <span className="text-white font-bold">{Math.round(finalStandardWIP)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Finished Goods:</span>
                            <span className="text-white font-bold">{Math.round(finalFinishedStandard)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Daily Output:</span>
                            <span className="text-white font-bold">{avgStandardProduction.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Daily Demand:</span>
                            <span className="text-white font-bold">21 units/day max</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Critical Constraints</h4>
                        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                          <li>5-day batching delay adds significant lead time</li>
                          <li>ARCP workforce bottleneck limits completion rate</li>
                          <li>High WIP (&gt;100 units) indicates capacity constraint</li>
                          <li>MCE allocation determines production volume</li>
                        </ul>
                      </div>

                      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">💡 Strategic Insights</h4>
                        <p className="text-gray-300 text-sm">
                          Standard line profitability depends on maintaining inventory levels to meet demand while minimizing WIP and batching delays. Balance MCE allocation with ARCP capacity to optimize throughput without excessive inventory buildup.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-3xl font-bold text-white mb-2 drop-shadow-lg">💎 STANDARD LINE</div>
              <div className="text-lg text-white mb-2 drop-shadow-md">(Make-to-Stock)</div>
              <div className="text-sm text-white mt-2 drop-shadow-md">2 parts/unit • Second priority on MCE</div>
            </div>

            {/* Standard Line Stats */}
            <div className={`relative bg-blue-800 rounded-xl p-6 mb-6 text-center ${isStandardBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="💎 Standard Line - Work-In-Progress (WIP)"
                  buttonClassName="bg-blue-600 hover:bg-blue-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          Work-In-Progress (WIP) represents standard units currently being processed through the production pipeline but not yet completed and added to finished goods inventory.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Current Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Current WIP:</span>
                            <span className="text-white font-bold">{Math.round(finalStandardWIP)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Average Daily Output:</span>
                            <span className="text-white font-bold">{avgStandardProduction.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(avgStandardProduction - mceToStandardDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(avgStandardProduction - mceToStandardDemandRate).toFixed(1)} units/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">📊 WIP Breakdown</h4>
                        <p className="text-gray-300 text-sm mb-3">
                          The {Math.round(finalStandardWIP)} units of WIP are distributed across ALL pipeline stages:
                        </p>
                        <div className="space-y-2 text-xs text-gray-300">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-600 rounded"></div>
                            <span>First Batching Queue (4-day wait)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-600 rounded"></div>
                            <span>ARCP Assembly (variable processing time)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-600 rounded"></div>
                            <span>Second Batching Queue (1-day wait)</span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs mt-3 italic">
                          The Batching Queue boxes shown below are PART OF this total WIP, not additional to it.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Production Flow</h4>
                        <p className="text-gray-300 text-sm mb-3">
                          Standard line follows a make-to-stock model. Each unit flows through:
                        </p>
                        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                          <li>MCE - Material Consumption (Day 0)</li>
                          <li>Batching Queue - Wait for batch size (4 days)</li>
                          <li>ARCP - Manual Assembly & Quality (variable)</li>
                          <li>Second Batching - Final batch wait (1 day)</li>
                          <li>Finished Goods Inventory</li>
                          <li>Ship to Customer</li>
                        </ol>
                      </div>

                      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">⚠️ Bottleneck Detection</h4>
                        <p className="text-gray-300 text-sm">
                          High WIP (&gt;100 units) indicates a bottleneck. Common causes: insufficient ARCP capacity, low MCE allocation, or batching delays accumulating units faster than ARCP can process them.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Total Processing Time</h4>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Expected Duration:</span>
                          <span className="text-white font-bold">~4-6 days + delays</span>
                        </div>
                        <p className="text-gray-400 text-xs mt-2">
                          Two batching stages add 5 days baseline delay, plus variable ARCP processing time
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-base font-semibold text-white mb-1 drop-shadow-lg">📊 Work-In-Progress (WIP)</div>
              <div className="text-xs text-blue-100 mb-3 drop-shadow-md">Units currently being processed</div>
              <div className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{Math.round(finalStandardWIP)}</div>
              <div className="text-sm text-blue-100 drop-shadow-md">standard units</div>
              <div className="border-t border-blue-600 mt-4 pt-3">
                <div className="text-xs text-blue-100 mb-1 drop-shadow-md">Average Daily Output</div>
                <div className="text-lg font-bold text-white drop-shadow-lg">{avgStandardProduction.toFixed(1)} units/day</div>
              </div>
              {isStandardBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Batching Queue */}
            <div className="relative bg-amber-700 border-2 border-amber-500 rounded-xl p-5 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="⏳ Batching Queue (First Stage)"
                  buttonClassName="bg-amber-600 hover:bg-amber-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          Units wait in the first batching queue after MCE processing until enough units accumulate to form an efficient ARCP processing batch.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Batching Parameters</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Wait Time:</span>
                            <span className="text-white font-bold">4 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Target Batch Size:</span>
                            <span className="text-white font-bold">60 units</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Current Flow Rate:</span>
                            <span className="text-white font-bold">{avgStandardProduction.toFixed(1)} units/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After MCE (Day 0)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Wait Duration:</span>
                            <span className="text-white font-bold">4 days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exit Point:</span>
                            <span className="text-white font-bold">To ARCP (Day 4)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Units Waiting:</span>
                            <span className="text-white font-bold">~{Math.round(avgStandardProduction * 4)} units</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{mceToStandardFlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow:</span>
                            <span className="text-white font-bold">{standardToARCPFlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Demand from ARCP:</span>
                            <span className="text-white font-bold">{standardToARCPDemandRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(standardToARCPFlowRate - standardToARCPDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(standardToARCPFlowRate - standardToARCPDemandRate).toFixed(1)} units/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Purpose</h4>
                        <p className="text-gray-300 text-sm">
                          Batching reduces setup costs and improves ARCP efficiency by processing multiple units together. However, it also adds delay to the production pipeline.
                        </p>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Trade-off</h4>
                        <p className="text-gray-300 text-sm">
                          Longer batch wait times reduce setup frequency but increase WIP and total lead time. This 4-day wait is fixed and cannot be bypassed.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">⏳ BATCHING QUEUE</div>
              <div className="text-base text-white font-semibold mb-2">Wait for Batch Size</div>
            </div>

            {/* Animated Arrow: Batching Queue → ARCP */}
            <AnimatedFlowArrow
              fromStation="Batching Queue"
              toStation="ARCP"
              flowRate={standardToARCPFlowRate}
              demandRate={standardToARCPDemandRate}
              vertical={true}
            />

            {/* Station 6 - ARCP Manual */}
            <div className={`relative bg-orange-700 rounded-xl p-5 mb-2 text-center ${isARCPBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="Station 6 - ARCP (Assembly & Quality Control)"
                  buttonClassName="bg-orange-600 hover:bg-orange-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          The ARCP (Assembly, Refinishing, Cosmetic work, and Packaging) station is a manual, labor-intensive operation shared between both production lines. This is the primary workforce bottleneck in the factory.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Current Workforce</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Expert Workers:</span>
                            <span className="text-white font-bold">{finalExperts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Rookie Workers:</span>
                            <span className="text-white font-bold">{finalRookies}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Daily Capacity:</span>
                            <span className="text-white font-bold">{arcpCapacity.toFixed(1)} units/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Productivity Rates</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Expert Productivity:</span>
                            <span className="text-white font-bold">3 units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Rookie Productivity:</span>
                            <span className="text-white font-bold">1.2 units/day (40%)</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Workforce Development</h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Rookies become experts after 15 days of training. This automatic promotion significantly increases productivity.
                        </p>
                        <div className="bg-gray-900 rounded p-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Training Period:</span>
                            <span className="text-white font-bold">15 days</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Labor Costs</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Expert Salary:</span>
                            <span className="text-white font-bold">$150/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Rookie Salary:</span>
                            <span className="text-white font-bold">$85/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Overtime Rate:</span>
                            <span className="text-white font-bold">1.5x normal</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-900 border border-red-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-red-300 mb-2">🚨 Critical Bottleneck</h4>
                        <p className="text-gray-300 text-sm">
                          ARCP is typically the factory's primary bottleneck. Low capacity (&lt;10 units/day) causes WIP to accumulate rapidly. Hiring additional workers is often the most effective optimization strategy.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Custom Line Entry:</span>
                            <span className="text-white font-bold">After WMA Pass 2 (Day 5)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Standard Line Entry:</span>
                            <span className="text-white font-bold">After First Batching (Day 4)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Processing Duration:</span>
                            <span className="text-white font-bold">Variable (capacity-dependent)</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Units In Process:</span>
                            <span className="text-white font-bold">~{Math.round((avgStandardProduction + avgCustomProduction) * 0.5)} units</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-purple-300 font-semibold">Custom Line Flow:</span>
                              <span className="text-white font-bold">{customToARCPFlowRate.toFixed(1)} orders/day</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Allocated Capacity:</span>
                              <span className="text-white">{customToARCPDemandRate.toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Gap:</span>
                              <span className={`font-bold ${(customToARCPFlowRate - customToARCPDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {(customToARCPFlowRate - customToARCPDemandRate).toFixed(1)} orders/day
                              </span>
                            </div>
                          </div>
                          <div className="border-t border-gray-700 pt-2">
                            <div className="flex justify-between mb-1">
                              <span className="text-blue-300 font-semibold">Standard Line Flow:</span>
                              <span className="text-white font-bold">{standardToARCPFlowRate.toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Allocated Capacity:</span>
                              <span className="text-white">{standardToARCPDemandRate.toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Gap:</span>
                              <span className={`font-bold ${(standardToARCPFlowRate - standardToARCPDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {(standardToARCPFlowRate - standardToARCPDemandRate).toFixed(1)} units/day
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Capacity Allocation</h4>
                        <p className="text-gray-300 text-sm">
                          ARCP capacity is allocated proportionally between Custom and Standard lines based on MCE allocation percentages, ensuring both lines can complete orders.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">Station 6 - ARCP (Manual)</div>
              <div className="text-base text-white font-semibold mb-3">Assembly & Quality Control</div>
              <div className="text-sm text-orange-300 mb-1">Workforce: {finalExperts} experts + {finalRookies} rookies</div>
              <div className="text-sm text-orange-300">Capacity: {arcpCapacity.toFixed(1)} units/day</div>
              {isARCPBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  ⚠️ LABOR CAPACITY BOTTLENECK
                </div>
              )}
            </div>

            {/* Animated Arrow: ARCP → Second Batching */}
            <AnimatedFlowArrow
              fromStation="ARCP"
              toStation="Second Batching"
              flowRate={arcpToStandardBatch2FlowRate}
              demandRate={arcpToStandardBatch2DemandRate}
              vertical={true}
            />

            {/* Second Batching */}
            <div className="relative bg-amber-700 border-2 border-amber-500 rounded-xl p-5 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="⏳ Second Batching (Final Stage)"
                  buttonClassName="bg-amber-600 hover:bg-amber-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          After ARCP processing, units wait in a second batching queue before being added to finished goods inventory. This ensures efficient packaging and inventory management.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Batching Parameters</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Wait Time:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Target Batch Size:</span>
                            <span className="text-white font-bold">12 units</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Current Flow Rate:</span>
                            <span className="text-white font-bold">{avgStandardProduction.toFixed(1)} units/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After ARCP (Day 4+)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Wait Duration:</span>
                            <span className="text-white font-bold">1 day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exit Point:</span>
                            <span className="text-white font-bold">To Finished Goods</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Units Waiting:</span>
                            <span className="text-white font-bold">~{Math.round(avgStandardProduction * 1)} units</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{arcpToStandardBatch2FlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow:</span>
                            <span className="text-white font-bold">{batch2ToFinishedFlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Demand from FG:</span>
                            <span className="text-white font-bold">{batch2ToFinishedDemandRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Flow vs Demand Gap:</span>
                            <span className={`font-bold ${(batch2ToFinishedFlowRate - batch2ToFinishedDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(batch2ToFinishedFlowRate - batch2ToFinishedDemandRate).toFixed(1)} units/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-amber-300 mb-2">Total Pipeline Delay</h4>
                        <p className="text-gray-300 text-sm mb-2">
                          Combined with the first batching queue, the standard line experiences 5 days of batching delay (4 + 1 days) in every production cycle.
                        </p>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Impact on WIP</h4>
                        <p className="text-gray-300 text-sm">
                          This second batching stage contributes to WIP accumulation. Units are complete from ARCP but not yet available for shipping.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-sm font-bold text-white drop-shadow-lg mb-2">⏳ SECOND BATCHING</div>
              <div className="text-base text-white font-semibold mb-2">Final Batching</div>
            </div>

            {/* Animated Arrow: Second Batching → Finished Goods */}
            <AnimatedFlowArrow
              fromStation="Second Batching"
              toStation="Finished Goods"
              flowRate={batch2ToFinishedFlowRate}
              demandRate={batch2ToFinishedDemandRate}
              vertical={true}
            />

            {/* Finished Goods Inventory */}
            <div className="relative bg-green-700 border-2 border-green-500 rounded-xl p-6 mb-2 text-center">
              <div className="absolute top-2 right-2">
                <InfoPopup
                  title="📦 Finished Goods Inventory"
                  buttonClassName="bg-green-600 hover:bg-green-700"
                  content={
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-green-300 mb-2">Overview</h4>
                        <p className="text-gray-300">
                          Finished goods inventory holds completed standard units that are ready to ship to customers. This is the final buffer before customer delivery.
                        </p>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-green-300 mb-2">Current Status</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Units in Stock:</span>
                            <span className="text-white font-bold">{Math.round(finalFinishedStandard)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Production Completed:</span>
                            <span className="text-white font-bold">{Math.round(finalStandardProduction)} units today</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Daily Production Rate:</span>
                            <span className="text-white font-bold">{avgStandardProduction.toFixed(1)} units/day</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-green-300 mb-2">⏱️ Timeline Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Point:</span>
                            <span className="text-white font-bold">After Second Batching</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Storage Duration:</span>
                            <span className="text-white font-bold">Until Customer Order</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Pipeline Time:</span>
                            <span className="text-white font-bold">~5-6 days from MCE</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Days of Inventory:</span>
                            <span className={`font-bold ${(finalFinishedStandard / Math.max(avgStandardProduction, 1)) < 1 ? 'text-red-400' : 'text-green-400'}`}>
                              {(finalFinishedStandard / Math.max(avgStandardProduction, 1)).toFixed(1)} days
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-green-300 mb-2">📊 Flow Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Input Flow:</span>
                            <span className="text-white font-bold">{batch2ToFinishedFlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Output Flow (Shipments):</span>
                            <span className="text-white font-bold">{finishedToCustomerFlowRate.toFixed(1)} units/day</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                            <span className="text-gray-400">Customer Demand:</span>
                            <span className="text-white font-bold">{finishedToCustomerDemandRate.toFixed(1)} units/day (max)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Production vs Demand Gap:</span>
                            <span className={`font-bold ${(finishedToCustomerFlowRate - finishedToCustomerDemandRate) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {(finishedToCustomerFlowRate - finishedToCustomerDemandRate).toFixed(1)} units/day
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-green-300 mb-2">Purpose</h4>
                        <p className="text-gray-300 text-sm">
                          The finished goods inventory allows the factory to maintain stock levels and fulfill customer orders even when production capacity is limited. This is characteristic of make-to-stock production.
                        </p>
                      </div>

                      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-yellow-300 mb-2">⚠️ Stockout Conditions</h4>
                        <p className="text-gray-300 text-sm">
                          When demand exceeds production capacity, finished goods may remain at zero. This indicates all completed units are immediately shipped, with no inventory buffer. This is normal when production is the bottleneck.
                        </p>
                      </div>
                    </div>
                  }
                />
              </div>
              <div className="text-base font-bold text-white drop-shadow-lg mb-3">📦 FINISHED GOODS INVENTORY</div>
              <div className="text-sm text-white mb-2">Ready to Ship</div>
              <div className="text-4xl font-bold text-white mb-1">{Math.round(finalFinishedStandard)}</div>
              <div className="text-sm text-green-300">units in stock</div>
            </div>

            {/* Animated Arrow: Finished Goods → Ship */}
            <AnimatedFlowArrow
              fromStation="Finished Goods"
              toStation="Ship to Customer"
              flowRate={finishedToCustomerFlowRate}
              demandRate={finishedToCustomerDemandRate}
              vertical={true}
            />

            {/* Ship */}
            <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 text-center">
              <div className="text-base font-bold text-white drop-shadow-lg mb-2">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white mb-3">Shipped From Finished Goods Inventory</div>
              <div className="text-xs text-green-300 mb-2">Units Shipped Today</div>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(finalStandardProduction)}</div>
              <div className="text-sm text-green-300">standard units shipped</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
        </>
      )}

      {/* Constraint Suggestions Modal */}
      {showConstraintSuggestionsModal && (
        <ConstraintSuggestionsModal
          suggestions={constraintSuggestions}
          onClose={() => setShowConstraintSuggestionsModal(false)}
        />
      )}
    </div>
  );
}
