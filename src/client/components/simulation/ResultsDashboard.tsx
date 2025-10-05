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

interface ResultsDashboardProps {
  onEditStrategy?: () => void;
}

export default function ResultsDashboard({ onEditStrategy }: ResultsDashboardProps) {
  const { simulationResult } = useStrategyStore();
  const [selectedTab, setSelectedTab] = useState<'processMap' | 'financial' | 'production' | 'workforce' | 'inventory' | 'market'>('processMap');

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

  // Prepare chart data - sample every 10 days to keep charts readable
  const financialChartData = useMemo(() => {
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
  }, [state.history]);

  const productionChartData = useMemo(() => {
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
  }, [state.history]);

  const workforceChartData = useMemo(() => {
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
  }, [state.history]);

  const inventoryChartData = useMemo(() => {
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
  }, [state.history]);

  const marketChartData = useMemo(() => {
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
  }, [state.history]);

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
            <ProcessMap simulationResult={simulationResult} />
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
    </div>
  );
}
