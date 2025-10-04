import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { StrategyAction } from '../../types/ui.types';

interface DayActionSelectorProps {
  onClose: () => void;
}

type MachineType = 'MCE' | 'WMA' | 'PUC';
type ProductType = 'standard' | 'custom';
type ARCPType = 'standard' | 'custom';

export default function DayActionSelector({ onClose }: DayActionSelectorProps) {
  const { addTimedAction } = useStrategyStore();

  // Day input
  const [day, setDay] = useState(100);

  // Action enablement checkboxes
  const [enableTakeLoan, setEnableTakeLoan] = useState(false);
  const [enablePayDebt, setEnablePayDebt] = useState(false);
  const [enableOrderMaterials, setEnableOrderMaterials] = useState(false);
  const [enableStopMaterials, setEnableStopMaterials] = useState(false);
  const [enableHireRookie, setEnableHireRookie] = useState(false);
  const [enableHireExpert, setEnableHireExpert] = useState(false);
  const [enableBuyMachine, setEnableBuyMachine] = useState(false);
  const [enableSellMachine, setEnableSellMachine] = useState(false);
  const [enableAdjustPrice, setEnableAdjustPrice] = useState(false);
  const [enableAdjustBatchSize, setEnableAdjustBatchSize] = useState(false);
  const [enableAdjustMCEAllocation, setEnableAdjustMCEAllocation] = useState(false);

  // Action parameters with defaults
  const [loanAmount, setLoanAmount] = useState(50000);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState(10000);
  const [materialQuantity, setMaterialQuantity] = useState(500);
  const [rookieCount, setRookieCount] = useState(2);
  const [expertCount, setExpertCount] = useState(1);
  const [buyMachineType, setBuyMachineType] = useState<MachineType>('MCE');
  const [buyMachineCount, setBuyMachineCount] = useState(1);
  const [sellMachineType, setSellMachineType] = useState<MachineType>('MCE');
  const [sellMachineCount, setSellMachineCount] = useState(1);
  const [priceProductType, setPriceProductType] = useState<ProductType>('standard');
  const [newPrice, setNewPrice] = useState(800);
  const [batchSizeArcpType, setBatchSizeArcpType] = useState<ARCPType>('standard');
  const [newBatchSize, setNewBatchSize] = useState(50);
  const [newMCEAllocation, setNewMCEAllocation] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const actions: StrategyAction[] = [];

    if (enableTakeLoan) {
      actions.push({ day, type: 'TAKE_LOAN', amount: loanAmount });
    }
    if (enablePayDebt) {
      actions.push({ day, type: 'PAY_DEBT', amount: debtPaymentAmount });
    }
    if (enableOrderMaterials) {
      actions.push({ day, type: 'ORDER_MATERIALS', quantity: materialQuantity });
    }
    if (enableStopMaterials) {
      actions.push({ day, type: 'STOP_MATERIAL_ORDERS' });
    }
    if (enableHireRookie) {
      actions.push({ day, type: 'HIRE_ROOKIE', count: rookieCount });
    }
    if (enableHireExpert) {
      actions.push({ day, type: 'HIRE_EXPERT', count: expertCount });
    }
    if (enableBuyMachine) {
      actions.push({ day, type: 'BUY_MACHINE', machineType: buyMachineType, count: buyMachineCount });
    }
    if (enableSellMachine) {
      actions.push({ day, type: 'SELL_MACHINE', machineType: sellMachineType, count: sellMachineCount });
    }
    if (enableAdjustPrice) {
      actions.push({ day, type: 'ADJUST_PRICE', productType: priceProductType, newPrice });
    }
    if (enableAdjustBatchSize) {
      actions.push({ day, type: 'ADJUST_BATCH_SIZE', arcpType: batchSizeArcpType, batchSize: newBatchSize });
    }
    if (enableAdjustMCEAllocation) {
      actions.push({ day, type: 'ADJUST_MCE_ALLOCATION', standardAllocation: newMCEAllocation });
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
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      disabled={!enableTakeLoan}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="10000"
                      max="500000"
                      step="10000"
                      placeholder="$50,000"
                    />
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
                      onChange={(e) => setDebtPaymentAmount(Number(e.target.value))}
                      disabled={!enablePayDebt}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1000"
                      max="100000"
                      step="1000"
                      placeholder="$10,000"
                    />
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
                      onChange={(e) => setMaterialQuantity(Number(e.target.value))}
                      disabled={!enableOrderMaterials}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="100"
                      max="5000"
                      step="100"
                      placeholder="500 units"
                    />
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
                    </label>
                    <input
                      type="number"
                      value={rookieCount}
                      onChange={(e) => setRookieCount(Number(e.target.value))}
                      disabled={!enableHireRookie}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="10"
                      placeholder="2"
                    />
                  </div>
                </div>
              </div>

              {/* HIRE_EXPERT */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableHireExpert}
                    onChange={(e) => setEnableHireExpert(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-lg">👨‍🔬</span> Hire Experts
                    </label>
                    <input
                      type="number"
                      value={expertCount}
                      onChange={(e) => setExpertCount(Number(e.target.value))}
                      disabled={!enableHireExpert}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="5"
                      placeholder="1"
                    />
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
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={buyMachineType}
                        onChange={(e) => setBuyMachineType(e.target.value as MachineType)}
                        disabled={!enableBuyMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MCE">MCE (Station 1)</option>
                        <option value="WMA">WMA (Station 2)</option>
                        <option value="PUC">PUC (Station 3)</option>
                      </select>
                      <input
                        type="number"
                        value={buyMachineCount}
                        onChange={(e) => setBuyMachineCount(Number(e.target.value))}
                        disabled={!enableBuyMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="5"
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
                        <option value="MCE">MCE (Station 1)</option>
                        <option value="WMA">WMA (Station 2)</option>
                        <option value="PUC">PUC (Station 3)</option>
                      </select>
                      <input
                        type="number"
                        value={sellMachineCount}
                        onChange={(e) => setSellMachineCount(Number(e.target.value))}
                        disabled={!enableSellMachine}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="5"
                        placeholder="Count"
                      />
                    </div>
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
                        onChange={(e) => setNewPrice(Number(e.target.value))}
                        disabled={!enableAdjustPrice}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="400"
                        max="1200"
                        step="10"
                        placeholder="$800"
                      />
                    </div>
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
                      <span className="text-lg">📊</span> Adjust Batch Size
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={batchSizeArcpType}
                        onChange={(e) => setBatchSizeArcpType(e.target.value as ARCPType)}
                        disabled={!enableAdjustBatchSize}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="standard">Standard ARCP</option>
                        <option value="custom">Custom ARCP</option>
                      </select>
                      <input
                        type="number"
                        value={newBatchSize}
                        onChange={(e) => setNewBatchSize(Number(e.target.value))}
                        disabled={!enableAdjustBatchSize}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                        min="10"
                        max="200"
                        step="5"
                        placeholder="50"
                      />
                    </div>
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
                      <span className="text-lg">⚙️</span> Adjust MCE Allocation
                    </label>
                    <input
                      type="number"
                      value={newMCEAllocation}
                      onChange={(e) => setNewMCEAllocation(Number(e.target.value))}
                      disabled={!enableAdjustMCEAllocation}
                      className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="100"
                      step="5"
                      placeholder="50% standard"
                    />
                    <p className="text-xs text-gray-600 mt-1">Custom allocation will be {100 - newMCEAllocation}%</p>
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
