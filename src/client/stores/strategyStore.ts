import { create } from 'zustand';
import type { Strategy, StrategyAction, SimulationResult } from '../types/ui.types';
import type { SavedSimulationResult } from '../utils/savedResults';
import type { ConstraintSuggestionSet } from '../utils/constraintSuggestions';
import {
  loadSavedResults,
  saveSimulationResult,
  deleteSavedResult,
} from '../utils/savedResults';

export interface SavedStrategy {
  id: string;
  name: string;
  strategy: Strategy;
  scenarioId?: string; // ID to determine which initial state to use ('business-case-day51' | 'historical-data-day51')
  description?: string; // Optional description of the scenario
  createdAt: string;
  updatedAt: string;
}

interface StrategyStore {
  // Current strategy being edited
  strategy: Strategy;
  currentScenarioId?: string; // Track which scenario this strategy is for

  // Simulation state
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  simulationError: string | null;

  // Saved strategies
  savedStrategies: SavedStrategy[];

  // Saved simulation results
  savedResults: SavedSimulationResult[];
  currentViewingResultId: string | null; // ID of result being viewed, null means current simulation

  // Pending constraint suggestions
  pendingConstraintSuggestions: ConstraintSuggestionSet | null;

  // Actions
  updateStrategy: (updates: Partial<Strategy>) => void;
  addTimedAction: (action: StrategyAction) => void;
  updateTimedAction: (index: number, action: StrategyAction) => void;
  removeTimedAction: (index: number) => void;
  toggleTimedActionLock: (index: number) => void;
  resetStrategy: () => void;
  loadStrategy: (strategy: Strategy) => void;

  // Saved strategy actions
  saveStrategy: (name: string) => void;
  loadSavedStrategy: (id: string) => void;
  deleteSavedStrategy: (id: string) => void;
  updateSavedStrategy: (id: string, name: string) => void;

  // Simulation actions
  setSimulationResult: (result: SimulationResult | null) => void;
  setSimulating: (isSimulating: boolean) => void;
  setSimulationError: (error: string | null) => void;

  // Saved results actions
  saveCurrentResult: (strategyName: string) => void;
  loadSavedResult: (id: string) => void;
  deleteSavedResultById: (id: string) => void;
  refreshSavedResults: () => void;
  viewCurrentSimulation: () => void;
  getViewingResult: () => SimulationResult | null; // Gets either current sim or saved result

  // Constraint suggestion actions
  setPendingConstraintSuggestions: (suggestions: ConstraintSuggestionSet | null) => void;
  applyConstraintSuggestions: (suggestionIds: string[]) => void;
  clearPendingConstraintSuggestions: () => void;
}

const DEFAULT_STRATEGY: Strategy = {
  // Inventory Management (will be calculated dynamically by simulation)
  reorderPoint: 0,
  orderQuantity: 0,
  standardBatchSize: 0,

  // Production Allocation
  mceAllocationCustom: 0.50, // 50% to custom, 50% to standard

  // Pricing
  standardPrice: 225, // Competitive market price (reflects steep demand curve)
  dailyOvertimeHours: 0,
  customBasePrice: 106.56,
  customPenaltyPerDay: 0.27,
  customTargetDeliveryDays: 5,

  // Demand Model
  customDemandMean1: 25,
  customDemandStdDev1: 5,
  customDemandMean2: 32.5,
  customDemandStdDev2: 6.5,

  // Standard Demand Curve (COMPETITIVE market - steep slope)
  // Q = 1500 - 5.0 * P means zero demand at prices above $300
  standardDemandIntercept: 1500,
  standardDemandSlope: -5.0,

  // Quit Risk Model
  overtimeTriggerDays: 5,
  dailyQuitProbability: 0.10,

  // Timed Actions
  timedActions: [],
};

// LocalStorage helpers
const STORAGE_KEY = 'medica-saved-strategies';

// Pre-loaded default strategies
const DEFAULT_STRATEGIES: SavedStrategy[] = [
  {
    id: 'business-case-day51',
    name: 'Business Case (Day 51)',
    strategy: {
      ...DEFAULT_STRATEGY,
      // Business Case specific values are already in DEFAULT_STRATEGY
    },
    scenarioId: 'business-case-day51',
    description: 'Textbook starting point: Cash $8.2K, Debt $70K, 0 inventory, 120 WIP',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'historical-data-day51',
    name: 'Historical Data (Day 51)',
    strategy: {
      ...DEFAULT_STRATEGY,
      // Historical data uses same strategy parameters, just different initial state
    },
    scenarioId: 'historical-data-day51',
    description: 'Excel data: Cash $384K, Debt $0, 164 inventory, 414 WIP',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const loadSavedStrategiesFromStorage = (): SavedStrategy[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const userStrategies = stored ? JSON.parse(stored) : [];

    // Check if default strategies already exist
    const hasBusinessCase = userStrategies.some((s: SavedStrategy) => s.id === 'business-case-day51');
    const hasHistorical = userStrategies.some((s: SavedStrategy) => s.id === 'historical-data-day51');

    // Add missing default strategies
    const strategies = [...userStrategies];
    if (!hasBusinessCase) {
      strategies.unshift(DEFAULT_STRATEGIES[0]);
    }
    if (!hasHistorical) {
      // Add historical after business case
      const businessCaseIndex = strategies.findIndex(s => s.id === 'business-case-day51');
      strategies.splice(businessCaseIndex + 1, 0, DEFAULT_STRATEGIES[1]);
    }

    return strategies;
  } catch (error) {
    console.error('Failed to load saved strategies from localStorage:', error);
    return DEFAULT_STRATEGIES;
  }
};

const saveSavedStrategiesToStorage = (strategies: SavedStrategy[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
  } catch (error) {
    console.error('Failed to save strategies to localStorage:', error);
  }
};

export const useStrategyStore = create<StrategyStore>((set, get) => ({
  strategy: DEFAULT_STRATEGY,
  currentScenarioId: 'business-case-day51', // Default to business case scenario
  simulationResult: null,
  isSimulating: false,
  simulationError: null,
  savedStrategies: loadSavedStrategiesFromStorage(),
  savedResults: loadSavedResults(),
  currentViewingResultId: null,
  pendingConstraintSuggestions: null,

  updateStrategy: (updates) =>
    set((state) => ({
      strategy: { ...state.strategy, ...updates },
    })),

  addTimedAction: (action) =>
    set((state) => ({
      strategy: {
        ...state.strategy,
        timedActions: [...state.strategy.timedActions, action].sort((a, b) => a.day - b.day),
      },
    })),

  updateTimedAction: (index, action) =>
    set((state) => ({
      strategy: {
        ...state.strategy,
        timedActions: state.strategy.timedActions.map((a, i) => (i === index ? action : a)).sort((a, b) => a.day - b.day),
      },
    })),

  removeTimedAction: (index) =>
    set((state) => ({
      strategy: {
        ...state.strategy,
        timedActions: state.strategy.timedActions.filter((_, i) => i !== index),
      },
    })),

  toggleTimedActionLock: (index) =>
    set((state) => ({
      strategy: {
        ...state.strategy,
        timedActions: state.strategy.timedActions.map((a, i) =>
          i === index ? { ...a, isLocked: !a.isLocked } : a
        ),
      },
    })),

  resetStrategy: () =>
    set({
      strategy: DEFAULT_STRATEGY,
      currentScenarioId: 'business-case-day51', // Reset to default scenario
      simulationResult: null,
      simulationError: null,
    }),

  loadStrategy: (strategy) =>
    set({
      strategy,
      simulationResult: null,
      simulationError: null,
    }),

  saveStrategy: (name) => {
    const { strategy, savedStrategies } = get();
    const now = new Date().toISOString();
    const newSavedStrategy: SavedStrategy = {
      id: `strategy-${Date.now()}`,
      name,
      strategy: { ...strategy },
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...savedStrategies, newSavedStrategy];
    saveSavedStrategiesToStorage(updated);
    set({ savedStrategies: updated });
  },

  loadSavedStrategy: (id) => {
    const { savedStrategies } = get();
    const saved = savedStrategies.find((s) => s.id === id);
    if (saved) {
      set({
        strategy: { ...saved.strategy },
        currentScenarioId: saved.scenarioId, // Set the scenario ID from saved strategy
        simulationResult: null,
        simulationError: null,
      });
    }
  },

  deleteSavedStrategy: (id) => {
    const { savedStrategies } = get();
    const updated = savedStrategies.filter((s) => s.id !== id);
    saveSavedStrategiesToStorage(updated);
    set({ savedStrategies: updated });
  },

  updateSavedStrategy: (id, name) => {
    const { savedStrategies } = get();
    const updated = savedStrategies.map((s) =>
      s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s
    );
    saveSavedStrategiesToStorage(updated);
    set({ savedStrategies: updated });
  },

  setSimulationResult: (result) => set({ simulationResult: result, currentViewingResultId: null }),
  setSimulating: (isSimulating) => set({ isSimulating }),
  setSimulationError: (error) => set({ simulationError: error }),

  // Saved results management
  saveCurrentResult: (strategyName) => {
    const { simulationResult } = get();
    if (simulationResult) {
      try {
        saveSimulationResult(strategyName, simulationResult);
        set({ savedResults: loadSavedResults() });
      } catch (error) {
        console.error('Failed to save simulation result:', error);
      }
    }
  },

  loadSavedResult: (id) => {
    const { savedResults } = get();
    const result = savedResults.find(r => r.id === id);
    if (result) {
      set({
        currentViewingResultId: id,
        simulationResult: result.result,
      });
    }
  },

  deleteSavedResultById: (id) => {
    try {
      deleteSavedResult(id);
      set({
        savedResults: loadSavedResults(),
        currentViewingResultId: get().currentViewingResultId === id ? null : get().currentViewingResultId,
      });
    } catch (error) {
      console.error('Failed to delete saved result:', error);
    }
  },

  refreshSavedResults: () => {
    set({ savedResults: loadSavedResults() });
  },

  viewCurrentSimulation: () => {
    set({ currentViewingResultId: null });
  },

  getViewingResult: () => {
    const { currentViewingResultId, simulationResult, savedResults } = get();
    if (currentViewingResultId) {
      const saved = savedResults.find(r => r.id === currentViewingResultId);
      return saved?.result || null;
    }
    return simulationResult;
  },

  setPendingConstraintSuggestions: (suggestions) =>
    set({ pendingConstraintSuggestions: suggestions }),

  applyConstraintSuggestions: (suggestionIds) => {
    const pending = get().pendingConstraintSuggestions;
    if (!pending) return;

    const selectedSuggestions = pending.suggestions.filter(s =>
      suggestionIds.includes(s.id)
    );

    // Store in localStorage for cross-page transfer
    localStorage.setItem('appliedConstraintSuggestions', JSON.stringify(selectedSuggestions));

    set({ pendingConstraintSuggestions: null });
  },

  clearPendingConstraintSuggestions: () =>
    set({ pendingConstraintSuggestions: null }),
}));
