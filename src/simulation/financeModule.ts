/**
 * Finance Module - Handles all financial operations
 * Manages cash, debt, interest calculations, and loans with full type safety
 */

import type { SimulationState } from './types.js';
import { CONSTANTS } from './constants.js';

export interface LoanTransaction {
  loanAmount: number;
  commission: number;
  netAmount: number;
  isSalaryLoan: boolean;
  newDebt: number;
  newCash: number;
}

export interface DebtPayment {
  requestedAmount: number;
  actualPayment: number;
  success: boolean;
  reason?: string;
  newDebt?: number;
  newCash?: number;
}

export interface Payment {
  amount: number;
  description: string;
  paidFromCash: boolean;
  loanTaken: LoanTransaction | null;
}

export interface FinancialHealth {
  cash: number;
  debt: number;
  netWorth: number;
  debtToAssetRatio: number;
  dailyDebtCost: number;
  isSolvent: boolean;
}

export interface RevenueTransaction {
  amount: number;
  source: string;
  newCash: number;
}

/**
 * Calculates and applies daily interest on debt
 */
export function applyDebtInterest(state: SimulationState): number {
  if (state.debt <= 0) {
    return 0;
  }

  const interestAmount = state.debt * CONSTANTS.DEBT_INTEREST_RATE_DAILY;
  state.debt += interestAmount;
  state.cash -= interestAmount;

  return interestAmount;
}

/**
 * Calculates and applies daily interest earned on positive cash
 */
export function applyCashInterest(state: SimulationState): number {
  if (state.cash <= 0) {
    return 0;
  }

  const interestAmount = state.cash * CONSTANTS.CASH_INTEREST_RATE_DAILY;
  state.cash += interestAmount;

  return interestAmount;
}

/**
 * Takes out a loan (adds to cash and debt)
 */
export function takeLoan(state: SimulationState, amount: number, isSalaryLoan = false): LoanTransaction {
  const commissionRate = isSalaryLoan
    ? CONSTANTS.SALARY_DEBT_COMMISSION
    : CONSTANTS.NORMAL_DEBT_COMMISSION;

  const commission = amount * commissionRate;
  const netAmount = amount - commission;

  state.cash += netAmount;
  state.debt += amount;

  return {
    loanAmount: amount,
    commission,
    netAmount,
    isSalaryLoan,
    newDebt: state.debt,
    newCash: state.cash,
  };
}

/**
 * Pays down debt
 */
export function payDebt(state: SimulationState, amount: number): DebtPayment {
  const actualPayment = Math.min(amount, state.debt, state.cash);

  if (actualPayment <= 0) {
    return {
      requestedAmount: amount,
      actualPayment: 0,
      success: false,
      reason: 'Insufficient cash or no debt',
    };
  }

  state.cash -= actualPayment;
  state.debt -= actualPayment;

  return {
    requestedAmount: amount,
    actualPayment,
    success: true,
    newDebt: state.debt,
    newCash: state.cash,
  };
}

/**
 * Processes a payment (deducts from cash, takes automatic salary loan if needed)
 */
export function processPayment(state: SimulationState, amount: number, description: string): Payment {
  if (state.cash >= amount) {
    state.cash -= amount;
    return {
      amount,
      description,
      paidFromCash: true,
      loanTaken: null,
    };
  }

  // Need to take salary loan
  const shortfall = amount - state.cash;
  const loanDetails = takeLoan(state, shortfall, true);

  // Now pay the amount
  state.cash -= amount;

  return {
    amount,
    description,
    paidFromCash: false,
    loanTaken: loanDetails,
  };
}

/**
 * Calculates total daily financial expenses (salaries + interest)
 */
export function calculateDailyExpenses(state: SimulationState, salaryCost: number): number {
  const debtInterest = state.debt * CONSTANTS.DEBT_INTEREST_RATE_DAILY;
  return salaryCost + debtInterest;
}

/**
 * Adds revenue to cash
 */
export function addRevenue(state: SimulationState, amount: number, source: string): RevenueTransaction {
  state.cash += amount;

  return {
    amount,
    source,
    newCash: state.cash,
  };
}

/**
 * Checks if cash is critically low and automatic loan is needed
 */
export function isCashCritical(state: SimulationState): boolean {
  return state.cash < 0;
}

/**
 * Calculates current financial health metrics
 */
export function getFinancialHealth(state: SimulationState): FinancialHealth {
  const netWorth = state.cash - state.debt;
  const debtToAssetRatio = state.cash > 0 ? state.debt / state.cash : Infinity;
  const dailyDebtCost = state.debt * CONSTANTS.DEBT_INTEREST_RATE_DAILY;

  return {
    cash: state.cash,
    debt: state.debt,
    netWorth,
    debtToAssetRatio,
    dailyDebtCost,
    isSolvent: netWorth > 0,
  };
}
