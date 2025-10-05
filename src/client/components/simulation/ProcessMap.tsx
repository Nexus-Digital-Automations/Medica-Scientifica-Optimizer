import { useMemo, useState } from 'react';
import type { SimulationResult } from '../../types/ui.types';
import { getMostRecentSavedResult } from '../../utils/savedResults';
import { analyzeBottlenecks } from '../../utils/bottleneckAnalysis';
import { loadHistoricalData } from '../../utils/historicalDataLoader';
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
  // Fallback chain: current simulation -> most recent saved -> historical data
  const displayResult = simulationResult || getMostRecentSavedResult()?.result || loadHistoricalData();

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

  // Determine data source for display
  const isHistoricalData = !simulationResult && !getMostRecentSavedResult();

  const { state } = displayResult;

  // Perform comprehensive bottleneck analysis
  const bottleneckAnalysis = useMemo(() => analyzeBottlenecks(displayResult), [displayResult]);
  const [showStatistics, setShowStatistics] = useState(true);
  const [showProblems, setShowProblems] = useState(true);
  const [showTrends, setShowTrends] = useState(false);

  // Get final day values
  const finalDayIndex = state.history.dailyCash.length - 1;
  const finalRawMaterial = state.history.dailyRawMaterial[finalDayIndex]?.value || 0;
  const finalStandardWIP = state.history.dailyStandardWIP[finalDayIndex]?.value || 0;
  const finalCustomWIP = state.history.dailyCustomWIP[finalDayIndex]?.value || 0;
  const finalFinishedStandard = state.history.dailyFinishedStandard[finalDayIndex]?.value || 0;
  const finalStandardProduction = state.history.dailyStandardProduction[finalDayIndex]?.value || 0;
  const finalCustomProduction = state.history.dailyCustomProduction[finalDayIndex]?.value || 0;
  const finalExperts = state.history.dailyExperts[finalDayIndex]?.value || 0;
  const finalRookies = state.history.dailyRookies[finalDayIndex]?.value || 0;

  // Calculate average daily production rates (last 50 days)
  const recentDays = 50;
  const startIdx = Math.max(0, finalDayIndex - recentDays);

  const avgStandardProduction = useMemo(() => {
    const sum = state.history.dailyStandardProduction.slice(startIdx).reduce((acc, d) => acc + d.value, 0);
    return sum / Math.min(recentDays, finalDayIndex - startIdx + 1);
  }, [state.history, startIdx, finalDayIndex]);

  const avgCustomProduction = useMemo(() => {
    const sum = state.history.dailyCustomProduction.slice(startIdx).reduce((acc, d) => acc + d.value, 0);
    return sum / Math.min(recentDays, finalDayIndex - startIdx + 1);
  }, [state.history, startIdx, finalDayIndex]);

  // Calculate ARCP capacity
  const arcpCapacity = (finalExperts * 3) + (finalRookies * 3 * 0.4);

  // Detect bottlenecks (WIP > 100 or capacity < 50% of demand)
  const isStandardBottleneck = finalStandardWIP > 100;
  const isCustomBottleneck = finalCustomWIP > 50;
  const isARCPBottleneck = arcpCapacity < 10;
  const isRawMaterialBottleneck = finalRawMaterial < 50;

  // Prepare trend chart data
  const trendChartData = useMemo(() => {
    const sampleInterval = Math.max(1, Math.floor(finalDayIndex / 50)); // Sample ~50 points
    return state.history.dailyStandardWIP
      .filter((_, idx) => idx % sampleInterval === 0)
      .map((_, idx) => {
        const actualIdx = idx * sampleInterval;
        return {
          day: state.history.dailyStandardWIP[actualIdx].day,
          standardWIP: state.history.dailyStandardWIP[actualIdx].value,
          customWIP: state.history.dailyCustomWIP[actualIdx]?.value || 0,
          rawMaterial: state.history.dailyRawMaterial[actualIdx]?.value || 0,
        };
      });
  }, [state.history, finalDayIndex]);

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

  return (
    <div className="space-y-8">
      {/* Data Source Indicator */}
      {isHistoricalData && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">📊</span>
            <div>
              <p className="text-amber-900 text-sm font-semibold">Historical Reference Data</p>
              <p className="text-amber-700 text-xs">
                Showing baseline factory performance. Run a simulation to see your custom strategy results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with Overall Health */}
      <div className={`bg-gradient-to-r from-blue-900 to-purple-900 border-2 rounded-xl p-6 ${getSeverityColor(bottleneckAnalysis.overallHealth)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              🏭 {isHistoricalData ? 'Factory Process Map (Historical Data)' : 'Live Factory Process Map'}
            </h2>
            <p className="text-gray-300 text-sm">
              {isHistoricalData
                ? 'Reference visualization showing typical factory operation'
                : 'Real-time visualization with comprehensive bottleneck analysis'}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Problem Analysis Panel */}
      {showProblems && bottleneckAnalysis.problems.length > 0 && (
        <div className="bg-gradient-to-br from-red-900/90 to-orange-900/90 border border-red-500 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">🔍 Detected Problems & Recommendations</h3>
            <button
              onClick={() => setShowProblems(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Hide
            </button>
          </div>
          <div className="space-y-4">
            {bottleneckAnalysis.problems.map((problem) => (
              <div key={problem.id} className={`border-2 rounded-lg p-5 ${getSeverityColor(problem.severity)}`}>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-bold text-white">{problem.title}</h4>
                  <div className={`px-3 py-1 rounded ${getSeverityBadge(problem.severity)} text-xs font-bold`}>
                    {problem.severity.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Description:</span>
                    <p className="text-white mt-1">{problem.description}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Root Cause:</span>
                    <p className="text-yellow-300 mt-1">{problem.rootCause}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Impact:</span>
                    <p className="text-red-300 mt-1">{problem.impact}</p>
                  </div>
                  <div className="bg-blue-900 border border-blue-500 rounded-lg p-3">
                    <span className="text-blue-300 font-semibold">💡 Recommendation:</span>
                    <p className="text-blue-200 mt-1">{problem.recommendation}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-700">
                    <div className="text-center">
                      <div className="text-gray-400 text-xs">Peak WIP</div>
                      <div className="text-white font-bold">{problem.metrics.peakWIP.toFixed(0)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs">Health Score</div>
                      <div className="text-white font-bold">{problem.metrics.utilizationRate.toFixed(0)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400 text-xs">Station</div>
                      <div className="text-white font-bold text-xs">{problem.station}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        {!showProblems && bottleneckAnalysis.problems.length > 0 && (
          <button
            onClick={() => setShowProblems(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Show Problems ({bottleneckAnalysis.problems.length})
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

      {/* Raw Material Inventory - Top */}
      <div className="flex justify-center mb-12">
        <div className={`relative bg-gradient-to-br ${isRawMaterialBottleneck ? 'from-red-900 to-red-800 border-red-500' : 'from-amber-900 to-amber-800 border-amber-500'} border-3 rounded-3xl p-8 min-w-[400px] shadow-2xl`}>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-300 mb-3">📦 RAW MATERIAL INVENTORY</div>
            <div className="text-5xl font-bold text-white mb-3">{Math.round(finalRawMaterial)}</div>
            <div className="text-sm text-amber-200 mb-1">parts available</div>
            <div className="text-sm text-gray-300 mt-4">$50/part • $1,000/order • 4-day lead time</div>
            {isRawMaterialBottleneck && (
              <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                ⚠️ LOW INVENTORY BOTTLENECK
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arrow Down */}
      <div className="flex justify-center my-8">
        <div className="text-6xl text-blue-400">↓</div>
      </div>

      {/* Two Production Lines */}
      <div className="grid grid-cols-2 gap-12">
        {/* CUSTOM LINE - Left */}
        <div className="space-y-6">
          <div className="bg-purple-900 border-3 border-purple-500 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="text-3xl font-bold text-purple-300 mb-2">🎨 CUSTOM LINE</div>
              <div className="text-lg text-purple-200 mb-2">(Make-to-Order)</div>
              <div className="text-sm text-gray-300 mt-2">1 part/unit • FIRST priority on MCE</div>
            </div>

            {/* Custom Line Stats */}
            <div className={`bg-purple-800 rounded-xl p-6 mb-6 text-center ${isCustomBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="text-base font-semibold text-purple-200 mb-3">Total WIP</div>
              <div className="text-4xl font-bold text-white mb-2">{Math.round(finalCustomWIP)}</div>
              <div className="text-sm text-purple-300">orders in progress</div>
              <div className="text-sm text-purple-300 mt-3">Avg Output: {avgCustomProduction.toFixed(1)}/day</div>
              {isCustomBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Station 3 - MCE */}
            <div className="bg-purple-700 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-purple-200 mb-2">Station 3 - MCE (Shared)</div>
              <div className="text-base text-white font-semibold mb-2">Material Consumption & Forming</div>
              <div className="text-sm text-purple-300">Consumes 1 part/order</div>
            </div>

            {/* Station 2 - WMA Pass 1 */}
            <div className="bg-purple-700 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-purple-200 mb-2">Station 2 - WMA Pass 1</div>
              <div className="text-base text-white font-semibold mb-2">Whittling & Micro Abrasion</div>
              <div className="text-sm text-purple-300">2 days • 6 units/day capacity</div>
            </div>

            {/* Station 4 - PUC */}
            <div className="bg-purple-700 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-purple-200 mb-2">Station 4 - PUC</div>
              <div className="text-base text-white font-semibold mb-2">Precision Ultra-fine Cutting</div>
              <div className="text-sm text-purple-300">1 day processing</div>
            </div>

            {/* Station 2 - WMA Pass 2 */}
            <div className="bg-purple-700 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-purple-200 mb-2">Station 2 - WMA Pass 2</div>
              <div className="text-base text-white font-semibold mb-2">Final Adjustments (AGAIN!)</div>
              <div className="text-sm text-purple-300 mb-2">2 days • Shares capacity</div>
              <div className="text-sm text-amber-300">⚠️ Goes through WMA TWICE</div>
            </div>

            {/* Ship Direct */}
            <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 text-center">
              <div className="text-base font-bold text-green-200 mb-2">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white mb-3">No Inventory (Direct Ship)</div>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(finalCustomProduction)}</div>
              <div className="text-sm text-green-300">shipped today</div>
              <div className="text-xs text-green-400 mt-3">Max: 360 orders WIP capacity</div>
            </div>

            {/* Processing Time */}
            <div className="mt-6 bg-purple-900 rounded-xl p-5 border-2 border-purple-600 text-center">
              <div className="text-sm font-bold text-purple-200 mb-3">Total Processing Time</div>
              <div className="text-3xl font-bold text-white mb-3">~10-12 days</div>
              <div className="text-sm text-purple-300">MCE → WMA(2d) → PUC(1d) → WMA(2d) → Ship</div>
            </div>
          </div>
        </div>

        {/* STANDARD LINE - Right */}
        <div className="space-y-6">
          <div className="bg-blue-900 border-3 border-blue-500 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="text-3xl font-bold text-blue-300 mb-2">💎 STANDARD LINE</div>
              <div className="text-lg text-blue-200 mb-2">(Make-to-Stock)</div>
              <div className="text-sm text-gray-300 mt-2">2 parts/unit • Second priority on MCE</div>
            </div>

            {/* Standard Line Stats */}
            <div className={`bg-blue-800 rounded-xl p-6 mb-6 text-center ${isStandardBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="text-base font-semibold text-blue-200 mb-3">Total WIP</div>
              <div className="text-4xl font-bold text-white mb-2">{Math.round(finalStandardWIP)}</div>
              <div className="text-sm text-blue-300">units in progress</div>
              <div className="text-sm text-blue-300 mt-3">Avg Output: {avgStandardProduction.toFixed(1)}/day</div>
              {isStandardBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Station 3 - MCE */}
            <div className="bg-blue-700 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-blue-200 mb-2">Station 3 - MCE (Shared)</div>
              <div className="text-base text-white font-semibold mb-2">Material Consumption & Forming</div>
              <div className="text-sm text-blue-300">Consumes 2 parts/unit</div>
            </div>

            {/* Batching Queue */}
            <div className="bg-amber-700 border-2 border-amber-500 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-amber-200 mb-2">⏳ BATCHING QUEUE</div>
              <div className="text-base text-white font-semibold mb-2">Wait for Batch Size</div>
              <div className="text-sm text-amber-300">4 days initial batching</div>
              <div className="text-sm text-amber-300">Batch size: 60 units</div>
            </div>

            {/* Station 6 - ARCP Manual */}
            <div className={`bg-blue-700 rounded-xl p-5 mb-4 text-center ${isARCPBottleneck ? 'border-3 border-red-500' : ''}`}>
              <div className="text-sm font-bold text-blue-200 mb-2">Station 6 - ARCP (Manual)</div>
              <div className="text-base text-white font-semibold mb-3">Assembly & Quality Control</div>
              <div className="text-sm text-blue-300 mb-1">Workforce: {finalExperts} experts + {finalRookies} rookies</div>
              <div className="text-sm text-blue-300 mb-1">Capacity: {arcpCapacity.toFixed(1)} units/day</div>
              <div className="text-sm text-amber-300">Expert: 3 units/day • Rookie: 40%</div>
              {isARCPBottleneck && (
                <div className="mt-4 px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-sm text-white font-bold">
                  ⚠️ LABOR CAPACITY BOTTLENECK
                </div>
              )}
            </div>

            {/* Second Batching */}
            <div className="bg-amber-700 border-2 border-amber-500 rounded-xl p-5 mb-4 text-center">
              <div className="text-sm font-bold text-amber-200 mb-2">⏳ BATCH AGAIN!</div>
              <div className="text-base text-white font-semibold mb-2">Final Batching</div>
              <div className="text-sm text-amber-300">1 day batching</div>
              <div className="text-sm text-amber-300">Batch size: 12 units</div>
            </div>

            {/* Finished Goods Inventory */}
            <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 mb-4 text-center">
              <div className="text-base font-bold text-green-200 mb-3">📦 FINISHED GOODS INVENTORY</div>
              <div className="text-sm text-white mb-2">Ready to Ship</div>
              <div className="text-4xl font-bold text-white mb-1">{Math.round(finalFinishedStandard)}</div>
              <div className="text-sm text-green-300">units available</div>
            </div>

            {/* Ship */}
            <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 text-center">
              <div className="text-base font-bold text-green-200 mb-2">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white mb-3">From Finished Goods</div>
              <div className="text-3xl font-bold text-white mb-2">{Math.round(finalStandardProduction)}</div>
              <div className="text-sm text-green-300">shipped today</div>
            </div>

            {/* Processing Time */}
            <div className="mt-6 bg-blue-900 rounded-xl p-5 border-2 border-blue-600 text-center">
              <div className="text-sm font-bold text-blue-200 mb-3">Total Processing Time</div>
              <div className="text-3xl font-bold text-white mb-3">~4-6 days + delays</div>
              <div className="text-sm text-blue-300 mb-2">MCE → Batch(4d) → ARCP → Batch(1d) → FG → Ship</div>
              <div className="text-sm text-red-300">⚠️ TWO batching delays (5 days total)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-3 gap-8 mt-12">
        <div className="bg-purple-900 border-2 border-purple-500 rounded-2xl p-6 text-center">
          <div className="text-xl font-bold text-purple-300 mb-4">🎨 Custom Line Flow</div>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li>• Fast flow (10-12 days)</li>
            <li>• Goes through WMA TWICE</li>
            <li>• Ships immediately (no inventory)</li>
            <li>• Limited to 360 orders max</li>
          </ul>
        </div>

        <div className="bg-blue-900 border-2 border-blue-500 rounded-2xl p-6 text-center">
          <div className="text-xl font-bold text-blue-300 mb-4">💎 Standard Line Flow</div>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li>• Slower (4-6 days + batching)</li>
            <li>• TWO batching delays (5 days waiting)</li>
            <li>• Manual ARCP bottleneck (1 worker)</li>
            <li>• Builds finished goods inventory</li>
          </ul>
        </div>

        <div className="bg-red-900 border-2 border-red-500 rounded-2xl p-6 text-center">
          <div className="text-xl font-bold text-red-300 mb-4">⚠️ Bottleneck Detection</div>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li className={isStandardBottleneck ? 'text-red-300 font-semibold' : ''}>
              • Standard WIP: {isStandardBottleneck ? '🚨 HIGH' : '✓ Normal'}
            </li>
            <li className={isCustomBottleneck ? 'text-red-300 font-semibold' : ''}>
              • Custom WIP: {isCustomBottleneck ? '🚨 HIGH' : '✓ Normal'}
            </li>
            <li className={isARCPBottleneck ? 'text-red-300 font-semibold' : ''}>
              • ARCP Capacity: {isARCPBottleneck ? '🚨 LOW' : '✓ Adequate'}
            </li>
            <li className={isRawMaterialBottleneck ? 'text-red-300 font-semibold' : ''}>
              • Raw Materials: {isRawMaterialBottleneck ? '🚨 LOW' : '✓ Sufficient'}
            </li>
          </ul>
        </div>
      </div>

      {/* Competition for MCE */}
      <div className="bg-gradient-to-r from-amber-900 to-red-900 border-3 border-amber-600 rounded-2xl p-8 mt-12">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-300 mb-4">⚔️ CRITICAL: Both Lines Compete for MCE Capacity!</div>
          <p className="text-base text-gray-300 leading-relaxed max-w-4xl mx-auto">
            The MCE station (Station 3) is SHARED between both production lines. Management must decide daily how to allocate
            MCE capacity between Custom (1 part/order, first priority) and Standard (2 parts/unit, second priority).
          </p>
          <p className="text-sm text-amber-400 mt-4">
            This is controlled by the "MCE Allocation - % to Custom Line" parameter in strategy settings.
          </p>
        </div>
      </div>
    </div>
  );
}
