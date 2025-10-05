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
  let finishedStandard = 50;
  let finishedCustom = 10;
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

    // Update WIP (with some oscillation but ensuring positive values)
    standardWIP = Math.max(20, Math.min(150, Math.floor(standardWIP + Math.sin(day / 30) * 15)));
    customWIP = Math.max(10, Math.min(60, Math.floor(customWIP + Math.sin(day / 20) * 8)));

    // Update finished goods inventory (simulate production and sales)
    finishedStandard = Math.max(30, Math.min(80, Math.floor(finishedStandard + standardProduction - 30 + variance * 5)));
    finishedCustom = Math.max(5, Math.min(25, Math.floor(finishedCustom + customProduction - 15 + variance * 2)));

    // Update raw materials (reorder logic with proper inventory management)
    const materialUsed = (standardProduction * 3 + customProduction);
    rawMaterial -= materialUsed;
    let materialOrdered = 0;
    if (rawMaterial < 100) {
      materialOrdered = 200;
      rawMaterial += materialOrdered; // Reorder arrives
    }
    // Ensure raw material never goes below 50
    rawMaterial = Math.max(50, rawMaterial);

    // Push to history
    history.dailyCash.push({ day, value: Math.floor(cash) });
    history.dailyDebt.push({ day, value: debt });
    history.dailyNetWorth.push({ day, value: Math.floor(cash - debt + 50000) }); // Assets included
    history.dailyRevenue.push({ day, value: revenue });
    history.dailyExpenses.push({ day, value: expenses });
    history.dailyInterestPaid.push({ day, value: 0 });
    history.dailyInterestEarned.push({ day, value: cash > 0 ? Math.floor(cash * 0.0001) : 0 });
    history.dailyStandardProduction.push({ day, value: standardProduction });
    history.dailyCustomProduction.push({ day, value: customProduction });
    history.dailyStandardWIP.push({ day, value: Math.floor(standardWIP) });
    history.dailyCustomWIP.push({ day, value: Math.floor(customWIP) });
    history.dailyFinishedStandard.push({ day, value: Math.floor(finishedStandard) });
    history.dailyFinishedCustom.push({ day, value: Math.floor(finishedCustom) });
    history.dailyRawMaterial.push({ day, value: Math.floor(rawMaterial) });
    history.dailyRawMaterialOrders.push({ day, value: materialOrdered });
    history.dailyRawMaterialOrdersPlaced.push({ day, value: materialOrdered });
    history.dailyRawMaterialCost.push({ day, value: materialOrdered > 0 ? 10000 : 0 });
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

  const finalNetWorth = Math.floor(cash - debt + 50000);

  return {
    finalCash: Math.floor(cash),
    finalDebt: debt,
    finalNetWorth,
    fitnessScore: finalNetWorth,
    strategy: DEFAULT_STRATEGY,
    state: {
      currentDay: days,
      cash: Math.floor(cash),
      debt,
      rawMaterialInventory: Math.floor(rawMaterial),
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
        standard: Math.floor(finishedStandard),
        custom: Math.floor(finishedCustom),
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
