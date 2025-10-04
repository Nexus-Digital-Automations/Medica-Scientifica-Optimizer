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
        return `Take Loan: $${action.amount.toLocaleString()}`;
      case 'ORDER_MATERIALS':
        return `Order Materials: ${action.quantity.toLocaleString()} units`;
      case 'HIRE_ROOKIE':
        return `Hire ${action.count} Rookie${action.count > 1 ? 's' : ''}`;
      case 'BUY_MACHINE':
        return `Buy ${action.count} ${action.machineType} Machine${action.count > 1 ? 's' : ''}`;
      case 'SELL_MACHINE':
        return `Sell ${action.count} ${action.machineType} Machine${action.count > 1 ? 's' : ''}`;
      case 'ADJUST_PRICE':
        return `Adjust ${action.productType} price to $${action.newPrice}`;
      default:
        return 'Unknown Action';
    }
  };

  return (
    <div className="space-y-6">
      {/* Timeline Section */}
      <div className="bg-white rounded-2xl shadow-xl border-4 border-indigo-500 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-5 flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-black text-white flex items-center gap-3">
              <span className="text-4xl">📅</span> Action Timeline
            </h3>
            <p className="text-indigo-100 text-base mt-1 font-medium">Schedule strategic actions throughout the simulation</p>
          </div>
          <button
            onClick={handleAddAction}
            className="px-8 py-4 bg-white text-indigo-700 rounded-2xl font-black text-xl hover:bg-indigo-50 hover:scale-105 transition-all shadow-2xl"
          >
            + Add Action
          </button>
        </div>

        <div className="p-8">
          {/* Timeline Indicator */}
          <div className="flex items-center gap-4 text-base text-gray-700 font-bold mb-8">
            <span className="bg-indigo-100 px-6 py-3 rounded-xl border-2 border-indigo-500">Day 51</span>
            <div className="flex-1 h-2 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 rounded-full"></div>
            <span className="bg-pink-100 px-6 py-3 rounded-xl border-2 border-pink-500">Day 500</span>
          </div>

          {/* Actions List */}
          {strategy.timedActions.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border-4 border-dashed border-indigo-300">
              <div className="text-8xl mb-5">🗓️</div>
              <p className="text-gray-900 text-2xl font-black">No actions scheduled yet</p>
              <p className="text-gray-600 text-lg mt-3 font-semibold">Click "Add Action" to plan your first timed action</p>
            </div>
          ) : (
            <div className="space-y-4">
              {strategy.timedActions.map((action, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-2xl p-6 flex items-center justify-between border-4 border-gray-300 hover:border-indigo-500 hover:bg-white transition-all"
                >
                  <div className="flex items-center gap-6 flex-1">
                    <div className="text-5xl">{getActionIcon(action)}</div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-indigo-700 font-black bg-indigo-100 px-6 py-3 rounded-xl text-xl border-2 border-indigo-500">
                        Day {action.day}
                      </span>
                      <span className="text-gray-900 font-black text-xl">{getActionLabel(action)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditAction(index)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-base transition-all hover:scale-105 shadow-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAction(index)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-base transition-all hover:scale-105 shadow-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {strategy.timedActions.length > 0 && (
          <div className="border-t-4 border-indigo-300 bg-gray-50 px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-5 border-4 border-indigo-400 text-center shadow-lg">
                <p className="text-xs text-indigo-700 mb-2 font-black uppercase tracking-widest">Total Actions</p>
                <p className="text-gray-900 font-black text-4xl">{strategy.timedActions.length}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border-4 border-emerald-400 text-center shadow-lg">
                <p className="text-xs text-emerald-700 mb-2 font-black uppercase tracking-widest">Loans</p>
                <p className="text-gray-900 font-black text-4xl">
                  {strategy.timedActions.filter((a) => a.type === 'TAKE_LOAN').length}
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 border-4 border-amber-400 text-center shadow-lg">
                <p className="text-xs text-amber-700 mb-2 font-black uppercase tracking-widest">Hiring Events</p>
                <p className="text-gray-900 font-black text-4xl">
                  {strategy.timedActions.filter((a) => a.type === 'HIRE_ROOKIE').length}
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 border-4 border-cyan-400 text-center shadow-lg">
                <p className="text-xs text-cyan-700 mb-2 font-black uppercase tracking-widest">Material Orders</p>
                <p className="text-gray-900 font-black text-4xl">
                  {strategy.timedActions.filter((a) => a.type === 'ORDER_MATERIALS').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

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
