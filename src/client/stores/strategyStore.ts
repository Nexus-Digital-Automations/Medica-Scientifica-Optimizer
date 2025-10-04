import { create } from 'zustand';
import type { Strategy, StrategyAction, SimulationResult } from '../types/ui.types';

interface StrategyStore {
  // Current strategy being edited
  strategy: Strategy;

  // Simulation state
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  simulationError: string | null;

  // Actions
  updateStrategy: (updates: Partial<Strategy>) => void;
  addTimedAction: (action: StrategyAction) => void;
  updateTimedAction: (index: number, action: StrategyAction) => void;
  removeTimedAction: (index: number) => void;
  resetStrategy: () => void;
  loadStrategy: (strategy: Strategy) => void;

  // Simulation actions
  setSimulationResult: (result: SimulationResult | null) => void;
  setSimulating: (isSimulating: boolean) => void;
  setSimulationError: (error: string | null) => void;
}

const DEFAULT_STRATEGY: Strategy = {
  // Inventory Management (will be calculated dynamically by simulation)
  reorderPoint: 0,
  orderQuantity: 0,
  standardBatchSize: 0,

  // Production Allocation
  mceAllocationCustom: 0.50, // 50% to custom, 50% to standard

  // Pricing
  standardPrice: 800,
  dailyOvertimeHours: 0,
  customBasePrice: 106.56,
  customPenaltyPerDay: 0.27,
  customTargetDeliveryDays: 5,

  // Demand Model
  customDemandMean1: 25,
  customDemandStdDev1: 5,
  customDemandMean2: 32.5,
  customDemandStdDev2: 6.5,

  // Standard Demand Curve
  standardDemandIntercept: 500,
  standardDemandSlope: -0.25,

  // Quit Risk Model
  overtimeTriggerDays: 5,
  dailyQuitProbability: 0.10,

  // Timed Actions
  timedActions: [],
};

export const useStrategyStore = create<StrategyStore>((set) => ({
  strategy: DEFAULT_STRATEGY,
  simulationResult: null,
  isSimulating: false,
  simulationError: null,

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

  resetStrategy: () =>
    set({
      strategy: DEFAULT_STRATEGY,
      simulationResult: null,
      simulationError: null,
    }),

  loadStrategy: (strategy) =>
    set({
      strategy,
      simulationResult: null,
      simulationError: null,
    }),

  setSimulationResult: (result) => set({ simulationResult: result }),
  setSimulating: (isSimulating) => set({ isSimulating }),
  setSimulationError: (error) => set({ simulationError: error }),
}));
