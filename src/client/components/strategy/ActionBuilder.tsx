import { useState, useEffect } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { StrategyAction } from '../../types/ui.types';
import FormulaPopup from '../common/FormulaPopup';

interface ActionBuilderProps {
  editingIndex: number | null;
  onClose: () => void;
}

type ActionType = 'TAKE_LOAN' | 'PAY_DEBT' | 'ORDER_MATERIALS' | 'STOP_MATERIAL_ORDERS' | 'HIRE_ROOKIE' | 'FIRE_EMPLOYEE' | 'BUY_MACHINE' | 'SELL_MACHINE' | 'ADJUST_PRICE' | 'ADJUST_BATCH_SIZE' | 'ADJUST_MCE_ALLOCATION' | 'SET_REORDER_POINT' | 'SET_ORDER_QUANTITY';
type MachineType = 'MCE' | 'WMA' | 'PUC';
type ProductType = 'standard' | 'custom';
type EmployeeType = 'expert' | 'rookie';

export default function ActionBuilder({ editingIndex, onClose }: ActionBuilderProps) {
  const { strategy, addTimedAction, updateTimedAction } = useStrategyStore();

  const existingAction = editingIndex !== null ? strategy.timedActions[editingIndex] : null;

  const [day, setDay] = useState<number | ''>(existingAction?.day ?? '');
  const [actionType, setActionType] = useState<ActionType>(() => {
    const type = existingAction?.type;
    const validTypes = ['TAKE_LOAN', 'PAY_DEBT', 'ORDER_MATERIALS', 'STOP_MATERIAL_ORDERS', 'HIRE_ROOKIE', 'FIRE_EMPLOYEE', 'BUY_MACHINE', 'SELL_MACHINE', 'ADJUST_PRICE', 'ADJUST_BATCH_SIZE', 'ADJUST_MCE_ALLOCATION', 'SET_REORDER_POINT', 'SET_ORDER_QUANTITY'];
    if (type && validTypes.includes(type)) {
      return type as ActionType;
    }
    return 'SET_REORDER_POINT';
  });

  // Action-specific fields (empty by default = "no changes")
  const [loanAmount, setLoanAmount] = useState<number | ''>(
    existingAction && 'amount' in existingAction ? existingAction.amount : ''
  );
  const [materialQuantity, setMaterialQuantity] = useState<number | ''>(
    existingAction && 'quantity' in existingAction ? existingAction.quantity : ''
  );
  const [rookieCount, setRookieCount] = useState<number | ''>(
    existingAction && 'count' in existingAction ? existingAction.count : ''
  );
  const [machineType, setMachineType] = useState<MachineType>(() =>
    existingAction && 'machineType' in existingAction ? (existingAction.machineType as MachineType) : 'MCE'
  );
  const [machineCount, setMachineCount] = useState<number | ''>(
    existingAction && 'count' in existingAction ? existingAction.count : ''
  );
  const [productType, setProductType] = useState<ProductType>(() =>
    existingAction && 'productType' in existingAction ? (existingAction.productType as ProductType) : 'standard'
  );
  const [newPrice, setNewPrice] = useState<number | ''>(
    existingAction && 'newPrice' in existingAction ? existingAction.newPrice : ''
  );
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<number | ''>(
    existingAction && 'amount' in existingAction ? existingAction.amount : ''
  );
  const [newBatchSize, setNewBatchSize] = useState<number | ''>(
    existingAction && 'newSize' in existingAction ? existingAction.newSize : ''
  );
  const [newMCEAllocation, setNewMCEAllocation] = useState<number | ''>(
    existingAction && 'newAllocation' in existingAction ? existingAction.newAllocation * 100 : ''
  );

  // New action fields
  const [fireEmployeeType, setFireEmployeeType] = useState<EmployeeType>(() =>
    existingAction && 'employeeType' in existingAction ? (existingAction.employeeType as EmployeeType) : 'expert'
  );
  const [fireEmployeeCount, setFireEmployeeCount] = useState<number | ''>(
    existingAction && 'count' in existingAction && existingAction.type === 'FIRE_EMPLOYEE' ? existingAction.count : ''
  );
  const [reorderPoint, setReorderPoint] = useState<number | ''>(
    existingAction && 'newReorderPoint' in existingAction ? existingAction.newReorderPoint : ''
  );
  const [orderQuantity, setOrderQuantity] = useState<number | ''>(
    existingAction && 'newOrderQuantity' in existingAction ? existingAction.newOrderQuantity : ''
  );

  // Update action type when editing different action
  useEffect(() => {
    const validTypes = ['TAKE_LOAN', 'PAY_DEBT', 'ORDER_MATERIALS', 'STOP_MATERIAL_ORDERS', 'HIRE_ROOKIE', 'FIRE_EMPLOYEE', 'BUY_MACHINE', 'SELL_MACHINE', 'ADJUST_PRICE', 'ADJUST_BATCH_SIZE', 'ADJUST_MCE_ALLOCATION', 'SET_REORDER_POINT', 'SET_ORDER_QUANTITY'];
    if (existingAction && validTypes.includes(existingAction.type)) {
      setActionType(existingAction.type as ActionType);
    }
  }, [existingAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let action: StrategyAction;
    const dayNum = Number(day);

    switch (actionType) {
      case 'TAKE_LOAN':
        action = { day: dayNum, type: 'TAKE_LOAN', amount: Number(loanAmount) };
        break;
      case 'PAY_DEBT':
        action = { day: dayNum, type: 'PAY_DEBT', amount: Number(debtPaymentAmount) };
        break;
      case 'ORDER_MATERIALS':
        action = { day: dayNum, type: 'ORDER_MATERIALS', quantity: Number(materialQuantity) };
        break;
      case 'STOP_MATERIAL_ORDERS':
        action = { day: dayNum, type: 'STOP_MATERIAL_ORDERS' };
        break;
      case 'HIRE_ROOKIE':
        action = { day: dayNum, type: 'HIRE_ROOKIE', count: Number(rookieCount) };
        break;
      case 'BUY_MACHINE':
        action = { day: dayNum, type: 'BUY_MACHINE', machineType, count: Number(machineCount) };
        break;
      case 'SELL_MACHINE':
        action = { day: dayNum, type: 'SELL_MACHINE', machineType, count: Number(machineCount) };
        break;
      case 'ADJUST_PRICE':
        action = { day: dayNum, type: 'ADJUST_PRICE', productType, newPrice: Number(newPrice) };
        break;
      case 'ADJUST_BATCH_SIZE':
        action = { day: dayNum, type: 'ADJUST_BATCH_SIZE', newSize: Number(newBatchSize) };
        break;
      case 'ADJUST_MCE_ALLOCATION':
        action = { day: dayNum, type: 'ADJUST_MCE_ALLOCATION', newAllocation: Number(newMCEAllocation) / 100 };
        break;
      case 'FIRE_EMPLOYEE':
        action = { day: dayNum, type: 'FIRE_EMPLOYEE', employeeType: fireEmployeeType, count: Number(fireEmployeeCount) };
        break;
      case 'SET_REORDER_POINT':
        action = { day: dayNum, type: 'SET_REORDER_POINT', newReorderPoint: Number(reorderPoint) };
        break;
      case 'SET_ORDER_QUANTITY':
        action = { day: dayNum, type: 'SET_ORDER_QUANTITY', newOrderQuantity: Number(orderQuantity) };
        break;
      default:
        // TypeScript exhaustiveness check - should never reach here
        action = { day: dayNum, type: 'SET_REORDER_POINT', newReorderPoint: Number(reorderPoint) };
        break;
    }

    if (editingIndex !== null) {
      updateTimedAction(editingIndex, action);
    } else {
      addTimedAction(action);
    }

    onClose();
  };

  const policyActions = [
    { type: 'SET_REORDER_POINT' as const, icon: '📍', label: 'Set Reorder Point' },
    { type: 'SET_ORDER_QUANTITY' as const, icon: '📏', label: 'Set Order Quantity' },
    { type: 'ADJUST_BATCH_SIZE' as const, icon: '📊', label: 'Adjust Batch Size' },
    { type: 'ADJUST_PRICE' as const, icon: '💵', label: 'Adjust Price' },
    { type: 'ADJUST_MCE_ALLOCATION' as const, icon: '⚙️', label: 'Adjust MCE Allocation' },
  ];

  const oneTimeActions = [
    { type: 'TAKE_LOAN' as const, icon: '💰', label: 'Take Loan' },
    { type: 'PAY_DEBT' as const, icon: '💳', label: 'Pay Debt' },
    { type: 'ORDER_MATERIALS' as const, icon: '📦', label: 'Order Materials' },
    { type: 'STOP_MATERIAL_ORDERS' as const, icon: '🛑', label: 'Stop Material Orders' },
    { type: 'HIRE_ROOKIE' as const, icon: '👷', label: 'Hire Rookies' },
    { type: 'FIRE_EMPLOYEE' as const, icon: '🚪', label: 'Fire Employees' },
    { type: 'BUY_MACHINE' as const, icon: '🏭', label: 'Buy Machine' },
    { type: 'SELL_MACHINE' as const, icon: '💸', label: 'Sell Machine' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {editingIndex !== null ? 'Edit User Action' : 'Add User Action'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Day Input */}
            <div>
              <label htmlFor="action-day" className="block text-sm font-medium text-gray-700 mb-2">
                Day (51-500) - When should this action take place?
              </label>
              <input
                id="action-day"
                type="number"
                value={day}
                onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="51"
                max="500"
                placeholder="Enter day number"
                required
              />
            </div>

            {/* Two Column Action Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Policy Decisions Column */}
              <div className="border-r border-gray-200 pr-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">📋 Policy Decisions</h4>
                <div className="space-y-2">
                  {policyActions.map((action) => (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => setActionType(action.type)}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                        actionType === action.type
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="text-lg mr-2">{action.icon}</span>
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* One-Time Actions Column */}
              <div className="pl-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">⚡ One-Time Actions</h4>
                <div className="space-y-2">
                  {oneTimeActions.map((action) => (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => setActionType(action.type)}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                        actionType === action.type
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="text-lg mr-2">{action.icon}</span>
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                  onChange={(e) => setLoanAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  step="1000"
                  placeholder="Enter loan amount"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Commission: 2% on loan amount</p>
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
                  onChange={(e) => setMaterialQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  step="1"
                  placeholder="Enter quantity"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Cost: $50/part + $1,000 order fee | Lead time: 4 days</p>
              </div>
            )}

            {actionType === 'HIRE_ROOKIE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  Number of Rookies
                  <FormulaPopup actionType="HIRE_ROOKIE" day={Number(day) || 51} />
                </label>
                <input
                  type="number"
                  value={rookieCount}
                  onChange={(e) => setRookieCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  placeholder="Number of rookies to hire"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Salary: $85/day | Training: 15 days → Expert ($150/day) | Productivity: 40% during training</p>
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
                    <option value="MCE">MCE (Station 1) - Buy: $20k, Sell: $10k</option>
                    <option value="WMA">WMA (Station 2) - Buy: $15k, Sell: $7.5k</option>
                    <option value="PUC">PUC (Station 3) - Buy: $12k, Sell: $4k</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Count
                    {actionType === 'BUY_MACHINE' && <FormulaPopup actionType="BUY_MACHINE" day={Number(day) || 51} />}
                  </label>
                  <input
                    type="number"
                    value={machineCount}
                    onChange={(e) => setMachineCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    placeholder="Number of machines"
                    required
                  />
                  {actionType === 'SELL_MACHINE' && (
                    <p className="text-xs text-gray-500 mt-1">⚠️ At least 1 machine must remain at each station</p>
                  )}
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
                    <option value="custom">Custom Product Base Price</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    New Price ($)
                    <FormulaPopup actionType="ADJUST_PRICE" day={Number(day) || 51} />
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter new price"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">💡 Price affects demand (higher price = lower demand)</p>
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
                  onChange={(e) => setDebtPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0.01"
                  step="100"
                  placeholder="Enter payment amount"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Interest rate: 36.5% annual (0.1% daily)</p>
              </div>
            )}

            {actionType === 'ADJUST_BATCH_SIZE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  New Standard Batch Size
                  <FormulaPopup actionType="ADJUST_BATCH_SIZE" day={Number(day) || 51} />
                </label>
                <input
                  type="number"
                  value={newBatchSize}
                  onChange={(e) => setNewBatchSize(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  step="1"
                  placeholder="Enter batch size"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Current default: 60 units | Affects production batching time</p>
              </div>
            )}

            {actionType === 'ADJUST_MCE_ALLOCATION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom MCE Allocation (%)
                </label>
                <input
                  type="number"
                  value={newMCEAllocation}
                  onChange={(e) => setNewMCEAllocation(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Enter allocation percentage (0-100)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Custom: {newMCEAllocation || 0}% | Standard: {100 - (Number(newMCEAllocation) || 0)}%</p>
              </div>
            )}

            {actionType === 'FIRE_EMPLOYEE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee Type
                  </label>
                  <select
                    value={fireEmployeeType}
                    onChange={(e) => setFireEmployeeType(e.target.value as EmployeeType)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="expert">Experts ($150/day)</option>
                    <option value="rookie">Rookies ($85/day)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number to Fire
                  </label>
                  <input
                    type="number"
                    value={fireEmployeeCount}
                    onChange={(e) => setFireEmployeeCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    placeholder="Number of employees to fire"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">⚠️ Cannot fire rookies in training (first 15 days)</p>
                </div>
              </>
            )}

            {actionType === 'SET_REORDER_POINT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  New Reorder Point (units)
                  <FormulaPopup actionType="SET_REORDER_POINT" day={Number(day) || 51} />
                </label>
                <input
                  type="number"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="1"
                  placeholder="Enter reorder point"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Inventory level that triggers new material order | Documented as management decision</p>
              </div>
            )}

            {actionType === 'SET_ORDER_QUANTITY' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  New Order Quantity (units)
                  <FormulaPopup actionType="SET_ORDER_QUANTITY" day={Number(day) || 51} />
                </label>
                <input
                  type="number"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  step="1"
                  placeholder="Enter order quantity"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">💡 Amount to order when reorder point is reached | Documented as management decision</p>
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
