import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';
import { generateConstrainedStrategyParams, mutateConstrainedStrategyParams, ensureSufficientCash } from '../../utils/geneticOptimizer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { debugLogger } from '../../utils/debugLogger';
import ExcelJS from 'exceljs';
import historicalDataImport from '../../data/historicalData.json';

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
  });

  // Genetic algorithm parameters
  const [gaParams, setGaParams] = useState({
    populationSize: 30,
    generations: 10,
    mutationRate: 0.3,
    eliteCount: 3,
  });

  // Current state locks
  const [lockedWorkforce, setLockedWorkforce] = useState(false);
  const [lockedMachines, setLockedMachines] = useState({ MCE: false, WMA: false, PUC: false });
  const [lockedPolicies, setLockedPolicies] = useState({
    batchSize: false,
    price: false,
    mceAllocation: false,
  });

  // Handler functions for current state locks
  const handleLockWorkforce = () => {
    setLockedWorkforce(!lockedWorkforce);
  };

  const handleLockMachine = (machineType: 'MCE' | 'WMA' | 'PUC') => {
    setLockedMachines(prev => ({ ...prev, [machineType]: !prev[machineType] }));
  };

  const handleLockPolicy = (policyType: 'batchSize' | 'price' | 'mceAllocation') => {
    setLockedPolicies(prev => ({ ...prev, [policyType]: !prev[policyType] }));
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
  const [optimizationResults, setOptimizationResults] = useState<OptimizationCandidate[]>([]);
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
    const hasLockedWorkforceAction = lockedWorkforce || lockedActions.some(a =>
      a.type === 'HIRE_ROOKIE' || a.type === 'FIRE_EMPLOYEE'
    );

    // Check if any machine actions are locked per machine type
    // Also check current state panel machine locks
    const hasLockedMCEAction = lockedMachines.MCE || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'MCE'
    );
    const hasLockedWMAAction = lockedMachines.WMA || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'WMA'
    );
    const hasLockedPUCAction = lockedMachines.PUC || lockedActions.some(a =>
      (a.type === 'BUY_MACHINE' || a.type === 'SELL_MACHINE') && a.machineType === 'PUC'
    );

    // Check if any batch size actions are locked
    // Also check current state panel policy lock
    const hasLockedBatchSizeAction = lockedPolicies.batchSize || lockedActions.some(a => a.type === 'ADJUST_BATCH_SIZE');

    // Check if any price actions are locked
    // Also check current state panel policy lock
    const hasLockedPriceAction = lockedPolicies.price || lockedActions.some(a => a.type === 'ADJUST_PRICE');

    // Check if any MCE allocation actions are locked
    // Also check current state panel policy lock
    const hasLockedMCEAllocationAction = lockedPolicies.mceAllocation || lockedActions.some(a => a.type === 'ADJUST_MCE_ALLOCATION');

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

      if (!constraints.fixedPolicies.standardBatchSize && params.standardBatchSize !== undefined && !hasLockedBatchSizeAction) {
        actions.push({
          day,
          type: 'ADJUST_BATCH_SIZE',
          newSize: params.standardBatchSize,
        });
      }

      if (!constraints.fixedPolicies.standardPrice && params.standardPrice !== undefined && !hasLockedPriceAction) {
        actions.push({
          day,
          type: 'ADJUST_PRICE',
          productType: 'standard',
          newPrice: params.standardPrice,
        });
      }

      if (!constraints.fixedPolicies.mceAllocationCustom && params.mceAllocationCustom !== undefined && !hasLockedMCEAllocationAction) {
        actions.push({
          day,
          type: 'ADJUST_MCE_ALLOCATION',
          newAllocation: params.mceAllocationCustom,
        });
      }

      // Note: dailyOvertimeHours is not a policy action, it's a strategy parameter
      // It affects daily operations, not a one-time decision
    }

    // Add diverse one-time actions with increased probabilities and ranges
    // Only add if no locked actions prevent it

    // HIRE_ROOKIE - 70% chance, 1-10 workers (only if no workforce actions are locked)
    if (!hasLockedWorkforceAction && Math.random() < 0.7) {
      const hireCount = Math.floor(1 + Math.random() * 10); // 1-10 workers
      console.log(`[AdvancedOptimizer] Adding HIRE_ROOKIE action: day=${day}, count=${hireCount}`);
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: hireCount,
      });
    } else if (hasLockedWorkforceAction) {
      console.log(`[AdvancedOptimizer] Skipping HIRE_ROOKIE - workforce actions are locked`);
    }

    // BUY_MACHINE - 70% chance, 1-5 machines (only if that machine type is not locked)
    if (Math.random() < 0.7) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const availableMachineTypes = machineTypes.filter(type => {
        if (type === 'MCE') return !hasLockedMCEAction;
        if (type === 'WMA') return !hasLockedWMAAction;
        if (type === 'PUC') return !hasLockedPUCAction;
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
        console.log(`[AdvancedOptimizer] Skipping BUY_MACHINE - all machine types are locked`);
      }
    }

    // FIRE_EMPLOYEE - 30% chance, 1-3 employees (only if no workforce actions are locked)
    if (!hasLockedWorkforceAction && Math.random() < 0.3) {
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
    } else if (hasLockedWorkforceAction) {
      console.log(`[AdvancedOptimizer] Skipping FIRE_EMPLOYEE - workforce actions are locked`);
    }

    // SELL_MACHINE - 30% chance, 1-2 machines (only if that machine type is not locked)
    if (Math.random() < 0.3) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const availableMachineTypes = machineTypes.filter(type => {
        if (type === 'MCE') return !hasLockedMCEAction;
        if (type === 'WMA') return !hasLockedWMAAction;
        if (type === 'PUC') return !hasLockedPUCAction;
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
        console.log(`[AdvancedOptimizer] Skipping SELL_MACHINE - all machine types are locked`);
      }
    }

    // Add automatic loan management to ensure actions don't violate minimum cash threshold
    const actionsWithLoans = ensureSufficientCash(actions, 100000, 50000);
    console.log(`[AdvancedOptimizer] Generated ${actions.length} actions, after loan management: ${actionsWithLoans.length} actions`);

    return actionsWithLoans;
  };

  const runConstrainedOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationResults([]);

    // Start debug logging (overwrites previous logs)
    debugLogger.start();
    console.log('🚀 Starting constrained optimization');

    try {
      const { populationSize, generations, mutationRate, eliteCount } = gaParams;

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

      setOptimizationResults(topResults);
      console.log('✅ Optimization complete!');
      console.log('🚀 Top 5 by Growth Rate:', topResults);

      // Notify parent component (OptimizerPage) that Phase 1 results are ready
      if (onResultsReady) {
        onResultsReady(topResults, constraints.evaluationWindow);
        console.log('📤 Phase 1 results sent to OptimizerPage for Phase 2');
      }

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
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress({ current: 0, total: 0 });

      // Stop debug logging and download log file
      debugLogger.stop();
      debugLogger.download('optimizer-debug.log');
      console.log('📥 Debug log file downloaded');
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
              <select
                id="evaluation-window"
                name="evaluationWindow"
                value={constraints.evaluationWindow}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setConstraints(prev => ({ ...prev, evaluationWindow: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value={14}>14 days - Quick decisions only</option>
                <option value={21}>21 days - Balanced</option>
                <option value={30}>30 days - Full cycle (Recommended) ⭐</option>
                <option value={45}>45 days - Extended impact</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Time horizon for measuring growth rate. Longer windows capture workforce maturation and production cycles.
              </p>
            </div>
          </div>
        </div>

        {/* Genetic Algorithm Parameters */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-300 mb-3">🧬 Genetic Algorithm Parameters</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="population-size" className="block text-sm font-medium text-white mb-2">
                Population Size
              </label>
              <input
                id="population-size"
                name="populationSize"
                type="number"
                value={gaParams.populationSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setGaParams(prev => ({ ...prev, populationSize: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                min="10"
                max="100"
                step="5"
              />
              <p className="text-xs text-gray-400 mt-1">Number of strategies per generation</p>
            </div>

            <div>
              <label htmlFor="generations" className="block text-sm font-medium text-white mb-2">
                Generations
              </label>
              <input
                id="generations"
                name="generations"
                type="number"
                value={gaParams.generations}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setGaParams(prev => ({ ...prev, generations: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                min="5"
                max="50"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Number of evolution cycles</p>
            </div>

            <div>
              <label htmlFor="mutation-rate" className="block text-sm font-medium text-white mb-2">
                Mutation Rate
              </label>
              <input
                id="mutation-rate"
                name="mutationRate"
                type="number"
                value={gaParams.mutationRate}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setGaParams(prev => ({ ...prev, mutationRate: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                min="0.1"
                max="0.9"
                step="0.1"
              />
              <p className="text-xs text-gray-400 mt-1">Probability of random changes (0-1)</p>
            </div>

            <div>
              <label htmlFor="elite-count" className="block text-sm font-medium text-white mb-2">
                Elite Count
              </label>
              <input
                id="elite-count"
                name="eliteCount"
                type="number"
                value={gaParams.eliteCount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                    setGaParams(prev => ({ ...prev, eliteCount: val }));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                min="1"
                max="10"
                step="1"
              />
              <p className="text-xs text-gray-400 mt-1">Top strategies preserved each generation</p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <h5 className="text-sm font-semibold text-blue-300 mb-2">Optimization Summary</h5>
          <div className="text-xs text-gray-300 space-y-1">
            <div>🔒 Fixed Policies: {Object.values(constraints.fixedPolicies).filter(Boolean).length} / 6</div>
            <div>🔓 Variable Policies: {Object.values(constraints.fixedPolicies).filter(v => !v).length} / 6</div>
            <div>🔒 Fixed Actions: {constraints.fixedActions.size}</div>
            <div>⏱️ Test Range: Days {constraints.testDay} - {constraints.endDay}</div>
            <div>🧬 GA Settings: Pop={gaParams.populationSize}, Gen={gaParams.generations}, Mut={gaParams.mutationRate}, Elite={gaParams.eliteCount}</div>
            <div>📊 Total Simulations: {gaParams.populationSize * gaParams.generations}</div>
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
                lockedWorkforce
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
              title={lockedWorkforce ? 'Unlock workforce (allow hiring/firing)' : 'Lock workforce (prevent hiring/firing)'}
            >
              {lockedWorkforce ? '🔓 Unlock All' : '🔒 Lock All'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${lockedWorkforce ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
              <p className="text-sm text-gray-400 mb-1">Experts</p>
              <p className="text-2xl font-bold text-white">{currentValues.experts}</p>
            </div>
            <div className={`p-4 rounded-lg border-2 ${lockedWorkforce ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
              <p className="text-sm text-gray-400 mb-1">Rookies</p>
              <p className="text-2xl font-bold text-white">{currentValues.rookies}</p>
            </div>
          </div>
          {lockedWorkforce && (
            <div className="mt-2 text-xs bg-red-900/30 text-red-300 px-3 py-2 rounded">
              🔒 Optimizer cannot hire or fire employees
            </div>
          )}
        </div>

        {/* Machines Section */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-300 mb-3">🏭 Machines</h5>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className={`p-4 rounded-lg border-2 ${lockedMachines.MCE ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
                <p className="text-sm text-gray-400 mb-1">MCE</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.MCE}</p>
              </div>
              <button
                onClick={() => handleLockMachine('MCE')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  lockedMachines.MCE
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedMachines.MCE ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>
            <div>
              <div className={`p-4 rounded-lg border-2 ${lockedMachines.WMA ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
                <p className="text-sm text-gray-400 mb-1">WMA</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.WMA}</p>
              </div>
              <button
                onClick={() => handleLockMachine('WMA')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  lockedMachines.WMA
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedMachines.WMA ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>
            <div>
              <div className={`p-4 rounded-lg border-2 ${lockedMachines.PUC ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
                <p className="text-sm text-gray-400 mb-1">PUC</p>
                <p className="text-2xl font-bold text-white">{currentValues.machines.PUC}</p>
              </div>
              <button
                onClick={() => handleLockMachine('PUC')}
                className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  lockedMachines.PUC
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedMachines.PUC ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>
          </div>
        </div>

        {/* Policy Settings Section */}
        <div>
          <h5 className="text-sm font-semibold text-gray-300 mb-3">⚙️ Policy Settings</h5>
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${lockedPolicies.batchSize ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
              <div>
                <p className="text-sm font-medium text-white">Standard Batch Size</p>
                <p className="text-2xl font-bold text-white">{currentValues.standardBatchSize || 60}</p>
              </div>
              <button
                onClick={() => handleLockPolicy('batchSize')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  lockedPolicies.batchSize
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedPolicies.batchSize ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${lockedPolicies.price ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
              <div>
                <p className="text-sm font-medium text-white">Standard Price</p>
                <p className="text-2xl font-bold text-white">${currentValues.standardPrice || 225}</p>
              </div>
              <button
                onClick={() => handleLockPolicy('price')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  lockedPolicies.price
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedPolicies.price ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${lockedPolicies.mceAllocation ? 'bg-red-900/20 border-red-600/50' : 'bg-gray-700 border-gray-600'}`}>
              <div>
                <p className="text-sm font-medium text-white">MCE Allocation (Custom)</p>
                <p className="text-2xl font-bold text-white">{(currentValues.mceAllocationCustom * 100).toFixed(0)}%</p>
              </div>
              <button
                onClick={() => handleLockPolicy('mceAllocation')}
                className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
                  lockedPolicies.mceAllocation
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {lockedPolicies.mceAllocation ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <p className="text-xs text-blue-300">
            ℹ️ Locked values prevent the optimizer from making changes. Values shown reflect Day {constraints.testDay} state.
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
              Optimizing... (Gen {optimizationProgress.current + 1}/{optimizationProgress.total})
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Optimizer
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Will test {Object.values(constraints.fixedPolicies).filter(v => !v).length} variable policy actions on Day {constraints.testDay},
          respecting {Object.values(constraints.fixedPolicies).filter(v => v).length} fixed policies and {strategy.timedActions.filter(a => a.isLocked).length} locked actions
        </p>
      </div>

      {/* Optimization Results */}
      {optimizationResults.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">🎯 Optimization Results</h4>
          <p className="text-sm text-gray-400 mb-4">
            Top 5 strategies ranked by growth rate from day {constraints.testDay} over {constraints.evaluationWindow} days
          </p>

          <div className="space-y-4">
            {optimizationResults.map((result, idx) => (
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
