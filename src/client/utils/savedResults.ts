import type { SimulationResult } from '../../simulation/types';

export interface SavedSimulationResult {
  id: string;
  timestamp: number;
  strategyName: string;
  result: SimulationResult;
  metadata: {
    finalCash: number;
    finalNetWorth: number;
    totalProfit: number;
    totalRevenue: number;
    averageUtilization: number;
  };
}

const STORAGE_KEY = 'medica_saved_results';
const MAX_SAVED_RESULTS = 50; // Limit to prevent localStorage overflow

/**
 * Load all saved simulation results from localStorage
 */
export function loadSavedResults(): SavedSimulationResult[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const results = JSON.parse(stored) as SavedSimulationResult[];
    return results.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  } catch (error) {
    console.error('Failed to load saved results:', error);
    return [];
  }
}

/**
 * Save a simulation result to localStorage
 */
export function saveSimulationResult(
  strategyName: string,
  result: SimulationResult
): SavedSimulationResult {
  try {
    const savedResults = loadSavedResults();

    // Calculate metadata for quick preview
    const history = result.state.history;
    const finalCash = history.dailyCash[history.dailyCash.length - 1]?.value || 0;
    const finalNetWorth = history.dailyNetWorth[history.dailyNetWorth.length - 1]?.value || 0;

    const totalRevenue = history.dailyRevenue.reduce((sum: number, d) => sum + d.value, 0);
    const totalExpenses = history.dailyExpenses.reduce((sum: number, d) => sum + d.value, 0);
    const totalProfit = totalRevenue - totalExpenses;

    // Calculate average utilization from production metrics
    const totalProduction = history.dailyStandardProduction.reduce((sum: number, d) => sum + d.value, 0) +
                           history.dailyCustomProduction.reduce((sum: number, d) => sum + d.value, 0);
    const daysWithProduction = history.dailyStandardProduction.length;
    const averageUtilization = daysWithProduction > 0 ? (totalProduction / daysWithProduction) / 100 : 0;

    const newSavedResult: SavedSimulationResult = {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      strategyName,
      result,
      metadata: {
        finalCash,
        finalNetWorth,
        totalProfit,
        totalRevenue,
        averageUtilization,
      },
    };

    // Add new result at the beginning
    savedResults.unshift(newSavedResult);

    // Limit to MAX_SAVED_RESULTS to prevent localStorage overflow
    const trimmedResults = savedResults.slice(0, MAX_SAVED_RESULTS);

    // Save back to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedResults));

    return newSavedResult;
  } catch (error) {
    console.error('Failed to save simulation result:', error);
    throw error;
  }
}

/**
 * Delete a saved simulation result by ID
 */
export function deleteSavedResult(id: string): void {
  try {
    const savedResults = loadSavedResults();
    const filtered = savedResults.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete saved result:', error);
    throw error;
  }
}

/**
 * Get a specific saved result by ID
 */
export function getSavedResultById(id: string): SavedSimulationResult | null {
  const savedResults = loadSavedResults();
  return savedResults.find(r => r.id === id) || null;
}

/**
 * Clear all saved results
 */
export function clearAllSavedResults(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear saved results:', error);
    throw error;
  }
}

/**
 * Get the most recent saved result
 */
export function getMostRecentSavedResult(): SavedSimulationResult | null {
  const savedResults = loadSavedResults();
  return savedResults.length > 0 ? savedResults[0] : null;
}
