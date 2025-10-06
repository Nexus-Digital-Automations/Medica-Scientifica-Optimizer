import type { SimulationResult } from '../types/ui.types';

export interface RemedyHint {
  category: 'Inventory Policy' | 'Workforce Expansion' | 'Capital Equipment' | 'Resource Rebalancing';
  action: string;
  complexity: 'Quick Fix' | 'Capital Investment' | 'Strategic';
  icon: string;
}

export interface BottleneckMetrics {
  station: string;
  severity: 'critical' | 'warning' | 'optimal';
  averageWIP: number;
  peakWIP: number;
  peakDay: number;
  percentageBottlenecked: number;
  daysBottlenecked: number;
  totalDays: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  utilizationRate: number;
  flowRate: number; // Units per day change rate (positive = growing, negative = declining)
  remedyHint?: RemedyHint;
}

export interface BottleneckProblem {
  id: string;
  station: string;
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  rootCause: string;
  impact: string;
  recommendation: string;
  metrics: {
    averageDelay?: number;
    peakWIP: number;
    utilizationRate: number;
  };
}

export interface BottleneckAnalysis {
  metrics: BottleneckMetrics[];
  problems: BottleneckProblem[];
  overallHealth: 'critical' | 'warning' | 'optimal';
  summaryStats: {
    totalBottlenecks: number;
    criticalBottlenecks: number;
    averageUtilization: number;
    mostCriticalStation: string | null;
  };
}

/**
 * Analyze simulation results for bottlenecks and generate comprehensive statistics
 */
export function analyzeBottlenecks(simulationResult: SimulationResult): BottleneckAnalysis {
  const { state } = simulationResult;
  const history = state.history;
  const totalDays = history.dailyCash.length;

  // Analyze Standard Line WIP
  const standardMetrics = analyzeStationWIP(
    'Standard Line',
    history.dailyStandardWIP,
    100, // Critical threshold
    50   // Warning threshold
  );

  // Analyze Custom Line WIP
  const customMetrics = analyzeStationWIP(
    'Custom Line',
    history.dailyCustomWIP,
    50,  // Critical threshold
    25   // Warning threshold
  );

  // Analyze Raw Material Inventory (inverted - low is bad)
  const rawMaterialMetrics = analyzeInventoryLevel(
    'Raw Materials',
    history.dailyRawMaterial,
    50,  // Critical threshold (below this)
    100  // Warning threshold (below this)
  );

  // Analyze ARCP Capacity
  const arcpMetrics = analyzeARCPCapacity(
    'ARCP Workforce',
    history.dailyExperts,
    history.dailyRookies,
    totalDays
  );

  const metrics = [standardMetrics, customMetrics, rawMaterialMetrics, arcpMetrics];

  // Generate problem list with recommendations
  const problems = generateProblems(metrics);

  // Calculate overall health
  const criticalCount = metrics.filter(m => m.severity === 'critical').length;
  const warningCount = metrics.filter(m => m.severity === 'warning').length;

  const overallHealth: 'critical' | 'warning' | 'optimal' =
    criticalCount > 0 ? 'critical' :
    warningCount > 0 ? 'warning' : 'optimal';

  // Find most critical station
  const mostCritical = metrics
    .filter(m => m.severity === 'critical')
    .sort((a, b) => b.percentageBottlenecked - a.percentageBottlenecked)[0];

  const avgUtilization = metrics.reduce((sum, m) => sum + m.utilizationRate, 0) / metrics.length;

  return {
    metrics,
    problems,
    overallHealth,
    summaryStats: {
      totalBottlenecks: criticalCount + warningCount,
      criticalBottlenecks: criticalCount,
      averageUtilization: avgUtilization,
      mostCriticalStation: mostCritical?.station || null,
    },
  };
}

/**
 * Generate remedy hint based on station type and severity
 */
function generateRemedyHint(stationName: string, severity: 'critical' | 'warning' | 'optimal'): RemedyHint | undefined {
  if (severity === 'optimal') return undefined;

  switch (stationName) {
    case 'Standard Line':
    case 'Custom Line':
      return {
        category: 'Resource Rebalancing',
        action: 'Adjust MCE allocation between product lines or reduce batch sizes',
        complexity: 'Quick Fix',
        icon: '⚖️',
      };

    case 'Raw Materials':
      return {
        category: 'Inventory Policy',
        action: 'Increase reorder levels and order quantities',
        complexity: 'Quick Fix',
        icon: '📦',
      };

    case 'ARCP Workforce':
      return {
        category: 'Workforce Expansion',
        action: 'Hire additional workers (rookies + experts)',
        complexity: 'Strategic',
        icon: '👷',
      };

    default:
      return undefined;
  }
}

/**
 * Analyze WIP levels for a station
 */
function analyzeStationWIP(
  stationName: string,
  wipData: Array<{ day: number; value: number }>,
  criticalThreshold: number,
  warningThreshold: number
): BottleneckMetrics {
  const totalDays = wipData.length;

  // Calculate average WIP
  const avgWIP = wipData.reduce((sum, d) => sum + d.value, 0) / totalDays;

  // Find peak WIP
  const peak = wipData.reduce((max, d) => d.value > max.value ? d : max, wipData[0]);

  // Count days bottlenecked (above threshold)
  const daysBottlenecked = wipData.filter(d => d.value > criticalThreshold).length;
  const percentageBottlenecked = (daysBottlenecked / totalDays) * 100;

  // Determine severity
  const severity: 'critical' | 'warning' | 'optimal' =
    avgWIP > criticalThreshold ? 'critical' :
    avgWIP > warningThreshold ? 'warning' : 'optimal';

  // Calculate trend (compare first 1/3 to last 1/3)
  const firstThird = wipData.slice(0, Math.floor(totalDays / 3));
  const lastThird = wipData.slice(Math.floor(totalDays * 2 / 3));
  const firstAvg = firstThird.reduce((sum, d) => sum + d.value, 0) / firstThird.length;
  const lastAvg = lastThird.reduce((sum, d) => sum + d.value, 0) / lastThird.length;
  const trendDiff = lastAvg - firstAvg;

  const trend: 'increasing' | 'decreasing' | 'stable' =
    trendDiff > criticalThreshold * 0.1 ? 'increasing' :
    trendDiff < -criticalThreshold * 0.1 ? 'decreasing' : 'stable';

  // Calculate flow rate (units per day change)
  const daysInPeriod = lastThird.length;
  const flowRate = daysInPeriod > 0 ? trendDiff / daysInPeriod : 0;

  // Utilization rate (inverse of bottleneck - higher WIP = lower utilization quality)
  const utilizationRate = Math.max(0, 100 - (avgWIP / criticalThreshold) * 100);

  return {
    station: stationName,
    severity,
    averageWIP: avgWIP,
    peakWIP: peak.value,
    peakDay: peak.day,
    percentageBottlenecked,
    daysBottlenecked,
    totalDays,
    trend,
    utilizationRate,
    flowRate,
    remedyHint: generateRemedyHint(stationName, severity),
  };
}

/**
 * Analyze inventory levels (inverted - low is bad)
 */
function analyzeInventoryLevel(
  stationName: string,
  inventoryData: Array<{ day: number; value: number }>,
  criticalThreshold: number,
  warningThreshold: number
): BottleneckMetrics {
  const totalDays = inventoryData.length;

  const avgInventory = inventoryData.reduce((sum, d) => sum + d.value, 0) / totalDays;
  const lowest = inventoryData.reduce((min, d) => d.value < min.value ? d : min, inventoryData[0]);

  // Count days below critical threshold
  const daysBottlenecked = inventoryData.filter(d => d.value < criticalThreshold).length;
  const percentageBottlenecked = (daysBottlenecked / totalDays) * 100;

  const severity: 'critical' | 'warning' | 'optimal' =
    avgInventory < criticalThreshold ? 'critical' :
    avgInventory < warningThreshold ? 'warning' : 'optimal';

  // Trend calculation
  const firstThird = inventoryData.slice(0, Math.floor(totalDays / 3));
  const lastThird = inventoryData.slice(Math.floor(totalDays * 2 / 3));
  const firstAvg = firstThird.reduce((sum, d) => sum + d.value, 0) / firstThird.length;
  const lastAvg = lastThird.reduce((sum, d) => sum + d.value, 0) / lastThird.length;
  const trendDiff = lastAvg - firstAvg;

  const trend: 'increasing' | 'decreasing' | 'stable' =
    trendDiff > criticalThreshold * 0.1 ? 'increasing' :
    trendDiff < -criticalThreshold * 0.1 ? 'decreasing' : 'stable';

  // Calculate flow rate (units per day change)
  const daysInPeriod = lastThird.length;
  const flowRate = daysInPeriod > 0 ? trendDiff / daysInPeriod : 0;

  const utilizationRate = Math.min(100, (avgInventory / warningThreshold) * 100);

  return {
    station: stationName,
    severity,
    averageWIP: avgInventory, // Using WIP field for inventory level
    peakWIP: lowest.value,    // Inverted - "peak" is actually lowest
    peakDay: lowest.day,
    percentageBottlenecked,
    daysBottlenecked,
    totalDays,
    trend,
    utilizationRate,
    flowRate,
    remedyHint: generateRemedyHint(stationName, severity),
  };
}

/**
 * Analyze ARCP workforce capacity
 */
function analyzeARCPCapacity(
  stationName: string,
  expertsData: Array<{ day: number; value: number }>,
  rookiesData: Array<{ day: number; value: number }>,
  totalDays: number
): BottleneckMetrics {
  // Calculate ARCP capacity for each day
  const capacityData = expertsData.map((expertDay, idx) => {
    const experts = expertDay.value;
    const rookies = rookiesData[idx]?.value || 0;
    const capacity = (experts * 3) + (rookies * 3 * 0.4);
    return { day: expertDay.day, value: capacity };
  });

  const avgCapacity = capacityData.reduce((sum, d) => sum + d.value, 0) / totalDays;
  const lowest = capacityData.reduce((min, d) => d.value < min.value ? d : min, capacityData[0]);

  const criticalThreshold = 10;
  const warningThreshold = 20;

  const daysBottlenecked = capacityData.filter(d => d.value < criticalThreshold).length;
  const percentageBottlenecked = (daysBottlenecked / totalDays) * 100;

  const severity: 'critical' | 'warning' | 'optimal' =
    avgCapacity < criticalThreshold ? 'critical' :
    avgCapacity < warningThreshold ? 'warning' : 'optimal';

  // Trend
  const firstThird = capacityData.slice(0, Math.floor(totalDays / 3));
  const lastThird = capacityData.slice(Math.floor(totalDays * 2 / 3));
  const firstAvg = firstThird.reduce((sum, d) => sum + d.value, 0) / firstThird.length;
  const lastAvg = lastThird.reduce((sum, d) => sum + d.value, 0) / lastThird.length;
  const trendDiff = lastAvg - firstAvg;

  const trend: 'increasing' | 'decreasing' | 'stable' =
    trendDiff > 5 ? 'increasing' :
    trendDiff < -5 ? 'decreasing' : 'stable';

  // Calculate flow rate (units per day change)
  const daysInPeriod = lastThird.length;
  const flowRate = daysInPeriod > 0 ? trendDiff / daysInPeriod : 0;

  const utilizationRate = Math.min(100, (avgCapacity / 30) * 100);

  return {
    station: stationName,
    severity,
    averageWIP: avgCapacity,
    peakWIP: lowest.value,
    peakDay: lowest.day,
    percentageBottlenecked,
    daysBottlenecked,
    totalDays,
    trend,
    utilizationRate,
    flowRate,
    remedyHint: generateRemedyHint(stationName, severity),
  };
}

/**
 * Generate problem descriptions and recommendations
 */
function generateProblems(metrics: BottleneckMetrics[]): BottleneckProblem[] {
  const problems: BottleneckProblem[] = [];

  metrics.forEach((metric, index) => {
    if (metric.severity === 'optimal') return;

    const problem: BottleneckProblem = {
      id: `bottleneck_${index}`,
      station: metric.station,
      severity: metric.severity,
      title: '',
      description: '',
      rootCause: '',
      impact: '',
      recommendation: '',
      metrics: {
        peakWIP: metric.peakWIP,
        utilizationRate: metric.utilizationRate,
      },
    };

    // Station-specific analysis
    if (metric.station === 'Standard Line') {
      problem.title = metric.severity === 'critical'
        ? '🚨 Critical Standard Line Bottleneck'
        : '⚠️ Standard Line Congestion';
      problem.description = `Standard Line WIP averaging ${metric.averageWIP.toFixed(0)} units (${metric.percentageBottlenecked.toFixed(1)}% of days bottlenecked)`;
      problem.rootCause = 'High WIP indicates production cannot keep up with demand or batching delays are excessive';
      problem.impact = `${metric.daysBottlenecked} days with delayed production, potential customer dissatisfaction`;
      problem.recommendation = 'Increase batch size, reduce batching delays, or add PUC capacity';

    } else if (metric.station === 'Custom Line') {
      problem.title = metric.severity === 'critical'
        ? '🚨 Critical Custom Line Bottleneck'
        : '⚠️ Custom Line Congestion';
      problem.description = `Custom Line WIP averaging ${metric.averageWIP.toFixed(0)} orders (${metric.percentageBottlenecked.toFixed(1)}% of days bottlenecked)`;
      problem.rootCause = 'High WIP suggests MCE or WMA capacity insufficient for custom order volume';
      problem.impact = `Late deliveries incurring penalties, ${metric.daysBottlenecked} days affected`;
      problem.recommendation = 'Increase MCE allocation to Custom Line, add WMA machines, or hire more workers';

    } else if (metric.station === 'Raw Materials') {
      problem.title = metric.severity === 'critical'
        ? '🚨 Critical Material Shortage'
        : '⚠️ Low Raw Material Inventory';
      problem.description = `Raw materials averaging ${metric.averageWIP.toFixed(0)} parts (${metric.percentageBottlenecked.toFixed(1)}% of days below threshold)`;
      problem.rootCause = 'Reorder point too low, order quantity insufficient, or demand spike unpredicted';
      problem.impact = `${metric.daysBottlenecked} days with production constraints, potential stockouts`;
      problem.recommendation = 'Increase reorder point and order quantity, reduce lead time risk';

    } else if (metric.station === 'ARCP Workforce') {
      problem.title = metric.severity === 'critical'
        ? '🚨 Critical Workforce Shortage'
        : '⚠️ Insufficient ARCP Capacity';
      problem.description = `ARCP capacity averaging ${metric.averageWIP.toFixed(1)} units/day (${metric.percentageBottlenecked.toFixed(1)}% of days below threshold)`;
      problem.rootCause = 'Insufficient experts and rookies to handle ARCP workload';
      problem.impact = `${metric.daysBottlenecked} days with ARCP bottleneck limiting production`;
      problem.recommendation = 'Hire more rookies, reduce employee turnover, optimize training efficiency';
    }

    // Add trend warning
    if (metric.trend === 'increasing') {
      problem.impact += ` | TREND: Worsening over time`;
    }

    problems.push(problem);
  });

  return problems;
}
