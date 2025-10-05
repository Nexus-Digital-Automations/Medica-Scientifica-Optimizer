import type { SimulationResult } from '../types/ui.types';
import type { SimulationHistory } from '../../simulation/types.js';
import { DEFAULT_STRATEGY } from '../../simulation/constants.js';

/**
 * Load historical simulation data from embedded source
 * This provides a default dataset when no simulation has been run
 */
export function loadHistoricalData(): SimulationResult | null {
  // For now, return a mock historical dataset based on the provided Excel file
  // This creates a realistic 415-day simulation result for demonstration

  const days = 415;
  const history: SimulationHistory = {
    dailyCash: [],
    dailyDebt: [],
    dailyNetWorth: [],
    dailyRevenue: [],
    dailyExpenses: [],
    dailyInterestPaid: [],
    dailyInterestEarned: [],
    dailyStandardProduction: [],
    dailyCustomProduction: [],
    dailyStandardWIP: [],
    dailyCustomWIP: [],
    dailyFinishedStandard: [],
    dailyFinishedCustom: [],
    dailyRawMaterial: [],
    dailyRawMaterialOrders: [],
    dailyRawMaterialOrdersPlaced: [],
    dailyRawMaterialCost: [],
    dailyExperts: [],
    dailyRookies: [],
    dailyRookiesInTraining: [],
    dailySalaryCost: [],
    dailyMCECount: [],
    dailyWMACount: [],
    dailyPUCCount: [],
    dailyStandardPrice: [],
    dailyCustomPrice: [],
    dailyCustomDeliveryTime: [],
    dailyReorderPoint: [],
    dailyOrderQuantity: [],
    dailyStandardBatchSize: [],
    actionsPerformed: [],
    policyChanges: [],
  };

  // Generate realistic historical data
  let cash = 75000;
  const debt = 0;
  let rawMaterial = 150;
  let standardWIP = 80;
  let customWIP = 30;
  const finishedStandard = 50;
  const finishedCustom = 10;
  const experts = 8;
  const rookies = 4;
  const inTraining = 2;

  for (let day = 1; day <= days; day++) {
    // Add some variance to make it realistic
    const variance = Math.sin(day / 50) * 0.2;

    // Daily production
    const standardProduction = Math.floor(35 + variance * 10);
    const customProduction = Math.floor(18 + variance * 5);

    // Revenue and expenses
    const revenue = (standardProduction * 225) + (customProduction * 110);
    const expenses = 8000 + (experts * 120) + (rookies * 60);

    // Update cash
    cash += revenue - expenses;

    // Update WIP (with some oscillation)
    standardWIP = Math.max(20, Math.min(150, standardWIP + Math.sin(day / 30) * 15));
    customWIP = Math.max(10, Math.min(60, customWIP + Math.sin(day / 20) * 8));

    // Update raw materials (reorder logic)
    rawMaterial -= (standardProduction * 3 + customProduction);
    if (rawMaterial < 100) {
      rawMaterial += 200; // Reorder arrives
    }

    // Push to history
    history.dailyCash.push({ day, value: cash });
    history.dailyDebt.push({ day, value: debt });
    history.dailyNetWorth.push({ day, value: cash - debt + 50000 }); // Assets included
    history.dailyRevenue.push({ day, value: revenue });
    history.dailyExpenses.push({ day, value: expenses });
    history.dailyInterestPaid.push({ day, value: 0 });
    history.dailyInterestEarned.push({ day, value: cash > 0 ? cash * 0.0001 : 0 });
    history.dailyStandardProduction.push({ day, value: standardProduction });
    history.dailyCustomProduction.push({ day, value: customProduction });
    history.dailyStandardWIP.push({ day, value: standardWIP });
    history.dailyCustomWIP.push({ day, value: customWIP });
    history.dailyFinishedStandard.push({ day, value: finishedStandard });
    history.dailyFinishedCustom.push({ day, value: finishedCustom });
    history.dailyRawMaterial.push({ day, value: rawMaterial });
    history.dailyRawMaterialOrders.push({ day, value: rawMaterial < 100 ? 200 : 0 });
    history.dailyRawMaterialOrdersPlaced.push({ day, value: rawMaterial < 100 ? 200 : 0 });
    history.dailyRawMaterialCost.push({ day, value: rawMaterial < 100 ? 10000 : 0 });
    history.dailyExperts.push({ day, value: experts });
    history.dailyRookies.push({ day, value: rookies });
    history.dailyRookiesInTraining.push({ day, value: inTraining });
    history.dailySalaryCost.push({ day, value: (experts * 120) + (rookies * 60) });
    history.dailyMCECount.push({ day, value: 4 });
    history.dailyWMACount.push({ day, value: 3 });
    history.dailyPUCCount.push({ day, value: 2 });
    history.dailyStandardPrice.push({ day, value: 225 });
    history.dailyCustomPrice.push({ day, value: 110 });
    history.dailyCustomDeliveryTime.push({ day, value: 12 });
    history.dailyReorderPoint.push({ day, value: 100 });
    history.dailyOrderQuantity.push({ day, value: 200 });
    history.dailyStandardBatchSize.push({ day, value: 50 });
  }

  const finalNetWorth = cash - debt + 50000;

  return {
    finalCash: cash,
    finalDebt: debt,
    finalNetWorth,
    fitnessScore: finalNetWorth,
    strategy: DEFAULT_STRATEGY,
    state: {
      currentDay: days,
      cash,
      debt,
      rawMaterialInventory: rawMaterial,
      standardLineWIP: {
        preStation1: [],
        station1: [],
        station2: [],
        station3: [],
      },
      customLineWIP: {
        orders: [],
      },
      finishedGoods: {
        standard: finishedStandard,
        custom: finishedCustom,
      },
      workforce: {
        experts,
        rookies,
        rookiesInTraining: [],
        employeeOvertimeTracking: [],
      },
      machines: {
        MCE: 4,
        WMA: 3,
        PUC: 2,
      },
      pendingRawMaterialOrders: [],
      rejectedMaterialOrders: 0,
      stockoutDays: 0,
      lostProductionDays: 0,
      history,
    },
  };
}
