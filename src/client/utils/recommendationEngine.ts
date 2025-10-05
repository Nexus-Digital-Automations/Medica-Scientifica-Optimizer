import type { SimulationResult } from '../types/ui.types';
import type { BottleneckAnalysis } from './bottleneckAnalysis';

export interface RecommendationAction {
  type: 'hire_rookie' | 'purchase_machine' | 'adjust_inventory' | 'adjust_pricing' | 'adjust_allocation' | 'adjust_batch_size';
  parameter: string;
  currentValue: number;
  targetValue: number;
  day?: number;
}

export interface Recommendation {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'workforce' | 'inventory' | 'capacity' | 'strategy' | 'financial';
  title: string;
  problem: string;
  analysis: string;
  solution: string;
  expectedImpact: string;
  implementation: string[];
  risks: string[];
  metrics: {
    currentValue: number;
    targetValue: number;
    unit: string;
  };
  actions: RecommendationAction[]; // Actionable changes that can be applied to strategy
}

export function generateComprehensiveRecommendations(
  simulationResult: SimulationResult,
  bottleneckAnalysis: BottleneckAnalysis
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { state } = simulationResult;
  const finalDay = state.history.dailyCash.length - 1;

  // Get current state
  const finalExperts = state.history.dailyExperts[finalDay]?.value || 0;
  const finalRookies = state.history.dailyRookies[finalDay]?.value || 0;
  const finalRawMaterial = state.history.dailyRawMaterial[finalDay]?.value || 0;
  const finalStandardWIP = state.history.dailyStandardWIP[finalDay]?.value || 0;
  const finalCustomWIP = state.history.dailyCustomWIP[finalDay]?.value || 0;
  const arcpCapacity = (finalExperts * 3) + (finalRookies * 3 * 0.4);

  // Calculate averages for last 50 days
  const recentDays = Math.min(50, finalDay);
  const startIdx = Math.max(0, finalDay - recentDays);

  const avgStandardProduction = state.history.dailyStandardProduction
    .slice(startIdx)
    .reduce((sum, d) => sum + d.value, 0) / recentDays;

  const avgCustomProduction = state.history.dailyCustomProduction
    .slice(startIdx)
    .reduce((sum, d) => sum + d.value, 0) / recentDays;

  // 1. ARCP Workforce Recommendations
  const arcpMetrics = bottleneckAnalysis.metrics.find(m => m.station === 'ARCP Workforce');
  if (arcpMetrics && arcpMetrics.severity !== 'optimal') {
    const targetCapacity = Math.max(
      avgStandardProduction + avgCustomProduction + 10, // 10 unit buffer
      20 // Minimum reasonable capacity
    );
    const neededWorkers = Math.ceil((targetCapacity - arcpCapacity) / 3);

    const rookiesToHire = Math.max(1, Math.ceil(neededWorkers * 0.6));
    const expertsToHire = Math.max(1, Math.floor(neededWorkers * 0.4));

    recommendations.push({
      id: 'arcp_workforce',
      priority: arcpMetrics.severity === 'critical' ? 'urgent' : 'high',
      category: 'workforce',
      title: arcpMetrics.severity === 'critical'
        ? '🚨 Critical ARCP Workforce Shortage'
        : '⚠️ Increase ARCP Workforce Capacity',
      problem: `Current ARCP capacity is ${arcpCapacity.toFixed(1)} units/day, but production requires ${targetCapacity.toFixed(1)} units/day. This ${arcpMetrics.percentageBottlenecked.toFixed(1)}% bottleneck is causing massive WIP buildup on both production lines.`,
      analysis: `With ${finalExperts} experts and ${finalRookies} rookies, the ARCP station can only process ${arcpCapacity.toFixed(1)} units/day. Standard line produces ${avgStandardProduction.toFixed(1)} units/day and Custom line produces ${avgCustomProduction.toFixed(1)} orders/day. The bottleneck has persisted for ${arcpMetrics.daysBottlenecked} days (${arcpMetrics.percentageBottlenecked.toFixed(1)}% of simulation).`,
      solution: `Hire ${neededWorkers} additional worker${neededWorkers > 1 ? 's' : ''} to achieve ${targetCapacity.toFixed(1)} units/day capacity.`,
      expectedImpact: `Reduce Standard WIP from ${finalStandardWIP.toFixed(0)} to <100 units, reduce Custom WIP from ${finalCustomWIP.toFixed(0)} to <50 orders. Improve delivery times by 40-60%, increase daily throughput by ${((targetCapacity - arcpCapacity) / arcpCapacity * 100).toFixed(0)}%.`,
      implementation: [
        `Hire ${rookiesToHire} rookie${rookiesToHire > 1 ? 's' : ''} immediately (15-day training period)`,
        `Consider hiring ${expertsToHire} expert${expertsToHire > 1 ? 's' : ''} for immediate capacity`,
        `Monitor WIP levels daily during ramp-up`,
        `Evaluate overtime options during training period`,
      ],
      risks: [
        `Rookies take 15 days to reach full productivity`,
        `Labor costs increase by $${(neededWorkers * 85).toFixed(0)}/day initially`,
        `Training overhead during transition period`,
      ],
      metrics: {
        currentValue: arcpCapacity,
        targetValue: targetCapacity,
        unit: 'units/day',
      },
      actions: [
        {
          type: 'hire_rookie',
          parameter: 'rookies',
          currentValue: finalRookies,
          targetValue: finalRookies + rookiesToHire,
          day: 51, // Hire immediately - they will train to become experts
        },
      ],
    });
  }

  // 2. Raw Material Inventory Recommendations
  const rawMaterialMetrics = bottleneckAnalysis.metrics.find(m => m.station === 'Raw Materials');
  if (rawMaterialMetrics && rawMaterialMetrics.severity !== 'optimal') {
    const dailyConsumption = (avgStandardProduction * 2) + (avgCustomProduction * 1);
    const targetInventory = dailyConsumption * 10; // 10-day buffer
    const targetReorderPoint = dailyConsumption * 7; // Reorder at 7 days remaining

    recommendations.push({
      id: 'raw_material_inventory',
      priority: rawMaterialMetrics.severity === 'critical' ? 'urgent' : 'high',
      category: 'inventory',
      title: rawMaterialMetrics.severity === 'critical'
        ? '🚨 Critical Raw Material Stockout Risk'
        : '⚠️ Optimize Raw Material Inventory',
      problem: `Raw material inventory averages ${rawMaterialMetrics.averageWIP.toFixed(0)} parts, experiencing stockouts ${rawMaterialMetrics.percentageBottlenecked.toFixed(1)}% of the time. Current inventory (${finalRawMaterial} parts) is critically low.`,
      analysis: `Daily consumption: ${dailyConsumption.toFixed(1)} parts (${(avgStandardProduction * 2).toFixed(1)} for Standard, ${avgCustomProduction.toFixed(1)} for Custom). With 4-day lead time and $1,000 order fee, inventory policies are suboptimal. Stockouts occurred on ${rawMaterialMetrics.daysBottlenecked} days.`,
      solution: `Increase reorder point to ${targetReorderPoint.toFixed(0)} parts and order quantity to ${(targetInventory * 0.8).toFixed(0)} parts per order.`,
      expectedImpact: `Eliminate ${rawMaterialMetrics.percentageBottlenecked.toFixed(1)}% stockout rate, ensure continuous production flow, reduce production delays by ${rawMaterialMetrics.daysBottlenecked} days over simulation period.`,
      implementation: [
        `Set reorder point: ${targetReorderPoint.toFixed(0)} parts`,
        `Set order quantity: ${(targetInventory * 0.8).toFixed(0)} parts`,
        `Immediate emergency order to reach ${targetInventory.toFixed(0)} parts`,
        `Review and adjust weekly based on demand patterns`,
      ],
      risks: [
        `Increased inventory holding costs`,
        `Higher initial capital requirement for inventory`,
        `Order fees: ~$${((365 / dailyConsumption) * targetInventory * 1000 / 365).toFixed(0)}/day`,
      ],
      metrics: {
        currentValue: rawMaterialMetrics.averageWIP,
        targetValue: targetInventory,
        unit: 'parts',
      },
      actions: [
        {
          type: 'adjust_inventory',
          parameter: 'reorderPoint',
          currentValue: simulationResult.strategy.reorderPoint || 50,
          targetValue: Math.round(targetReorderPoint),
          day: 51,
        },
        {
          type: 'adjust_inventory',
          parameter: 'orderQuantity',
          currentValue: simulationResult.strategy.orderQuantity || 200,
          targetValue: Math.round(targetInventory * 0.8),
          day: 51,
        },
      ],
    });
  }

  // 3. Standard Line WIP Recommendations
  const standardMetrics = bottleneckAnalysis.metrics.find(m => m.station === 'Standard Line');
  if (standardMetrics && standardMetrics.severity !== 'optimal') {
    recommendations.push({
      id: 'standard_line_wip',
      priority: standardMetrics.severity === 'critical' ? 'high' : 'medium',
      category: 'capacity',
      title: standardMetrics.severity === 'critical'
        ? '🚨 Standard Line Severe Congestion'
        : '⚠️ Reduce Standard Line WIP',
      problem: `Standard Line WIP at ${finalStandardWIP.toFixed(0)} units (${(finalStandardWIP / 100 * 100).toFixed(0)}% over healthy threshold). Batching delays of 5 days combined with ARCP bottleneck creating ${standardMetrics.daysBottlenecked}-day backlog.`,
      analysis: `Root causes: (1) ARCP capacity (${arcpCapacity.toFixed(1)} units/day) << production input, (2) 5-day batching delay adds fixed lag, (3) MCE allocation may be too high. WIP trend: ${standardMetrics.trend}.`,
      solution: `Multi-pronged approach: Increase ARCP capacity (see workforce recommendation), reduce first batch delay from 4 to 3 days, optimize MCE allocation.`,
      expectedImpact: `Reduce WIP to <100 units, decrease lead time by 20-30%, free up working capital tied in WIP, improve delivery predictability.`,
      implementation: [
        `Address ARCP workforce bottleneck first (primary constraint)`,
        `Reduce first batching delay: 4 days → 3 days`,
        `Consider reducing MCE allocation to Standard if Custom is starved`,
        `Implement WIP caps to prevent runaway accumulation`,
      ],
      risks: [
        `Batching optimization may increase setup frequency`,
        `MCE allocation changes affect both lines`,
        `May temporarily reduce throughput during transition`,
      ],
      metrics: {
        currentValue: finalStandardWIP,
        targetValue: 80,
        unit: 'units',
      },
      actions: [
        {
          type: 'adjust_batch_size',
          parameter: 'standardBatchSize',
          currentValue: simulationResult.strategy.standardBatchSize || 60,
          targetValue: Math.max(40, Math.floor((simulationResult.strategy.standardBatchSize || 60) * 0.8)),
          day: 51,
        },
      ],
    });
  }

  // 4. Custom Line WIP Recommendations
  const customMetrics = bottleneckAnalysis.metrics.find(m => m.station === 'Custom Line');
  if (customMetrics && customMetrics.severity !== 'optimal') {
    const customUtilization = (finalCustomWIP / 360) * 100;

    recommendations.push({
      id: 'custom_line_wip',
      priority: customMetrics.severity === 'critical' ? 'high' : 'medium',
      category: 'capacity',
      title: customMetrics.severity === 'critical'
        ? '🚨 Custom Line at Critical Capacity'
        : '⚠️ Custom Line Congestion',
      problem: `Custom Line WIP at ${finalCustomWIP.toFixed(0)} orders (${customUtilization.toFixed(1)}% of 360-order maximum capacity). Delivery times severely impacted, affecting pricing and customer satisfaction.`,
      analysis: `Custom orders take ~10-12 days through pipeline (MCE→WMA(2d)→PUC(1d)→WMA(2d)→ARCP). WMA capacity shared across both passes (6 units/day total). ${customMetrics.daysBottlenecked} days affected by bottleneck (${customMetrics.percentageBottlenecked.toFixed(1)}%).`,
      solution: `Increase WMA capacity from 1 to 2 machines (double throughput to 12 units/day), increase ARCP allocation to Custom line.`,
      expectedImpact: `Reduce delivery time from ${(finalCustomWIP / avgCustomProduction).toFixed(0)} days to <30 days, improve pricing by 15-25%, reduce WIP to <50 orders, increase customer satisfaction.`,
      implementation: [
        `Purchase 1 additional WMA machine ($15,000)`,
        `Increase MCE allocation to Custom if <30%`,
        `Address ARCP capacity (affects both lines)`,
        `Monitor delivery time metrics daily`,
      ],
      risks: [
        `Capital investment: $15,000 for WMA machine`,
        `May shift bottleneck to ARCP if not addressed`,
        `Resale value only $7,500 if over-capacity`,
      ],
      metrics: {
        currentValue: finalCustomWIP,
        targetValue: 50,
        unit: 'orders',
      },
      actions: [
        {
          type: 'purchase_machine',
          parameter: 'wmaMachines',
          currentValue: simulationResult.state.machines.WMA || 1,
          targetValue: (simulationResult.state.machines.WMA || 1) + 1,
          day: 51,
        },
      ],
    });
  }

  // 5. Strategic MCE Allocation Recommendation
  const mceAllocation = simulationResult.strategy.mceAllocationCustom || 0.5;
  const customStarvation = finalCustomWIP < 10 && avgCustomProduction < 2;
  const standardStarvation = finalStandardWIP < 20 && avgStandardProduction < 5;

  if (customStarvation || standardStarvation) {
    recommendations.push({
      id: 'mce_allocation_optimization',
      priority: 'medium',
      category: 'strategy',
      title: '⚙️ Optimize MCE Capacity Allocation',
      problem: customStarvation
        ? `Custom line starved with ${finalCustomWIP.toFixed(0)} WIP and ${avgCustomProduction.toFixed(1)} orders/day production. MCE allocation at ${(mceAllocation * 100).toFixed(0)}%.`
        : `Standard line starved with ${finalStandardWIP.toFixed(0)} WIP and ${avgStandardProduction.toFixed(1)} units/day production. MCE allocation at ${((1 - mceAllocation) * 100).toFixed(0)}%.`,
      analysis: `Current MCE allocation: ${(mceAllocation * 100).toFixed(0)}% Custom, ${((1 - mceAllocation) * 100).toFixed(0)}% Standard. ${customStarvation ? 'Custom' : 'Standard'} line is capacity-constrained while ${customStarvation ? 'Standard' : 'Custom'} may have excess allocation.`,
      solution: customStarvation
        ? `Increase Custom MCE allocation from ${(mceAllocation * 100).toFixed(0)}% to ${Math.min(70, (mceAllocation + 0.2) * 100).toFixed(0)}%.`
        : `Decrease Custom MCE allocation from ${(mceAllocation * 100).toFixed(0)}% to ${Math.max(30, (mceAllocation - 0.2) * 100).toFixed(0)}%.`,
      expectedImpact: `Balance production across both lines, improve ${customStarvation ? 'Custom' : 'Standard'} throughput by 20-40%, optimize overall factory utilization.`,
      implementation: [
        `Adjust MCE allocation gradually in 5% increments`,
        `Monitor both line WIP levels during transition`,
        `Target: 40-60% Custom allocation based on demand`,
        `Re-evaluate weekly based on backlog trends`,
      ],
      risks: [
        `May create opposite bottleneck if overcorrected`,
        `Requires monitoring both lines simultaneously`,
        `Optimal allocation varies with demand patterns`,
      ],
      metrics: {
        currentValue: mceAllocation * 100,
        targetValue: customStarvation ? Math.min(70, (mceAllocation + 0.2) * 100) : Math.max(30, (mceAllocation - 0.2) * 100),
        unit: '%',
      },
      actions: [
        {
          type: 'adjust_allocation',
          parameter: 'mceAllocationCustom',
          currentValue: mceAllocation,
          targetValue: customStarvation ? Math.min(0.7, mceAllocation + 0.2) : Math.max(0.3, mceAllocation - 0.2),
          day: 51,
        },
      ],
    });
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
