import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { getFormulaForAction } from '../../utils/formulaCalculations';

interface FormulaPopupProps {
  actionType: string;
  day: number;
}

export default function FormulaPopup({ actionType, day }: FormulaPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { strategy } = useStrategyStore();

  const formulaData = getFormulaForAction(actionType, strategy, day);

  if (!formulaData) {
    return null; // No formula available for this action type
  }

  const { title, formula, result } = formulaData;

  return (
    <div className="relative inline-block">
      {/* Info Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="ml-2 w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 font-bold text-xs flex items-center justify-center transition-colors"
        title="Show mathematical formula"
      >
        ?
      </button>

      {/* Popup Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={() => setIsOpen(false)}
          />

          {/* Popup Content */}
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-96 max-h-[80vh] overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-300 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
            </div>

            {/* Formula */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Formula:</p>
              <p className="text-lg font-mono text-blue-900 text-center">{formula}</p>
            </div>

            {/* Variables */}
            {result && (
              <>
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Where:</p>
                  <div className="space-y-1">
                    {result.variables.map((v, idx) => (
                      <div key={idx} className="text-sm flex items-start gap-2">
                        <span className="font-mono font-semibold text-blue-600 min-w-[2rem]">
                          {v.symbol}
                        </span>
                        <span className="text-gray-600 flex-1">
                          = {v.description}
                          <span className="font-semibold text-gray-900 ml-2">
                            ({v.value.toLocaleString()})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculated Value */}
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    💡 Calculated Optimal Value:
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    {result.value.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>

                {/* Explanation */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">{result.explanation}</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
