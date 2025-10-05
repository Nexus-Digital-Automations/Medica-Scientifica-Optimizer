import { useState } from 'react';
import type { Strategy } from '../../types/ui.types';

interface CurrentStatePanelProps {
  strategy: Strategy;
  onLockWorkforce: () => void;
  onLockMachine: (machineType: 'MCE' | 'WMA' | 'PUC') => void;
  onLockPolicy: (policyType: 'batchSize' | 'price' | 'mceAllocation') => void;
  lockedWorkforce: boolean;
  lockedMachines: { MCE: boolean; WMA: boolean; PUC: boolean };
  lockedPolicies: { batchSize: boolean; price: boolean; mceAllocation: boolean };
}

export default function CurrentStatePanel({
  strategy,
  onLockWorkforce,
  onLockMachine,
  onLockPolicy,
  lockedWorkforce,
  lockedMachines,
  lockedPolicies,
}: CurrentStatePanelProps) {
  const [showPanel, setShowPanel] = useState(true);

  // Get current workforce from timed actions or strategy
  const getCurrentWorkforce = () => {
    // In a real scenario, we'd calculate this from the simulation state
    // For now, we'll use placeholder values that can be adjusted
    return {
      experts: 1,
      rookies: 0,
    };
  };

  const getCurrentMachines = () => {
    return {
      MCE: 1,
      WMA: 2,
      PUC: 2,
    };
  };

  const workforce = getCurrentWorkforce();
  const machines = getCurrentMachines();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span> Current State & Locks
          </h3>
          <p className="text-indigo-100 text-sm mt-1">
            Lock values to prevent optimizer from modifying them
          </p>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
        >
          {showPanel ? 'Hide' : 'Show'}
        </button>
      </div>

      {showPanel && (
        <div className="p-6 space-y-6">
          {/* Workforce Section */}
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                👷 Workforce
              </h4>
              <button
                onClick={onLockWorkforce}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  lockedWorkforce
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
                title={lockedWorkforce ? 'Unlock workforce (allow hiring/firing)' : 'Lock workforce (prevent hiring/firing)'}
              >
                {lockedWorkforce ? '🔓 Unlock All' : '🔒 Lock All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-white rounded-lg p-4 border-2 ${lockedWorkforce ? 'border-red-300' : 'border-gray-200'}`}>
                <p className="text-sm text-gray-600 mb-1">Experts</p>
                <p className="text-3xl font-bold text-gray-900">{workforce.experts}</p>
              </div>
              <div className={`bg-white rounded-lg p-4 border-2 ${lockedWorkforce ? 'border-red-300' : 'border-gray-200'}`}>
                <p className="text-sm text-gray-600 mb-1">Rookies</p>
                <p className="text-3xl font-bold text-gray-900">{workforce.rookies}</p>
              </div>
            </div>
            {lockedWorkforce && (
              <div className="mt-3 text-xs bg-red-100 text-red-800 px-3 py-2 rounded font-medium">
                🔒 Optimizer cannot hire or fire employees
              </div>
            )}
          </div>

          {/* Machines Section */}
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🏭 Machines
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className={`bg-white rounded-lg p-4 border-2 ${lockedMachines.MCE ? 'border-red-300' : 'border-gray-200'}`}>
                  <p className="text-sm text-gray-600 mb-1">MCE</p>
                  <p className="text-3xl font-bold text-gray-900">{machines.MCE}</p>
                </div>
                <button
                  onClick={() => onLockMachine('MCE')}
                  className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    lockedMachines.MCE
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedMachines.MCE ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>
              <div>
                <div className={`bg-white rounded-lg p-4 border-2 ${lockedMachines.WMA ? 'border-red-300' : 'border-gray-200'}`}>
                  <p className="text-sm text-gray-600 mb-1">WMA</p>
                  <p className="text-3xl font-bold text-gray-900">{machines.WMA}</p>
                </div>
                <button
                  onClick={() => onLockMachine('WMA')}
                  className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    lockedMachines.WMA
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedMachines.WMA ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>
              <div>
                <div className={`bg-white rounded-lg p-4 border-2 ${lockedMachines.PUC ? 'border-red-300' : 'border-gray-200'}`}>
                  <p className="text-sm text-gray-600 mb-1">PUC</p>
                  <p className="text-3xl font-bold text-gray-900">{machines.PUC}</p>
                </div>
                <button
                  onClick={() => onLockMachine('PUC')}
                  className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    lockedMachines.PUC
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedMachines.PUC ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>
            </div>
          </div>

          {/* Policy Settings Section */}
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              ⚙️ Policy Settings
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-lg p-4 border-2 border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">Standard Batch Size</p>
                  <p className="text-2xl font-bold text-gray-900">{strategy.standardBatchSize || 60}</p>
                </div>
                <button
                  onClick={() => onLockPolicy('batchSize')}
                  className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                    lockedPolicies.batchSize
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedPolicies.batchSize ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>

              <div className="flex items-center justify-between bg-white rounded-lg p-4 border-2 border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">Standard Price</p>
                  <p className="text-2xl font-bold text-gray-900">${strategy.standardPrice || 225}</p>
                </div>
                <button
                  onClick={() => onLockPolicy('price')}
                  className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                    lockedPolicies.price
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedPolicies.price ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>

              <div className="flex items-center justify-between bg-white rounded-lg p-4 border-2 border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">MCE Allocation (Custom)</p>
                  <p className="text-2xl font-bold text-gray-900">{(strategy.mceAllocationCustom * 100).toFixed(0)}%</p>
                </div>
                <button
                  onClick={() => onLockPolicy('mceAllocation')}
                  className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                    lockedPolicies.mceAllocation
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {lockedPolicies.mceAllocation ? '🔓 Unlock' : '🔒 Lock'}
                </button>
              </div>
            </div>
          </div>

          {/* Lock Summary */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">
              ℹ️ Locked values prevent the optimizer from making changes.
              The optimizer will still optimize other unlocked parameters.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
