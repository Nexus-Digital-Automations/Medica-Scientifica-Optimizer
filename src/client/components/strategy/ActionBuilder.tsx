import { useState, useEffect } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { StrategyAction } from '../../types/ui.types';

interface ActionBuilderProps {
  editingIndex: number | null;
  onClose: () => void;
}

type ActionType = 'TAKE_LOAN' | 'PAY_DEBT' | 'ORDER_MATERIALS' | 'STOP_MATERIAL_ORDERS' | 'HIRE_ROOKIE' | 'HIRE_EXPERT' | 'BUY_MACHINE' | 'SELL_MACHINE' | 'ADJUST_PRICE' | 'ADJUST_BATCH_SIZE' | 'ADJUST_MCE_ALLOCATION';
type MachineType = 'MCE' | 'WMA' | 'PUC';
type ProductType = 'standard' | 'custom';
type ARCPType = 'standard' | 'custom';

export default function ActionBuilder({ editingIndex, onClose }: ActionBuilderProps) {
  const { strategy, addTimedAction, updateTimedAction } = useStrategyStore();

  const existingAction = editingIndex !== null ? strategy.timedActions[editingIndex] : null;

  const [day, setDay] = useState(existingAction?.day || 100);
  const [actionType, setActionType] = useState<ActionType>(() => {
    const type = existingAction?.type;
    if (type && ['TAKE_LOAN', 'PAY_DEBT', 'ORDER_MATERIALS', 'STOP_MATERIAL_ORDERS', 'HIRE_ROOKIE', 'HIRE_EXPERT', 'BUY_MACHINE', 'SELL_MACHINE', 'ADJUST_PRICE', 'ADJUST_BATCH_SIZE', 'ADJUST_MCE_ALLOCATION'].includes(type)) {
      return type as ActionType;
    }
    return 'TAKE_LOAN';
  });

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
  const [debtPaymentAmount, setDebtPaymentAmount] = useState(() =>
    existingAction && 'amount' in existingAction ? existingAction.amount : 10000
  );
  const [expertCount, setExpertCount] = useState(() =>
    existingAction && 'count' in existingAction ? existingAction.count : 1
  );
  const [newBatchSize, setNewBatchSize] = useState(() =>
    existingAction && 'batchSize' in existingAction ? existingAction.batchSize : 50
  );
  const [newMCEAllocation, setNewMCEAllocation] = useState(() =>
    existingAction && 'standardAllocation' in existingAction ? existingAction.standardAllocation : 50
  );
  const [arcpType, setArcpType] = useState<ARCPType>(() =>
    existingAction && 'arcpType' in existingAction ? (existingAction.arcpType as ARCPType) : 'standard'
  );

  // Update action type when editing different action
  useEffect(() => {
    if (existingAction && ['TAKE_LOAN', 'PAY_DEBT', 'ORDER_MATERIALS', 'STOP_MATERIAL_ORDERS', 'HIRE_ROOKIE', 'HIRE_EXPERT', 'BUY_MACHINE', 'SELL_MACHINE', 'ADJUST_PRICE', 'ADJUST_BATCH_SIZE', 'ADJUST_MCE_ALLOCATION'].includes(existingAction.type)) {
      setActionType(existingAction.type as ActionType);
    }
  }, [existingAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let action: StrategyAction;

    switch (actionType) {
      case 'TAKE_LOAN':
        action = { day, type: 'TAKE_LOAN', amount: loanAmount };
        break;
      case 'PAY_DEBT':
        action = { day, type: 'PAY_DEBT', amount: debtPaymentAmount };
        break;
      case 'ORDER_MATERIALS':
        action = { day, type: 'ORDER_MATERIALS', quantity: materialQuantity };
        break;
      case 'STOP_MATERIAL_ORDERS':
        action = { day, type: 'STOP_MATERIAL_ORDERS' };
        break;
      case 'HIRE_ROOKIE':
        action = { day, type: 'HIRE_ROOKIE', count: rookieCount };
        break;
      case 'HIRE_EXPERT':
        action = { day, type: 'HIRE_EXPERT', count: expertCount };
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
      case 'ADJUST_BATCH_SIZE':
        action = { day, type: 'ADJUST_BATCH_SIZE', arcpType, batchSize: newBatchSize };
        break;
      case 'ADJUST_MCE_ALLOCATION':
        action = { day, type: 'ADJUST_MCE_ALLOCATION', standardAllocation: newMCEAllocation };
        break;
      default:
        // TypeScript exhaustiveness check - should never reach here
        action = { day, type: 'TAKE_LOAN', amount: loanAmount };
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
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl border border-gray-200">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {editingIndex !== null ? 'Edit Action' : 'Add Timed Action'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Day Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Day (51-500)
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="51"
                max="500"
                required
              />
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ActionType)}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="TAKE_LOAN">💰 Take Loan</option>
                <option value="PAY_DEBT">💳 Pay Debt</option>
                <option value="ORDER_MATERIALS">📦 Order Materials</option>
                <option value="STOP_MATERIAL_ORDERS">🛑 Stop Material Orders</option>
                <option value="HIRE_ROOKIE">👷 Hire Rookies</option>
                <option value="HIRE_EXPERT">👨‍🔬 Hire Experts</option>
                <option value="BUY_MACHINE">🏭 Buy Machine</option>
                <option value="SELL_MACHINE">💸 Sell Machine</option>
                <option value="ADJUST_PRICE">💵 Adjust Price</option>
                <option value="ADJUST_BATCH_SIZE">📊 Adjust Batch Size</option>
                <option value="ADJUST_MCE_ALLOCATION">⚙️ Adjust MCE Allocation</option>
              </select>
            </div>

            {/* Conditional Fields Based on Action Type */}
            {actionType === 'TAKE_LOAN' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Amount ($)
                </label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="10000"
                  max="500000"
                  step="10000"
                  required
                />
              </div>
            )}

            {actionType === 'ORDER_MATERIALS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (units)
                </label>
                <input
                  type="number"
                  value={materialQuantity}
                  onChange={(e) => setMaterialQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="100"
                  max="5000"
                  step="100"
                  required
                />
              </div>
            )}

            {actionType === 'HIRE_ROOKIE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Rookies
                </label>
                <input
                  type="number"
                  value={rookieCount}
                  onChange={(e) => setRookieCount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="10"
                  required
                />
              </div>
            )}

            {(actionType === 'BUY_MACHINE' || actionType === 'SELL_MACHINE') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Machine Type
                  </label>
                  <select
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value as MachineType)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MCE">MCE (Station 1)</option>
                    <option value="WMA">WMA (Station 2)</option>
                    <option value="PUC">PUC (Station 3)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Count
                  </label>
                  <input
                    type="number"
                    value={machineCount}
                    onChange={(e) => setMachineCount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Type
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="standard">Standard Product</option>
                    <option value="custom">Custom Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Price ($)
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="400"
                    max="1200"
                    step="10"
                    required
                  />
                </div>
              </>
            )}

            {actionType === 'PAY_DEBT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount ($)
                </label>
                <input
                  type="number"
                  value={debtPaymentAmount}
                  onChange={(e) => setDebtPaymentAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1000"
                  max="100000"
                  step="1000"
                  required
                />
              </div>
            )}

            {actionType === 'HIRE_EXPERT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Experts
                </label>
                <input
                  type="number"
                  value={expertCount}
                  onChange={(e) => setExpertCount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="5"
                  required
                />
              </div>
            )}

            {actionType === 'ADJUST_BATCH_SIZE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ARCP Type
                  </label>
                  <select
                    value={arcpType}
                    onChange={(e) => setArcpType(e.target.value as ARCPType)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="standard">Standard ARCP</option>
                    <option value="custom">Custom ARCP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Batch Size
                  </label>
                  <input
                    type="number"
                    value={newBatchSize}
                    onChange={(e) => setNewBatchSize(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="10"
                    max="200"
                    step="5"
                    required
                  />
                </div>
              </>
            )}

            {actionType === 'ADJUST_MCE_ALLOCATION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Standard Allocation (%) - Custom will be 100 - this value
                </label>
                <input
                  type="number"
                  value={newMCEAllocation}
                  onChange={(e) => setNewMCEAllocation(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="100"
                  step="5"
                  required
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition-colors"
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
