import { useStrategyStore } from '../../stores/strategyStore';

export default function PolicyForm() {
  const { strategy, updateStrategy } = useStrategyStore();

  const handleInputChange = (field: string, value: number) => {
    updateStrategy({ [field]: value });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4">
      {/* Production Allocation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-8 py-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>🏭</span> Production Allocation
          </h3>
          <p className="text-gray-600 text-sm mt-1">Configure machine capacity distribution</p>
        </div>
        <div className="p-8">
          <label className="block text-base font-medium text-gray-900 mb-6">
            MCE Allocation to Custom Line
            <span className="text-gray-500 text-sm ml-2 font-normal">(% of machine capacity)</span>
          </label>
          <div className="flex items-center gap-6 mb-6">
            <input
              type="range"
              min="0"
              max="100"
              value={strategy.mceAllocationCustom * 100}
              onChange={(e) => handleInputChange('mceAllocationCustom', Number(e.target.value) / 100)}
              className="flex-1 h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <div className="bg-blue-600 text-white font-bold text-xl px-6 py-3 rounded-lg min-w-[120px] text-center shadow-sm">
              {(strategy.mceAllocationCustom * 100).toFixed(0)}%
            </div>
          </div>
          <div className="flex items-center justify-between text-sm font-medium gap-4">
            <div className="bg-green-50 text-green-700 px-5 py-3 rounded-lg border border-green-200">
              Standard: {((1 - strategy.mceAllocationCustom) * 100).toFixed(0)}%
            </div>
            <div className="bg-purple-50 text-purple-700 px-5 py-3 rounded-lg border border-purple-200">
              Custom: {(strategy.mceAllocationCustom * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Policy */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-8 py-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>💵</span> Pricing Policy
          </h3>
          <p className="text-gray-600 text-sm mt-1">Set product pricing and delivery terms</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💎 Standard Price ($/unit)
              </label>
              <input
                type="number"
                value={strategy.standardPrice}
                onChange={(e) => handleInputChange('standardPrice', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="400"
                max="1200"
                step="10"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Recommended: $400-$1200
              </p>
            </div>

            {/* Custom Base Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎨 Custom Base Price ($)
              </label>
              <input
                type="number"
                value={strategy.customBasePrice}
                onChange={(e) => handleInputChange('customBasePrice', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="90"
                max="120"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-2">
                📊 Data-driven baseline: $106.56
              </p>
            </div>

            {/* Custom Penalty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⚠️ Custom Penalty ($/day late)
              </label>
              <input
                type="number"
                value={strategy.customPenaltyPerDay}
                onChange={(e) => handleInputChange('customPenaltyPerDay', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="0.20"
                max="0.35"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Recommended: $0.20-$0.35
              </p>
            </div>

            {/* Custom Target Delivery */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏱️ Custom Target Delivery (days)
              </label>
              <input
                type="number"
                value={strategy.customTargetDeliveryDays}
                onChange={(e) => handleInputChange('customTargetDeliveryDays', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="5"
                max="7"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-2">
                ⏱️ Max allowed: 7 days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workforce Policy */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-8 py-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>👷</span> Workforce Policy
          </h3>
          <p className="text-gray-600 text-sm mt-1">Manage overtime and employee retention</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Daily Overtime */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Daily Overtime (hours)
              </label>
              <input
                type="number"
                value={strategy.dailyOvertimeHours}
                onChange={(e) => handleInputChange('dailyOvertimeHours', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="0"
                max="4"
                step="0.5"
              />
              <p className="text-xs text-gray-500 mt-2">
                ⏰ Max: 4 hours/day (at 1.5x cost)
              </p>
            </div>

            {/* Overtime Trigger */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Overtime Trigger (days)
              </label>
              <input
                type="number"
                value={strategy.overtimeTriggerDays}
                onChange={(e) => handleInputChange('overtimeTriggerDays', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="3"
                max="7"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-2">
                📅 Consecutive days before quit risk
              </p>
            </div>

            {/* Daily Quit Probability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🚨 Daily Quit Probability
              </label>
              <input
                type="number"
                value={strategy.dailyQuitProbability}
                onChange={(e) => handleInputChange('dailyQuitProbability', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="0.05"
                max="0.20"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-2">
                🚨 {(strategy.dailyQuitProbability * 100).toFixed(0)}% chance when overworked
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced: Demand Model (Collapsible) */}
      <details className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <summary className="border-b border-gray-200 px-8 py-6 cursor-pointer hover:bg-gray-50 transition-all">
          <h3 className="text-xl font-semibold text-gray-900 inline-flex items-center gap-2">
            <span>📊</span> Advanced: Demand Model
            <span className="text-sm font-normal text-gray-500 ml-2">(click to expand)</span>
          </h3>
        </summary>
        <div className="p-8 space-y-8">
          {/* Custom Demand */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b-2 border-gray-200">
              🎨 Custom Line Demand
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Phase 1 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean1}
                  onChange={(e) => handleInputChange('customDemandMean1', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  min="20"
                  max="30"
                  step="0.1"
                />
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-1.5 rounded">Days 51-172</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Phase 1 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev1}
                  onChange={(e) => handleInputChange('customDemandStdDev1', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  min="3"
                  max="6"
                  step="0.1"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Phase 2 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean2}
                  onChange={(e) => handleInputChange('customDemandMean2', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                  min="25"
                  max="40"
                  step="0.1"
                />
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-1.5 rounded">Days 173-500 (30% growth)</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Phase 2 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev2}
                  onChange={(e) => handleInputChange('customDemandStdDev2', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                  min="4"
                  max="8"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Standard Demand */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b-2 border-gray-200">
              💎 Standard Line Demand Curve
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Demand Intercept
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandIntercept}
                  onChange={(e) => handleInputChange('standardDemandIntercept', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                  min="400"
                  max="600"
                  step="10"
                />
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-1.5 rounded">Demand at price = $0</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label className="block text-base font-semibold text-gray-900 mb-3">
                  Demand Slope
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandSlope}
                  onChange={(e) => handleInputChange('standardDemandSlope', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                  min="-0.15"
                  max="-0.05"
                  step="0.01"
                />
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-1.5 rounded">
                  Formula: Demand = {strategy.standardDemandIntercept} + ({strategy.standardDemandSlope}) × Price
                </p>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💡</span>
          <p className="text-gray-700 text-sm leading-relaxed">
            <strong className="text-blue-700 font-semibold">Note:</strong> Inventory policies (Reorder Point, Order Quantity, Batch Size) are calculated dynamically by the simulation using Operations Research formulas (EOQ, ROP, EPQ) based on your pricing and allocation decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
