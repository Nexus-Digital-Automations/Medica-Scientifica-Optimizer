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
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          {/* Popup Content */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-96 max-h-[80vh] overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-300 p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
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

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
