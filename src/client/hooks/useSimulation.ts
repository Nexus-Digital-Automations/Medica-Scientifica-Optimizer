import { useState } from 'react';
import { useStrategyStore } from '../stores/strategyStore';
import type { SimulationResult } from '../types/ui.types';

interface SimulationResponse {
  success: boolean;
  result?: SimulationResult;
  businessRules?: {
    valid: boolean;
    violations: Array<{
      severity: 'CRITICAL' | 'MAJOR' | 'WARNING';
      rule: string;
      message: string;
    }>;
    criticalCount: number;
    majorCount: number;
    warningCount: number;
  };
  executionTime?: number;
  error?: string;
}

export function useSimulation() {
  const { strategy, setSimulationResult, setSimulating, setSimulationError } = useStrategyStore();
  const [progress, setProgress] = useState(0);

  const runSimulation = async () => {
    setSimulating(true);
    setSimulationError(null);
    setProgress(0);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strategy }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SimulationResponse = await response.json();

      if (data.success && data.result) {
        setSimulationResult(data.result);
        setProgress(100);
        return { success: true, data };
      } else {
        setSimulationError(data.error || 'Simulation failed');
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSimulationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSimulating(false);
    }
  };

  return {
    runSimulation,
    progress,
  };
}
