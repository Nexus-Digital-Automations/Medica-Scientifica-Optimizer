import { useMemo } from 'react';
import type { SimulationResult } from '../../types/ui.types';

interface ProcessMapProps {
  simulationResult: SimulationResult;
}

export default function ProcessMap({ simulationResult }: ProcessMapProps) {
  const { state } = simulationResult;

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-600/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">🏭 Live Factory Process Map</h2>
        <p className="text-gray-300 text-sm">
          Real-time visualization of production flow with bottleneck detection
        </p>
      </div>

      {/* Raw Material Inventory - Top */}
      <div className="flex justify-center">
        <div className={`relative bg-gradient-to-br ${isRawMaterialBottleneck ? 'from-red-900/40 to-red-800/40 border-red-500' : 'from-amber-900/40 to-amber-800/40 border-amber-500'} border-2 rounded-2xl p-6 min-w-[300px] shadow-lg`}>
          <div className="text-center">
            <div className="text-sm font-semibold text-amber-300 mb-2">📦 RAW MATERIAL INVENTORY</div>
            <div className="text-3xl font-bold text-white mb-1">{Math.round(finalRawMaterial)} parts</div>
            <div className="text-xs text-gray-300">$50/part • $1,000/order • 4-day lead time</div>
            {isRawMaterialBottleneck && (
              <div className="mt-2 px-3 py-1 bg-red-600/30 border border-red-500 rounded-lg text-xs text-red-200 font-semibold">
                ⚠️ LOW INVENTORY BOTTLENECK
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arrow Down */}
      <div className="flex justify-center">
        <div className="text-4xl text-blue-400">↓</div>
      </div>

      {/* Two Production Lines */}
      <div className="grid grid-cols-2 gap-8">
        {/* CUSTOM LINE - Left */}
        <div className="space-y-4">
          <div className="bg-purple-900/20 border-2 border-purple-500 rounded-xl p-4">
            <div className="text-center mb-4">
              <div className="text-xl font-bold text-purple-300">🎨 CUSTOM LINE</div>
              <div className="text-sm text-purple-200">(Make-to-Order)</div>
              <div className="text-xs text-gray-400 mt-1">1 part/unit • FIRST priority on MCE</div>
            </div>

            {/* Custom Line Stats */}
            <div className={`bg-purple-800/30 rounded-lg p-3 mb-3 ${isCustomBottleneck ? 'border-2 border-red-500' : ''}`}>
              <div className="text-sm font-semibold text-purple-200 mb-1">Total WIP</div>
              <div className="text-2xl font-bold text-white">{Math.round(finalCustomWIP)} orders</div>
              <div className="text-xs text-purple-300 mt-1">Avg Output: {avgCustomProduction.toFixed(1)}/day</div>
              {isCustomBottleneck && (
                <div className="mt-2 px-2 py-1 bg-red-600/30 border border-red-500 rounded text-xs text-red-200 font-semibold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Station 3 - MCE */}
            <div className="bg-purple-700/30 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-purple-200">Station 3 - MCE (Shared)</div>
              <div className="text-sm text-white">Material Consumption & Forming</div>
              <div className="text-xs text-purple-300 mt-1">Consumes 1 part/order</div>
            </div>

            {/* Station 2 - WMA Pass 1 */}
            <div className="bg-purple-700/30 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-purple-200">Station 2 - WMA Pass 1</div>
              <div className="text-sm text-white">Whittling & Micro Abrasion</div>
              <div className="text-xs text-purple-300 mt-1">2 days processing • 6 units/day capacity</div>
            </div>

            {/* Station 4 - PUC */}
            <div className="bg-purple-700/30 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-purple-200">Station 4 - PUC</div>
              <div className="text-sm text-white">Precision Ultra-fine Cutting</div>
              <div className="text-xs text-purple-300 mt-1">1 day processing</div>
            </div>

            {/* Station 2 - WMA Pass 2 */}
            <div className="bg-purple-700/30 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-purple-200">Station 2 - WMA Pass 2</div>
              <div className="text-sm text-white">Final Adjustments (AGAIN!)</div>
              <div className="text-xs text-purple-300 mt-1">2 days processing • Shares capacity</div>
              <div className="text-xs text-amber-300 mt-1">⚠️ Goes through WMA TWICE</div>
            </div>

            {/* Ship Direct */}
            <div className="bg-green-700/30 border border-green-500 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-200">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white">No Inventory (Direct Ship)</div>
              <div className="text-xs text-green-300 mt-1">Max: 360 orders WIP capacity</div>
              <div className="text-lg font-bold text-white mt-2">{Math.round(finalCustomProduction)} shipped today</div>
            </div>

            {/* Processing Time */}
            <div className="mt-3 bg-purple-900/40 rounded-lg p-3 border border-purple-600">
              <div className="text-xs font-semibold text-purple-200 mb-1">Total Processing Time</div>
              <div className="text-xl font-bold text-white">~10-12 days</div>
              <div className="text-xs text-purple-300">MCE → WMA(2d) → PUC(1d) → WMA(2d) → Ship</div>
            </div>
          </div>
        </div>

        {/* STANDARD LINE - Right */}
        <div className="space-y-4">
          <div className="bg-blue-900/20 border-2 border-blue-500 rounded-xl p-4">
            <div className="text-center mb-4">
              <div className="text-xl font-bold text-blue-300">💎 STANDARD LINE</div>
              <div className="text-sm text-blue-200">(Make-to-Stock)</div>
              <div className="text-xs text-gray-400 mt-1">2 parts/unit • Second priority on MCE</div>
            </div>

            {/* Standard Line Stats */}
            <div className={`bg-blue-800/30 rounded-lg p-3 mb-3 ${isStandardBottleneck ? 'border-2 border-red-500' : ''}`}>
              <div className="text-sm font-semibold text-blue-200 mb-1">Total WIP</div>
              <div className="text-2xl font-bold text-white">{Math.round(finalStandardWIP)} units</div>
              <div className="text-xs text-blue-300 mt-1">Avg Output: {avgStandardProduction.toFixed(1)}/day</div>
              {isStandardBottleneck && (
                <div className="mt-2 px-2 py-1 bg-red-600/30 border border-red-500 rounded text-xs text-red-200 font-semibold">
                  🚨 HIGH WIP - BOTTLENECK
                </div>
              )}
            </div>

            {/* Station 3 - MCE */}
            <div className="bg-blue-700/30 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-blue-200">Station 3 - MCE (Shared)</div>
              <div className="text-sm text-white">Material Consumption & Forming</div>
              <div className="text-xs text-blue-300 mt-1">Consumes 2 parts/unit</div>
            </div>

            {/* Batching Queue */}
            <div className="bg-amber-700/30 border border-amber-500 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-amber-200">⏳ BATCHING QUEUE</div>
              <div className="text-sm text-white">Wait for Batch Size</div>
              <div className="text-xs text-amber-300 mt-1">4 days initial batching time</div>
              <div className="text-xs text-amber-300">Batch size: 60 units</div>
            </div>

            {/* Station 6 - ARCP Manual */}
            <div className={`bg-blue-700/30 rounded-lg p-3 mb-2 ${isARCPBottleneck ? 'border-2 border-red-500' : ''}`}>
              <div className="text-xs font-semibold text-blue-200">Station 6 - ARCP (Manual)</div>
              <div className="text-sm text-white">Assembly & Quality Control</div>
              <div className="text-xs text-blue-300 mt-1">Workforce: {finalExperts} experts + {finalRookies} rookies</div>
              <div className="text-xs text-blue-300">Capacity: {arcpCapacity.toFixed(1)} units/day</div>
              <div className="text-xs text-amber-300 mt-1">Expert: 3 units/day • Rookie: 40% productivity</div>
              {isARCPBottleneck && (
                <div className="mt-2 px-2 py-1 bg-red-600/30 border border-red-500 rounded text-xs text-red-200 font-semibold">
                  ⚠️ LABOR CAPACITY BOTTLENECK
                </div>
              )}
            </div>

            {/* Second Batching */}
            <div className="bg-amber-700/30 border border-amber-500 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-amber-200">⏳ BATCH AGAIN!</div>
              <div className="text-sm text-white">Final Batching</div>
              <div className="text-xs text-amber-300 mt-1">1 day batching time</div>
              <div className="text-xs text-amber-300">Batch size: 12 units</div>
            </div>

            {/* Finished Goods Inventory */}
            <div className="bg-green-700/30 border border-green-500 rounded-lg p-3 mb-2">
              <div className="text-xs font-semibold text-green-200">📦 FINISHED GOODS INVENTORY</div>
              <div className="text-sm text-white">Ready to Ship</div>
              <div className="text-2xl font-bold text-white mt-1">{Math.round(finalFinishedStandard)} units</div>
            </div>

            {/* Ship */}
            <div className="bg-green-700/30 border border-green-500 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-200">✈️ SHIP TO CUSTOMER</div>
              <div className="text-sm text-white">From Finished Goods</div>
              <div className="text-lg font-bold text-white mt-2">{Math.round(finalStandardProduction)} shipped today</div>
            </div>

            {/* Processing Time */}
            <div className="mt-3 bg-blue-900/40 rounded-lg p-3 border border-blue-600">
              <div className="text-xs font-semibold text-blue-200 mb-1">Total Processing Time</div>
              <div className="text-xl font-bold text-white">~4-6 days + delays</div>
              <div className="text-xs text-blue-300">MCE → Batch(4d) → ARCP → Batch(1d) → FG → Ship</div>
              <div className="text-xs text-red-300 mt-1">⚠️ TWO batching delays (5 days total)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-900/20 border border-purple-500 rounded-lg p-4">
          <div className="text-sm font-semibold text-purple-300 mb-2">🎨 Custom Line Flow</div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Fast flow (10-12 days)</li>
            <li>• Goes through WMA TWICE</li>
            <li>• Ships immediately (no inventory)</li>
            <li>• Limited to 360 orders max</li>
          </ul>
        </div>

        <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-300 mb-2">💎 Standard Line Flow</div>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Slower (4-6 days + batching)</li>
            <li>• TWO batching delays (5 days waiting)</li>
            <li>• Manual ARCP bottleneck (1 worker)</li>
            <li>• Builds finished goods inventory</li>
          </ul>
        </div>

        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <div className="text-sm font-semibold text-red-300 mb-2">⚠️ Bottleneck Detection</div>
          <ul className="text-xs text-gray-300 space-y-1">
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
      <div className="bg-gradient-to-r from-amber-900/30 to-red-900/30 border border-amber-600/50 rounded-xl p-6">
        <div className="text-center">
          <div className="text-lg font-bold text-amber-300 mb-2">⚔️ CRITICAL: Both Lines Compete for MCE Capacity!</div>
          <p className="text-sm text-gray-300">
            The MCE station (Station 3) is SHARED between both production lines. Management must decide daily how to allocate
            MCE capacity between Custom (1 part/order, first priority) and Standard (2 parts/unit, second priority).
          </p>
          <p className="text-xs text-amber-400 mt-2">
            This is controlled by the "MCE Allocation - % to Custom Line" parameter in strategy settings.
          </p>
        </div>
      </div>
    </div>
  );
}
