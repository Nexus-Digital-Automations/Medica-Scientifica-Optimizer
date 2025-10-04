import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { StrategyAction } from '../../types/ui.types';
import FormulaPopup from '../common/FormulaPopup';

interface DayActionSelectorProps {
  onClose: () => void;
}

type MachineType = 'MCE' | 'WMA' | 'PUC';
type ProductType = 'standard' | 'custom';

export default function DayActionSelector({ onClose }: DayActionSelectorProps) {
  const { addTimedAction } = useStrategyStore();

  // Day input (empty by default = user must specify)
  const [day, setDay] = useState<number | ''>('');

  // Action enablement checkboxes
  const [enableTakeLoan, setEnableTakeLoan] = useState(false);
  const [enablePayDebt, setEnablePayDebt] = useState(false);
  const [enableOrderMaterials, setEnableOrderMaterials] = useState(false);
  const [enableStopMaterials, setEnableStopMaterials] = useState(false);
  const [enableHireRookie, setEnableHireRookie] = useState(false);
  const [enableBuyMachine, setEnableBuyMachine] = useState(false);
  const [enableSellMachine, setEnableSellMachine] = useState(false);
  const [enableAdjustPrice, setEnableAdjustPrice] = useState(false);
  const [enableAdjustBatchSize, setEnableAdjustBatchSize] = useState(false);
  const [enableAdjustMCEAllocation, setEnableAdjustMCEAllocation] = useState(false);
  const [enableSetReorderPoint, setEnableSetReorderPoint] = useState(false);
  const [enableSetOrderQuantity, setEnableSetOrderQuantity] = useState(false);
  const [enableFireEmployee, setEnableFireEmployee] = useState(false);

  // Action parameters (empty by default = "no changes")
  const [loanAmount, setLoanAmount] = useState<number | ''>('');
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<number | ''>('');
  const [materialQuantity, setMaterialQuantity] = useState<number | ''>('');
  const [rookieCount, setRookieCount] = useState<number | ''>('');
  const [buyMachineType, setBuyMachineType] = useState<MachineType>('MCE');
  const [buyMachineCount, setBuyMachineCount] = useState<number | ''>('');
  const [sellMachineType, setSellMachineType] = useState<MachineType>('MCE');
  const [sellMachineCount, setSellMachineCount] = useState<number | ''>('');
  const [priceProductType, setPriceProductType] = useState<ProductType>('standard');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newBatchSize, setNewBatchSize] = useState<number | ''>('');
  const [newMCEAllocation, setNewMCEAllocation] = useState<number | ''>('');
  const [reorderPoint, setReorderPoint] = useState<number | ''>('');
  const [orderQuantity, setOrderQuantity] = useState<number | ''>('');
  const [fireEmployeeType, setFireEmployeeType] = useState<'expert' | 'rookie'>('expert');
  const [fireEmployeeCount, setFireEmployeeCount] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const actions: StrategyAction[] = [];
    const dayNum = Number(day);

    if (enableTakeLoan) {
      actions.push({ day: dayNum, type: 'TAKE_LOAN', amount: Number(loanAmount) });
    }
    if (enablePayDebt) {
      actions.push({ day: dayNum, type: 'PAY_DEBT', amount: Number(debtPaymentAmount) });
    }
    if (enableOrderMaterials) {
      actions.push({ day: dayNum, type: 'ORDER_MATERIALS', quantity: Number(materialQuantity) });
    }
    if (enableStopMaterials) {
      actions.push({ day: dayNum, type: 'STOP_MATERIAL_ORDERS' });
    }
    if (enableHireRookie) {
      actions.push({ day: dayNum, type: 'HIRE_ROOKIE', count: Number(rookieCount) });
    }
    if (enableBuyMachine) {
      actions.push({ day: dayNum, type: 'BUY_MACHINE', machineType: buyMachineType, count: Number(buyMachineCount) });
    }
    if (enableSellMachine) {
      actions.push({ day: dayNum, type: 'SELL_MACHINE', machineType: sellMachineType, count: Number(sellMachineCount) });
    }
    if (enableAdjustPrice) {
      actions.push({ day: dayNum, type: 'ADJUST_PRICE', productType: priceProductType, newPrice: Number(newPrice) });
    }
    if (enableAdjustBatchSize) {
      actions.push({ day: dayNum, type: 'ADJUST_BATCH_SIZE', newSize: Number(newBatchSize) });
    }
    if (enableAdjustMCEAllocation) {
      actions.push({ day: dayNum, type: 'ADJUST_MCE_ALLOCATION', newAllocation: Number(newMCEAllocation) / 100 });
    }
    if (enableSetReorderPoint) {
      actions.push({ day: dayNum, type: 'SET_REORDER_POINT', newReorderPoint: Number(reorderPoint) });
    }
    if (enableSetOrderQuantity) {
      actions.push({ day: dayNum, type: 'SET_ORDER_QUANTITY', newOrderQuantity: Number(orderQuantity) });
    }
    if (enableFireEmployee) {
      actions.push({ day: dayNum, type: 'FIRE_EMPLOYEE', employeeType: fireEmployeeType, count: Number(fireEmployeeCount) });
    }

    // Add all enabled actions
    actions.forEach(action => addTimedAction(action));

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl border border-gray-200 my-8">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Schedule Actions for Day
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Day Input */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                📅 Day (51-500)
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="51"
                max="500"
                placeholder="Enter day number (51-500)"
                required
              />
              <p className="text-xs text-gray-600 mt-2">💡 All selected actions will be scheduled for this day</p>
            </div>

            {/* All Action Types */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Select Actions</h4>

              {/* TAKE_LOAN */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableTakeLoan}
                    onChange={(e) => setEnableTakeLoan(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">💰</span> Take Loan
                    </label>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableTakeLoan}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      step="1000"
                      placeholder="Loan amount ($)"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Commission: 2% | Interest: 36.5% annual</p>
                  </div>
                </div>
              </div>

              {/* PAY_DEBT */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enablePayDebt}
                    onChange={(e) => setEnablePayDebt(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">💳</span> Pay Debt
                    </label>
                    <input
                      type="number"
                      value={debtPaymentAmount}
                      onChange={(e) => setDebtPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enablePayDebt}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="0.01"
                      step="100"
                      placeholder="Payment amount ($)"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Interest rate: 36.5% annual (0.1% daily)</p>
                  </div>
                </div>
              </div>

              {/* ORDER_MATERIALS */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableOrderMaterials}
                    onChange={(e) => setEnableOrderMaterials(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">📦</span> Order Materials
                    </label>
                    <input
                      type="number"
                      value={materialQuantity}
                      onChange={(e) => setMaterialQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableOrderMaterials}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      step="1"
                      placeholder="Quantity (units)"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Cost: $50/part + $1,000 fee | Lead time: 4 days</p>
                  </div>
                </div>
              </div>

              {/* STOP_MATERIAL_ORDERS */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableStopMaterials}
                    onChange={(e) => setEnableStopMaterials(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">🛑</span> Stop Material Orders
                    </label>
                    <p className="text-xs text-gray-600 mt-1">No additional parameters required</p>
                  </div>
                </div>
              </div>

              {/* HIRE_ROOKIE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableHireRookie}
                    onChange={(e) => setEnableHireRookie(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">👷</span> Hire Rookies
                      <FormulaPopup actionType="HIRE_ROOKIE" day={Number(day) || 51} />
                    </label>
                    <input
                      type="number"
                      value={rookieCount}
                      onChange={(e) => setRookieCount(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableHireRookie}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      placeholder="Number of rookies"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 $85/day | Training: 15 days → Expert | 40% productivity</p>
                  </div>
                </div>
              </div>

              {/* BUY_MACHINE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableBuyMachine}
                    onChange={(e) => setEnableBuyMachine(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">🏭</span> Buy Machine
                      <FormulaPopup actionType="BUY_MACHINE" day={Number(day) || 51} />
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={buyMachineType}
                        onChange={(e) => setBuyMachineType(e.target.value as MachineType)}
                        disabled={!enableBuyMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MCE">MCE - $20k</option>
                        <option value="WMA">WMA - $15k</option>
                        <option value="PUC">PUC - $12k</option>
                      </select>
                      <input
                        type="number"
                        value={buyMachineCount}
                        onChange={(e) => setBuyMachineCount(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!enableBuyMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        placeholder="Count"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SELL_MACHINE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableSellMachine}
                    onChange={(e) => setEnableSellMachine(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">💸</span> Sell Machine
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={sellMachineType}
                        onChange={(e) => setSellMachineType(e.target.value as MachineType)}
                        disabled={!enableSellMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MCE">MCE - Sell $10k</option>
                        <option value="WMA">WMA - Sell $7.5k</option>
                        <option value="PUC">PUC - Sell $4k</option>
                      </select>
                      <input
                        type="number"
                        value={sellMachineCount}
                        onChange={(e) => setSellMachineCount(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!enableSellMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        placeholder="Count"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">⚠️ At least 1 machine must remain at each station</p>
                  </div>
                </div>
              </div>

              {/* ADJUST_PRICE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableAdjustPrice}
                    onChange={(e) => setEnableAdjustPrice(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">💵</span> Adjust Price
                      <FormulaPopup actionType="ADJUST_PRICE" day={Number(day) || 51} />
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={priceProductType}
                        onChange={(e) => setPriceProductType(e.target.value as ProductType)}
                        disabled={!enableAdjustPrice}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="standard">Standard Product</option>
                        <option value="custom">Custom Product</option>
                      </select>
                      <input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!enableAdjustPrice}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="0.01"
                        step="0.01"
                        placeholder="New price ($)"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">💡 Price affects demand (higher price = lower demand)</p>
                  </div>
                </div>
              </div>

              {/* ADJUST_BATCH_SIZE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableAdjustBatchSize}
                    onChange={(e) => setEnableAdjustBatchSize(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">📊</span> Adjust Standard Batch Size
                      <FormulaPopup actionType="ADJUST_BATCH_SIZE" day={Number(day) || 51} />
                    </label>
                    <input
                      type="number"
                      value={newBatchSize}
                      onChange={(e) => setNewBatchSize(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableAdjustBatchSize}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      step="1"
                      placeholder="Batch size"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Current default: 60 units | Affects batching time</p>
                  </div>
                </div>
              </div>

              {/* ADJUST_MCE_ALLOCATION */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableAdjustMCEAllocation}
                    onChange={(e) => setEnableAdjustMCEAllocation(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">⚙️</span> Adjust MCE Custom Allocation
                    </label>
                    <input
                      type="number"
                      value={newMCEAllocation}
                      onChange={(e) => setNewMCEAllocation(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableAdjustMCEAllocation}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="Custom allocation %"
                    />
                    <p className="text-xs text-gray-600 mt-1">Standard: {100 - (Number(newMCEAllocation) || 0)}% | Custom: {Number(newMCEAllocation) || 0}%</p>
                  </div>
                </div>
              </div>

              {/* SET_REORDER_POINT */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableSetReorderPoint}
                    onChange={(e) => setEnableSetReorderPoint(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">📍</span> Set Reorder Point
                      <FormulaPopup actionType="SET_REORDER_POINT" day={Number(day) || 51} />
                    </label>
                    <input
                      type="number"
                      value={reorderPoint}
                      onChange={(e) => setReorderPoint(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableSetReorderPoint}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1"
                      placeholder="Reorder point (units)"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Inventory level that triggers new material order</p>
                  </div>
                </div>
              </div>

              {/* SET_ORDER_QUANTITY */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableSetOrderQuantity}
                    onChange={(e) => setEnableSetOrderQuantity(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">📏</span> Set Order Quantity
                      <FormulaPopup actionType="SET_ORDER_QUANTITY" day={Number(day) || 51} />
                    </label>
                    <input
                      type="number"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!enableSetOrderQuantity}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      step="1"
                      placeholder="Order quantity (units)"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Amount to order when reorder point is reached</p>
                  </div>
                </div>
              </div>

              {/* FIRE_EMPLOYEE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableFireEmployee}
                    onChange={(e) => setEnableFireEmployee(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">🚪</span> Fire Employees
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={fireEmployeeType}
                        onChange={(e) => setFireEmployeeType(e.target.value as 'expert' | 'rookie')}
                        disabled={!enableFireEmployee}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="expert">Experts ($150/day)</option>
                        <option value="rookie">Rookies ($85/day)</option>
                      </select>
                      <input
                        type="number"
                        value={fireEmployeeCount}
                        onChange={(e) => setFireEmployeeCount(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!enableFireEmployee}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        placeholder="Count"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">⚠️ Cannot fire rookies in training (first 15 days)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
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
                Add Selected Actions
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
