import { useMemo } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { exportSimulationToCSV } from '../../../utils/csvExporter';
import { validateSimulationResults, type ValidationIssue } from '../../../utils/simulationValidator';

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

  // Validate simulation results
  const validationReport = useMemo(() => {
    return validateSimulationResults(simulationResult);
  }, [simulationResult]);

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

  const renderValidationIssue = (issue: ValidationIssue, index: number) => {
    const severityConfig = {
      error: {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        textColor: 'text-red-900',
        icon: '🚨',
        badgeColor: 'bg-red-600',
      },
      warning: {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-900',
        icon: '⚠️',
        badgeColor: 'bg-yellow-600',
      },
      info: {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-900',
        icon: 'ℹ️',
        badgeColor: 'bg-blue-600',
      },
    };

    const config = severityConfig[issue.severity];

    return (
      <div
        key={index}
        className={`${config.bgColor} border-l-4 ${config.borderColor} rounded-lg p-5 shadow-sm`}
      >
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h5 className={`font-bold text-lg ${config.textColor}`}>
                {issue.title}
              </h5>
              <span className={`${config.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full uppercase flex-shrink-0`}>
                {issue.category}
              </span>
            </div>
            <p className={`${config.textColor} text-sm mb-3 leading-relaxed`}>
              {issue.description}
            </p>
            {issue.recommendation && (
              <div className="bg-white/50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  <span className="font-bold">💡 Recommendation:</span> {issue.recommendation}
                </p>
              </div>
            )}
            {issue.days && issue.days.length > 0 && issue.days.length <= 10 && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Affected days:</span> {issue.days.join(', ')}
              </div>
            )}
            {issue.days && issue.days.length > 10 && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Affected days:</span> {issue.days.length} total (days {issue.days[0]}-{issue.days[issue.days.length - 1]})
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Validation Report */}
      {(validationReport.errors.length > 0 || validationReport.warnings.length > 0 || validationReport.info.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h3 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <span>🔍</span> Validation Report
              {validationReport.allPassed ? (
                <span className="text-sm font-normal bg-green-100 text-green-800 px-3 py-1 rounded-full">
                  ✓ All constraints passed
                </span>
              ) : (
                <span className="text-sm font-normal bg-red-100 text-red-800 px-3 py-1 rounded-full">
                  ✗ {validationReport.errors.length} constraint violation{validationReport.errors.length !== 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <p className="text-gray-600 text-sm mt-2">
              Analysis based on objectives and constraints from project documentation
            </p>
          </div>

          <div className="space-y-4">
            {/* Errors */}
            {validationReport.errors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-red-900 text-lg flex items-center gap-2">
                  <span>🚨</span> Critical Errors ({validationReport.errors.length})
                </h4>
                {validationReport.errors.map((issue, index) => renderValidationIssue(issue, index))}
              </div>
            )}

            {/* Warnings */}
            {validationReport.warnings.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-yellow-900 text-lg flex items-center gap-2 mt-6">
                  <span>⚠️</span> Warnings ({validationReport.warnings.length})
                </h4>
                {validationReport.warnings.map((issue, index) => renderValidationIssue(issue, index))}
              </div>
            )}

            {/* Info */}
            {validationReport.info.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-blue-900 text-lg flex items-center gap-2 mt-6">
                  <span>ℹ️</span> Optimization Suggestions ({validationReport.info.length})
                </h4>
                {validationReport.info.map((issue, index) => renderValidationIssue(issue, index))}
              </div>
            )}
          </div>
        </div>
      )}

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
