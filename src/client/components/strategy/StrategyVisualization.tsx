import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy, StrategyAction } from '../../types/ui.types';

export default function StrategyVisualization() {
  const { strategy } = useStrategyStore();

  // Calculate what policy values will be over time based on timed actions
  const policyData = useMemo(() => {
    return calculatePolicyTimeline(strategy);
  }, [strategy]);

  const priceData = useMemo(() => {
    return calculatePriceTimeline(strategy);
  }, [strategy]);

  const allocationData = useMemo(() => {
    return calculateAllocationTimeline(strategy);
  }, [strategy]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <span>📊</span> Strategy Visualization
        </h3>
        <p className="text-gray-600 text-sm mt-1">
          Preview how your strategy parameters change over time (days 51-500)
        </p>
      </div>

      {/* Inventory Policy Values Over Time */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📦 Inventory Policies Over Time
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={policyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              label={{ value: 'Day', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Units', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Legend />
            <Line
              type="stepAfter"
              dataKey="reorderPoint"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Reorder Point"
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="orderQuantity"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Order Quantity"
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="batchSize"
              stroke="#10b981"
              strokeWidth={2}
              name="Batch Size"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
            Reorder Point: {strategy.reorderPoint} units (initial)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
            Order Quantity: {strategy.orderQuantity} units (initial)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            Batch Size: {strategy.standardBatchSize} units (initial)
          </span>
        </div>
      </div>

      {/* Product Prices Over Time */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💵 Product Prices Over Time
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              label={{ value: 'Day', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Legend />
            <Line
              type="stepAfter"
              dataKey="standardPrice"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Standard Product"
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="customPrice"
              stroke="#ec4899"
              strokeWidth={2}
              name="Custom Product Base"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
            Standard: ${strategy.standardPrice} (initial)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-500 rounded-sm"></div>
            Custom Base: ${strategy.customBasePrice} (initial)
          </span>
        </div>
      </div>

      {/* MCE Allocation Over Time */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          ⚙️ MCE Allocation Over Time
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={allocationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              label={{ value: 'Day', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Allocation (%)', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <Tooltip />
            <Legend />
            <Line
              type="stepAfter"
              dataKey="customAllocation"
              stroke="#6366f1"
              strokeWidth={2}
              name="Custom %"
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="standardAllocation"
              stroke="#22c55e"
              strokeWidth={2}
              name="Standard %"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm"></div>
            Custom: {(strategy.mceAllocationCustom * 100).toFixed(0)}% (initial)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            Standard: {((1 - strategy.mceAllocationCustom) * 100).toFixed(0)}% (initial)
          </span>
        </div>
      </div>

      {/* Action Summary */}
      {strategy.timedActions.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-blue-900 font-semibold mb-2">
                {strategy.timedActions.length} Timed Action{strategy.timedActions.length > 1 ? 's' : ''} Scheduled
              </p>
              <p className="text-blue-700 text-sm">
                The graphs above show how your parameters will change based on scheduled actions.
                Run the simulation to see the actual impact on your factory's performance.
              </p>
            </div>
          </div>
        </div>
      )}

      {strategy.timedActions.length === 0 && (
        <div className="bg-gray-50 border-l-4 border-gray-300 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <span className="text-2xl">ℹ️</span>
            <p className="text-gray-600 text-sm">
              No timed actions scheduled. Values will remain constant throughout the simulation.
              Add timed actions in the Timeline Editor to adjust parameters during the simulation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to calculate policy timeline
function calculatePolicyTimeline(strategy: Strategy): Array<{
  day: number;
  reorderPoint: number;
  orderQuantity: number;
  batchSize: number;
}> {
  const timeline: Array<{
    day: number;
    reorderPoint: number;
    orderQuantity: number;
    batchSize: number;
  }> = [];

  let currentReorderPoint = strategy.reorderPoint;
  let currentOrderQuantity = strategy.orderQuantity;
  let currentBatchSize = strategy.standardBatchSize;

  // Get all policy-related actions and sort by day
  const policyActions = strategy.timedActions
    .filter((a: StrategyAction) =>
      a.type === 'SET_REORDER_POINT' ||
      a.type === 'SET_ORDER_QUANTITY' ||
      a.type === 'ADJUST_BATCH_SIZE'
    )
    .sort((a: StrategyAction, b: StrategyAction) => a.day - b.day);

  // Sample every 10 days
  for (let day = 51; day <= 500; day += 10) {
    // Apply any actions that occur before or on this day
    policyActions.forEach((action: StrategyAction) => {
      if (action.day <= day) {
        if (action.type === 'SET_REORDER_POINT' && 'newReorderPoint' in action) {
          currentReorderPoint = action.newReorderPoint;
        } else if (action.type === 'SET_ORDER_QUANTITY' && 'newOrderQuantity' in action) {
          currentOrderQuantity = action.newOrderQuantity;
        } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
          currentBatchSize = action.newSize;
        }
      }
    });

    timeline.push({
      day,
      reorderPoint: currentReorderPoint,
      orderQuantity: currentOrderQuantity,
      batchSize: currentBatchSize,
    });
  }

  return timeline;
}

// Helper function to calculate price timeline
function calculatePriceTimeline(strategy: Strategy): Array<{
  day: number;
  standardPrice: number;
  customPrice: number;
}> {
  const timeline: Array<{
    day: number;
    standardPrice: number;
    customPrice: number;
  }> = [];

  let currentStandardPrice = strategy.standardPrice;
  let currentCustomPrice = strategy.customBasePrice;

  // Get all price actions and sort by day
  const priceActions = strategy.timedActions
    .filter((a: StrategyAction) => a.type === 'ADJUST_PRICE')
    .sort((a: StrategyAction, b: StrategyAction) => a.day - b.day);

  // Sample every 10 days
  for (let day = 51; day <= 500; day += 10) {
    // Apply any actions that occur before or on this day
    priceActions.forEach((action: StrategyAction) => {
      if (action.day <= day && action.type === 'ADJUST_PRICE' && 'productType' in action && 'newPrice' in action) {
        if (action.productType === 'standard') {
          currentStandardPrice = action.newPrice;
        } else if (action.productType === 'custom') {
          currentCustomPrice = action.newPrice;
        }
      }
    });

    timeline.push({
      day,
      standardPrice: currentStandardPrice,
      customPrice: currentCustomPrice,
    });
  }

  return timeline;
}

// Helper function to calculate allocation timeline
function calculateAllocationTimeline(strategy: Strategy): Array<{
  day: number;
  customAllocation: number;
  standardAllocation: number;
}> {
  const timeline: Array<{
    day: number;
    customAllocation: number;
    standardAllocation: number;
  }> = [];

  let currentCustomAllocation = strategy.mceAllocationCustom * 100;

  // Get all allocation actions and sort by day
  const allocationActions = strategy.timedActions
    .filter((a: StrategyAction) => a.type === 'ADJUST_MCE_ALLOCATION')
    .sort((a: StrategyAction, b: StrategyAction) => a.day - b.day);

  // Sample every 10 days
  for (let day = 51; day <= 500; day += 10) {
    // Apply any actions that occur before or on this day
    allocationActions.forEach((action: StrategyAction) => {
      if (action.day <= day && action.type === 'ADJUST_MCE_ALLOCATION' && 'newAllocation' in action) {
        currentCustomAllocation = action.newAllocation * 100;
      }
    });

    timeline.push({
      day,
      customAllocation: currentCustomAllocation,
      standardAllocation: 100 - currentCustomAllocation,
    });
  }

  return timeline;
}
