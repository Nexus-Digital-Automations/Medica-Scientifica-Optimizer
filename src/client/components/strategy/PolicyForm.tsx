import { useStrategyStore } from '../../stores/strategyStore';

export default function PolicyForm() {
  const { strategy, updateStrategy } = useStrategyStore();

  const handleInputChange = (field: string, value: number) => {
    updateStrategy({ [field]: value });
  };

  return (
    <div className="space-y-8">
      {/* Production Allocation */}
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-3xl border border-blue-400/30 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="text-3xl">🏭</span> Production Allocation
          </h3>
          <p className="text-blue-100 text-sm mt-1">Configure machine capacity distribution</p>
        </div>
        <div className="p-8">
          <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
            <label className="block text-lg font-bold text-white mb-4">
              MCE Allocation to Custom Line
              <span className="text-blue-300 text-sm ml-3 font-normal">(% of machine capacity)</span>
            </label>
            <div className="flex items-center gap-6">
              <input
                type="range"
                min="0"
                max="100"
                value={strategy.mceAllocationCustom * 100}
                onChange={(e) => handleInputChange('mceAllocationCustom', Number(e.target.value) / 100)}
                className="flex-1 h-3 bg-gradient-to-r from-emerald-500/30 to-purple-500/30 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-black text-2xl px-8 py-4 rounded-2xl min-w-[100px] text-center shadow-xl">
                {(strategy.mceAllocationCustom * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex items-center justify-between mt-6 text-base font-bold">
              <span className="text-emerald-400 bg-emerald-500/20 px-4 py-2 rounded-xl">
                Standard: {((1 - strategy.mceAllocationCustom) * 100).toFixed(0)}%
              </span>
              <span className="text-purple-400 bg-purple-500/20 px-4 py-2 rounded-xl">
                Custom: {(strategy.mceAllocationCustom * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Policy */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-3xl border border-emerald-400/30 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="text-3xl">💵</span> Pricing Policy
          </h3>
          <p className="text-emerald-100 text-sm mt-1">Set product pricing and delivery terms</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Price */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-emerald-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                💎 Standard Price ($/unit)
              </label>
              <input
                type="number"
                value={strategy.standardPrice}
                onChange={(e) => handleInputChange('standardPrice', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 outline-none transition-all"
                min="400"
                max="1200"
                step="10"
              />
              <p className="text-sm text-emerald-300 mt-3 font-medium">
                💡 Recommended: $400-$1200
              </p>
            </div>

            {/* Custom Base Price */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-purple-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                🎨 Custom Base Price ($)
              </label>
              <input
                type="number"
                value={strategy.customBasePrice}
                onChange={(e) => handleInputChange('customBasePrice', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-purple-500/50 focus:border-purple-400 outline-none transition-all"
                min="90"
                max="120"
                step="0.01"
              />
              <p className="text-sm text-purple-300 mt-3 font-medium">
                📊 Data-driven baseline: $106.56
              </p>
            </div>

            {/* Custom Penalty */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-red-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                ⚠️ Custom Penalty ($/day late)
              </label>
              <input
                type="number"
                value={strategy.customPenaltyPerDay}
                onChange={(e) => handleInputChange('customPenaltyPerDay', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-red-500/50 focus:border-red-400 outline-none transition-all"
                min="0.20"
                max="0.35"
                step="0.01"
              />
              <p className="text-sm text-red-300 mt-3 font-medium">
                ⚠️ Recommended: $0.20-$0.35
              </p>
            </div>

            {/* Custom Target Delivery */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-blue-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                ⏱️ Custom Target Delivery (days)
              </label>
              <input
                type="number"
                value={strategy.customTargetDeliveryDays}
                onChange={(e) => handleInputChange('customTargetDeliveryDays', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                min="5"
                max="7"
                step="1"
              />
              <p className="text-sm text-blue-300 mt-3 font-medium">
                ⏱️ Max allowed: 7 days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workforce Policy */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-3xl border border-amber-400/30 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="text-3xl">👷</span> Workforce Policy
          </h3>
          <p className="text-amber-100 text-sm mt-1">Manage overtime and employee retention</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Daily Overtime */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-amber-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                ⏰ Daily Overtime (hours)
              </label>
              <input
                type="number"
                value={strategy.dailyOvertimeHours}
                onChange={(e) => handleInputChange('dailyOvertimeHours', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-amber-500/50 focus:border-amber-400 outline-none transition-all"
                min="0"
                max="4"
                step="0.5"
              />
              <p className="text-sm text-amber-300 mt-3 font-medium">
                ⏰ Max: 4 hours/day (at 1.5x cost)
              </p>
            </div>

            {/* Overtime Trigger */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-orange-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                📅 Overtime Trigger (days)
              </label>
              <input
                type="number"
                value={strategy.overtimeTriggerDays}
                onChange={(e) => handleInputChange('overtimeTriggerDays', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all"
                min="3"
                max="7"
                step="1"
              />
              <p className="text-sm text-orange-300 mt-3 font-medium">
                📅 Consecutive days before quit risk
              </p>
            </div>

            {/* Daily Quit Probability */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-red-400/50 transition-all">
              <label className="block text-base font-bold text-white mb-4">
                🚨 Daily Quit Probability
              </label>
              <input
                type="number"
                value={strategy.dailyQuitProbability}
                onChange={(e) => handleInputChange('dailyQuitProbability', Number(e.target.value))}
                className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-red-500/50 focus:border-red-400 outline-none transition-all"
                min="0.05"
                max="0.20"
                step="0.01"
              />
              <p className="text-sm text-red-300 mt-3 font-medium">
                🚨 {(strategy.dailyQuitProbability * 100).toFixed(0)}% chance when overworked
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced: Demand Model (Collapsible) */}
      <details className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-3xl border border-indigo-400/30 overflow-hidden shadow-2xl">
        <summary className="bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-6 cursor-pointer hover:from-indigo-600 hover:to-purple-600 transition-all">
          <h3 className="text-2xl font-black text-white inline-flex items-center gap-3">
            <span className="text-3xl">📊</span> Advanced: Demand Model
            <span className="text-base font-normal text-indigo-200 ml-3">(click to expand)</span>
          </h3>
        </summary>
        <div className="p-8 space-y-8">
          {/* Custom Demand */}
          <div>
            <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>🎨</span> Custom Line Demand
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Phase 1 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean1}
                  onChange={(e) => handleInputChange('customDemandMean1', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="20"
                  max="30"
                  step="0.1"
                />
                <p className="text-sm text-indigo-300 mt-3">Days 51-172</p>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Phase 1 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev1}
                  onChange={(e) => handleInputChange('customDemandStdDev1', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="3"
                  max="6"
                  step="0.1"
                />
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Phase 2 Mean (orders/day)
                </label>
                <input
                  type="number"
                  value={strategy.customDemandMean2}
                  onChange={(e) => handleInputChange('customDemandMean2', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="25"
                  max="40"
                  step="0.1"
                />
                <p className="text-sm text-indigo-300 mt-3">Days 173-500 (30% growth)</p>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Phase 2 Std Dev
                </label>
                <input
                  type="number"
                  value={strategy.customDemandStdDev2}
                  onChange={(e) => handleInputChange('customDemandStdDev2', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="4"
                  max="8"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Standard Demand */}
          <div>
            <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>💎</span> Standard Line Demand Curve
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Demand Intercept
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandIntercept}
                  onChange={(e) => handleInputChange('standardDemandIntercept', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="400"
                  max="600"
                  step="10"
                />
                <p className="text-sm text-indigo-300 mt-3">Demand at price = $0</p>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <label className="block text-base font-bold text-white mb-4">
                  Demand Slope
                </label>
                <input
                  type="number"
                  value={strategy.standardDemandSlope}
                  onChange={(e) => handleInputChange('standardDemandSlope', Number(e.target.value))}
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-4 focus:ring-blue-500/50 focus:border-blue-400 outline-none transition-all"
                  min="-0.15"
                  max="-0.05"
                  step="0.01"
                />
                <p className="text-sm text-indigo-300 mt-3">
                  Formula: Demand = {strategy.standardDemandIntercept} + ({strategy.standardDemandSlope}) × Price
                </p>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl p-6 border border-blue-400/30">
        <div className="flex items-start gap-4">
          <span className="text-4xl">💡</span>
          <p className="text-white text-base leading-relaxed">
            <strong className="text-blue-300">Note:</strong> Inventory policies (Reorder Point, Order Quantity, Batch Size) are calculated dynamically by the simulation using Operations Research formulas (EOQ, ROP, EPQ) based on your pricing and allocation decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
