import type { Strategy, StrategyAction, SimulationResult } from '../../simulation/types';

export interface SavedStrategy {
  id: string;
  name: string;
  description: string;
  strategy: Strategy;
  result?: SimulationResult;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationStatus {
  isRunning: boolean;
  progress?: number;
  error?: string;
  result?: SimulationResult;
}

export { Strategy, StrategyAction, SimulationResult };
