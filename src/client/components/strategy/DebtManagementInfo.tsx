import { useState } from 'react';

interface DebtManagementInfoProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DebtManagementInfo({ isOpen, onClose }: DebtManagementInfoProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                💰 Automated Debt Management System
              </h2>
              <p className="text-green-100 text-sm">
                Intelligent debt paydown strategy delivering ~20% annual ROI
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Overview */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>📊</span> What Is This System?
            </h3>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
              <p className="text-gray-800 leading-relaxed mb-3">
                The Automated Debt Management System is an intelligent financial optimization tool that automatically manages your company's debt to maximize profitability. It works by:
              </p>
              <ul className="space-y-2 text-gray-800">
                <li className="flex gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span><strong>Preventing expensive emergencies:</strong> Takes cheap 2% loans before payroll to avoid costly 5% wage advances</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span><strong>Aggressively paying down debt:</strong> Uses excess cash to eliminate high-interest debt (0.05%/day ≈ 18.25% annual)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span><strong>Maintaining safety reserves:</strong> Keeps minimum cash buffer for smooth operations</span>
                </li>
              </ul>
            </div>
          </section>

          {/* ROI Breakdown */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>💎</span> Why ~20% Annual ROI?
            </h3>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
              <div className="space-y-3 text-gray-800">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Interest Savings (Direct):</p>
                  <p className="ml-4">• Debt costs <strong>0.05% per day</strong> (compounds to ~18.25% annually)</p>
                  <p className="ml-4">• Each $1,000 paid down saves <strong>$0.50/day = $182.50/year</strong></p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Wage Advance Avoidance (Strategic):</p>
                  <p className="ml-4">• Regular loan: <strong>2% commission</strong></p>
                  <p className="ml-4">• Wage advance: <strong>5% commission</strong></p>
                  <p className="ml-4">• Preemptive action saves <strong>3% = 60% ROI</strong> on that capital</p>
                </div>
                <div className="pt-2 border-t-2 border-green-300">
                  <p className="font-bold text-green-700 text-lg">Combined Effect: ~20% annual return on debt reduction</p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>⚙️</span> How Does It Work?
            </h3>
            <div className="space-y-3">
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <p className="font-semibold text-purple-900 mb-1">Step 1: Calculate Safe Cash Reserve</p>
                <p className="text-gray-700 text-sm">
                  Reserve = (Daily Salaries + Overtime + Materials) × Min Cash Reserve Days
                </p>
                <p className="text-gray-600 text-xs mt-1 italic">
                  This ensures you always have enough to cover operating expenses
                </p>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <p className="font-semibold text-orange-900 mb-1">Step 2: Prevent Wage Advances (Preemptive Loans)</p>
                <p className="text-gray-700 text-sm">
                  If cash &lt; (next payroll + buffer) AND within threshold days of payroll:
                </p>
                <p className="text-gray-700 text-sm ml-4">→ Take 2% regular loan NOW to avoid 5% wage advance later</p>
                <p className="text-gray-600 text-xs mt-1 italic">
                  Saves 3% commission difference (60% ROI on preemptive action)
                </p>
              </div>

              <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded">
                <p className="font-semibold text-teal-900 mb-1">Step 3: Aggressive Debt Paydown</p>
                <p className="text-gray-700 text-sm">
                  Excess Cash = Current Cash - Min Reserve
                </p>
                <p className="text-gray-700 text-sm">
                  Paydown Amount = Excess Cash × Aggressiveness %
                </p>
                <p className="text-gray-600 text-xs mt-1 italic">
                  Uses "extra" cash to eliminate high-interest debt
                </p>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="font-semibold text-red-900 mb-1">Step 4: Monitor Emergency Threshold</p>
                <p className="text-gray-700 text-sm">
                  If debt &gt; Maximum Debt Threshold → Flag for emergency measures
                </p>
                <p className="text-gray-600 text-xs mt-1 italic">
                  Warns when debt reaches dangerous levels
                </p>
              </div>
            </div>
          </section>

          {/* Parameter Guide */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>🎛️</span> Parameter Guide
            </h3>
            <div className="space-y-4">
              <div className="border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🏦 Minimum Cash Reserve (days)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Number of days of operating expenses to maintain as a safety buffer.
                </p>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="mb-1"><strong>Conservative (10-15 days):</strong> Higher safety, slower debt paydown</p>
                  <p className="mb-1"><strong>Balanced (7-10 days):</strong> Good safety, reasonable debt reduction</p>
                  <p><strong>Aggressive (5-7 days):</strong> Tight margins, maximum debt paydown</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🎯 Debt Paydown Aggressiveness (0-1)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Percentage of excess cash (above reserve) to use for debt paydown.
                </p>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="mb-1"><strong>0.5 (50%):</strong> Conservative - keeps more cash on hand</p>
                  <p className="mb-1"><strong>0.8 (80%):</strong> Balanced - typical recommended setting</p>
                  <p><strong>1.0 (100%):</strong> Aggressive - maximizes debt reduction</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">⏰ Preemptive Loan Days (before payroll)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  How many days before payroll to take a 2% loan instead of risking a 5% wage advance.
                </p>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="mb-1"><strong>3 days:</strong> Last-minute prevention (riskier)</p>
                  <p className="mb-1"><strong>5 days:</strong> Balanced approach (recommended)</p>
                  <p><strong>7 days:</strong> Early prevention (safest, more 2% loans)</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🚨 Maximum Debt Threshold ($)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Debt level that triggers emergency warnings and potential crisis measures.
                </p>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="mb-1"><strong>$150K:</strong> Conservative - early warning system</p>
                  <p className="mb-1"><strong>$200K:</strong> Balanced - typical limit</p>
                  <p><strong>$250K+:</strong> Aggressive - allows higher leverage</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🛡️ Emergency Loan Buffer ($)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Minimum cash cushion to maintain before taking emergency loans for payroll.
                </p>
                <div className="bg-gray-50 rounded p-3 text-sm">
                  <p className="mb-1"><strong>$5K:</strong> Tight - minimal buffer</p>
                  <p className="mb-1"><strong>$10K-$15K:</strong> Balanced - recommended</p>
                  <p><strong>$20K+:</strong> Conservative - large safety margin</p>
                </div>
              </div>
            </div>
          </section>

          {/* Best Practices */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>✨</span> Best Practices
            </h3>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
              <ul className="space-y-2 text-gray-800">
                <li className="flex gap-2">
                  <span className="text-yellow-600 font-bold">💡</span>
                  <span><strong>Start Balanced:</strong> Use 7-10 day reserve, 80% aggressiveness, 5-day preemptive threshold</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-600 font-bold">💡</span>
                  <span><strong>Monitor Performance:</strong> Watch daily debt levels and cash flow in simulation results</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-600 font-bold">💡</span>
                  <span><strong>Adjust Based on Risk Tolerance:</strong> Increase reserves if cash flow is volatile</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-600 font-bold">💡</span>
                  <span><strong>Enable for Long Simulations:</strong> The system's benefits compound over time</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Example Scenario */}
          <section>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>📝</span> Example Scenario
            </h3>
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-5">
              <div className="space-y-3 text-sm text-gray-800">
                <div className="bg-white rounded p-3 border border-indigo-200">
                  <p className="font-semibold text-indigo-900 mb-1">Day 85 - Current State:</p>
                  <p>• Cash: $50,000</p>
                  <p>• Debt: $80,000</p>
                  <p>• Daily expenses: $3,000 (salaries + materials)</p>
                  <p>• Days until payroll: 4 days</p>
                </div>

                <div className="bg-white rounded p-3 border border-indigo-200">
                  <p className="font-semibold text-indigo-900 mb-1">System Calculations:</p>
                  <p>• Min Reserve (7 days × $3,000) = $21,000</p>
                  <p>• Excess Cash ($50,000 - $21,000) = $29,000</p>
                  <p>• Debt Paydown (80% × $29,000) = $23,200</p>
                </div>

                <div className="bg-white rounded p-3 border border-indigo-200">
                  <p className="font-semibold text-green-700 mb-1">✅ Actions Taken:</p>
                  <p>• Pay down $23,200 of debt</p>
                  <p>• New debt: $56,800</p>
                  <p>• New cash: $26,800 (above $21K reserve ✓)</p>
                  <p>• Daily savings: $11.60 (0.05% of $23,200)</p>
                  <p>• Annual savings: $4,234 (18.25% ROI)</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-8 py-4 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}

export function DebtManagementInfoButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors font-bold text-sm"
        title="Learn about Automated Debt Management"
        aria-label="Information about Automated Debt Management"
      >
        ℹ️
      </button>
      <DebtManagementInfo isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
