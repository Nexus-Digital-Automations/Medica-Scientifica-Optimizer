import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import ActionBuilder from './ActionBuilder';
import DayActionSelector from './DayActionSelector';
import type { StrategyAction } from '../../types/ui.types';

export default function TimelineEditor() {
  const { strategy, removeTimedAction, toggleTimedActionLock } = useStrategyStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddAction = () => {
    setIsAddModalOpen(true);
  };

  const handleEditAction = (index: number) => {
    setEditingIndex(index);
    setIsEditModalOpen(true);
  };

  const handleDeleteAction = (index: number) => {
    if (confirm('Are you sure you want to delete this action?')) {
      removeTimedAction(index);
    }
  };

  const handleToggleLock = (index: number) => {
    toggleTimedActionLock(index);
  };

  const getActionIcon = (action: StrategyAction) => {
    switch (action.type) {
      case 'TAKE_LOAN':
        return '💰';
      case 'PAY_DEBT':
        return '💳';
      case 'ORDER_MATERIALS':
        return '📦';
      case 'STOP_MATERIAL_ORDERS':
        return '🛑';
      case 'HIRE_ROOKIE':
        return '👷';
      case 'FIRE_EMPLOYEE':
        return '🚪';
      case 'BUY_MACHINE':
        return '🏭';
      case 'SELL_MACHINE':
        return '💸';
      case 'ADJUST_PRICE':
        return '💵';
      case 'ADJUST_BATCH_SIZE':
        return '📊';
      case 'ADJUST_MCE_ALLOCATION':
        return '⚙️';
      case 'SET_REORDER_POINT':
        return '📍';
      case 'SET_ORDER_QUANTITY':
        return '📏';
      default:
        return '📌';
    }
  };

  const getActionLabel = (action: StrategyAction) => {
    switch (action.type) {
      case 'TAKE_LOAN':
        return `Take Loan: $${action.amount.toLocaleString()}`;
      case 'PAY_DEBT':
        return `Pay Debt: $${action.amount.toLocaleString()}`;
      case 'ORDER_MATERIALS':
        return `Order Materials: ${action.quantity.toLocaleString()} units`;
      case 'STOP_MATERIAL_ORDERS':
        return 'Stop Material Orders';
      case 'HIRE_ROOKIE':
        return `Hire ${action.count} Rookie${action.count > 1 ? 's' : ''}`;
      case 'FIRE_EMPLOYEE':
        return `Fire ${action.count} ${action.employeeType}${action.count > 1 ? 's' : ''}`;
      case 'BUY_MACHINE':
        return `Buy ${action.count} ${action.machineType} Machine${action.count > 1 ? 's' : ''}`;
      case 'SELL_MACHINE':
        return `Sell ${action.count} ${action.machineType} Machine${action.count > 1 ? 's' : ''}`;
      case 'ADJUST_PRICE':
        return `Adjust ${action.productType} price to $${action.newPrice}`;
      case 'ADJUST_BATCH_SIZE':
        return `Adjust standard batch size to ${action.newSize}`;
      case 'ADJUST_MCE_ALLOCATION': {
        const customPct = (action.newAllocation * 100).toFixed(0);
        const standardPct = (100 - action.newAllocation * 100).toFixed(0);
        return `Adjust MCE allocation: ${standardPct}% standard / ${customPct}% custom`;
      }
      case 'SET_REORDER_POINT':
        return `Set reorder point to ${action.newReorderPoint} units`;
      case 'SET_ORDER_QUANTITY':
        return `Set order quantity to ${action.newOrderQuantity} units`;
      default:
        return 'Unknown Action';
    }
  };

  return (
    <div className="space-y-6">
      {/* Timeline Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📅</span> Action Timeline
            </h3>
            <p className="text-gray-600 text-sm mt-1">Schedule strategic actions throughout the simulation</p>
          </div>
          <button
            onClick={handleAddAction}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add User Actions
          </button>
        </div>

        <div className="p-6">
          {/* Timeline Indicator */}
          <div className="flex items-center gap-4 text-sm text-gray-700 mb-6">
            <span className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">Day 51</span>
            <div className="flex-1 h-1 bg-gray-200 rounded-full"></div>
            <span className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">Day 415</span>
          </div>

          {/* Actions List */}
          {strategy.timedActions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-4xl mb-3">🗓️</div>
              <p className="text-gray-900 text-lg font-semibold">No actions scheduled yet</p>
              <p className="text-gray-600 text-sm mt-1">Click "Add Action" to plan your first timed action</p>
            </div>
          ) : (
            <div className="space-y-3">
              {strategy.timedActions.map((action, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-4 flex items-center justify-between border-2 transition-all ${
                    action.isLocked
                      ? 'bg-red-50 border-red-300 hover:border-red-400'
                      : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-2xl">{getActionIcon(action)}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-blue-700 font-medium bg-blue-50 px-3 py-1 rounded-lg text-sm border border-blue-200">
                        Day {action.day}
                      </span>
                      <span className="text-gray-900 font-medium text-sm">{getActionLabel(action)}</span>
                      {action.isLocked && (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold">
                          🔒 LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleLock(index)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        action.isLocked
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                      title={action.isLocked ? 'Unlock action (allow optimizer to modify)' : 'Lock action (prevent optimizer from modifying)'}
                    >
                      {action.isLocked ? '🔓 Unlock' : '🔒 Lock'}
                    </button>
                    <button
                      onClick={() => handleEditAction(index)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAction(index)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
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
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Total Actions</p>
                <p className="text-gray-900 font-semibold text-2xl">{strategy.timedActions.length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Loans</p>
                <p className="text-gray-900 font-semibold text-2xl">
                  {strategy.timedActions.filter((a) => a.type === 'TAKE_LOAN').length}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Hiring Events</p>
                <p className="text-gray-900 font-semibold text-2xl">
                  {strategy.timedActions.filter((a) => a.type === 'HIRE_ROOKIE').length}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium uppercase">Material Orders</p>
                <p className="text-gray-900 font-semibold text-2xl">
                  {strategy.timedActions.filter((a) => a.type === 'ORDER_MATERIALS').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day Action Selector Modal - for adding new actions */}
      {isAddModalOpen && (
        <DayActionSelector
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Action Builder Modal - for editing existing actions */}
      {isEditModalOpen && (
        <ActionBuilder
          editingIndex={editingIndex}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
}
