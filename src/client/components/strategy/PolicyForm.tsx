import { useStrategyStore } from '../../stores/strategyStore';

export default function PolicyForm() {
  const { strategy, updateStrategy } = useStrategyStore();

  const handleInputChange = (field: string, value: number) => {
    updateStrategy({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Production Allocation */}
      <section className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          🏭 Production Allocation
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MCE Allocation to Custom
              <span className="text-gray-500 text-xs ml-2">(% of machine capacity)</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={strategy.mceAllocationCustom * 100}
                onChange={(e) => handleInputChange('mceAllocationCustom', Number(e.target.value) / 100)}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-white font-semibold w-16 text-right">
                {(strategy.mceAllocationCustom * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Standard gets {((1 - strategy.mceAllocationCustom) * 100).toFixed(0)}% | Custom gets {(strategy.mceAllocationCustom * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Policy */}
      <section className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          💵 Pricing Policy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Standard Price ($/unit)
            </label>
            <input
              type="number"
              value={strategy.standardPrice}
              onChange={(e) => handleInputChange('standardPrice', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="400"
              max="1200"
              step="10"
            />
            <p className="text-xs text-gray-400 mt-1">Recommended: $400-$1200</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Base Price ($)
            </label>
            <input
              type="number"
              value={strategy.customBasePrice}
              onChange={(e) => handleInputChange('customBasePrice', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="90"
              max="120"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-1">Data-driven baseline: $106.56</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Penalty ($/day late)
            </label>
            <input
              type="number"
              value={strategy.customPenaltyPerDay}
              onChange={(e) => handleInputChange('customPenaltyPerDay', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0.20"
              max="0.35"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-1">Recommended: $0.20-$0.35</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Target Delivery (days)
            </label>
            <input
              type="number"
              value={strategy.customTargetDeliveryDays}
              onChange={(e) => handleInputChange('customTargetDeliveryDays', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="5"
              max="7"
              step="1"
            />
            <p className="text-xs text-gray-400 mt-1">Max allowed: 7 days</p>
          </div>
        </div>
      </section>

      {/* Workforce Policy */}
      <section className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          👷 Workforce Policy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Overtime (hours)
            </label>
            <input
              type="number"
              value={strategy.dailyOvertimeHours}
              onChange={(e) => handleInputChange('dailyOvertimeHours', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              max="4"
              step="0.5"
            />
            <p className="text-xs text-gray-400 mt-1">Max: 4 hours/day (at 1.5x cost)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Overtime Trigger (days)
            </label>
            <input
              type="number"
              value={strategy.overtimeTriggerDays}
              onChange={(e) => handleInputChange('overtimeTriggerDays', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="3"
              max="7"
              step="1"
            />
            <p className="text-xs text-gray-400 mt-1">Consecutive days before quit risk</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Quit Probability
            </label>
            <input
              type="number"
              value={strategy.dailyQuitProbability}
              onChange={(e) => handleInputChange('dailyQuitProbability', Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0.05"
              max="0.20"
              step="0.01"
            />
            <p className="text-xs text-gray-400 mt-1">
              {(strategy.dailyQuitProbability * 100).toFixed(0)}% chance when overworked
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
