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

  // Generate realistic historical data based on Day 51 initial conditions
  // Source: Reference Guide.md - Initial Conditions (Start of Day 51)
  let cash = 8206.12;
  const debt = 70000;
  let rawMaterial = 0;
  let standardWIP = 120;
  let customWIP = 295;
  let finishedStandard = 0;
  let finishedCustom = 0;
  const experts = 1; // CRITICAL: Only 1 expert creates severe ARCP bottleneck
  const rookies = 0;
  const inTraining = 0;

  for (let day = 1; day <= days; day++) {
    // Add some variance to make it realistic
    const variance = Math.sin(day / 50) * 0.2;

    // Daily production - SEVERELY limited by 1 expert ARCP bottleneck
    // 1 expert = 3 units/day total ARCP capacity shared between both lines
    // Assuming ~70% to standard, ~30% to custom allocation
    const standardProduction = Math.max(0, Math.floor(2 + variance * 0.5)); // ~2 units/day
    const customProduction = Math.max(0, Math.floor(1 + variance * 0.3)); // ~1 order/day

    // Revenue and expenses with accurate salaries
    // Expert: $150/day, Rookie: $85/day (from Reference Guide)
    const revenue = (standardProduction * 750) + (customProduction * 1100); // Realistic prices
    const expenses = (experts * 150) + (rookies * 85) + 500; // Salaries + overhead

    // Update cash
    cash += revenue - expenses;

    // Update WIP - MASSIVE buildup due to ARCP bottleneck
    // WIP grows because MCE can process much more than ARCP can complete
    standardWIP = Math.max(120, Math.min(550, Math.floor(standardWIP + 15 - standardProduction)));
    customWIP = Math.max(295, Math.min(360, Math.floor(customWIP + 5 - customProduction)));

    // Finished goods - stockout conditions (demand >> production)
    finishedStandard = 0; // All units sell immediately
    finishedCustom = 0; // Custom ships direct (no inventory)

    // Raw materials - frequent stockouts with minimal inventory
    const materialUsed = (standardProduction * 2 + customProduction * 1);
    rawMaterial -= materialUsed;
    let materialOrdered = 0;
    if (rawMaterial < 50 && day % 10 === 0) { // Periodic reordering
      materialOrdered = 200;
      rawMaterial += materialOrdered; // Assumes 4-day lead time already passed
    }
    // Realistic low inventory with frequent stockouts
    rawMaterial = Math.max(0, rawMaterial);

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
    history.dailySalaryCost.push({ day, value: (experts * 150) + (rookies * 85) }); // Accurate salaries
    history.dailyMCECount.push({ day, value: 1 }); // Minimal machine setup
    history.dailyWMACount.push({ day, value: 1 });
    history.dailyPUCCount.push({ day, value: 1 });
    history.dailyStandardPrice.push({ day, value: 750 }); // Realistic pricing
    history.dailyCustomPrice.push({ day, value: 1100 });
    history.dailyCustomDeliveryTime.push({ day, value: 45 }); // Very long due to backlog
    history.dailyReorderPoint.push({ day, value: 50 });
    history.dailyOrderQuantity.push({ day, value: 200 });
    history.dailyStandardBatchSize.push({ day, value: 60 });
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
        MCE: 1, // Minimal machine setup at Day 51
        WMA: 1,
        PUC: 1,
      },
      pendingRawMaterialOrders: [],
      rejectedMaterialOrders: 0,
      stockoutDays: 0,
      lostProductionDays: 0,
      history,
    },
  };
}
