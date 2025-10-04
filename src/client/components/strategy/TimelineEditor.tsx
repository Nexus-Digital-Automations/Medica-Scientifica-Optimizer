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
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-3xl border border-indigo-400/30 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="text-3xl">📅</span> Action Timeline
            </h3>
            <p className="text-indigo-100 text-sm mt-1">Schedule strategic actions throughout the simulation</p>
          </div>
          <button
            onClick={handleAddAction}
            className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-base hover:bg-indigo-50 hover:scale-105 transition-all shadow-xl"
          >
            + Add Action
          </button>
        </div>

        <div className="p-8">
          {/* Timeline Indicator */}
          <div className="flex items-center gap-4 text-sm text-white/60 font-bold mb-8">
            <span className="bg-indigo-500/20 px-4 py-2 rounded-lg">Day 51</span>
            <div className="flex-1 h-1 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 rounded-full"></div>
            <span className="bg-pink-500/20 px-4 py-2 rounded-lg">Day 500</span>
          </div>

          {/* Actions List */}
          {strategy.timedActions.length === 0 ? (
            <div className="text-center py-16 bg-white/5 rounded-2xl border-2 border-dashed border-indigo-400/30">
              <div className="text-7xl mb-4">🗓️</div>
              <p className="text-white text-lg font-bold">No actions scheduled yet</p>
              <p className="text-indigo-300 text-base mt-2">Click "Add Action" to plan your first timed action</p>
            </div>
          ) : (
            <div className="space-y-4">
              {strategy.timedActions.map((action, index) => (
                <div
                  key={index}
                  className="bg-white/5 backdrop-blur rounded-2xl p-6 flex items-center justify-between border-2 border-white/10 hover:border-indigo-400/50 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-6 flex-1">
                    <div className="text-4xl group-hover:scale-110 transition-transform">{getActionIcon(action)}</div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-indigo-300 font-black bg-indigo-500/20 px-5 py-2.5 rounded-xl text-base border border-indigo-400/30">
                        Day {action.day}
                      </span>
                      <span className="text-white font-bold text-lg">{getActionLabel(action)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditAction(index)}
                      className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all hover:scale-105 shadow-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAction(index)}
                      className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all hover:scale-105 shadow-lg"
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
          <div className="border-t border-indigo-400/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 text-center">
                <p className="text-xs text-indigo-300 mb-2 font-bold uppercase tracking-wider">Total Actions</p>
                <p className="text-white font-black text-3xl">{strategy.timedActions.length}</p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 text-center">
                <p className="text-xs text-emerald-300 mb-2 font-bold uppercase tracking-wider">Loans</p>
                <p className="text-white font-black text-3xl">
                  {strategy.timedActions.filter((a) => a.type === 'TAKE_LOAN').length}
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 text-center">
                <p className="text-xs text-amber-300 mb-2 font-bold uppercase tracking-wider">Hiring Events</p>
                <p className="text-white font-black text-3xl">
                  {strategy.timedActions.filter((a) => a.type === 'HIRE_ROOKIE').length}
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 text-center">
                <p className="text-xs text-cyan-300 mb-2 font-bold uppercase tracking-wider">Material Orders</p>
                <p className="text-white font-black text-3xl">
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
