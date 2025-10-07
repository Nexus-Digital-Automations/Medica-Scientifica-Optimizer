import type { SimulationResult, Strategy } from '../types/ui.types';
import type { SimulationHistory } from '../../simulation/types.js';
import historicalDataJson from '../data/historicalData.json';

/**
 * Placeholder strategy for historical data display
 * Historical data is pre-computed, so strategy parameters are not directly applicable
 */
const PLACEHOLDER_STRATEGY: Strategy = {
  reorderPoint: 0,
  orderQuantity: 0,
  standardBatchSize: 0,
  mceAllocationCustom: 0.50,
  standardPrice: 225,
  dailyOvertimeHours: 0,
  customBasePrice: 106.56,
  customPenaltyPerDay: 0.27,
  customTargetDeliveryDays: 5,
  customDemandMean1: 25,
  customDemandStdDev1: 5,
  customDemandMean2: 32.5,
  customDemandStdDev2: 6.5,
  standardDemandIntercept: 1500,
  standardDemandSlope: -5.0,
  overtimeTriggerDays: 5,
  dailyQuitProbability: 0.10,
  autoDebtPaydown: true,
  minCashReserveDays: 8,
  debtPaydownAggressiveness: 0.80,
  preemptiveWageLoanDays: 4,
  maxDebtThreshold: 200000,
  emergencyLoanBuffer: 15000,
  timedActions: [],
};

/**
 * Load historical simulation data from Excel-sourced JSON
 * This provides REAL baseline historical data from the Excel file
 */
export function loadHistoricalData(): SimulationResult | null {
  try {
    // Extract data from JSON sheets
    const standardData = historicalDataJson.Standard.data;
    const customData = historicalDataJson.Custom.data;
    const financialData = historicalDataJson.Financial.data;
    const inventoryData = historicalDataJson.Inventory.data;
    const workforceData = historicalDataJson.WorkForce.data;

    const days = standardData.length;

    const history: SimulationHistory = {
      dailyCash: [],
      dailyDebt: [],
      dailyNetWorth: [],
      dailyRevenue: [],
      dailyExpenses: [],
      dailyInterestPaid: [],
      dailyInterestEarned: [],
      dailyDebtPaydown: [],
      dailyPreemptiveLoan: [],
      dailyDebtSavings: [],
      dailyStandardProduction: [],
      dailyCustomProduction: [],
      dailyStandardWIP: [],
      dailyCustomWIP: [],
      dailyFinishedStandard: [],
      dailyFinishedCustom: [],
      dailyCustomQueue1: [],
      dailyCustomQueue2: [],
      dailyCustomQueue3: [],
      dailyStdQueue1: [],
      dailyStdQueue2: [],
      dailyStdQueue3: [],
      dailyStdQueue4: [],
      dailyStdQueue5: [],
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
      dailyMCEAllocation: [],
      dailyOvertimeHours: [],
      dailyCustomBasePrice: [],
      dailyCustomPenaltyPerDay: [],
      dailyCustomTargetDeliveryDays: [],
      actionsPerformed: [],
      policyChanges: [],
    };

    // Process each day of historical data
    for (let i = 0; i < days; i++) {
      const day = standardData[i].Day;
      const stdDay = standardData[i];
      const custDay = customData[i];
      const finDay = financialData[i];
      const invDay = inventoryData[i];
      const wfDay = workforceData[i];

      // Financial data
      const cash = finDay['Finance-Cash On Hand'] || 0;
      const debt = finDay['Finance-Debt'] || 0;
      const interestEarned = i > 0
        ? (finDay['Finance-Interest Earned *To Date'] || 0) - (financialData[i-1]['Finance-Interest Earned *To Date'] || 0)
        : (finDay['Finance-Interest Earned *To Date'] || 0);

      // Calculate daily revenue from cumulative sales
      const standardSales = i > 0
        ? (finDay['Finance-Sales Standard *To Date'] || 0) - (financialData[i-1]['Finance-Sales Standard *To Date'] || 0)
        : (finDay['Finance-Sales Standard *To Date'] || 0);
      const customSales = i > 0
        ? (finDay['Finance-Sales Custom *To Date'] || 0) - (financialData[i-1]['Finance-Sales Custom *To Date'] || 0)
        : (finDay['Finance-Sales Custom *To Date'] || 0);
      const revenue = standardSales + customSales;

      // Calculate daily expenses from cumulative salaries
      const dailySalary = i > 0
        ? (finDay['Finance-Salaries *To Date'] || 0) - (financialData[i-1]['Finance-Salaries *To Date'] || 0)
        : (finDay['Finance-Salaries *To Date'] || 0);

      // Production outputs
      const standardProduction = stdDay['Standard Deliveries-Deliveries'] || 0;
      const customProduction = custDay['Custom Deliveries-Deliveries'] || 0;

      // WIP calculations - Sum all queue levels for total WIP
      const standardWIP =
        (stdDay['Standard Queue 1-Level'] || 0) +
        (stdDay['Standard Queue 2-Level'] || 0) +
        (stdDay['Standard Queue 3-Level'] || 0) +
        (stdDay['Standard Queue 4-Level'] || 0) +
        (stdDay['Standard Queue 5-Level'] || 0);

      const customWIP =
        (custDay['Custom Queue 1-Level'] || 0) +
        (custDay['Custom Queue 2-Level First Pass'] || 0) +
        (custDay['Custom Queue 3-Level'] || 0) +
        (custDay['Custom Queue 2-Level Second Pass'] || 0);

      // Raw materials
      const rawMaterial = invDay['Inventory-Level'] || 0;
      const rawMaterialOrdered = invDay['Inventory-Dispatches'] || 0;

      // Workforce
      const experts = wfDay['WorkForce-Experts'] || 0;
      const rookies = wfDay['WorkForce-Rookies'] || 0;

      // Machine counts from Excel data
      const mceCount = stdDay['Standard Station 1-Number of Machines'] || 1;
      const wmaCount = custDay['Custom Station 2-Number of Machines'] || 2;
      const pucCount = custDay['Custom Station 3-Number of Machines'] || 2;

      // Prices
      const standardPrice = stdDay['Standard Deliveries-Market Price'] || 200;
      const customPrice = custDay['Custom Deliveries-Actual Price'] || 100;
      const customLeadTime = custDay['Custom Deliveries-Average Lead Time'] || 5;

      // Push to history arrays
      history.dailyCash.push({ day, value: Math.round(cash) });
      history.dailyDebt.push({ day, value: Math.round(debt) });
      history.dailyNetWorth.push({ day, value: Math.round(cash - debt) });
      history.dailyRevenue.push({ day, value: Math.round(revenue) });
      history.dailyExpenses.push({ day, value: Math.round(dailySalary) });
      history.dailyInterestPaid.push({ day, value: 0 });
      history.dailyInterestEarned.push({ day, value: Math.round(interestEarned) });
      history.dailyDebtPaydown.push({ day, value: 0 }); // Debt management not in historical data
      history.dailyPreemptiveLoan.push({ day, value: 0 });
      history.dailyDebtSavings.push({ day, value: 0 });
      history.dailyStandardProduction.push({ day, value: Math.round(standardProduction) });
      history.dailyCustomProduction.push({ day, value: Math.round(customProduction) });
      history.dailyStandardWIP.push({ day, value: Math.round(standardWIP) });
      history.dailyCustomWIP.push({ day, value: Math.round(customWIP) });
      history.dailyFinishedStandard.push({ day, value: Math.round(stdDay['Standard Queue 5-Level'] || 0) });
      history.dailyFinishedCustom.push({ day, value: 0 }); // Custom ships direct
      history.dailyRawMaterial.push({ day, value: Math.round(rawMaterial) });
      history.dailyRawMaterialOrders.push({ day, value: Math.round(rawMaterialOrdered) });
      history.dailyRawMaterialOrdersPlaced.push({ day, value: Math.round(rawMaterialOrdered) });
      history.dailyRawMaterialCost.push({ day, value: rawMaterialOrdered > 0 ? 10000 : 0 });
      history.dailyExperts.push({ day, value: experts });
      history.dailyRookies.push({ day, value: rookies });
      history.dailyRookiesInTraining.push({ day, value: 0 });
      history.dailySalaryCost.push({ day, value: Math.round(dailySalary) });
      history.dailyMCECount.push({ day, value: mceCount });
      history.dailyWMACount.push({ day, value: wmaCount });
      history.dailyPUCCount.push({ day, value: pucCount });
      history.dailyStandardPrice.push({ day, value: Math.round(standardPrice) });
      history.dailyCustomPrice.push({ day, value: Math.round(customPrice) });
      history.dailyCustomDeliveryTime.push({ day, value: Math.round(customLeadTime) });
      history.dailyReorderPoint.push({ day, value: 50 });
      history.dailyOrderQuantity.push({ day, value: 200 });
      history.dailyStandardBatchSize.push({ day, value: 60 });
      history.dailyMCEAllocation.push({ day, value: 0.50 });
      history.dailyOvertimeHours.push({ day, value: 0 });
      history.dailyCustomBasePrice.push({ day, value: 106.56 });
      history.dailyCustomPenaltyPerDay.push({ day, value: 0.27 });
      history.dailyCustomTargetDeliveryDays.push({ day, value: 5 });
    }

    // Final day values
    const finalDay = days - 1;
    const finalCash = Math.round(financialData[finalDay]['Finance-Cash On Hand'] || 0);
    const finalDebt = Math.round(financialData[finalDay]['Finance-Debt'] || 0);
    const finalNetWorth = finalCash - finalDebt;
    const finalRawMaterial = Math.round(inventoryData[finalDay]['Inventory-Level'] || 0);
    const finalStandardQueue5 = Math.round(standardData[finalDay]['Standard Queue 5-Level'] || 0);
    const finalExperts = workforceData[finalDay]['WorkForce-Experts'] || 0;
    const finalRookies = workforceData[finalDay]['WorkForce-Rookies'] || 0;
    const finalMCE = standardData[finalDay]['Standard Station 1-Number of Machines'] || 1;
    const finalWMA = customData[finalDay]['Custom Station 2-Number of Machines'] || 2;
    const finalPUC = customData[finalDay]['Custom Station 3-Number of Machines'] || 2;

    return {
      finalCash,
      finalDebt,
      finalNetWorth,
      fitnessScore: finalNetWorth,
      strategy: PLACEHOLDER_STRATEGY,
      state: {
        currentDay: days - 1,
        cash: finalCash,
        debt: finalDebt,
        rawMaterialInventory: finalRawMaterial,
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
          standard: finalStandardQueue5,
          custom: 0,
        },
        workforce: {
          experts: finalExperts,
          rookies: finalRookies,
          rookiesInTraining: [],
          employeeOvertimeTracking: [],
        },
        machines: {
          MCE: finalMCE,
          WMA: finalWMA,
          PUC: finalPUC,
        },
        pendingRawMaterialOrders: [],
        rejectedMaterialOrders: 0,
        stockoutDays: 0,
        lostProductionDays: 0,
        history,
      },
    };
  } catch (error) {
    console.error('Error loading historical data:', error);
    return null;
  }
}
