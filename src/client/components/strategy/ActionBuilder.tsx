import { useState, useEffect } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { StrategyAction } from '../../types/ui.types';

interface ActionBuilderProps {
  editingIndex: number | null;
  onClose: () => void;
}

type ActionType = 'TAKE_LOAN' | 'ORDER_MATERIALS' | 'HIRE_ROOKIE' | 'BUY_MACHINE' | 'SELL_MACHINE' | 'ADJUST_PRICE';
type MachineType = 'MCE' | 'WMA' | 'PUC';
type ProductType = 'standard' | 'custom';

export default function ActionBuilder({ editingIndex, onClose }: ActionBuilderProps) {
  const { strategy, addTimedAction, updateTimedAction } = useStrategyStore();

  const existingAction = editingIndex !== null ? strategy.timedActions[editingIndex] : null;

  const [day, setDay] = useState(existingAction?.day || 100);
  const [actionType, setActionType] = useState<ActionType>(existingAction?.type || 'TAKE_LOAN');

  // Action-specific fields
  const [loanAmount, setLoanAmount] = useState(() =>
    existingAction && 'amount' in existingAction ? existingAction.amount : 50000
  );
  const [materialQuantity, setMaterialQuantity] = useState(() =>
    existingAction && 'quantity' in existingAction ? existingAction.quantity : 500
  );
  const [rookieCount, setRookieCount] = useState(() =>
    existingAction && 'count' in existingAction ? existingAction.count : 2
  );
  const [machineType, setMachineType] = useState<MachineType>(() =>
    existingAction && 'machineType' in existingAction ? (existingAction.machineType as MachineType) : 'MCE'
  );
  const [machineCount, setMachineCount] = useState(() =>
    existingAction && 'count' in existingAction ? existingAction.count : 1
  );
  const [productType, setProductType] = useState<ProductType>(() =>
    existingAction && 'productType' in existingAction ? (existingAction.productType as ProductType) : 'standard'
  );
  const [newPrice, setNewPrice] = useState(() =>
    existingAction && 'newPrice' in existingAction ? existingAction.newPrice : 800
  );

  // Update action type when editing different action
  useEffect(() => {
    if (existingAction) {
      setActionType(existingAction.type as ActionType);
    }
  }, [existingAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let action: StrategyAction = { day, type: actionType };

    switch (actionType) {
      case 'TAKE_LOAN':
        action = { day, type: 'TAKE_LOAN', amount: loanAmount };
        break;
      case 'ORDER_MATERIALS':
        action = { day, type: 'ORDER_MATERIALS', quantity: materialQuantity };
        break;
      case 'HIRE_ROOKIE':
        action = { day, type: 'HIRE_ROOKIE', count: rookieCount };
        break;
      case 'BUY_MACHINE':
        action = { day, type: 'BUY_MACHINE', machineType, count: machineCount };
        break;
      case 'SELL_MACHINE':
        action = { day, type: 'SELL_MACHINE', machineType, count: machineCount };
        break;
      case 'ADJUST_PRICE':
        action = { day, type: 'ADJUST_PRICE', productType, newPrice };
        break;
    }

    if (editingIndex !== null) {
      updateTimedAction(editingIndex, action);
    } else {
      addTimedAction(action);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full shadow-2xl border border-gray-700">
        <div className="p-6">
          <h3 className="text-2xl font-bold text-white mb-4">
            {editingIndex !== null ? 'Edit Action' : 'Add Timed Action'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Day Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Day (51-500)
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="51"
                max="500"
                required
              />
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Action Type
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ActionType)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TAKE_LOAN">💰 Take Loan</option>
                <option value="ORDER_MATERIALS">📦 Order Materials</option>
                <option value="HIRE_ROOKIE">👷 Hire Rookies</option>
                <option value="BUY_MACHINE">🏭 Buy Machine</option>
                <option value="SELL_MACHINE">💸 Sell Machine</option>
                <option value="ADJUST_PRICE">💵 Adjust Price</option>
              </select>
            </div>

            {/* Conditional Fields Based on Action Type */}
            {actionType === 'TAKE_LOAN' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Loan Amount ($)
                </label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="10000"
                  max="500000"
                  step="10000"
                  required
                />
              </div>
            )}

            {actionType === 'ORDER_MATERIALS' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantity (units)
                </label>
                <input
                  type="number"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="100"
                  max="5000"
                  step="100"
                  required
                />
              </div>
            )}

            {actionType === 'HIRE_ROOKIE' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Rookies
                </label>
                <input
                  type="number"
                  value={rookieCount}
                  onChange={(e) => setRookieCount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="10"
                  required
                />
              </div>
            )}

            {(actionType === 'BUY_MACHINE' || actionType === 'SELL_MACHINE') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Machine Type
                  </label>
                  <select
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value as MachineType)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="MCE">MCE (Station 1)</option>
                    <option value="WMA">WMA (Station 2)</option>
                    <option value="PUC">PUC (Station 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Count
                  </label>
                  <input
                    type="number"
                    value={machineCount}
                    onChange={(e) => setMachineCount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    max="5"
                    required
                  />
                </div>
              </>
            )}

            {actionType === 'ADJUST_PRICE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Product Type
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="standard">Standard Product</option>
                    <option value="custom">Custom Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Price ($)
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="400"
                    max="1200"
                    step="10"
                    required
                  />
                </div>
              </>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {editingIndex !== null ? 'Update' : 'Add'} Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
