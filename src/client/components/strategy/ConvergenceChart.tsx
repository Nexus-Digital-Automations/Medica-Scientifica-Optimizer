/**
 * Convergence Chart Component
 *
 * Visualizes GA convergence over generations
 * Shows how fitness improves and when algorithm converges
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ConvergenceChartProps {
  convergenceHistory: number[];
}

export function ConvergenceChart({ convergenceHistory }: ConvergenceChartProps) {
  const data = convergenceHistory.map((fitness, gen) => ({
    generation: gen + 1,
    fitness
  }));

  const improvement = convergenceHistory.length > 1
    ? ((convergenceHistory[convergenceHistory.length - 1] - convergenceHistory[0]) / Math.abs(convergenceHistory[0]) * 100)
    : 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white">
          📈 Convergence History
        </h4>
        <div className="text-sm">
          <span className="text-gray-400">Total Improvement:</span>
          <span className={`ml-2 font-bold ${improvement > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="generation"
            stroke="#9CA3AF"
            label={{ value: 'Generation', position: 'insideBottom', offset: -5, fill: '#9CA3AF', style: { fontSize: '12px' } }}
            style={{ fontSize: '10px' }}
          />
          <YAxis
            stroke="#9CA3AF"
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            style={{ fontSize: '10px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Best Fitness']}
            labelFormatter={(label) => `Generation ${label}`}
          />
          <Line
            type="monotone"
            dataKey="fitness"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 text-xs text-gray-400">
        {convergenceHistory.length >= 5 && (
          <div>
            The algorithm converged after {convergenceHistory.length} generations
            {convergenceHistory.length < 15 && ' (early stopping triggered)'}
          </div>
        )}
      </div>
    </div>
  );
}
