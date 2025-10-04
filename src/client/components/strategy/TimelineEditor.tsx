import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import ActionBuilder from './ActionBuilder';
import type { StrategyAction } from '../../types/ui.types';

export default function TimelineEditor() {
  const { strategy, removeTimedAction } = useStrategyStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddAction = () => {
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEditAction = (index: number) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleDeleteAction = (index: number) => {
    if (confirm('Are you sure you want to delete this action?')) {
      removeTimedAction(index);
    }
  };

  const getActionIcon = (action: StrategyAction) => {
    switch (action.type) {
      case 'TAKE_LOAN':
        return '💰';
      case 'ORDER_MATERIALS':
        return '📦';
      case 'HIRE_ROOKIE':
        return '👷';
      case 'BUY_MACHINE':
        return '🏭';
      case 'SELL_MACHINE':
        return '💸';
      case 'ADJUST_PRICE':
        return '💵';
      default:
        return '📌';
    }
  };

  const getActionLabel = (action: StrategyAction) => {
    switch (action.type) {
      case 'TAKE_LOAN':
        return `Take Loan: $${('amount' in action ? action.amount : 0).toLocaleString()}`;
      case 'ORDER_MATERIALS':
        return `Order Materials: ${'quantity' in action ? action.quantity : 0} units`;
      case 'HIRE_ROOKIE':
        return `Hire Rookies: ${'count' in action ? action.count : 0} workers`;
      case 'BUY_MACHINE':
        return `Buy Machine: ${'machineType' in action ? action.machineType : ''}`;
      case 'SELL_MACHINE':
        return `Sell Machine: ${'machineType' in action ? action.machineType : ''}`;
      case 'ADJUST_PRICE':
        return `Adjust Price: ${'productType' in action ? action.productType : ''} → $${'newPrice' in action ? action.newPrice : 0}`;
      default:
        return 'Unknown Action';
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline Visual */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">📅 Action Timeline</h3>
          <button
            onClick={handleAddAction}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Action
          </button>
        </div>

        {/* Timeline Header */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
          <span>Day 51</span>
          <div className="flex-1 h-px bg-gray-700"></div>
          <span>Day 500</span>
        </div>

        {/* Actions List */}
        {strategy.timedActions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No actions scheduled yet.</p>
            <p className="text-sm mt-2">Click "Add Action" to plan your first timed action.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {strategy.timedActions.map((action, index) => (
              <div
                key={index}
                className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl">{getActionIcon(action)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-400 font-semibold">
                        Day {action.day}
                      </span>
                      <span className="text-white">{getActionLabel(action)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditAction(index)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAction(index)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Summary */}
      {strategy.timedActions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Total Actions</p>
              <p className="text-white font-semibold text-lg">{strategy.timedActions.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Loans</p>
              <p className="text-white font-semibold text-lg">
                {strategy.timedActions.filter((a) => a.type === 'TAKE_LOAN').length}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Hiring Events</p>
              <p className="text-white font-semibold text-lg">
                {strategy.timedActions.filter((a) => a.type === 'HIRE_ROOKIE').length}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Material Orders</p>
              <p className="text-white font-semibold text-lg">
                {strategy.timedActions.filter((a) => a.type === 'ORDER_MATERIALS').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Builder Modal */}
      {isModalOpen && (
        <ActionBuilder
          editingIndex={editingIndex}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
