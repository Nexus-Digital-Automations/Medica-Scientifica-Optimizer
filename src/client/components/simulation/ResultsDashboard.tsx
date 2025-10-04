import { useStrategyStore } from '../../stores/strategyStore';
import { exportSimulationToCSV } from '../../../utils/csvExporter';

interface ResultsDashboardProps {
  onEditStrategy?: () => void;
}

export default function ResultsDashboard({ onEditStrategy }: ResultsDashboardProps) {
  const { simulationResult } = useStrategyStore();

  if (!simulationResult) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Simulation Results Yet</h3>
        <p className="text-gray-600">
          Go to the Strategy Builder tab and click "Run Simulation" to see results here.
        </p>
      </div>
    );
  }

  const { state, finalNetWorth, fitnessScore } = simulationResult;

  const handleExportCSV = () => {
    const csv = exportSimulationToCSV(simulationResult);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medica-scientifica-simulation-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate totals from history
  const totalRevenue = state.history.dailyRevenue.reduce((sum, d) => sum + d.value, 0);
  const totalExpenses = state.history.dailyExpenses.reduce((sum, d) => sum + d.value, 0);
  const totalInterestPaid = state.history.dailyInterestPaid.reduce((sum, d) => sum + d.value, 0);
  const totalStandardProduced = state.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0);
  const totalCustomProduced = state.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0);

  // Final day values
  const finalDay = state.history.dailyCash[state.history.dailyCash.length - 1];
  const finalCash = finalDay?.value || 0;
  const finalDebt = state.history.dailyDebt[state.history.dailyDebt.length - 1]?.value || 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Worth */}
        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <p className="text-green-700 text-sm font-medium mb-1">Final Net Worth</p>
          <p className="text-3xl font-bold text-gray-900">
            ${finalNetWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-green-600 text-xs mt-2">Fitness Score: ${fitnessScore.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Cash */}
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <p className="text-blue-700 text-sm font-medium mb-1">Final Cash</p>
          <p className="text-3xl font-bold text-gray-900">
            ${finalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-blue-600 text-xs mt-2">Day 500</p>
        </div>

        {/* Debt */}
        <div className="bg-red-50 rounded-lg p-6 border border-red-200">
          <p className="text-red-700 text-sm font-medium mb-1">Final Debt</p>
          <p className="text-3xl font-bold text-gray-900">
            ${finalDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-red-600 text-xs mt-2">Interest Paid: ${totalInterestPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Revenue & Production */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">💰 Financial Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Revenue</span>
              <span className="text-gray-900 font-semibold">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Expenses</span>
              <span className="text-gray-900 font-semibold">${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-gray-300">Net Profit</span>
              <span className="text-green-400 font-bold">
                ${(totalRevenue - totalExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">🏭 Production Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Standard Units Produced</span>
              <span className="text-gray-900 font-semibold">{Math.round(totalStandardProduced).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Custom Orders Fulfilled</span>
              <span className="text-gray-900 font-semibold">{Math.round(totalCustomProduced).toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-gray-300">Total Output</span>
              <span className="text-blue-400 font-bold">
                {Math.round(totalStandardProduced + totalCustomProduced).toLocaleString()} units
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-4">
        {onEditStrategy && (
          <button
            onClick={onEditStrategy}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            ✏️ Edit Strategy & Rerun
          </button>
        )}
        <button
          onClick={handleExportCSV}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          📥 Export Full CSV Report
        </button>
      </div>

      {/* Placeholder for Charts */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">📈 Performance Charts</h4>
        <p className="text-gray-400 text-center py-8">
          Interactive charts coming in Phase 6...
        </p>
      </div>
    </div>
  );
}
