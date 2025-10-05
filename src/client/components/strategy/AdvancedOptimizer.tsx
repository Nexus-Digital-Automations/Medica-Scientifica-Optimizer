import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';
import { generateConstrainedStrategyParams, mutateConstrainedStrategyParams, ensureSufficientCash } from '../../utils/geneticOptimizer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { debugLogger } from '../../utils/debugLogger';
import ExcelJS from 'exceljs';
import historicalDataImport from '../../data/historicalData.json';

// Lock state for granular control
type LockState = 'unlocked' | 'minimum' | 'maximum' | 'locked';

interface AdvancedOptimizerProps {
  onResultsReady?: (results: OptimizationCandidate[], evaluationWindow: number) => void;
}

interface OptimizationConstraints {
  // Policy decisions - true means FIXED (don't change), false means VARIABLE (can optimize)
  fixedPolicies: {
    reorderPoint: boolean;
    orderQuantity: boolean;
    standardPrice: boolean;
    standardBatchSize: boolean;
    mceAllocationCustom: boolean;
    dailyOvertimeHours: boolean;
  };
  // Timed actions - can mark specific actions as fixed
  fixedActions: Set<string>; // Action IDs that cannot be changed
  // Test day configuration
  testDay: number;
  endDay: number;
  // Evaluation window for short-term growth rate calculation
  evaluationWindow: number; // Days to measure growth rate (default: 30)
  // Granular lock states for workforce and machines
  workforceLockState: LockState;
  machineLockStates: {
    MCE: LockState;
    WMA: LockState;
    PUC: LockState;
  };
}

export default function AdvancedOptimizer({ onResultsReady }: AdvancedOptimizerProps = {}) {
  const { strategy, loadStrategy, savedStrategies, deleteSavedStrategy } = useStrategyStore();

  const [constraints, setConstraints] = useState<OptimizationConstraints>({
    fixedPolicies: {
      reorderPoint: false,
      orderQuantity: false,
      standardPrice: false,
      standardBatchSize: false,
      mceAllocationCustom: false,
      dailyOvertimeHours: false,
    },
    fixedActions: new Set(),
    testDay: 51,
    endDay: 415,
    evaluationWindow: 30,
    workforceLockState: 'unlocked',
    machineLockStates: {
      MCE: 'unlocked',
      WMA: 'unlocked',
      PUC: 'unlocked'
    },
  });

  // Phase 1 genetic algorithm parameters
  const [phase1Params, setPhase1Params] = useState({
    populationSize: 30,
    generations: 10,
    mutationRate: 0.3,
    eliteCount: 3,
  });

  // Phase 2 refinement parameters
  const [phase2Params, setPhase2Params] = useState({
    populationSize: 25,
    generations: 10,
    mutationRate: 0.25,
    eliteCount: 3,
    refinementIntensity: 0.10, // ±10% mutations
  });

  // Current state locks - now with granular control
  type LockState = 'unlocked' | 'minimum' | 'maximum' | 'locked';
  const [workforceLockState, setWorkforceLockState] = useState<LockState>('unlocked');
  const [machineLockStates, setMachineLockStates] = useState<Record<'MCE' | 'WMA' | 'PUC', LockState>>({
    MCE: 'unlocked',
    WMA: 'unlocked',
    PUC: 'unlocked'
  });
  const [policyLockStates, setPolicyLockStates] = useState<Record<'batchSize' | 'price' | 'mceAllocation', LockState>>({
    batchSize: 'unlocked',
    price: 'unlocked',
    mceAllocation: 'unlocked',
  });

  // Handler functions for current state locks - cycle through states
  const handleLockWorkforce = () => {
    setWorkforceLockState(prev => {
      const newState = (() => {
        switch (prev) {
          case 'unlocked': return 'minimum';
          case 'minimum': return 'maximum';
          case 'maximum': return 'locked';
          case 'locked': return 'unlocked';
          default: return 'unlocked';
        }
      })();
      // Sync with constraints
      setConstraints(c => ({ ...c, workforceLockState: newState }));
      return newState;
    });
  };

  const handleLockMachine = (machineType: 'MCE' | 'WMA' | 'PUC') => {
    setMachineLockStates(prev => {
      const newStates = {
        ...prev,
        [machineType]: (() => {
          switch (prev[machineType]) {
            case 'unlocked': return 'minimum';
            case 'minimum': return 'maximum';
            case 'maximum': return 'locked';
            case 'locked': return 'unlocked';
            default: return 'unlocked';
          }
        })()
      };
      // Sync with constraints
      setConstraints(c => ({ ...c, machineLockStates: newStates }));
      return newStates;
    });
  };

  const handleLockPolicy = (policyType: 'batchSize' | 'price' | 'mceAllocation') => {
    setPolicyLockStates(prev => {
      const newStates = {
        ...prev,
        [policyType]: (() => {
          switch (prev[policyType]) {
            case 'unlocked': return 'minimum';
            case 'minimum': return 'maximum';
            case 'maximum': return 'locked';
            case 'locked': return 'unlocked';
            default: return 'unlocked';
          }
        })()
      };
      // Sync with constraints
      setConstraints(c => ({ ...c, policyLockStates: newStates }));
      return newStates;
    });
  };

  // Get values on the selected test day (applying all timed actions up to that day)
  const getValuesOnDay = (day: number) => {
    const values = {
      reorderPoint: strategy.reorderPoint,
      orderQuantity: strategy.orderQuantity,
      standardPrice: strategy.standardPrice,
      standardBatchSize: strategy.standardBatchSize,
      mceAllocationCustom: strategy.mceAllocationCustom,
      dailyOvertimeHours: strategy.dailyOvertimeHours,
      experts: 1, // Starting values from day 51
      rookies: 0,
      machines: { MCE: 1, WMA: 2, PUC: 2 },
    };

    // Apply all timed actions up to and including the selected day
    const actionsUpToDay = strategy.timedActions
      .filter(a => a.day <= day)
      .sort((a, b) => a.day - b.day);

    for (const action of actionsUpToDay) {
      if (action.type === 'SET_REORDER_POINT' && 'newReorderPoint' in action) {
        values.reorderPoint = action.newReorderPoint;
      } else if (action.type === 'SET_ORDER_QUANTITY' && 'newOrderQuantity' in action) {
        values.orderQuantity = action.newOrderQuantity;
      } else if (action.type === 'ADJUST_PRICE' && 'newPrice' in action && action.productType === 'standard') {
        values.standardPrice = action.newPrice;
      } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
        values.standardBatchSize = action.newSize;
      } else if (action.type === 'ADJUST_MCE_ALLOCATION' && 'newAllocation' in action) {
        values.mceAllocationCustom = action.newAllocation;
      } else if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
        values.rookies += action.count;
      } else if (action.type === 'FIRE_EMPLOYEE' && 'count' in action && 'employeeType' in action) {
        if (action.employeeType === 'expert') {
          values.experts = Math.max(0, values.experts - action.count);
        } else {
          values.rookies = Math.max(0, values.rookies - action.count);
        }
      } else if (action.type === 'BUY_MACHINE' && 'machineType' in action && 'count' in action) {
        values.machines[action.machineType] += action.count;
      } else if (action.type === 'SELL_MACHINE' && 'machineType' in action && 'count' in action) {
        values.machines[action.machineType] = Math.max(0, values.machines[action.machineType] - action.count);
      }
    }

    return values;
  };

  const currentValues = getValuesOnDay(constraints.testDay);

  // Optimization state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'phase1' | 'phase2'>('idle');
  const [phase1Results, setPhase1Results] = useState<OptimizationCandidate[]>([]);
  const [phase2Results, setPhase2Results] = useState<OptimizationCandidate[]>([]);
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0 });

  // Convert strategy parameters to policy decision actions for a specific day
  const createPolicyActionsForDay = (
    day: number,
    params: OptimizationCandidate['strategyParams']
  ): Strategy['timedActions'] => {
    const actions: Strategy['timedActions'] = [];

    // Get all locked actions to determine what the optimizer cannot modify
    const lockedActions = strategy.timedActions.filter(a => a.isLocked);

    // Check if any workforce actions are locked (HIRE_ROOKIE, FIRE_EMPLOYEE)
    // Also check current state panel workforce lock
    const hasLockedWorkforceAction = workforceLockState === 'locked' || lockedActions.some(a =>
      a.type === 'HIRE_ROOKIE' || a.type === 'FIRE_EMPLOYEE'
    );

    // Check if any machine actions are locked per machine type
    // Also check current state panel machine locks
    const hasLockedMCEAction = machineLockStates.MCE === 'locked' || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'MCE'
    );
    const hasLockedWMAAction = machineLockStates.WMA === 'locked' || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'WMA'
    );
    const hasLockedPUCAction = machineLockStates.PUC === 'locked' || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'PUC'
    );

    // Check if any batch size actions are locked
    // Also check current state panel policy lock
    const hasLockedBatchSizeAction = policyLockStates.batchSize === 'locked' || lockedActions.some(a => a.type === 'ADJUST_BATCH_SIZE');

    // Check if any price actions are locked
    // Also check current state panel policy lock
    const hasLockedPriceAction = policyLockStates.price === 'locked' || lockedActions.some(a => a.type === 'ADJUST_PRICE');

    // Check if any MCE allocation actions are locked
    // Also check current state panel policy lock
    const hasLockedMCEAllocationAction = policyLockStates.mceAllocation === 'locked' || lockedActions.some(a => a.type === 'ADJUST_MCE_ALLOCATION');

    if (params) {
      // Only add actions for non-fixed policies AND non-locked actions
      if (!constraints.fixedPolicies.reorderPoint && params.reorderPoint !== undefined) {
        actions.push({
          day,
          type: 'SET_REORDER_POINT',
          newReorderPoint: params.reorderPoint,
        });
      }

      if (!constraints.fixedPolicies.orderQuantity && params.orderQuantity !== undefined) {
        actions.push({
          day,
          type: 'SET_ORDER_QUANTITY',
          newOrderQuantity: params.orderQuantity,
        });
      }

      // Get current values for policy constraint checking
      const currentValues = getValuesOnDay(day);

      // Batch Size - respect lock state (minimum = can only increase, maximum = can only decrease)
      if (!constraints.fixedPolicies.standardBatchSize && params.standardBatchSize !== undefined && !hasLockedBatchSizeAction) {
        const lockState = policyLockStates.batchSize;
        const currentBatchSize = currentValues.standardBatchSize;
        let newBatchSize = params.standardBatchSize;

        if (lockState === 'minimum' && newBatchSize < currentBatchSize) {
          newBatchSize = currentBatchSize; // Can only increase
        } else if (lockState === 'maximum' && newBatchSize > currentBatchSize) {
          newBatchSize = currentBatchSize; // Can only decrease
        }

        if (newBatchSize !== currentBatchSize) {
          actions.push({
            day,
            type: 'ADJUST_BATCH_SIZE',
            newSize: newBatchSize,
          });
        }
      }

      // Standard Price - respect lock state
      if (!constraints.fixedPolicies.standardPrice && params.standardPrice !== undefined && !hasLockedPriceAction) {
        const lockState = policyLockStates.price;
        const currentPrice = currentValues.standardPrice;
        let newPrice = params.standardPrice;

        if (lockState === 'minimum' && newPrice < currentPrice) {
          newPrice = currentPrice; // Can only increase
        } else if (lockState === 'maximum' && newPrice > currentPrice) {
          newPrice = currentPrice; // Can only decrease
        }

        if (newPrice !== currentPrice) {
          actions.push({
            day,
            type: 'ADJUST_PRICE',
            productType: 'standard',
            newPrice: newPrice,
          });
        }
      }

      // MCE Allocation - respect lock state
      if (!constraints.fixedPolicies.mceAllocationCustom && params.mceAllocationCustom !== undefined && !hasLockedMCEAllocationAction) {
        const lockState = policyLockStates.mceAllocation;
        const currentAllocation = currentValues.mceAllocationCustom;
        let newAllocation = params.mceAllocationCustom;

        if (lockState === 'minimum' && newAllocation < currentAllocation) {
          newAllocation = currentAllocation; // Can only increase
        } else if (lockState === 'maximum' && newAllocation > currentAllocation) {
          newAllocation = currentAllocation; // Can only decrease
        }

        if (Math.abs(newAllocation - currentAllocation) > 0.001) { // Use small threshold for float comparison
          actions.push({
            day,
            type: 'ADJUST_MCE_ALLOCATION',
            newAllocation: newAllocation,
          });
        }
      }

      // Note: dailyOvertimeHours is not a policy action, it's a strategy parameter
      // It affects daily operations, not a one-time decision
    }

    // Add diverse one-time actions with increased probabilities and ranges
    // Only add if no locked actions prevent it

    // HIRE_ROOKIE - 70% chance, 1-10 workers (respect workforce lock state)
    const canHire = workforceLockState === 'unlocked' || workforceLockState === 'minimum';
    if (canHire && !hasLockedWorkforceAction && Math.random() < 0.7) {
      const hireCount = Math.floor(1 + Math.random() * 10); // 1-10 workers
      console.log(`[AdvancedOptimizer] Adding HIRE_ROOKIE action: day=${day}, count=${hireCount}`);
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: hireCount,
      });
    } else if (!canHire) {
      console.log(`[AdvancedOptimizer] Skipping HIRE_ROOKIE - workforce lock state: ${workforceLockState}`);
    } else if (hasLockedWorkforceAction) {
      console.log(`[AdvancedOptimizer] Skipping HIRE_ROOKIE - workforce actions are locked`);
    }

    // BUY_MACHINE - 70% chance, 1-5 machines (respect machine lock states)
    if (Math.random() < 0.7) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const availableMachineTypes = machineTypes.filter(type => {
        // Can buy if unlocked or minimum (minimum = can only add)
        const lockState = machineLockStates[type];
        const canBuy = lockState === 'unlocked' || lockState === 'minimum';
        if (type === 'MCE') return canBuy && !hasLockedMCEAction;
        if (type === 'WMA') return canBuy && !hasLockedWMAAction;
        if (type === 'PUC') return canBuy && !hasLockedPUCAction;
        return true;
      });

      if (availableMachineTypes.length > 0) {
        const machineType = availableMachineTypes[Math.floor(Math.random() * availableMachineTypes.length)];
        const machineCount = Math.floor(1 + Math.random() * 5); // 1-5 machines
        console.log(`[AdvancedOptimizer] Adding BUY_MACHINE action: day=${day}, type=${machineType}, count=${machineCount}`);
        actions.push({
          day,
          type: 'BUY_MACHINE',
          machineType,
          count: machineCount,
        });
      } else {
        console.log(`[AdvancedOptimizer] Skipping BUY_MACHINE - no machine types available (lock states)`);
      }
    }

    // FIRE_EMPLOYEE - 30% chance, 1-3 employees (respect workforce lock state)
    const canFire = workforceLockState === 'unlocked' || workforceLockState === 'maximum';
    if (canFire && !hasLockedWorkforceAction && Math.random() < 0.3) {
      const employeeTypes: Array<'expert' | 'rookie'> = ['expert', 'rookie'];
      const employeeType = employeeTypes[Math.floor(Math.random() * 2)];
      const fireCount = Math.floor(1 + Math.random() * 3); // 1-3 employees
      console.log(`[AdvancedOptimizer] Adding FIRE_EMPLOYEE action: day=${day}, type=${employeeType}, count=${fireCount}`);
      actions.push({
        day,
        type: 'FIRE_EMPLOYEE',
        employeeType,
        count: fireCount,
      });
    } else if (!canFire) {
      console.log(`[AdvancedOptimizer] Skipping FIRE_EMPLOYEE - workforce lock state: ${workforceLockState}`);
    } else if (hasLockedWorkforceAction) {
      console.log(`[AdvancedOptimizer] Skipping FIRE_EMPLOYEE - workforce actions are locked`);
    }

    // SELL_MACHINE - 30% chance, 1-2 machines (respect machine lock states)
    if (Math.random() < 0.3) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const availableMachineTypes = machineTypes.filter(type => {
        // Can sell if unlocked or maximum (maximum = can only remove)
        const lockState = machineLockStates[type];
        const canSell = lockState === 'unlocked' || lockState === 'maximum';
        if (type === 'MCE') return canSell && !hasLockedMCEAction;
        if (type === 'WMA') return canSell && !hasLockedWMAAction;
        if (type === 'PUC') return canSell && !hasLockedPUCAction;
        return true;
      });

      if (availableMachineTypes.length > 0) {
        const machineType = availableMachineTypes[Math.floor(Math.random() * availableMachineTypes.length)];
        const sellCount = Math.floor(1 + Math.random() * 2); // 1-2 machines
        console.log(`[AdvancedOptimizer] Adding SELL_MACHINE action: day=${day}, type=${machineType}, count=${sellCount}`);
        actions.push({
          day,
          type: 'SELL_MACHINE',
          machineType,
          count: sellCount,
        });
      } else {
        console.log(`[AdvancedOptimizer] Skipping SELL_MACHINE - no machine types available (lock states)`);
      }
    }

    // Add automatic loan management to ensure actions don't violate minimum cash threshold
    const actionsWithLoans = ensureSufficientCash(actions, 100000, 50000);
    console.log(`[AdvancedOptimizer] Generated ${actions.length} actions, after loan management: ${actionsWithLoans.length} actions`);

    return actionsWithLoans;
  };

  const runConstrainedOptimization = async () => {
    setIsOptimizing(true);
    setCurrentPhase('phase1');
    setPhase1Results([]);
    setPhase2Results([]);

    // Start debug logging (overwrites previous logs)
    debugLogger.start();
    console.log('🚀 Starting Two-Phase Optimization');
    console.log('🔵 Phase 1: Broad Exploration');

    try {
      const { populationSize, generations, mutationRate, eliteCount } = phase1Params;

      // Validate evaluation window
      if (!constraints.evaluationWindow || constraints.evaluationWindow < 1 || constraints.evaluationWindow > 365) {
        alert('⚠️ Invalid evaluation window! Please enter a value between 1 and 365 days.');
        setIsOptimizing(false);
        return;
      }

      // Check if any policies can vary
      const variablePolicies = Object.values(constraints.fixedPolicies).filter(v => !v).length;
      if (variablePolicies === 0) {
        alert('⚠️ All policies are fixed! Mark at least one policy as Variable (🔓) to optimize.');
        setIsOptimizing(false);
        return;
      }

      console.log(`🎯 Optimizing ${variablePolicies} variable policies on Day ${constraints.testDay}`);

      // Generate initial population with constrained strategy parameters
      let population: OptimizationCandidate[] = [];
      for (let i = 0; i < populationSize; i++) {
        const strategyParams = generateConstrainedStrategyParams(strategy, constraints);
        population.push({
          id: `gen0-${i}`,
          actions: createPolicyActionsForDay(constraints.testDay, strategyParams),
          fitness: 0,
          netWorth: 0,
          strategyParams,
        });
      }

      // Debug: Log first 3 candidates' parameters to verify they're different
      console.log('🔍 First 3 candidates parameters:', population.slice(0, 3).map(c => ({
        id: c.id,
        params: c.strategyParams,
        actionCount: c.actions.length
      })));

      // Evolution loop
      for (let gen = 0; gen < generations; gen++) {
        console.log(`🧬 Generation ${gen + 1}/${generations}`);
        setOptimizationProgress({ current: gen, total: generations });

        // Test each candidate in parallel
        const testPromises = population.map(async (candidate) => {
          // Build test strategy:
          // 1. Keep base strategy actions BEFORE test day
          // 2. Add candidate's policy actions ON test day only
          // 3. All candidates start from same context at test day
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);

          const testStrategy: Strategy = {
            ...strategy,
            // Apply candidate's strategy parameters that aren't timed actions
            ...(candidate.strategyParams?.dailyOvertimeHours !== undefined && {
              dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours
            }),
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions, // These are actions for test day only
            ].sort((a, b) => a.day - b.day),
          };

          // Debug: Log what we're sending to backend for first 3 candidates
          if (gen === 0 && population.indexOf(candidate) < 3) {
            console.log(`📤 Sending to backend - Candidate ${candidate.id}:`, {
              totalActions: testStrategy.timedActions.length,
              testDayActions: candidate.actions,
              strategyParams: candidate.strategyParams,
              // Check if actions are actually different
              actionDetails: candidate.actions.map(a => ({
                type: a.type,
                value: 'newReorderPoint' in a ? a.newReorderPoint :
                       'newOrderQuantity' in a ? a.newOrderQuantity :
                       'newPrice' in a ? a.newPrice :
                       'newSize' in a ? a.newSize :
                       'newAllocation' in a ? a.newAllocation : 'N/A'
              }))
            });
          }

          try {
            const response = await fetch('/api/simulate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              },
              cache: 'no-store',
              body: JSON.stringify({ strategy: testStrategy }),
            });

            if (!response.ok) {
              throw new Error(`Simulation failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success || !data.result) {
              throw new Error(`Simulation failed: ${data.error}`);
            }

            const result = data.result;

            // Store full simulation state for comprehensive CSV export
            candidate.fullState = result;

            // Calculate dual fitness metrics: Growth Rate + Peak Growth
            let growthRate = 0;
            let endNetWorth = result.finalNetWorth;

            if (result.state?.history?.dailyNetWorth) {
              const dailyNetWorth = result.state.history.dailyNetWorth;
              const startDay = constraints.testDay;
              const evaluationEndDay = Math.min(startDay + constraints.evaluationWindow, constraints.endDay);

              // Get net worth at start (testDay)
              const startNetWorth = dailyNetWorth.find((d: { day: number; value: number }) => d.day === startDay)?.value || 0;

              // Growth Rate ($/day over evaluation window)
              const endDayData = dailyNetWorth.find((d: { day: number; value: number }) => d.day === evaluationEndDay);
              endNetWorth = endDayData?.value || result.finalNetWorth;
              growthRate = (endNetWorth - startNetWorth) / constraints.evaluationWindow;

              // Store complete history for graphing
              candidate.history = dailyNetWorth;
            }

            // Debug logging
            console.log(`Candidate ${candidate.id}:`, {
              growthRate: `$${growthRate.toFixed(0)}/day`,
              totalGain: `+$${(growthRate * constraints.evaluationWindow).toLocaleString()}`,
              endNetWorth: endNetWorth.toLocaleString(),
              evaluationWindow: constraints.evaluationWindow,
              testDay: constraints.testDay,
              params: candidate.strategyParams
            });

            candidate.netWorth = endNetWorth;
            candidate.growthRate = growthRate;
            candidate.fitness = growthRate; // Primary fitness for GA selection
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Simulation error for candidate ${candidate.id}:`, errorMsg);

            // Provide helpful error context
            if (errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
              console.error('💡 Hint: Backend server may not be running. Start with: npm run dev');
            }

            candidate.fitness = -Infinity;
            candidate.netWorth = -Infinity;
            candidate.error = errorMsg; // Store error for debugging
          }
        });

        await Promise.all(testPromises);

        // Check if ALL candidates failed
        const allFailed = population.every(c => c.fitness === -Infinity);
        if (allFailed) {
          const firstError = population[0].error || 'Unknown error';
          throw new Error(
            `All simulations failed! Common causes:\n` +
            `1. Backend server not running (run: npm run dev)\n` +
            `2. Backend server on wrong port (check http://localhost:3000)\n` +
            `3. API endpoint error\n\n` +
            `First error: ${firstError}`
          );
        }

        // Debug: Check if all candidates have identical peak net worth (suspicious!)
        const uniqueNetWorths = new Set(population.map(c => c.netWorth));
        if (uniqueNetWorths.size === 1) {
          console.warn('⚠️ WARNING: All candidates have IDENTICAL peak net worth!', {
            peakNetWorth: population[0].netWorth,
            candidateCount: population.length
          });
        } else {
          console.log(`✅ Generation ${gen + 1}: ${uniqueNetWorths.size} unique peak net worth values found`);
        }

        // Sort by peak net worth (highest to lowest)
        population.sort((a, b) => b.netWorth - a.netWorth);

        // If last generation, break
        if (gen === generations - 1) break;

        // Select elite (use user-configured elite count)
        const elite = population.slice(0, eliteCount);

        // Generate new population
        const newPopulation: OptimizationCandidate[] = [...elite];

        while (newPopulation.length < populationSize) {
          // Tournament selection
          const parent1 = population[Math.floor(Math.random() * Math.min(10, population.length))];
          const parent2 = population[Math.floor(Math.random() * Math.min(10, population.length))];

          // Crossover strategy params
          let childParams: OptimizationCandidate['strategyParams'] = {};
          if (parent1.strategyParams && parent2.strategyParams) {
            Object.keys(parent1.strategyParams).forEach(key => {
              const k = key as keyof typeof parent1.strategyParams;
              if (parent1.strategyParams![k] !== undefined && parent2.strategyParams![k] !== undefined) {
                if (!childParams) childParams = {};
                childParams[k] = Math.random() < 0.5 ? parent1.strategyParams![k] : parent2.strategyParams![k];
              }
            });
          }

          // Mutate with constraints
          const mutatedParams = mutateConstrainedStrategyParams(childParams, constraints, mutationRate);
          childParams = mutatedParams;

          newPopulation.push({
            id: `gen${gen + 1}-${newPopulation.length}`,
            actions: createPolicyActionsForDay(constraints.testDay, childParams),
            fitness: 0,
            netWorth: 0,
            strategyParams: childParams,
          });
        }

        population = newPopulation;
      }

      // Rank by growth rate and take top 5
      const topResults = [...population]
        .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
        .slice(0, 5);

      setPhase1Results(topResults);
      console.log('✅ Phase 1 Complete!');
      console.log('🚀 Top 5 by Growth Rate:', topResults);

      // Automatically start Phase 2 with top 3 strategies from Phase 1
      console.log('🟢 Phase 2: Focused Refinement');
      setCurrentPhase('phase2');
      const seedStrategies = topResults.slice(0, 3); // Top 3 for seeding
      await runPhase2(seedStrategies);

      // Debug: Check if all have same history reference (shallow copy issue)
      const firstHistory = topResults[0]?.history;
      const allSameHistory = topResults.every(c => c.history === firstHistory);
      if (allSameHistory) {
        console.error('🐛 BUG FOUND: All candidates share the SAME history array reference! This is a shallow copy issue.');
      }

      // Debug: Critical check - are the actions actually different?
      console.log('🔍 ACTIONS COMPARISON:');
      topResults.forEach((candidate, idx) => {
        const priceAction = candidate.actions.find(a => a.type === 'ADJUST_PRICE');
        const ropAction = candidate.actions.find(a => a.type === 'SET_REORDER_POINT');
        console.log(`Candidate ${idx} (${candidate.id}):`, {
          price: priceAction && 'newPrice' in priceAction ? priceAction.newPrice : 'N/A',
          reorderPoint: ropAction && 'newReorderPoint' in ropAction ? ropAction.newReorderPoint : 'N/A',
          growthRate: candidate.growthRate,
          actionCount: candidate.actions.length
        });
      });

      // Check if all growth rates are identical
      const uniqueGrowthRates = new Set(topResults.map(c => c.growthRate));
      if (uniqueGrowthRates.size === 1) {
        console.error('🐛 CRITICAL BUG: All top 5 candidates have IDENTICAL growth rate despite different parameters!');
        console.error('This suggests the backend is either:');
        console.error('1. Caching responses');
        console.error('2. Ignoring timed actions');
        console.error('3. All actions are actually the same (check above)');
      }
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      alert('Optimization failed. Check console for details.');
      setCurrentPhase('idle');
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress({ current: 0, total: 0 });

      // Stop debug logging and download log file
      debugLogger.stop();
      debugLogger.download('optimizer-debug.log');
      console.log('📥 Debug log file downloaded');
    }
  };

  const runPhase2 = async (seedStrategies: OptimizationCandidate[]) => {
    const { populationSize, generations, mutationRate, eliteCount, refinementIntensity } = phase2Params;

    try {
      // Import generateSeededPopulation and related functions
      const { generateSeededPopulation, mutateRefinement, generateLocalVariations } = await import('../../utils/geneticOptimizer');

      // Generate seeded population from Phase 1 results with constraints
      let population = generateSeededPopulation(seedStrategies, populationSize, refinementIntensity, constraints);

      if (population.length === 0) {
        alert('⚠️ Failed to generate Phase 2 population from Phase 1 results.');
        return;
      }

      console.log(`🟢 Starting Phase 2 refinement with ${population.length} candidates`);

      // Evolution loop for Phase 2
      for (let gen = 0; gen < generations; gen++) {
        console.log(`🧬 Phase 2 Generation ${gen + 1}/${generations}`);
        setOptimizationProgress({ current: gen, total: generations });

        // Evaluate fitness for all candidates
        const testPromises = population.map(async (candidate) => {
          const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
          const testStrategy: Strategy = {
            ...strategy,
            ...(candidate.strategyParams?.dailyOvertimeHours !== undefined && {
              dailyOvertimeHours: candidate.strategyParams.dailyOvertimeHours
            }),
            timedActions: [
              ...actionsBeforeTestDay,
              ...candidate.actions,
            ].sort((a, b) => a.day - b.day),
          };

          try {
            const response = await fetch('/api/simulate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
              cache: 'no-store',
              body: JSON.stringify({ strategy: testStrategy }),
            });

            if (!response.ok) {
              throw new Error(`Simulation failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success || !data.result) {
              throw new Error(`Simulation failed: ${data.error}`);
            }

            const result = data.result;
            candidate.fullState = result;

            // Calculate growth rate
            let growthRate = 0;
            let endNetWorth = result.finalNetWorth;

            if (result.state?.history?.dailyNetWorth) {
              const dailyNetWorth = result.state.history.dailyNetWorth;
              const startDay = constraints.testDay;
              const evaluationEndDay = Math.min(startDay + constraints.evaluationWindow, constraints.endDay);

              const startNetWorth = dailyNetWorth.find((d: { day: number; value: number }) => d.day === startDay)?.value || 0;

              const endDayData = dailyNetWorth.find((d: { day: number; value: number }) => d.day === evaluationEndDay);
              endNetWorth = endDayData?.value || result.finalNetWorth;
              growthRate = (endNetWorth - startNetWorth) / constraints.evaluationWindow;

              candidate.history = dailyNetWorth;
            }

            candidate.netWorth = endNetWorth;
            candidate.growthRate = growthRate;
            candidate.fitness = growthRate;

            console.log(`Phase 2 Candidate ${candidate.id}: $${growthRate.toFixed(0)}/day`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Phase 2 simulation error for ${candidate.id}:`, errorMsg);
            candidate.fitness = -Infinity;
            candidate.netWorth = -Infinity;
            candidate.error = errorMsg;
          }
        });

        await Promise.all(testPromises);

        // Check if all failed
        const allFailed = population.every(c => c.fitness === -Infinity);
        if (allFailed) {
          throw new Error('All Phase 2 simulations failed!');
        }

        // Sort by fitness
        population.sort((a, b) => b.fitness - a.fitness);

        // If last generation, save results
        if (gen === generations - 1) {
          const topResults = [...population]
            .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
            .slice(0, 5);

          setPhase2Results(topResults);
          console.log('✅ Phase 2 refinement complete!');
          console.log('🚀 Top 5 Results:', topResults);

          // Notify parent component
          if (onResultsReady) {
            onResultsReady(topResults, constraints.evaluationWindow);
          }
          break;
        }

        // Selection: Keep elite
        const elite = population.slice(0, eliteCount);

        // Generate next generation
        const nextGen: OptimizationCandidate[] = [...elite];

        while (nextGen.length < populationSize) {
          // Tournament selection
          const parent1 = population[Math.floor(Math.random() * Math.min(10, population.length))];
          const parent2 = population[Math.floor(Math.random() * Math.min(10, population.length))];

          // Crossover actions
          const splitPoint = Math.floor(Math.random() * Math.min(parent1.actions.length, parent2.actions.length));
          let childActions = [
            ...parent1.actions.slice(0, splitPoint),
            ...parent2.actions.slice(splitPoint),
          ];

          // Mutate with refinement intensity
          if (Math.random() < mutationRate) {
            childActions = generateLocalVariations(childActions, refinementIntensity);
          }

          // Crossover strategy parameters
          let childParams: OptimizationCandidate['strategyParams'] = undefined;
          if (parent1.strategyParams && parent2.strategyParams) {
            childParams = {};
            Object.keys(parent1.strategyParams).forEach(key => {
              const k = key as keyof typeof parent1.strategyParams;
              if (parent1.strategyParams![k] !== undefined && parent2.strategyParams![k] !== undefined) {
                childParams![k] = Math.random() < 0.5 ? parent1.strategyParams![k] : parent2.strategyParams![k];
              }
            });

            // Mutate with refinement and constraints
            if (Math.random() < mutationRate) {
              childParams = mutateRefinement(childParams, refinementIntensity, constraints);
            }
          }

          nextGen.push({
            id: `phase2-gen${gen + 1}-${nextGen.length}`,
            actions: childActions,
            fitness: 0,
            netWorth: 0,
            strategyParams: childParams,
          });
        }

        population = nextGen;
      }

      setCurrentPhase('idle');
    } catch (error) {
      console.error('❌ Phase 2 refinement failed:', error);
      alert('Phase 2 refinement failed. Check console for details.');
      setCurrentPhase('idle');
    }
  };

  // Placeholder for saving recommended strategies - will be connected to optimizer results
  // const saveRecommendedStrategy = (strategyToSave: Strategy, netWorth: number) => {
  //   const name = prompt('Enter a name for this strategy:');
  //   if (!name) return;

  //   const newStrategy = {
  //     id: `saved-${Date.now()}`,
  //     name,
  //     strategy: strategyToSave,
  //     netWorth,
  //     timestamp: new Date(),
  //   };

  //   setSavedStrategies(prev => [...prev, newStrategy]);
  //   alert(`Strategy "${name}" saved successfully!`);
  // };

  const exportStrategy = (strategyToExport: Strategy) => {
    const dataStr = JSON.stringify(strategyToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `strategy-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Helper function to merge conflicting actions and return formatted strings
  const getMergedActionTexts = (actions: Strategy['timedActions']): string[] => {
    // Track net effects for mergeable action types
    const machineNet: Record<string, number> = {}; // machineType -> net count (+ = buy, - = sell)
    const rookieNet = { hire: 0, fire: 0 };
    const expertNet = { hire: 0, fire: 0 };
    let loanNet = 0;
    const otherActions: Strategy['timedActions'] = [];

    // Process all actions and calculate net effects
    actions.forEach(action => {
      if (action.type === 'BUY_MACHINE' && 'machineType' in action && 'count' in action) {
        const key = action.machineType;
        machineNet[key] = (machineNet[key] || 0) + action.count;
      } else if (action.type === 'SELL_MACHINE' && 'machineType' in action && 'count' in action) {
        const key = action.machineType;
        machineNet[key] = (machineNet[key] || 0) - action.count;
      } else if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
        rookieNet.hire += action.count;
      } else if (action.type === 'FIRE_EMPLOYEE' && 'employeeType' in action && 'count' in action) {
        if (action.employeeType === 'rookie') {
          rookieNet.fire += action.count;
        } else {
          expertNet.fire += action.count;
        }
      } else if (action.type === 'TAKE_LOAN' && 'amount' in action) {
        loanNet += action.amount;
      } else if (action.type === 'PAY_DEBT' && 'amount' in action) {
        loanNet -= action.amount;
      } else {
        // Keep non-mergeable actions as-is
        otherActions.push(action);
      }
    });

    // Build merged action text list
    const mergedTexts: string[] = [];

    // Add policy actions first (from otherActions)
    otherActions.forEach(action => {
      let actionText = '';
      if (action.type === 'SET_REORDER_POINT' && 'newReorderPoint' in action) {
        actionText = `Set Reorder Point → ${action.newReorderPoint} units`;
      } else if (action.type === 'SET_ORDER_QUANTITY' && 'newOrderQuantity' in action) {
        actionText = `Set Order Quantity → ${action.newOrderQuantity} units`;
      } else if (action.type === 'ADJUST_BATCH_SIZE' && 'newSize' in action) {
        actionText = `Adjust Batch Size → ${action.newSize} units`;
      } else if (action.type === 'ADJUST_PRICE' && 'newPrice' in action) {
        actionText = `Adjust Standard Price → $${action.newPrice}`;
      } else if (action.type === 'ADJUST_MCE_ALLOCATION' && 'newAllocation' in action) {
        const customPct = (action.newAllocation * 100).toFixed(0);
        const standardPct = (100 - action.newAllocation * 100).toFixed(0);
        actionText = `Adjust MCE Allocation → ${standardPct}% standard / ${customPct}% custom`;
      } else {
        actionText = action.type;
      }
      if (actionText) mergedTexts.push(actionText);
    });

    // Add merged workforce actions
    const netRookies = rookieNet.hire - rookieNet.fire;
    if (netRookies > 0) {
      mergedTexts.push(`Hire Rookie Workers → ${netRookies} workers`);
    } else if (netRookies < 0) {
      mergedTexts.push(`Fire Employee → ${Math.abs(netRookies)}x rookie`);
    }

    if (expertNet.fire > 0) {
      mergedTexts.push(`Fire Employee → ${expertNet.fire}x expert`);
    }

    // Add merged machine actions
    Object.entries(machineNet).forEach(([machineType, netCount]) => {
      if (netCount > 0) {
        mergedTexts.push(`Buy Machine → ${netCount}x ${machineType}`);
      } else if (netCount < 0) {
        mergedTexts.push(`Sell Machine → ${Math.abs(netCount)}x ${machineType}`);
      }
      // If netCount === 0, actions cancel out - don't show anything
    });

    // Add merged loan actions
    if (loanNet > 0) {
      mergedTexts.push(`Take Loan → $${loanNet.toLocaleString()}`);
    } else if (loanNet < 0) {
      mergedTexts.push(`Pay Debt → $${Math.abs(loanNet).toLocaleString()}`);
    }

    return mergedTexts;
  };

  const downloadComprehensiveXLSX = async (candidate: OptimizationCandidate, idx: number) => {
    if (!candidate.fullState) {
      alert('No simulation data available for this result');
      return;
    }

    const historicalData = historicalDataImport as Record<string, { headers: string[]; data: Record<string, unknown>[] }>;

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // ==================== SHEET 1: DAILY HISTORY (Days 1-500) ====================
    const dailyHistorySheet = workbook.addWorksheet('Daily History');

    // Collect all simulation metrics from the candidate
    const simulationHistory = candidate.fullState.state?.history || {};
    const simulationMetrics = Object.keys(simulationHistory).filter(key => Array.isArray(simulationHistory[key]));

    // Create header row with all available metrics
    const headerRow: string[] = ['Day', 'Data Source'];

    // Add simulation metrics (these will be populated for days 51+)
    simulationMetrics.forEach(metric => {
      const formatted = metric.replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/daily /i, '');
      headerRow.push(formatted);
    });

    dailyHistorySheet.addRow(headerRow);

    // Generate rows for days 1-500
    for (let day = 1; day <= 500; day++) {
      const row: (string | number)[] = [day];

      // Indicate data source
      if (day <= 50) {
        row.push('Historical');
      } else {
        row.push('Simulation');
      }

      // For each metric, determine if we use historical data or simulation data
      simulationMetrics.forEach(metric => {
        // Days 1-50: Leave empty (historical data has different structure)
        // Days 51+: Use simulation data
        if (day <= 50) {
          // Historical data period - leave empty for now
          // Different column structure from simulation
          row.push('');
        } else {
          // Days 51+: Use simulation data
          const simulationDayIndex = day - 1; // Simulation array is 0-indexed
          const dataPoint = simulationHistory[metric][simulationDayIndex];

          if (dataPoint && typeof dataPoint === 'object' && 'value' in dataPoint) {
            row.push(dataPoint.value);
          } else if (typeof dataPoint === 'number') {
            row.push(dataPoint);
          } else {
            row.push('');
          }
        }
      });

      dailyHistorySheet.addRow(row);
    }

    // ==================== SHEET 2: SUMMARY & METADATA ====================
    const summarySheet = workbook.addWorksheet('Summary');

    // Section 1: Simulation Summary
    summarySheet.addRow(['=== SIMULATION SUMMARY ===']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Strategy ID', candidate.id]);
    summarySheet.addRow(['Rank', `#${idx + 1}`]);
    summarySheet.addRow(['Peak Net Worth', `$${candidate.netWorth.toLocaleString()}`]);
    summarySheet.addRow(['Final Net Worth', `$${candidate.fullState.finalNetWorth?.toLocaleString() || 'N/A'}`]);
    summarySheet.addRow(['Historical Data Period', 'Days 1-50']);
    summarySheet.addRow(['Strategy Testing Started', `Day ${constraints.testDay}`]);
    summarySheet.addRow(['Simulation End Day', constraints.endDay]);
    summarySheet.addRow([]);

    // Section 2: Strategy Parameters
    summarySheet.addRow(['=== STRATEGY PARAMETERS ===']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Parameter', 'Value']);
    if (candidate.strategyParams) {
      if (candidate.strategyParams.reorderPoint !== undefined) {
        summarySheet.addRow(['Reorder Point', `${candidate.strategyParams.reorderPoint} units`]);
      }
      if (candidate.strategyParams.orderQuantity !== undefined) {
        summarySheet.addRow(['Order Quantity', `${candidate.strategyParams.orderQuantity} units`]);
      }
      if (candidate.strategyParams.standardPrice !== undefined) {
        summarySheet.addRow(['Standard Price', `$${candidate.strategyParams.standardPrice}`]);
      }
      if (candidate.strategyParams.standardBatchSize !== undefined) {
        summarySheet.addRow(['Standard Batch Size', `${candidate.strategyParams.standardBatchSize} units`]);
      }
      if (candidate.strategyParams.mceAllocationCustom !== undefined) {
        summarySheet.addRow(['MCE Custom Allocation', `${(candidate.strategyParams.mceAllocationCustom * 100).toFixed(1)}%`]);
      }
      if (candidate.strategyParams.dailyOvertimeHours !== undefined) {
        summarySheet.addRow(['Daily Overtime Hours', `${candidate.strategyParams.dailyOvertimeHours}h`]);
      }
    }
    summarySheet.addRow([]);

    // Section 3: Timed Actions
    summarySheet.addRow(['=== TIMED ACTIONS ===']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Day', 'Action Type', 'Details']);
    candidate.actions.forEach(action => {
      let details = '';
      if ('newReorderPoint' in action) details = `New Reorder Point: ${action.newReorderPoint} units`;
      else if ('newOrderQuantity' in action) details = `New Order Quantity: ${action.newOrderQuantity} units`;
      else if ('newPrice' in action) details = `New Price: $${action.newPrice}`;
      else if ('newSize' in action) details = `New Batch Size: ${action.newSize} units`;
      else if ('newAllocation' in action) details = `New MCE Allocation: ${(action.newAllocation * 100).toFixed(1)}%`;
      else if ('count' in action) details = `Count: ${action.count}`;
      else if ('amount' in action) details = `Amount: $${action.amount}`;
      else if ('machineType' in action) details = `Machine Type: ${action.machineType}`;
      else if ('productType' in action) details = `Product Type: ${action.productType}`;

      summarySheet.addRow([action.day, action.type, details]);
    });
    summarySheet.addRow([]);

    // Section 4: Final State
    if (candidate.fullState.state) {
      summarySheet.addRow(['=== FINAL STATE ===']);
      summarySheet.addRow([]);
      summarySheet.addRow(['Metric', 'Value']);

      const state = candidate.fullState.state;
      if (state.cash !== undefined) summarySheet.addRow(['Cash', `$${state.cash.toLocaleString()}`]);
      if (state.debt !== undefined) summarySheet.addRow(['Debt', `$${state.debt.toLocaleString()}`]);
      if (state.inventory !== undefined) summarySheet.addRow(['Inventory', `${state.inventory} units`]);
      if (state.backlog !== undefined) summarySheet.addRow(['Backlog', `${state.backlog} orders`]);
      if (state.totalRevenue !== undefined) summarySheet.addRow(['Total Revenue', `$${state.totalRevenue.toLocaleString()}`]);
      if (state.totalCosts !== undefined) summarySheet.addRow(['Total Costs', `$${state.totalCosts.toLocaleString()}`]);
      if (state.profit !== undefined) summarySheet.addRow(['Profit', `$${state.profit.toLocaleString()}`]);

      // Machines
      if (state.machines) {
        summarySheet.addRow(['MCE Machines', state.machines.MCE || 0]);
        summarySheet.addRow(['WMA Machines', state.machines.WMA || 0]);
        summarySheet.addRow(['PUC Machines', state.machines.PUC || 0]);
      }

      // Employees
      if (state.employees) {
        summarySheet.addRow(['Expert Employees', state.employees.experts || 0]);
        summarySheet.addRow(['Rookie Employees', state.employees.rookies || 0]);
        summarySheet.addRow(['Rookies in Training', state.employees.rookiesInTraining || 0]);
      }

      summarySheet.addRow([]);
    }

    // ==================== SHEET 3: HISTORICAL DATA REFERENCE ====================
    // Add historical data as a reference sheet
    if (historicalData && historicalData.Standard && historicalData.Standard.data) {
      const historicalSheet = workbook.addWorksheet('Historical Data');

      // Add header
      historicalSheet.addRow(['Historical Data (Days 0-50)']);
      historicalSheet.addRow([]);
      historicalSheet.addRow(historicalData.Standard.headers);

      // Add data rows
      historicalData.Standard.data.forEach((row: Record<string, unknown>) => {
        const rowData = historicalData.Standard.headers.map((header: string) => row[header] !== undefined ? row[header] : '');
        historicalSheet.addRow(rowData);
      });
    }

    // Write and download the XLSX file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulation-strategy-${idx + 1}-${candidate.id}-${Date.now()}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 border border-purple-600 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-2">
          🎯 Advanced Optimizer <span className="text-xs text-green-400 ml-2">v3.0-MAXIMUM-DIVERSITY</span>
        </h3>
        <p className="text-sm text-gray-200">
          Configure exactly which parameters the optimizer can change. The optimizer will use your current strategy values as a starting point,
          but only vary the parameters you mark as "Variable" (🔓). Mark policies and actions as "Fixed" (🔒) to lock them.
        </p>
        <p className="text-xs text-yellow-300 mt-2">
          ✨ Testing diverse action combinations: HIRE_ROOKIE (70%, 1-10 workers), BUY_MACHINE (70%, 1-5 machines), FIRE_EMPLOYEE (30%, 1-3), SELL_MACHINE (30%, 1-2), automatic loans
        </p>
      </div>

      {/* Optimization Settings */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">⚙️ Optimization Settings</h4>

        {/* Simulation Range */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-300 mb-3">📅 Simulation Range</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="test-start-day" className="block text-sm font-medium text-white mb-2">
                Test Starting Day
              </label>
              <input
                id="test-start-day"
                name="testStartDay"
                type="number"
                value={constraints.testDay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setConstraints(prev => ({ ...prev, testDay: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="51"
                max="450"
              />
            </div>

            <div>
              <label htmlFor="simulation-end-day" className="block text-sm font-medium text-white mb-2">
                Simulation End Day
              </label>
              <input
                id="simulation-end-day"
                name="simulationEndDay"
                type="number"
                value={constraints.endDay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setConstraints(prev => ({ ...prev, endDay: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="51"
                max="415"
              />
            </div>

            <div>
              <label htmlFor="evaluation-window" className="block text-sm font-medium text-white mb-2">
                Evaluation Window (Days)
              </label>
              <input
                id="evaluation-window"
                name="evaluationWindow"
                type="number"
                value={constraints.evaluationWindow || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow empty value temporarily
                  if (val === '') {
                    setConstraints(prev => ({ ...prev, evaluationWindow: 0 }));
                  } else {
                    const numVal = Number(val);
                    if (!isNaN(numVal)) {
                      setConstraints(prev => ({ ...prev, evaluationWindow: numVal }));
                    }
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="1"
                max="365"
                step="1"
                placeholder="Enter days (1-365)"
              />
              <p className="text-xs text-gray-400 mt-1">
                Exact number of days for measuring growth rate (e.g., 30 = one full production cycle). Range: 1-365 days.
              </p>
            </div>
          </div>
        </div>

        {/* Phase 1 Parameters */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-blue-300 mb-3">🔵 Phase 1: Broad Exploration Parameters</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phase1-population-size" className="block text-sm font-medium text-white mb-2">
                Population Size
              </label>
              <input
                id="phase1-population-size"
                type="number"
                value={phase1Params.populationSize}
                onChange={(e) => setPhase1Params(prev => ({ ...prev, populationSize: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="10"
                max="100"
                step="5"
              />
              <p className="text-xs text-gray-400 mt-1">Strategies per generation</p>
            </div>

            <div>
              <label htmlFor="phase1-generations" className="block text-sm font-medium text-white mb-2">
                Generations
              </label>
              <input
                id="phase1-generations"
                type="number"
                value={phase1Params.generations}
                onChange={(e) => setPhase1Params(prev => ({ ...prev, generations: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="5"
                max="50"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Evolution cycles</p>
            </div>

            <div>
              <label htmlFor="phase1-mutation-rate" className="block text-sm font-medium text-white mb-2">
                Mutation Rate
              </label>
              <input
                id="phase1-mutation-rate"
                type="number"
                value={phase1Params.mutationRate}
                onChange={(e) => setPhase1Params(prev => ({ ...prev, mutationRate: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="0.1"
                max="0.9"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Probability of changes (0-1)</p>
            </div>

            <div>
              <label htmlFor="phase1-elite-count" className="block text-sm font-medium text-white mb-2">
                Elite Count
              </label>
              <input
                id="phase1-elite-count"
                type="number"
                value={phase1Params.eliteCount}
                onChange={(e) => setPhase1Params(prev => ({ ...prev, eliteCount: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Top strategies preserved</p>
            </div>
          </div>
        </div>

        {/* Phase 2 Parameters */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-green-300 mb-3">🟢 Phase 2: Focused Refinement Parameters</h5>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="phase2-population-size" className="block text-sm font-medium text-white mb-2">
                Population Size
              </label>
              <input
                id="phase2-population-size"
                type="number"
                value={phase2Params.populationSize}
                onChange={(e) => setPhase2Params(prev => ({ ...prev, populationSize: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                min="10"
                max="100"
                step="5"
              />
              <p className="text-xs text-gray-400 mt-1">Strategies per generation</p>
            </div>

            <div>
              <label htmlFor="phase2-generations" className="block text-sm font-medium text-white mb-2">
                Generations
              </label>
              <input
                id="phase2-generations"
                type="number"
                value={phase2Params.generations}
                onChange={(e) => setPhase2Params(prev => ({ ...prev, generations: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                min="5"
                max="50"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Evolution cycles</p>
            </div>

            <div>
              <label htmlFor="phase2-mutation-rate" className="block text-sm font-medium text-white mb-2">
                Mutation Rate
              </label>
              <input
                id="phase2-mutation-rate"
                type="number"
                value={phase2Params.mutationRate}
                onChange={(e) => setPhase2Params(prev => ({ ...prev, mutationRate: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                min="0.1"
                max="0.9"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Probability of changes</p>
            </div>

            <div>
              <label htmlFor="phase2-elite-count" className="block text-sm font-medium text-white mb-2">
                Elite Count
              </label>
              <input
                id="phase2-elite-count"
                type="number"
                value={phase2Params.eliteCount}
                onChange={(e) => setPhase2Params(prev => ({ ...prev, eliteCount: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                min="1"
                max="10"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Top strategies preserved</p>
            </div>

            <div>
              <label htmlFor="phase2-refinement-intensity" className="block text-sm font-medium text-white mb-2">
                Refinement Intensity (Maximum Mutation)
              </label>
              <input
                id="phase2-refinement-intensity"
                type="number"
                value={phase2Params.refinementIntensity}
                onChange={(e) => setPhase2Params(prev => ({ ...prev, refinementIntensity: Number(e.target.value) }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                min="0.05"
                max="0.30"
                step="0.05"
              />
              <p className="text-xs text-gray-400 mt-1">Maximum ±{(phase2Params.refinementIntensity * 100).toFixed(0)}% variation from Phase 1 values</p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-purple-900/20 border border-purple-600/30 rounded-lg">
          <h5 className="text-sm font-semibold text-purple-300 mb-2">Two-Phase Optimization Summary</h5>
          <div className="text-xs text-gray-300 space-y-1">
            <div>🔒 Fixed Policies: {Object.values(constraints.fixedPolicies).filter(Boolean).length} / 6</div>
            <div>🔓 Variable Policies: {Object.values(constraints.fixedPolicies).filter(v => !v).length} / 6</div>
            <div>⏱️ Test Range: Days {constraints.testDay} - {constraints.endDay}</div>
            <div>🔵 Phase 1: Pop={phase1Params.populationSize}, Gen={phase1Params.generations} → {phase1Params.populationSize * phase1Params.generations} sims</div>
            <div>🟢 Phase 2: Pop={phase2Params.populationSize}, Gen={phase2Params.generations} → {phase2Params.populationSize * phase2Params.generations} sims</div>
            <div>📊 Total Simulations: {(phase1Params.populationSize * phase1Params.generations) + (phase2Params.populationSize * phase2Params.generations)}</div>
          </div>
        </div>
      </div>

      {/* Current State & Policy Controls - Values on Day {constraints.testDay} */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-semibold text-white">📊 Current State & Policy Controls</h4>
            <p className="text-sm text-gray-400 mt-1">
              Values on Day {constraints.testDay} - Lock to prevent optimizer changes
            </p>
          </div>
        </div>

        {/* Workforce Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-gray-300">👷 Workforce</h5>
            <button
              onClick={handleLockWorkforce}
              className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
                workforceLockState === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                workforceLockState === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                workforceLockState === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={
                workforceLockState === 'unlocked' ? 'Click to set minimum (can only hire)' :
                workforceLockState === 'minimum' ? 'Click to set maximum (can only fire)' :
                workforceLockState === 'maximum' ? 'Click to lock (no changes)' :
                'Click to unlock (allow all changes)'
              }
            >
              {workforceLockState === 'unlocked' ? '🔓 Unlocked' :
               workforceLockState === 'minimum' ? '⬆️ Minimum' :
               workforceLockState === 'maximum' ? '⬇️ Maximum' :
               '🔒 Locked'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${
              workforceLockState === 'unlocked' ? 'bg-gray-700 border-gray-600' :
              workforceLockState === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
              workforceLockState === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
              'bg-red-900/20 border-red-600/50'
            }`}>
              <p className="text-sm text-gray-400 mb-1">Experts</p>
              <p className="text-2xl font-bold text-white">{currentValues.experts}</p>
            </div>
            <div className={`p-4 rounded-lg border-2 ${
              workforceLockState === 'unlocked' ? 'bg-gray-700 border-gray-600' :
              workforceLockState === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
              workforceLockState === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
              'bg-red-900/20 border-red-600/50'
            }`}>
              <p className="text-sm text-gray-400 mb-1">Rookies</p>
              <p className="text-2xl font-bold text-white">{currentValues.rookies}</p>
            </div>
          </div>
          {workforceLockState !== 'unlocked' && (
            <div className={`mt-2 text-xs px-3 py-2 rounded ${
              workforceLockState === 'minimum' ? 'bg-blue-900/30 text-blue-300' :
              workforceLockState === 'maximum' ? 'bg-orange-900/30 text-orange-300' :
              'bg-red-900/30 text-red-300'
            }`}>
              {workforceLockState === 'minimum' ? '⬆️ Optimizer can only hire (minimum constraint)' :
               workforceLockState === 'maximum' ? '⬇️ Optimizer can only fire (maximum constraint)' :
               '🔒 Optimizer cannot hire or fire employees'}
            </div>
          )}
        </div>

        {/* Machines Section */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-300 mb-3">🏭 Machines</h5>
          <div className="grid grid-cols-3 gap-4">
            {/* MCE Machine */}
            <div>
              <div className={`p-4 rounded-lg border-2 ${
                machineLockStates.MCE === 'locked' ? 'bg-red-900/20 border-red-600/50' :
                machineLockStates.MCE === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
                machineLockStates.MCE === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
                'bg-gray-700 border-gray-600'
              }`}>
                <p className="text-sm text-gray-400 mb-1">MCE</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.MCE}</p>
              </div>
              <button
                onClick={() => handleLockMachine('MCE')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  machineLockStates.MCE === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  machineLockStates.MCE === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  machineLockStates.MCE === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  machineLockStates.MCE === 'unlocked' ? 'Click to set minimum (can only buy)' :
                  machineLockStates.MCE === 'minimum' ? 'Click to set maximum (can only sell)' :
                  machineLockStates.MCE === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {machineLockStates.MCE === 'unlocked' ? '🔓' :
                 machineLockStates.MCE === 'minimum' ? '⬆️' :
                 machineLockStates.MCE === 'maximum' ? '⬇️' :
                 '🔒'}
              </button>
              {machineLockStates.MCE !== 'unlocked' && (
                <div className={`mt-1 text-xs px-2 py-1 rounded ${
                  machineLockStates.MCE === 'minimum' ? 'bg-blue-900/30 text-blue-300' :
                  machineLockStates.MCE === 'maximum' ? 'bg-orange-900/30 text-orange-300' :
                  'bg-red-900/30 text-red-300'
                }`}>
                  {machineLockStates.MCE === 'minimum' ? 'Buy only' :
                   machineLockStates.MCE === 'maximum' ? 'Sell only' :
                   'Locked'}
                </div>
              )}
            </div>

            {/* WMA Machine */}
            <div>
              <div className={`p-4 rounded-lg border-2 ${
                machineLockStates.WMA === 'locked' ? 'bg-red-900/20 border-red-600/50' :
                machineLockStates.WMA === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
                machineLockStates.WMA === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
                'bg-gray-700 border-gray-600'
              }`}>
                <p className="text-sm text-gray-400 mb-1">WMA</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.WMA}</p>
              </div>
              <button
                onClick={() => handleLockMachine('WMA')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  machineLockStates.WMA === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  machineLockStates.WMA === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  machineLockStates.WMA === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  machineLockStates.WMA === 'unlocked' ? 'Click to set minimum (can only buy)' :
                  machineLockStates.WMA === 'minimum' ? 'Click to set maximum (can only sell)' :
                  machineLockStates.WMA === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {machineLockStates.WMA === 'unlocked' ? '🔓' :
                 machineLockStates.WMA === 'minimum' ? '⬆️' :
                 machineLockStates.WMA === 'maximum' ? '⬇️' :
                 '🔒'}
              </button>
              {machineLockStates.WMA !== 'unlocked' && (
                <div className={`mt-1 text-xs px-2 py-1 rounded ${
                  machineLockStates.WMA === 'minimum' ? 'bg-blue-900/30 text-blue-300' :
                  machineLockStates.WMA === 'maximum' ? 'bg-orange-900/30 text-orange-300' :
                  'bg-red-900/30 text-red-300'
                }`}>
                  {machineLockStates.WMA === 'minimum' ? 'Buy only' :
                   machineLockStates.WMA === 'maximum' ? 'Sell only' :
                   'Locked'}
                </div>
              )}
            </div>

            {/* PUC Machine */}
            <div>
              <div className={`p-4 rounded-lg border-2 ${
                machineLockStates.PUC === 'locked' ? 'bg-red-900/20 border-red-600/50' :
                machineLockStates.PUC === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
                machineLockStates.PUC === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
                'bg-gray-700 border-gray-600'
              }`}>
                <p className="text-sm text-gray-400 mb-1">PUC</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.PUC}</p>
              </div>
              <button
                onClick={() => handleLockMachine('PUC')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  machineLockStates.PUC === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  machineLockStates.PUC === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  machineLockStates.PUC === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  machineLockStates.PUC === 'unlocked' ? 'Click to set minimum (can only buy)' :
                  machineLockStates.PUC === 'minimum' ? 'Click to set maximum (can only sell)' :
                  machineLockStates.PUC === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {machineLockStates.PUC === 'unlocked' ? '🔓' :
                 machineLockStates.PUC === 'minimum' ? '⬆️' :
                 machineLockStates.PUC === 'maximum' ? '⬇️' :
                 '🔒'}
              </button>
              {machineLockStates.PUC !== 'unlocked' && (
                <div className={`mt-1 text-xs px-2 py-1 rounded ${
                  machineLockStates.PUC === 'minimum' ? 'bg-blue-900/30 text-blue-300' :
                  machineLockStates.PUC === 'maximum' ? 'bg-orange-900/30 text-orange-300' :
                  'bg-red-900/30 text-red-300'
                }`}>
                  {machineLockStates.PUC === 'minimum' ? 'Buy only' :
                   machineLockStates.PUC === 'maximum' ? 'Sell only' :
                   'Locked'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Policy Settings Section */}
        <div>
          <h5 className="text-sm font-semibold text-gray-300 mb-3">⚙️ Policy Settings</h5>
          <div className="space-y-3">
            {/* Standard Batch Size */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              policyLockStates.batchSize === 'locked' ? 'bg-red-900/20 border-red-600/50' :
              policyLockStates.batchSize === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
              policyLockStates.batchSize === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
              'bg-gray-700 border-gray-600'
            }`}>
              <div>
                <p className="text-sm font-medium text-white">Standard Batch Size</p>
                <p className="text-2xl font-bold text-white">{currentValues.standardBatchSize || 60}</p>
                {policyLockStates.batchSize !== 'unlocked' && (
                  <p className={`text-xs mt-1 ${
                    policyLockStates.batchSize === 'minimum' ? 'text-blue-300' :
                    policyLockStates.batchSize === 'maximum' ? 'text-orange-300' :
                    'text-red-300'
                  }`}>
                    {policyLockStates.batchSize === 'minimum' ? '⬆️ Can only increase' :
                     policyLockStates.batchSize === 'maximum' ? '⬇️ Can only decrease' :
                     '🔒 Locked'}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleLockPolicy('batchSize')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  policyLockStates.batchSize === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  policyLockStates.batchSize === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  policyLockStates.batchSize === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  policyLockStates.batchSize === 'unlocked' ? 'Click to set minimum (can only increase)' :
                  policyLockStates.batchSize === 'minimum' ? 'Click to set maximum (can only decrease)' :
                  policyLockStates.batchSize === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {policyLockStates.batchSize === 'unlocked' ? '🔓 Unlocked' :
                 policyLockStates.batchSize === 'minimum' ? '⬆️ Minimum' :
                 policyLockStates.batchSize === 'maximum' ? '⬇️ Maximum' :
                 '🔒 Locked'}
              </button>
            </div>

            {/* Standard Price */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              policyLockStates.price === 'locked' ? 'bg-red-900/20 border-red-600/50' :
              policyLockStates.price === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
              policyLockStates.price === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
              'bg-gray-700 border-gray-600'
            }`}>
              <div>
                <p className="text-sm font-medium text-white">Standard Price</p>
                <p className="text-2xl font-bold text-white">${currentValues.standardPrice || 225}</p>
                {policyLockStates.price !== 'unlocked' && (
                  <p className={`text-xs mt-1 ${
                    policyLockStates.price === 'minimum' ? 'text-blue-300' :
                    policyLockStates.price === 'maximum' ? 'text-orange-300' :
                    'text-red-300'
                  }`}>
                    {policyLockStates.price === 'minimum' ? '⬆️ Can only increase' :
                     policyLockStates.price === 'maximum' ? '⬇️ Can only decrease' :
                     '🔒 Locked'}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleLockPolicy('price')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  policyLockStates.price === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  policyLockStates.price === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  policyLockStates.price === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  policyLockStates.price === 'unlocked' ? 'Click to set minimum (can only increase)' :
                  policyLockStates.price === 'minimum' ? 'Click to set maximum (can only decrease)' :
                  policyLockStates.price === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {policyLockStates.price === 'unlocked' ? '🔓 Unlocked' :
                 policyLockStates.price === 'minimum' ? '⬆️ Minimum' :
                 policyLockStates.price === 'maximum' ? '⬇️ Maximum' :
                 '🔒 Locked'}
              </button>
            </div>

            {/* MCE Allocation */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
              policyLockStates.mceAllocation === 'locked' ? 'bg-red-900/20 border-red-600/50' :
              policyLockStates.mceAllocation === 'minimum' ? 'bg-blue-900/20 border-blue-600/50' :
              policyLockStates.mceAllocation === 'maximum' ? 'bg-orange-900/20 border-orange-600/50' :
              'bg-gray-700 border-gray-600'
            }`}>
              <div>
                <p className="text-sm font-medium text-white">MCE Allocation (Custom)</p>
                <p className="text-2xl font-bold text-white">{(currentValues.mceAllocationCustom * 100).toFixed(0)}%</p>
                {policyLockStates.mceAllocation !== 'unlocked' && (
                  <p className={`text-xs mt-1 ${
                    policyLockStates.mceAllocation === 'minimum' ? 'text-blue-300' :
                    policyLockStates.mceAllocation === 'maximum' ? 'text-orange-300' :
                    'text-red-300'
                  }`}>
                    {policyLockStates.mceAllocation === 'minimum' ? '⬆️ Can only increase' :
                     policyLockStates.mceAllocation === 'maximum' ? '⬇️ Can only decrease' :
                     '🔒 Locked'}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleLockPolicy('mceAllocation')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  policyLockStates.mceAllocation === 'unlocked' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                  policyLockStates.mceAllocation === 'minimum' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  policyLockStates.mceAllocation === 'maximum' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                  'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={
                  policyLockStates.mceAllocation === 'unlocked' ? 'Click to set minimum (can only increase)' :
                  policyLockStates.mceAllocation === 'minimum' ? 'Click to set maximum (can only decrease)' :
                  policyLockStates.mceAllocation === 'maximum' ? 'Click to lock (no changes)' :
                  'Click to unlock (allow all changes)'
                }
              >
                {policyLockStates.mceAllocation === 'unlocked' ? '🔓 Unlocked' :
                 policyLockStates.mceAllocation === 'minimum' ? '⬆️ Minimum' :
                 policyLockStates.mceAllocation === 'maximum' ? '⬇️ Maximum' :
                 '🔒 Locked'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <p className="text-xs text-blue-300">
            ℹ️ Lock states: <span className="font-semibold">Unlocked</span> = any change, <span className="font-semibold text-blue-300">Minimum</span> = can only increase, <span className="font-semibold text-orange-300">Maximum</span> = can only decrease, <span className="font-semibold text-red-300">Locked</span> = no change. Values shown reflect Day {constraints.testDay} state.
          </p>
        </div>
      </div>

      {/* Run Optimization Button */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <button
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          onClick={runConstrainedOptimization}
          disabled={isOptimizing}
        >
          {isOptimizing ? (
            <>
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {currentPhase === 'phase1' ? '🔵 Phase 1' : '🟢 Phase 2'} - Gen {optimizationProgress.current + 1}/{optimizationProgress.total}
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Two-Phase Optimizer
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Will test {Object.values(constraints.fixedPolicies).filter(v => !v).length} variable policy actions on Day {constraints.testDay},
          respecting {Object.values(constraints.fixedPolicies).filter(v => v).length} fixed policies and {strategy.timedActions.filter(a => a.isLocked).length} locked actions
        </p>
      </div>

      {/* Phase 1 Results */}
      {phase1Results.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-blue-600 p-6">
          <h4 className="text-lg font-semibold text-blue-300 mb-4">🔵 Phase 1: Exploration Results</h4>
          <p className="text-sm text-gray-400 mb-4">
            Top 5 strategies from broad exploration (top 3 will be refined in Phase 2)
          </p>

          <div className="space-y-4">
            {phase1Results.map((result, idx) => (
                  <div
                    key={result.id}
                    className="p-4 bg-gradient-to-r from-gray-750 to-gray-800 border border-gray-600 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                          <h6 className="text-white font-semibold">Strategy #{idx + 1}</h6>
                        </div>
                        <p className="text-lg text-green-400 font-bold mt-1">
                          Growth Rate: ${result.growthRate?.toFixed(0)}/day
                        </p>
                        <p className="text-sm text-gray-400">
                          Total gain: ${((result.growthRate || 0) * constraints.evaluationWindow).toLocaleString()}
                        </p>
                      </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Merge candidate actions with existing strategy actions
                        const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
                        const actionsAfterTestDay = strategy.timedActions.filter(a => a.day > constraints.testDay);

                        loadStrategy({
                          ...strategy,
                          timedActions: [
                            ...actionsBeforeTestDay,
                            ...result.actions, // Actions on test day
                            ...actionsAfterTestDay,
                          ].sort((a, b) => a.day - b.day),
                        });
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      Add to Current Strategy
                    </button>
                    <button
                      onClick={() => {
                        const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
                        const actionsAfterTestDay = strategy.timedActions.filter(a => a.day > constraints.testDay);

                        exportStrategy({
                          ...strategy,
                          timedActions: [
                            ...actionsBeforeTestDay,
                            ...result.actions,
                            ...actionsAfterTestDay,
                          ].sort((a, b) => a.day - b.day),
                        });
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => downloadComprehensiveXLSX(result, idx)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
                    >
                      📊 Excel
                    </button>
                  </div>
                </div>

                {result.actions && result.actions.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-900/50 rounded">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">
                      📋 Policy Actions on Day {constraints.testDay}:
                    </div>
                    <div className="space-y-1">
                      {getMergedActionTexts(result.actions).map((actionText, actionIdx) => (
                        <div key={actionIdx} className="text-xs text-gray-300 flex items-center gap-2">
                          <span className="text-blue-400">•</span>
                          {actionText}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Net Worth Over Time Graph */}
                {result.history && result.history.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-900/50 rounded">
                    <div className="text-xs text-gray-400 mb-3 font-semibold">
                      📈 Net Worth Over Time
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={result.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="day"
                          stroke="#9CA3AF"
                          style={{ fontSize: '10px' }}
                          label={{ value: 'Day', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                        />
                        <YAxis
                          stroke="#9CA3AF"
                          style={{ fontSize: '10px' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                          labelFormatter={(label) => `Day ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={idx === 0 ? '#10B981' : idx === 1 ? '#3B82F6' : '#8B5CF6'}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
              </div>
        </div>
      )}

      {/* Phase 2 Results */}
      {phase2Results.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-green-600 p-6">
          <h4 className="text-lg font-semibold text-green-300 mb-4">🟢 Phase 2: Refinement Results (FINAL)</h4>
          <p className="text-sm text-gray-400 mb-4">
            Top 5 refined strategies - these are the final optimized recommendations
          </p>

          <div className="space-y-4">
            {phase2Results.map((result, idx) => (
                  <div
                    key={result.id}
                    className="p-4 bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-600 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                          <h6 className="text-white font-semibold">Final Strategy #{idx + 1}</h6>
                        </div>
                        <p className="text-lg text-green-400 font-bold mt-1">
                          Growth Rate: ${result.growthRate?.toFixed(0)}/day
                        </p>
                        <p className="text-sm text-gray-400">
                          Total gain: ${((result.growthRate || 0) * constraints.evaluationWindow).toLocaleString()}
                        </p>
                      </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
                        const actionsAfterTestDay = strategy.timedActions.filter(a => a.day > constraints.testDay);

                        loadStrategy({
                          ...strategy,
                          timedActions: [
                            ...actionsBeforeTestDay,
                            ...result.actions,
                            ...actionsAfterTestDay,
                          ].sort((a, b) => a.day - b.day),
                        });
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      Add to Current Strategy
                    </button>
                    <button
                      onClick={() => {
                        const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
                        const actionsAfterTestDay = strategy.timedActions.filter(a => a.day > constraints.testDay);

                        exportStrategy({
                          ...strategy,
                          timedActions: [
                            ...actionsBeforeTestDay,
                            ...result.actions,
                            ...actionsAfterTestDay,
                          ].sort((a, b) => a.day - b.day),
                        });
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => downloadComprehensiveXLSX(result, idx)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
                    >
                      📊 Excel
                    </button>
                  </div>
                </div>

                {result.actions && result.actions.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-900/50 rounded">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">
                      📋 Policy Actions on Day {constraints.testDay}:
                    </div>
                    <div className="space-y-1">
                      {getMergedActionTexts(result.actions).map((actionText, actionIdx) => (
                        <div key={actionIdx} className="text-xs text-gray-300 flex items-center gap-2">
                          <span className="text-green-400">•</span>
                          {actionText}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Net Worth Over Time Graph */}
                {result.history && result.history.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-900/50 rounded">
                    <div className="text-xs text-gray-400 mb-3 font-semibold">
                      📈 Net Worth Over Time
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={result.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="day"
                          stroke="#9CA3AF"
                          style={{ fontSize: '10px' }}
                          label={{ value: 'Day', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                        />
                        <YAxis
                          stroke="#9CA3AF"
                          style={{ fontSize: '10px' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          label={{ value: 'Net Worth ($k)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                          labelFormatter={(label) => `Day ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
              </div>
        </div>
      )}

      {/* Saved Strategies */}
      {savedStrategies.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">💾 Saved Strategies</h4>
          <div className="space-y-3">
            {savedStrategies.map(saved => (
              <div key={saved.id} className="p-4 bg-gray-750 border border-gray-600 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-white font-semibold">{saved.name}</h5>
                    <p className="text-xs text-gray-400">
                      Saved: {new Date(saved.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadStrategy(saved.strategy)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => exportStrategy(saved.strategy)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete strategy "${saved.name}"?`)) {
                          deleteSavedStrategy(saved.id);
                        }
                      }}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
