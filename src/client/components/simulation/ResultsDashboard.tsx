import { useMemo, useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { exportSimulationToCSV } from '../../../utils/csvExporter';
import { validateSimulationResults, type ValidationIssue } from '../../../utils/simulationValidator';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ProcessMap from './ProcessMap';
import SavedResultsManager from './SavedResultsManager';
import { getMostRecentSavedResult } from '../../utils/savedResults';

interface ResultsDashboardProps {
  onEditStrategy?: () => void;
}

export default function ResultsDashboard({ onEditStrategy }: ResultsDashboardProps) {
  const { simulationResult, saveCurrentResult, getViewingResult, currentViewingResultId, savedResults } = useStrategyStore();
  const [selectedTab, setSelectedTab] = useState<'processMap' | 'financial' | 'production' | 'workforce' | 'inventory' | 'market'>('processMap');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStrategyName, setSaveStrategyName] = useState('');
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  // Get the result being viewed (current or saved)
  const viewingResult = getViewingResult();

  // If no current viewing but have saved results, use most recent
  const displayResult = viewingResult || getMostRecentSavedResult()?.result;

  // Always show at least the Process Map tab (it handles its own empty state)
  // Only show full dashboard when we have data
  const hasData = displayResult !== null && displayResult !== undefined;

  const state = displayResult?.state;
  const finalNetWorth = displayResult?.finalNetWorth || 0;
  const fitnessScore = displayResult?.fitnessScore || 0;

  const handleSaveResult = () => {
    if (saveStrategyName.trim()) {
      saveCurrentResult(saveStrategyName.trim());
      setShowSaveModal(false);
      setSaveStrategyName('');
    }
  };

  // Validate simulation results (only if we have data)
  const validationReport = useMemo(() => {
    return hasData ? validateSimulationResults(displayResult!) : { errors: [], warnings: [], info: [], allPassed: true };
  }, [displayResult, hasData]);

  const handleExportCSV = () => {
    if (!displayResult) return;
    const csv = exportSimulationToCSV(displayResult);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medica-scientifica-simulation-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isViewingCurrent = currentViewingResultId === null;

  // Calculate totals from history (only if we have data)
  const totalRevenue = hasData ? state!.history.dailyRevenue.reduce((sum, d) => sum + d.value, 0) : 0;
  const totalExpenses = hasData ? state!.history.dailyExpenses.reduce((sum, d) => sum + d.value, 0) : 0;
  const totalInterestPaid = hasData ? state!.history.dailyInterestPaid.reduce((sum, d) => sum + d.value, 0) : 0;
  const totalStandardProduced = hasData ? state!.history.dailyStandardProduction.reduce((sum, d) => sum + d.value, 0) : 0;
  const totalCustomProduced = hasData ? state!.history.dailyCustomProduction.reduce((sum, d) => sum + d.value, 0) : 0;

  // Final day values
  const finalCash = hasData ? (state!.history.dailyCash[state!.history.dailyCash.length - 1]?.value || 0) : 0;
  const finalDebt = hasData ? (state!.history.dailyDebt[state!.history.dailyDebt.length - 1]?.value || 0) : 0;

  // Prepare chart data - sample every 10 days to keep charts readable
  const financialChartData = useMemo(() => {
    if (!hasData || !state) return [];
    return state.history.dailyCash
      .filter((_, idx) => idx % 10 === 0 || idx === state.history.dailyCash.length - 1)
      .map((cashData, idx) => {
        const actualIdx = idx * 10;
        return {
          day: cashData.day,
          cash: Math.round(cashData.value),
          debt: Math.round(state.history.dailyDebt[actualIdx]?.value || 0),
          netWorth: Math.round(state.history.dailyNetWorth[actualIdx]?.value || 0),
          revenue: Math.round(state.history.dailyRevenue[actualIdx]?.value || 0),
          expenses: Math.round(state.history.dailyExpenses[actualIdx]?.value || 0),
        };
      });
  }, [state, hasData]);

  const productionChartData = useMemo(() => {
    if (!hasData || !state) return [];
    return state.history.dailyStandardProduction
      .filter((_, idx) => idx % 10 === 0 || idx === state.history.dailyStandardProduction.length - 1)
      .map((prodData, idx) => {
        const actualIdx = idx * 10;
        return {
          day: prodData.day,
          standardProduced: Math.round(prodData.value),
          customProduced: Math.round(state.history.dailyCustomProduction[actualIdx]?.value || 0),
          standardWIP: Math.round(state.history.dailyStandardWIP[actualIdx]?.value || 0),
          customWIP: Math.round(state.history.dailyCustomWIP[actualIdx]?.value || 0),
          finishedStandard: Math.round(state.history.dailyFinishedStandard[actualIdx]?.value || 0),
          finishedCustom: Math.round(state.history.dailyFinishedCustom[actualIdx]?.value || 0),
        };
      });
  }, [state, hasData]);

  const workforceChartData = useMemo(() => {
    if (!hasData || !state) return [];
    return state.history.dailyExperts
      .filter((_, idx) => idx % 10 === 0 || idx === state.history.dailyExperts.length - 1)
      .map((expertData, idx) => {
        const actualIdx = idx * 10;
        return {
          day: expertData.day,
          experts: Math.round(expertData.value),
          rookies: Math.round(state.history.dailyRookies[actualIdx]?.value || 0),
          inTraining: Math.round(state.history.dailyRookiesInTraining[actualIdx]?.value || 0),
          salaryCost: Math.round(state.history.dailySalaryCost[actualIdx]?.value || 0),
        };
      });
  }, [state, hasData]);

  const inventoryChartData = useMemo(() => {
    if (!hasData || !state) return [];
    return state.history.dailyRawMaterial
      .filter((_, idx) => idx % 10 === 0 || idx === state.history.dailyRawMaterial.length - 1)
      .map((inventoryData, idx) => {
        const actualIdx = idx * 10;
        return {
          day: inventoryData.day,
          rawMaterial: Math.round(inventoryData.value),
          ordersArrived: Math.round(state.history.dailyRawMaterialOrders[actualIdx]?.value || 0),
          ordersPlaced: Math.round(state.history.dailyRawMaterialOrdersPlaced[actualIdx]?.value || 0),
        };
      });
  }, [state, hasData]);

  const marketChartData = useMemo(() => {
    if (!hasData || !state) return [];
    return state.history.dailyStandardPrice
      .filter((_, idx) => idx % 10 === 0 || idx === state.history.dailyStandardPrice.length - 1)
      .map((priceData, idx) => {
        const actualIdx = idx * 10;
        return {
          day: priceData.day,
          standardPrice: Math.round(priceData.value),
          customPrice: Math.round(state.history.dailyCustomPrice[actualIdx]?.value || 0),
          deliveryTime: Math.round(state.history.dailyCustomDeliveryTime[actualIdx]?.value || 0),
        };
      });
  }, [state, hasData]);

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
    <div className="flex gap-6">
      {/* Saved Results Sidebar */}
      {showResultsPanel && (
        <div className="w-80 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Saved Results</h3>
            <button
              onClick={() => setShowResultsPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SavedResultsManager />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 space-y-6">
      {/* Validation Report */}
      {hasData && (validationReport.errors.length > 0 || validationReport.warnings.length > 0 || validationReport.info.length > 0) && (
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
      {hasData && (
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
          <p className="text-blue-600 text-xs mt-2">Day 415</p>
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
      )}

      {/* Revenue & Production */}
      {hasData && (
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
      )}

      {/* Viewing Indicator */}
      {hasData && !isViewingCurrent && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-purple-900 text-sm font-medium">
            📌 You are viewing a saved result. This is not your current simulation.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => setShowResultsPanel(!showResultsPanel)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              showResultsPanel
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            📁 {showResultsPanel ? 'Hide' : 'Show'} Saved Results ({savedResults.length})
          </button>
          {hasData && onEditStrategy && (
            <button
              onClick={onEditStrategy}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              ✏️ Edit Strategy & Rerun
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {hasData && simulationResult && isViewingCurrent && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              💾 Save Result
            </button>
          )}
          {hasData && (
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          )}
        </div>
      </div>

      {/* Comprehensive Dashboard Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setSelectedTab('processMap')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'processMap'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              🏭 Process Map
            </button>
            <button
              onClick={() => setSelectedTab('financial')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'financial'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              💰 Financial Performance
            </button>
            <button
              onClick={() => setSelectedTab('production')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'production'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              🏭 Production Metrics
            </button>
            <button
              onClick={() => setSelectedTab('workforce')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'workforce'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              👥 Workforce Analytics
            </button>
            <button
              onClick={() => setSelectedTab('inventory')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'inventory'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              📦 Inventory Management
            </button>
            <button
              onClick={() => setSelectedTab('market')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === 'market'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              📊 Market Performance
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {/* Process Map Tab */}
          {selectedTab === 'processMap' && (
            <ProcessMap simulationResult={displayResult || null} />
          )}

          {/* Financial Performance Tab */}
          {selectedTab === 'financial' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Cash Flow Analysis</h3>
                <p className="text-sm text-gray-600 mb-4">Track cash, debt, and net worth over time</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={financialChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={2} name="Cash" dot={false} />
                    <Line type="monotone" dataKey="debt" stroke="#ef4444" strokeWidth={2} name="Debt" dot={false} />
                    <Line type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={3} name="Net Worth" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Revenue vs Expenses</h3>
                <p className="text-sm text-gray-600 mb-4">Daily revenue and expenses comparison</p>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={financialChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#10b98150" name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef444450" name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Production Metrics Tab */}
          {selectedTab === 'production' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Daily Production Output</h3>
                <p className="text-sm text-gray-600 mb-4">Standard and custom units produced per day</p>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={productionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="standardProduced" fill="#3b82f6" name="Standard Units" />
                    <Bar dataKey="customProduced" fill="#8b5cf6" name="Custom Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Work-in-Progress (WIP) Levels</h3>
                <p className="text-sm text-gray-600 mb-4">Units in production and finished goods inventory</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={productionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="standardWIP" stroke="#3b82f6" strokeWidth={2} name="Standard WIP" dot={false} />
                    <Line type="monotone" dataKey="customWIP" stroke="#8b5cf6" strokeWidth={2} name="Custom WIP" dot={false} />
                    <Line type="monotone" dataKey="finishedStandard" stroke="#10b981" strokeWidth={2} name="Finished Standard" dot={false} />
                    <Line type="monotone" dataKey="finishedCustom" stroke="#f59e0b" strokeWidth={2} name="Finished Custom" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Workforce Analytics Tab */}
          {selectedTab === 'workforce' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Workforce Composition</h3>
                <p className="text-sm text-gray-600 mb-4">Experts, rookies, and employees in training</p>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={workforceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="experts" stackId="1" stroke="#10b981" fill="#10b98180" name="Experts" />
                    <Area type="monotone" dataKey="rookies" stackId="1" stroke="#3b82f6" fill="#3b82f680" name="Rookies" />
                    <Area type="monotone" dataKey="inTraining" stackId="1" stroke="#f59e0b" fill="#f59e0b80" name="In Training" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Daily Salary Costs</h3>
                <p className="text-sm text-gray-600 mb-4">Total workforce compensation over time</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={workforceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="salaryCost" stroke="#ef4444" strokeWidth={2} name="Daily Salary Cost" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Inventory Management Tab */}
          {selectedTab === 'inventory' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Raw Material Inventory</h3>
                <p className="text-sm text-gray-600 mb-4">Track inventory levels over time</p>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={inventoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="rawMaterial" stroke="#3b82f6" fill="#3b82f680" name="Raw Material Inventory" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Material Orders</h3>
                <p className="text-sm text-gray-600 mb-4">Orders placed vs orders arrived (4-day lead time)</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={inventoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="ordersPlaced" stroke="#8b5cf6" strokeWidth={2} name="Orders Placed" dot={false} />
                    <Line type="monotone" dataKey="ordersArrived" stroke="#10b981" strokeWidth={2} name="Orders Arrived" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Market Performance Tab */}
          {selectedTab === 'market' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Product Pricing Trends</h3>
                <p className="text-sm text-gray-600 mb-4">Standard and custom product prices over time</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={marketChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="standardPrice" stroke="#3b82f6" strokeWidth={2} name="Standard Price" dot={false} />
                    <Line type="monotone" dataKey="customPrice" stroke="#8b5cf6" strokeWidth={2} name="Custom Price" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Custom Order Delivery Time</h3>
                <p className="text-sm text-gray-600 mb-4">Average delivery time for custom orders</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={marketChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#6b7280" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      formatter={(value: number) => `${value} days`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="deliveryTime" stroke="#f59e0b" strokeWidth={2} name="Delivery Time (days)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Result Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Save Simulation Result</h3>
            <p className="text-sm text-gray-600 mb-4">
              Give this simulation result a name so you can compare it with other strategies later.
            </p>
            <input
              type="text"
              value={saveStrategyName}
              onChange={(e) => setSaveStrategyName(e.target.value)}
              placeholder="e.g., Aggressive Growth Strategy"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveResult();
                if (e.key === 'Escape') setShowSaveModal(false);
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResult}
                disabled={!saveStrategyName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                💾 Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
