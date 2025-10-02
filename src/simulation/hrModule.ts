/**
 * HR Module - Handles workforce management with full type safety
 * Manages hiring, training, promotions, salary calculations, and employee turnover
 * Includes data-driven quit risk model for sustained overtime
 */

import type { SimulationState, EmployeeOvertimeRecord } from './types.js';
import { CONSTANTS } from './constants.js';

// Quit risk constants (data-driven estimates)
const OVERTIME_TRIGGER_DAYS = 5; // Consecutive days before quit risk activates
const QUIT_PROBABILITY_AFTER_TRIGGER = 0.1; // 10% chance per day after trigger

export interface HireResult {
  type: 'ROOKIE' | 'EXPERT';
  hireDay: number;
  promotionDay?: number;
  newRookieCount?: number;
  newExpertCount?: number;
}

export interface Promotion {
  hireDay: number;
  promotionDay: number;
  type: 'ROOKIE_TO_EXPERT';
}

export interface SalaryCost {
  expertSalary: number;
  rookieSalary: number;
  regularSalary: number;
  overtimeCost: number;
  totalSalary: number;
  breakdown: {
    experts: number;
    expertRate: number;
    rookies: number;
    rookieRate: number;
  };
}

export interface WorkforceProductivity {
  experts: number;
  rookies: number;
  expertProductivity: number;
  rookieProductivity: number;
  totalProductivity: number;
  effectiveExperts: number;
}

export interface WorkforceSummary {
  total: number;
  experts: number;
  rookies: number;
  inTraining: number;
  productivity: number;
  dailySalaryCost: number;
}

export interface CapacityCheck {
  currentProductivity: number;
  requiredProductivity: number;
  hasCapacity: boolean;
  shortfall: number;
  utilizationRate: number;
}

/**
 * Hires a new rookie
 */
export function hireRookie(state: SimulationState): HireResult {
  state.workforce.rookies += 1;
  state.workforce.rookiesInTraining.push({
    hireDay: state.currentDay,
    daysRemaining: CONSTANTS.ROOKIE_TRAINING_TIME,
  });

  // Initialize overtime tracking for new employee
  state.workforce.employeeOvertimeTracking.push({
    employeeId: `rookie-${state.currentDay}-${state.workforce.rookies}`,
    employeeType: 'rookie',
    consecutiveOvertimeDays: 0,
  });

  return {
    type: 'ROOKIE',
    hireDay: state.currentDay,
    promotionDay: state.currentDay + CONSTANTS.ROOKIE_TRAINING_TIME,
    newRookieCount: state.workforce.rookies,
  };
}

/**
 * Hires an expert directly (if allowed by business rules)
 */
export function hireExpert(state: SimulationState): HireResult {
  state.workforce.experts += 1;

  // Initialize overtime tracking for new employee
  state.workforce.employeeOvertimeTracking.push({
    employeeId: `expert-${state.currentDay}-${state.workforce.experts}`,
    employeeType: 'expert',
    consecutiveOvertimeDays: 0,
  });

  return {
    type: 'EXPERT',
    hireDay: state.currentDay,
    newExpertCount: state.workforce.experts,
  };
}

/**
 * Processes rookie training and promotes rookies to experts after training period
 */
export function processRookieTraining(state: SimulationState): Promotion[] {
  const promotions: Promotion[] = [];

  // Update training progress
  state.workforce.rookiesInTraining = state.workforce.rookiesInTraining.filter((rookie) => {
    rookie.daysRemaining -= 1;

    if (rookie.daysRemaining <= 0) {
      // Promote to expert
      state.workforce.rookies -= 1;
      state.workforce.experts += 1;

      promotions.push({
        hireDay: rookie.hireDay,
        promotionDay: state.currentDay,
        type: 'ROOKIE_TO_EXPERT',
      });

      return false; // Remove from training list
    }

    return true; // Keep in training
  });

  return promotions;
}

/**
 * Calculates total daily salary cost
 */
export function calculateDailySalaryCost(
  state: SimulationState,
  includeOvertime = false,
  overtimeHours = 0
): SalaryCost {
  const expertSalary = state.workforce.experts * CONSTANTS.EXPERT_SALARY;
  const rookieSalary = state.workforce.rookies * CONSTANTS.ROOKIE_SALARY;
  const regularSalary = expertSalary + rookieSalary;

  let overtimeCost = 0;
  if (includeOvertime && overtimeHours > 0) {
    // Calculate overtime based on hourly rate (assuming 8-hour workday)
    const expertHourlyRate = CONSTANTS.EXPERT_SALARY / 8;
    const rookieHourlyRate = CONSTANTS.ROOKIE_SALARY / 8;

    overtimeCost =
      overtimeHours *
      CONSTANTS.OVERTIME_MULTIPLIER *
      (state.workforce.experts * expertHourlyRate + state.workforce.rookies * rookieHourlyRate);
  }

  return {
    expertSalary,
    rookieSalary,
    regularSalary,
    overtimeCost,
    totalSalary: regularSalary + overtimeCost,
    breakdown: {
      experts: state.workforce.experts,
      expertRate: CONSTANTS.EXPERT_SALARY,
      rookies: state.workforce.rookies,
      rookieRate: CONSTANTS.ROOKIE_SALARY,
    },
  };
}

/**
 * Gets current workforce productivity for production calculations
 */
export function getWorkforceProductivity(state: SimulationState): WorkforceProductivity {
  const expertProductivity = state.workforce.experts * CONSTANTS.ARCP_EXPERT_PRODUCTIVITY;
  const rookieProductivity =
    state.workforce.rookies *
    CONSTANTS.ARCP_EXPERT_PRODUCTIVITY *
    CONSTANTS.ARCP_ROOKIE_PRODUCTIVITY_FACTOR;

  const totalProductivity = expertProductivity + rookieProductivity;

  return {
    experts: state.workforce.experts,
    rookies: state.workforce.rookies,
    expertProductivity,
    rookieProductivity,
    totalProductivity,
    effectiveExperts: totalProductivity / CONSTANTS.ARCP_EXPERT_PRODUCTIVITY,
  };
}

/**
 * Gets workforce summary for logging and display
 */
export function getWorkforceSummary(state: SimulationState): WorkforceSummary {
  const productivity = getWorkforceProductivity(state);
  const salaryCost = calculateDailySalaryCost(state);

  return {
    total: state.workforce.experts + state.workforce.rookies,
    experts: state.workforce.experts,
    rookies: state.workforce.rookies,
    inTraining: state.workforce.rookiesInTraining.length,
    productivity: productivity.totalProductivity,
    dailySalaryCost: salaryCost.totalSalary,
  };
}

/**
 * Checks if workforce has capacity to take on more work
 */
export function checkWorkforceCapacity(state: SimulationState, requiredProductivity: number): CapacityCheck {
  const current = getWorkforceProductivity(state);

  return {
    currentProductivity: current.totalProductivity,
    requiredProductivity,
    hasCapacity: current.totalProductivity >= requiredProductivity,
    shortfall: Math.max(0, requiredProductivity - current.totalProductivity),
    utilizationRate: requiredProductivity > 0 ? current.totalProductivity / requiredProductivity : 1,
  };
}

/**
 * Updates overtime tracking for employees working overtime
 * Call this when employees work overtime (implementation dependent on production module)
 */
export function trackOvertime(state: SimulationState, workedOvertime: boolean): void {
  if (workedOvertime) {
    // Increment consecutive overtime days for all employees
    state.workforce.employeeOvertimeTracking.forEach((record) => {
      record.consecutiveOvertimeDays += 1;
    });
  } else {
    // Reset overtime tracking for all employees (no overtime worked)
    state.workforce.employeeOvertimeTracking.forEach((record) => {
      record.consecutiveOvertimeDays = 0;
    });
  }
}

/**
 * Processes employee quit risk based on sustained overtime
 * Data-driven model: 10% quit chance after 5 consecutive days of overtime
 * Returns number of employees who quit
 */
export function processEmployeeQuitRisk(state: SimulationState): { expertsQuit: number; rookiesQuit: number } {
  let expertsQuit = 0;
  let rookiesQuit = 0;

  // Filter out employees who quit
  state.workforce.employeeOvertimeTracking = state.workforce.employeeOvertimeTracking.filter((record) => {
    // Check if employee has worked overtime for trigger threshold
    if (record.consecutiveOvertimeDays >= OVERTIME_TRIGGER_DAYS) {
      // Apply quit probability
      if (Math.random() < QUIT_PROBABILITY_AFTER_TRIGGER) {
        // Employee quits
        if (record.employeeType === 'expert') {
          state.workforce.experts = Math.max(0, state.workforce.experts - 1);
          expertsQuit += 1;
        } else {
          state.workforce.rookies = Math.max(0, state.workforce.rookies - 1);
          rookiesQuit += 1;
          // Remove from training if in training
          state.workforce.rookiesInTraining = state.workforce.rookiesInTraining.slice(0, -1);
        }
        return false; // Remove from tracking
      }
    }
    return true; // Keep employee
  });

  return { expertsQuit, rookiesQuit };
}
