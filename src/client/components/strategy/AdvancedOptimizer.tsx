import { useState } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import type { Strategy } from '../../types/ui.types';
import type { OptimizationCandidate } from '../../utils/geneticOptimizer';
import { generateConstrainedStrategyParams, mutateConstrainedStrategyParams, ensureSufficientCash } from '../../utils/geneticOptimizer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { debugLogger } from '../../utils/debugLogger';
import ExcelJS from 'exceljs';
import historicalDataImport from '../../data/historicalData.json';

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
}

export default function AdvancedOptimizer() {
  const { strategy, loadStrategy, saveStrategy, savedStrategies } = useStrategyStore();

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
    testDay: 75,
    endDay: 415,
  });

  // Genetic algorithm parameters
  const [gaParams, setGaParams] = useState({
    populationSize: 30,
    generations: 10,
    mutationRate: 0.3,
    eliteCount: 3,
  });

  // Get current values from most recent timed actions
  const getCurrentPolicyValues = () => {
    const values = {
      reorderPoint: strategy.reorderPoint,
      orderQuantity: strategy.orderQuantity,
      standardPrice: strategy.standardPrice,
      standardBatchSize: strategy.standardBatchSize,
      mceAllocationCustom: strategy.mceAllocationCustom,
      dailyOvertimeHours: strategy.dailyOvertimeHours,
    };

    // Find the most recent timed action for each policy
    for (const action of strategy.timedActions) {
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
      }
    }

    return values;
  };

  const currentValues = getCurrentPolicyValues();

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

    if (params) {
      // Only add actions for non-fixed policies
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

      if (!constraints.fixedPolicies.standardBatchSize && params.standardBatchSize !== undefined) {
        actions.push({
          day,
          type: 'ADJUST_BATCH_SIZE',
          newSize: params.standardBatchSize,
        });
      }

      if (!constraints.fixedPolicies.standardPrice && params.standardPrice !== undefined) {
        actions.push({
          day,
          type: 'ADJUST_PRICE',
          productType: 'standard',
          newPrice: params.standardPrice,
        });
      }

      if (!constraints.fixedPolicies.mceAllocationCustom && params.mceAllocationCustom !== undefined) {
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
    // HIRE_ROOKIE - 70% chance, 1-10 workers
    if (Math.random() < 0.7) {
      const hireCount = Math.floor(1 + Math.random() * 10); // 1-10 workers
      console.log(`[AdvancedOptimizer] Adding HIRE_ROOKIE action: day=${day}, count=${hireCount}`);
      actions.push({
        day,
        type: 'HIRE_ROOKIE',
        count: hireCount,
      });
    }

    // BUY_MACHINE - 70% chance, 1-5 machines
    if (Math.random() < 0.7) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const machineType = machineTypes[Math.floor(Math.random() * 3)];
      const machineCount = Math.floor(1 + Math.random() * 5); // 1-5 machines
      console.log(`[AdvancedOptimizer] Adding BUY_MACHINE action: day=${day}, type=${machineType}, count=${machineCount}`);
      actions.push({
        day,
        type: 'BUY_MACHINE',
        machineType,
        count: machineCount,
      });
    }

    // FIRE_EMPLOYEE - 30% chance, 1-3 employees
    if (Math.random() < 0.3) {
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
    }

    // SELL_MACHINE - 30% chance, 1-2 machines
    if (Math.random() < 0.3) {
      const machineTypes: Array<'MCE' | 'WMA' | 'PUC'> = ['MCE', 'WMA', 'PUC'];
      const machineType = machineTypes[Math.floor(Math.random() * 3)];
      const sellCount = Math.floor(1 + Math.random() * 2); // 1-2 machines
      console.log(`[AdvancedOptimizer] Adding SELL_MACHINE action: day=${day}, type=${machineType}, count=${sellCount}`);
      actions.push({
        day,
        type: 'SELL_MACHINE',
        machineType,
        count: sellCount,
      });
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

            // Find peak net worth after test day
            let peakNetWorth = result.finalNetWorth; // Default to final net worth

            if (result.state?.history?.dailyNetWorth) {
              const dailyNetWorth = result.state.history.dailyNetWorth;
              const netWorthAfterTestDay = dailyNetWorth.filter(
                (d: { day: number; value: number }) =>
                  d.day >= constraints.testDay && d.day <= constraints.endDay
              );

              if (netWorthAfterTestDay.length > 0) {
                peakNetWorth = Math.max(...netWorthAfterTestDay.map((d: { value: number }) => d.value));
              }

              // Store complete history for graphing
              candidate.history = dailyNetWorth;
            }

            // Debug logging with more details
            console.log(`Candidate ${candidate.id}:`, {
              peakNetWorth: peakNetWorth.toLocaleString(),
              finalNetWorth: result.finalNetWorth.toLocaleString(),
              hasHistory: !!result.state?.history?.dailyNetWorth,
              historyLength: result.state?.history?.dailyNetWorth?.length || 0,
              testDay: constraints.testDay,
              endDay: constraints.endDay,
              params: candidate.strategyParams
            });

            candidate.netWorth = peakNetWorth;
            candidate.fitness = peakNetWorth;
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

      // Set top 5 results
      const top5 = population.slice(0, 5);
      setOptimizationResults(top5);
      console.log('✅ Optimization complete! Top 5 results:', top5);

      // Debug: Check if all have same history reference (shallow copy issue)
      const firstHistory = top5[0].history;
      const allSameHistory = top5.every(c => c.history === firstHistory);
      if (allSameHistory) {
        console.error('🐛 BUG FOUND: All candidates share the SAME history array reference! This is a shallow copy issue.');
      }

      // Debug: Critical check - are the actions actually different?
      console.log('🔍 ACTIONS COMPARISON:');
      top5.forEach((candidate, idx) => {
        const priceAction = candidate.actions.find(a => a.type === 'ADJUST_PRICE');
        const ropAction = candidate.actions.find(a => a.type === 'SET_REORDER_POINT');
        console.log(`Candidate ${idx} (${candidate.id}):`, {
          price: priceAction && 'newPrice' in priceAction ? priceAction.newPrice : 'N/A',
          reorderPoint: ropAction && 'newReorderPoint' in ropAction ? ropAction.newReorderPoint : 'N/A',
          netWorth: candidate.netWorth,
          actionCount: candidate.actions.length
        });
      });

      // Check if all net worths are identical
      const uniqueNetWorths = new Set(top5.map(c => c.netWorth));
      if (uniqueNetWorths.size === 1) {
        console.error('🐛 CRITICAL BUG: All top 5 candidates have IDENTICAL net worth despite different parameters!');
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

  const saveRecommendedStrategy = (candidate: OptimizationCandidate) => {
    const name = prompt('Enter a name for this strategy:');
    if (!name) return;

    // Merge candidate actions with existing strategy actions
    const actionsBeforeTestDay = strategy.timedActions.filter(a => a.day < constraints.testDay);
    const actionsAfterTestDay = strategy.timedActions.filter(a => a.day > constraints.testDay);

    const strategyToSave: Strategy = {
      ...strategy,
      timedActions: [
        ...actionsBeforeTestDay,
        ...candidate.actions, // Actions on test day
        ...actionsAfterTestDay,
      ].sort((a, b) => a.day - b.day),
    };

    // Load the strategy into current state first
    loadStrategy(strategyToSave);

    // Then save it to the global library (persists to localStorage)
    saveStrategy(name);

    alert(`Strategy "${name}" saved to library successfully!`);
  };

  const togglePolicyFixed = (policy: keyof OptimizationConstraints['fixedPolicies']) => {
    setConstraints(prev => ({
      ...prev,
      fixedPolicies: {
        ...prev.fixedPolicies,
        [policy]: !prev.fixedPolicies[policy],
      },
    }));
  };

  const toggleActionFixed = (actionId: string) => {
    setConstraints(prev => {
      const newFixedActions = new Set(prev.fixedActions);
      if (newFixedActions.has(actionId)) {
        newFixedActions.delete(actionId);
      } else {
        newFixedActions.add(actionId);
      }
      return {
        ...prev,
        fixedActions: newFixedActions,
      };
    });
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

      {/* Policy Decision Controls */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">📋 Policy Decisions</h4>
        <p className="text-sm text-gray-400 mb-4">
          Toggle each policy to mark it as Fixed (🔒 locked value) or Variable (🔓 can be optimized)
        </p>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(constraints.fixedPolicies).map(([policy, isFixed]) => (
            <div
              key={policy}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                isFixed
                  ? 'bg-red-900/20 border-red-600/50'
                  : 'bg-green-900/20 border-green-600/50'
              }`}
              onClick={() => togglePolicyFixed(policy as keyof OptimizationConstraints['fixedPolicies'])}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">
                  {
                    policy === 'reorderPoint' ? 'Reorder Point - Raw Materials (Both Lines)' :
                    policy === 'orderQuantity' ? 'Order Quantity - Raw Materials (Both Lines)' :
                    policy === 'standardPrice' ? 'Standard Line - Price' :
                    policy === 'standardBatchSize' ? 'Standard Line - Batch Size' :
                    policy === 'mceAllocationCustom' ? 'MCE Allocation - % to Custom Line' :
                    policy === 'dailyOvertimeHours' ? 'Daily Overtime - Both Lines' :
                    policy.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                  }
                </span>
                <span className="text-2xl">{isFixed ? '🔒' : '🔓'}</span>
              </div>
              <div className="text-xs text-gray-400">
                {isFixed ? 'Fixed - will not change' : 'Variable - can be optimized'}
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Current: {
                  policy === 'reorderPoint' ? `${currentValues.reorderPoint} units` :
                  policy === 'orderQuantity' ? `${currentValues.orderQuantity} units` :
                  policy === 'standardPrice' ? `$${currentValues.standardPrice}` :
                  policy === 'standardBatchSize' ? `${currentValues.standardBatchSize} units` :
                  policy === 'mceAllocationCustom' ? `${(currentValues.mceAllocationCustom * 100).toFixed(0)}%` :
                  policy === 'dailyOvertimeHours' ? `${currentValues.dailyOvertimeHours}h` :
                  'N/A'
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timed Actions Controls */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-white mb-4">⏰ Timed Actions</h4>
        <p className="text-sm text-gray-400 mb-4">
          Mark specific timed actions as fixed to prevent the optimizer from removing or modifying them
        </p>

        {strategy.timedActions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No timed actions defined. Go to Strategy Builder to add some.
          </div>
        ) : (
          <div className="space-y-2">
            {strategy.timedActions.map((action, idx) => {
              const actionId = `action-${action.day}-${action.type}-${idx}`;
              const isFixed = constraints.fixedActions.has(actionId);

              return (
                <div
                  key={actionId}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isFixed
                      ? 'bg-red-900/20 border-red-600/50'
                      : 'bg-gray-750 border-gray-600'
                  }`}
                  onClick={() => toggleActionFixed(actionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm text-white">
                        Day {action.day}: <strong>{action.type}</strong>
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {JSON.stringify(action).substring(0, 100)}...
                      </span>
                    </div>
                    <span className="text-xl ml-4">{isFixed ? '🔒' : '🔓'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              Run Constrained Optimization
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Will test {Object.values(constraints.fixedPolicies).filter(v => !v).length} variable policy actions on Day {constraints.testDay},
          respecting {Object.values(constraints.fixedPolicies).filter(v => v).length} fixed policies and {constraints.fixedActions.size} locked actions
        </p>
      </div>

      {/* Optimization Results */}
      {optimizationResults.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">🎯 Optimization Results</h4>
          <p className="text-sm text-gray-400 mb-4">
            Top {optimizationResults.length} strategies found (tested from day {constraints.testDay} to {constraints.endDay})
          </p>
          <div className="space-y-3">
            {optimizationResults.map((result, idx) => (
              <div
                key={result.id}
                className="p-4 bg-gradient-to-r from-gray-750 to-gray-800 border border-gray-600 rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}</span>
                      <h5 className="text-white font-semibold">Strategy #{idx + 1}</h5>
                    </div>
                    <p className="text-lg text-green-400 font-bold mt-1">
                      Peak Net Worth: ${result.netWorth.toLocaleString()}
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
                      Load
                    </button>
                    <button
                      onClick={() => saveRecommendedStrategy(result)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                    >
                      Save
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
                      {result.actions.map((action, actionIdx) => {
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
                          actionText = `Adjust MCE Custom Allocation → ${(action.newAllocation * 100).toFixed(0)}%`;
                        } else if (action.type === 'HIRE_ROOKIE' && 'count' in action) {
                          actionText = `Hire Rookie Workers → ${action.count} workers`;
                        } else if (action.type === 'BUY_MACHINE' && 'machineType' in action && 'count' in action) {
                          actionText = `Buy Machine → ${action.count}x ${action.machineType}`;
                        } else if (action.type === 'FIRE_EMPLOYEE' && 'employeeType' in action && 'count' in action) {
                          actionText = `Fire Employee → ${action.count}x ${action.employeeType}`;
                        } else if (action.type === 'SELL_MACHINE' && 'machineType' in action && 'count' in action) {
                          actionText = `Sell Machine → ${action.count}x ${action.machineType}`;
                        } else if (action.type === 'TAKE_LOAN' && 'amount' in action) {
                          actionText = `Take Loan → $${action.amount.toLocaleString()}`;
                        } else {
                          actionText = action.type;
                        }

                        return (
                          <div key={actionIdx} className="text-xs text-gray-300 flex items-center gap-2">
                            <span className="text-blue-400">•</span>
                            {actionText}
                          </div>
                        );
                      })}
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
