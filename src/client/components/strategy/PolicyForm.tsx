import { useStrategyStore } from '../../stores/strategyStore';

export default function PolicyForm() {
  const { strategy, updateStrategy } = useStrategyStore();

  const handleInputChange = (field: string, value: number) => {
    updateStrategy({ [field]: value });
  };

  return (
    <div className="space-y-8">
      {/* Production Allocation */}
      <section className="relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-8 shadow-2xl border border-blue-700/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative">
          <span className="text-3xl">🏭</span>
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Production Allocation</span>
        </h3>
        <div className="space-y-6 relative">
          <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700/50">
            <label className="block text-base font-semibold text-blue-200 mb-4">
              MCE Allocation to Custom
              <span className="text-gray-400 text-sm ml-2 font-normal">(% of machine capacity)</span>
            </label>
            <div className="flex items-center gap-6">
              <input
                type="range"
                min="0"
                max="100"
                value={strategy.mceAllocationCustom * 100}
                onChange={(e) => handleInputChange('mceAllocationCustom', Number(e.target.value) / 100)}
                className="flex-1 h-3 bg-gradient-to-r from-gray-700 to-gray-600 rounded-full appearance-none cursor-pointer slider-thumb"
              />
              <span className="text-white font-bold text-2xl w-20 text-right bg-blue-600/20 px-4 py-2 rounded-lg border border-blue-500/30">
                {(strategy.mceAllocationCustom * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-emerald-400 font-medium">
                Standard gets {((1 - strategy.mceAllocationCustom) * 100).toFixed(0)}%
              </p>
              <p className="text-purple-400 font-medium">
                Custom gets {(strategy.mceAllocationCustom * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Policy */}
      <section className="relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-8 shadow-2xl border border-emerald-700/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative">
          <span className="text-3xl">💵</span>
          <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Pricing Policy</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-emerald-600/50 transition-all">
            <label className="block text-sm font-semibold text-emerald-200 mb-3">
              Standard Price ($/unit)
            </label>
            <input
              type="number"
              value={strategy.standardPrice}
              onChange={(e) => handleInputChange('standardPrice', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              min="400"
              max="1200"
              step="10"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-emerald-400">💡</span> Recommended: $400-$1200
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-purple-600/50 transition-all">
            <label className="block text-sm font-semibold text-purple-200 mb-3">
              Custom Base Price ($)
            </label>
            <input
              type="number"
              value={strategy.customBasePrice}
              onChange={(e) => handleInputChange('customBasePrice', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              min="90"
              max="120"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-purple-400">📊</span> Data-driven baseline: $106.56
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-red-600/50 transition-all">
            <label className="block text-sm font-semibold text-red-200 mb-3">
              Custom Penalty ($/day late)
            </label>
            <input
              type="number"
              value={strategy.customPenaltyPerDay}
              onChange={(e) => handleInputChange('customPenaltyPerDay', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
              min="0.20"
              max="0.35"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-red-400">⚠️</span> Recommended: $0.20-$0.35
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-blue-600/50 transition-all">
            <label className="block text-sm font-semibold text-blue-200 mb-3">
              Custom Target Delivery (days)
            </label>
            <input
              type="number"
              value={strategy.customTargetDeliveryDays}
              onChange={(e) => handleInputChange('customTargetDeliveryDays', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              min="5"
              max="7"
              step="1"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-blue-400">⏱️</span> Max allowed: 7 days
            </p>
          </div>
        </div>
      </section>

      {/* Workforce Policy */}
      <section className="relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 rounded-xl p-8 shadow-2xl border border-amber-700/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl"></div>
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 relative">
          <span className="text-3xl">👷</span>
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Workforce Policy</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-amber-600/50 transition-all">
            <label className="block text-sm font-semibold text-amber-200 mb-3">
              Daily Overtime (hours)
            </label>
            <input
              type="number"
              value={strategy.dailyOvertimeHours}
              onChange={(e) => handleInputChange('dailyOvertimeHours', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              min="0"
              max="4"
              step="0.5"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-amber-400">⏰</span> Max: 4 hours/day (at 1.5x cost)
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-orange-600/50 transition-all">
            <label className="block text-sm font-semibold text-orange-200 mb-3">
              Overtime Trigger (days)
            </label>
            <input
              type="number"
              value={strategy.overtimeTriggerDays}
              onChange={(e) => handleInputChange('overtimeTriggerDays', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              min="3"
              max="7"
              step="1"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-orange-400">📅</span> Consecutive days before quit risk
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 hover:border-red-600/50 transition-all">
            <label className="block text-sm font-semibold text-red-200 mb-3">
              Daily Quit Probability
            </label>
            <input
              type="number"
              value={strategy.dailyQuitProbability}
              onChange={(e) => handleInputChange('dailyQuitProbability', Number(e.target.value))}
              className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
              min="0.05"
              max="0.20"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="text-red-400">🚨</span> {(strategy.dailyQuitProbability * 100).toFixed(0)}% chance when overworked
            </p>
          </div>
        </div>
      </section>

      {/* Advanced: Demand Model (Collapsible) */}
      <details className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <summary className="text-xl font-semibold text-white mb-4 cursor-pointer flex items-center gap-2">
          📊 Advanced: Demand Model
          <span className="text-sm text-gray-400">(click to expand)</span>
        </summary>
        <div className="mt-4 space-y-6">
          {/* Custom Demand */}
          <div>
            <h4 className="text-lg font-medium text-gray-200 mb-3">Custom Line Demand</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phase 1 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean1}
                  onChange={(e) => handleInputChange('customDemandMean1', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="20"
                  max="30"
                  step="0.1"
                />
                <p className="text-xs text-gray-400 mt-1">Days 51-172</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phase 1 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev1}
                  onChange={(e) => handleInputChange('customDemandStdDev1', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="3"
                  max="8"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phase 2 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean2}
                  onChange={(e) => handleInputChange('customDemandMean2', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="28"
                  max="38"
                  step="0.1"
                />
                <p className="text-xs text-gray-400 mt-1">Days 173-500 (30% growth)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phase 2 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev2}
                  onChange={(e) => handleInputChange('customDemandStdDev2', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="4"
                  max="10"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Standard Demand Curve */}
          <div>
            <h4 className="text-lg font-medium text-gray-200 mb-3">Standard Line Demand Curve</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Demand Intercept
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandIntercept}
                  onChange={(e) => handleInputChange('standardDemandIntercept', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="400"
                  max="600"
                  step="10"
                />
                <p className="text-xs text-gray-400 mt-1">Demand at price = $0</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Demand Slope
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandSlope}
                  onChange={(e) => handleInputChange('standardDemandSlope', Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="-0.35"
                  max="-0.15"
                  step="0.01"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Formula: Demand = {strategy.standardDemandIntercept} + ({strategy.standardDemandSlope}) × Price
                </p>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Info Box */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-200">
          💡 <strong>Note:</strong> Inventory policies (Reorder Point, Order Quantity, Batch Size) are calculated dynamically by the simulation using Operations Research formulas (EOQ, ROP, EPQ) based on your pricing and allocation decisions.
        </p>
      </div>
    </div>
  );
}
