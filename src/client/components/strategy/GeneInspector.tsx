/**
 * Gene Inspector Component
 *
 * Displays the 8 optimized strategy genes with explanations
 * Shows user what the GA found and why it matters
 */

import type { StrategyGenes } from '../../../optimization/strategyGenes.js';

interface GeneInspectorProps {
  genes: StrategyGenes;
  showExplanations?: boolean;
}

export function GeneInspector({ genes, showExplanations = true }: GeneInspectorProps) {
  const geneInfo = [
    {
      name: 'Safety Stock Multiplier',
      value: genes.safetyStockMultiplier.toFixed(2),
      range: '0.8-1.5',
      interpretation: genes.safetyStockMultiplier > 1.2
        ? 'Conservative (High inventory, low stockout risk)'
        : 'Aggressive (Low inventory, accepts some stockout risk)',
      explanation: 'Controls how much safety stock to maintain. Higher = more inventory protection against demand variability.'
    },
    {
      name: 'Capacity Buffer',
      value: genes.targetCapacityMultiplier.toFixed(2),
      range: '1.0-1.5',
      interpretation: genes.targetCapacityMultiplier > 1.3
        ? 'High buffer (Can handle demand spikes)'
        : 'Tight capacity (Maximizes utilization)',
      explanation: 'How much production capacity beyond expected demand. Higher = can handle surges but costs more.'
    },
    {
      name: 'Workforce Aggressiveness',
      value: genes.workforceAggressiveness.toFixed(2),
      range: '0.8-1.2',
      interpretation: genes.workforceAggressiveness > 1.0
        ? 'Aggressive hiring (Prepared for growth)'
        : 'Conservative hiring (Minimize salary costs)',
      explanation: 'How proactively to hire workers ahead of demand. Accounts for 15-day training lag.'
    },
    {
      name: 'Price Aggressiveness',
      value: genes.priceAggressiveness.toFixed(2),
      range: '0.9-1.1',
      interpretation: genes.priceAggressiveness > 1.0
        ? 'Premium pricing (Maximize margin)'
        : 'Competitive pricing (Capture market share)',
      explanation: 'Multiplier on analytically-optimal price. Higher = charge more, lower = undercut competition.'
    },
    {
      name: 'MCE Allocation (Custom)',
      value: (genes.mceAllocationCustom * 100).toFixed(0) + '%',
      range: '30-70%',
      interpretation: genes.mceAllocationCustom > 0.5
        ? 'Focus on Custom (Higher margin, more complex)'
        : 'Focus on Standard (Higher volume, simpler)',
      explanation: 'What % of MCE capacity to allocate to custom orders vs standard production.'
    },
    {
      name: 'Debt Paydown',
      value: (genes.debtPaydownAggressiveness * 100).toFixed(0) + '%',
      range: '50-100%',
      interpretation: genes.debtPaydownAggressiveness > 0.75
        ? 'Aggressive (Pay down debt fast, save interest)'
        : 'Conservative (Keep more cash for flexibility)',
      explanation: 'What % of excess cash to use for debt paydown vs keeping as cash reserve.'
    },
    {
      name: 'Cash Reserve',
      value: genes.minCashReserveDays + ' days',
      range: '5-15 days',
      interpretation: genes.minCashReserveDays > 10
        ? 'Large buffer (Very safe, but opportunity cost)'
        : 'Lean buffer (Efficient, but risky)',
      explanation: 'How many days of operating expenses to maintain as cash reserve.'
    }
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h4 className="text-lg font-semibold text-white mb-4">
        🧬 Strategy Genes (GA-Optimized Parameters)
      </h4>

      <div className="space-y-3">
        {geneInfo.map((gene, i) => (
          <div key={i} className="border-l-4 border-blue-500 pl-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-300">{gene.name}</span>
              <span className="text-sm font-bold text-white">{gene.value}</span>
            </div>

            <div className="text-xs text-gray-500 mb-1">
              Range: {gene.range}
            </div>

            <div className="text-xs text-green-400">
              {gene.interpretation}
            </div>

            {showExplanations && (
              <div className="text-xs text-gray-400 mt-1 italic">
                {gene.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600 rounded text-xs text-gray-300">
        <strong>How it works:</strong> The GA optimized these 8 parameters over multiple generations.
        Each parameter tunes proven analytical models (EOQ, Newsvendor, DP) to find the optimal
        balance for your specific scenario.
      </div>
    </div>
  );
}
