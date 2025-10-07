import { useStrategyStore } from '../../stores/strategyStore';
import { DebtManagementInfoButton } from './DebtManagementInfo';

export default function PolicyForm() {
  const { strategy, updateStrategy } = useStrategyStore();

  const handleInputChange = (field: string, value: number) => {
    updateStrategy({ [field]: value });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4">
      {/* Pricing Policy */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-8 py-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>💵</span> Initial Pricing & Delivery Terms
          </h3>
          <p className="text-gray-600 text-sm mt-1">Starting product prices and delivery policies (prices adjustable via user actions)</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Price */}
            <div>
              <label htmlFor="standard-price" className="block text-sm font-medium text-gray-700 mb-2">
                💎 Standard Line - Price ($/unit)
              </label>
              <input
                id="standard-price"
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
              <label htmlFor="custom-base-price" className="block text-sm font-medium text-gray-700 mb-2">
                🎨 Custom Line - Base Price ($)
              </label>
              <input
                id="custom-base-price"
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
              <label htmlFor="custom-penalty-per-day" className="block text-sm font-medium text-gray-700 mb-2">
                ⚠️ Custom Line - Penalty ($/day late)
              </label>
              <input
                id="custom-penalty-per-day"
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
              <label htmlFor="custom-target-delivery-days" className="block text-sm font-medium text-gray-700 mb-2">
                ⏱️ Custom Line - Target Delivery (days)
              </label>
              <input
                id="custom-target-delivery-days"
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
              <label htmlFor="daily-overtime-hours" className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Daily Overtime - Both Lines (hours)
              </label>
              <input
                id="daily-overtime-hours"
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
              <label htmlFor="overtime-trigger-days" className="block text-sm font-medium text-gray-700 mb-2">
                📅 Overtime Trigger - Both Lines (days)
              </label>
              <input
                id="overtime-trigger-days"
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
              <label htmlFor="daily-quit-probability" className="block text-sm font-medium text-gray-700 mb-2">
                🚨 Daily Quit Probability - Both Lines
              </label>
              <input
                id="daily-quit-probability"
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

      {/* Debt Management Policy */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span>💰</span> Automated Debt Management
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                <strong className="text-green-600">20% Annual ROI:</strong> Paying down debt saves 0.05%/day + avoids 5% wage advances
              </p>
            </div>
            <DebtManagementInfoButton />
          </div>
        </div>
        <div className="p-8">
          {/* Enable/Disable Toggle */}
          <div className="mb-8 flex items-center gap-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <label htmlFor="auto-debt-paydown" className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                id="auto-debt-paydown"
                type="checkbox"
                checked={strategy.autoDebtPaydown}
                onChange={(e) => handleInputChange('autoDebtPaydown', e.target.checked ? 1 : 0)}
                className="w-6 h-6 text-blue-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-base font-semibold text-gray-900">
                Enable Automatic Debt Paydown
              </span>
            </label>
            <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded border border-gray-300">
              {strategy.autoDebtPaydown ? '✅ Active' : '⏸️ Disabled'}
            </span>
          </div>

          {/* Debt Management Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Min Cash Reserve Days */}
            <div>
              <label htmlFor="min-cash-reserve-days" className="block text-sm font-medium text-gray-700 mb-2">
                🏦 Minimum Cash Reserve (days of expenses)
              </label>
              <input
                id="min-cash-reserve-days"
                type="number"
                value={strategy.minCashReserveDays}
                onChange={(e) => handleInputChange('minCashReserveDays', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="5"
                max="15"
                step="1"
                disabled={!strategy.autoDebtPaydown}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Safety buffer: <strong>5-7 days</strong> = aggressive, <strong>7-10 days</strong> = balanced, <strong>10-15 days</strong> = conservative
              </p>
            </div>

            {/* Debt Paydown Aggressiveness */}
            <div>
              <label htmlFor="debt-paydown-aggressiveness" className="block text-sm font-medium text-gray-700 mb-2">
                🎯 Debt Paydown Aggressiveness (0-1)
              </label>
              <input
                id="debt-paydown-aggressiveness"
                type="number"
                value={strategy.debtPaydownAggressiveness}
                onChange={(e) => handleInputChange('debtPaydownAggressiveness', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="0"
                max="1"
                step="0.05"
                disabled={!strategy.autoDebtPaydown}
              />
              <p className="text-xs text-gray-500 mt-2">
                🎯 Currently using <strong>{(strategy.debtPaydownAggressiveness * 100).toFixed(0)}%</strong> of excess cash for debt paydown (0.8 = recommended balance)
              </p>
            </div>

            {/* Preemptive Wage Loan Days */}
            <div>
              <label htmlFor="preemptive-wage-loan-days" className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Preemptive Loan Before Payroll (days)
              </label>
              <input
                id="preemptive-wage-loan-days"
                type="number"
                value={strategy.preemptiveWageLoanDays}
                onChange={(e) => handleInputChange('preemptiveWageLoanDays', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="3"
                max="7"
                step="1"
                disabled={!strategy.autoDebtPaydown}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Take 2% loan <strong>{strategy.preemptiveWageLoanDays} days</strong> before payroll to avoid 5% wage advance (saves 3% = 60% ROI)
              </p>
            </div>

            {/* Max Debt Threshold */}
            <div>
              <label htmlFor="max-debt-threshold" className="block text-sm font-medium text-gray-700 mb-2">
                🚨 Maximum Debt Threshold ($)
              </label>
              <input
                id="max-debt-threshold"
                type="number"
                value={strategy.maxDebtThreshold}
                onChange={(e) => handleInputChange('maxDebtThreshold', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                min="100000"
                max="300000"
                step="10000"
                disabled={!strategy.autoDebtPaydown}
              />
              <p className="text-xs text-gray-500 mt-2">
                🚨 Emergency warnings trigger at <strong>${(strategy.maxDebtThreshold / 1000).toFixed(0)}K</strong> debt ($150K-$200K = typical)
              </p>
            </div>

            {/* Emergency Loan Buffer */}
            <div>
              <label htmlFor="emergency-loan-buffer" className="block text-sm font-medium text-gray-700 mb-2">
                🛡️ Emergency Loan Buffer ($)
              </label>
              <input
                id="emergency-loan-buffer"
                type="number"
                value={strategy.emergencyLoanBuffer}
                onChange={(e) => handleInputChange('emergencyLoanBuffer', Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                min="5000"
                max="30000"
                step="1000"
                disabled={!strategy.autoDebtPaydown}
              />
              <p className="text-xs text-gray-500 mt-2">
                🛡️ Emergency cushion: <strong>${(strategy.emergencyLoanBuffer / 1000).toFixed(0)}K</strong> minimum cash ($10K-$15K = recommended)
              </p>
            </div>
          </div>

          {/* Financial Health Ratio Constraints */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>📊</span> Financial Health Ratio Constraints
            </h4>
            <p className="text-sm text-gray-600 mb-6">
              Hard limits that automatically cap loan amounts to maintain financial health
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Max Debt-to-Asset Ratio */}
              <div>
                <label htmlFor="max-debt-to-asset-ratio" className="block text-sm font-medium text-gray-700 mb-2">
                  📈 Max Debt-to-Asset Ratio
                </label>
                <input
                  id="max-debt-to-asset-ratio"
                  type="number"
                  value={strategy.maxDebtToAssetRatio}
                  onChange={(e) => handleInputChange('maxDebtToAssetRatio', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  min="0.5"
                  max="0.9"
                  step="0.05"
                  disabled={!strategy.autoDebtPaydown}
                />
                <p className="text-xs text-gray-500 mt-2">
                  📊 Current: <strong>{(strategy.maxDebtToAssetRatio * 100).toFixed(0)}%</strong> max leverage<br />
                  💡 Debt cannot exceed this % of total assets
                </p>
              </div>

              {/* Min Interest Coverage Ratio */}
              <div>
                <label htmlFor="min-interest-coverage-ratio" className="block text-sm font-medium text-gray-700 mb-2">
                  💵 Min Interest Coverage Ratio
                </label>
                <input
                  id="min-interest-coverage-ratio"
                  type="number"
                  value={strategy.minInterestCoverageRatio}
                  onChange={(e) => handleInputChange('minInterestCoverageRatio', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  min="2.0"
                  max="5.0"
                  step="0.1"
                  disabled={!strategy.autoDebtPaydown}
                />
                <p className="text-xs text-gray-500 mt-2">
                  📊 Current: <strong>{strategy.minInterestCoverageRatio.toFixed(1)}x</strong> coverage<br />
                  💡 Revenue must be this multiple of interest paid
                </p>
              </div>

              {/* Max Debt-to-Revenue Ratio */}
              <div>
                <label htmlFor="max-debt-to-revenue-ratio" className="block text-sm font-medium text-gray-700 mb-2">
                  📉 Max Debt-to-Revenue Ratio
                </label>
                <input
                  id="max-debt-to-revenue-ratio"
                  type="number"
                  value={strategy.maxDebtToRevenueRatio}
                  onChange={(e) => handleInputChange('maxDebtToRevenueRatio', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  disabled={!strategy.autoDebtPaydown}
                />
                <p className="text-xs text-gray-500 mt-2">
                  📊 Current: <strong>{strategy.maxDebtToRevenueRatio.toFixed(1)}x</strong> revenue<br />
                  💡 Debt cannot exceed this multiple of annual revenue
                </p>
              </div>
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
                <label htmlFor="custom-demand-mean-1" className="block text-base font-semibold text-gray-900 mb-3">
                  Custom Line - Phase 1 Mean (orders/day)
                </label>
                <input
                  id="custom-demand-mean-1"
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
                <label htmlFor="custom-demand-std-dev-1" className="block text-base font-semibold text-gray-900 mb-3">
                  Custom Line - Phase 1 Std Dev
                </label>
                <input
                  id="custom-demand-std-dev-1"
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
                <label htmlFor="custom-demand-mean-2" className="block text-base font-semibold text-gray-900 mb-3">
                  Custom Line - Phase 2 Mean (orders/day)
                </label>
                <input
                  id="custom-demand-mean-2"
                  type="number"
                  value={strategy.customDemandMean2}
                  onChange={(e) => handleInputChange('customDemandMean2', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 text-xl font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                  min="25"
                  max="40"
                  step="0.1"
                />
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-1.5 rounded">Days 173-415 (30% growth)</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <label htmlFor="custom-demand-std-dev-2" className="block text-base font-semibold text-gray-900 mb-3">
                  Custom Line - Phase 2 Std Dev
                </label>
                <input
                  id="custom-demand-std-dev-2"
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
                <label htmlFor="standard-demand-intercept" className="block text-base font-semibold text-gray-900 mb-3">
                  Standard Line - Demand Intercept
                </label>
                <input
                  id="standard-demand-intercept"
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
                <label htmlFor="standard-demand-slope" className="block text-base font-semibold text-gray-900 mb-3">
                  Standard Line - Demand Slope
                </label>
                <input
                  id="standard-demand-slope"
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

    </div>
  );
}
