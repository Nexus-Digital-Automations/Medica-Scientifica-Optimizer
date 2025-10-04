import type { Strategy } from '../../simulation/types';

/**
 * Context-aware formula calculations for policy decisions
 * Calculates optimal values based on strategy state at a specific day
 */

export interface FormulaResult {
  value: number;
  variables: { symbol: string; description: string; value: number }[];
  explanation: string;
}

/**
 * Calculate Economic Order Quantity (EOQ)
 * Optimal quantity of raw materials to order per purchase
 */
export function calculateEOQ(params: {
  annualDemand: number;
  orderingCost: number;
  holdingCostPerUnit: number;
}): FormulaResult {
  const { annualDemand, orderingCost, holdingCostPerUnit } = params;

  const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);

  return {
    value: eoq,
    variables: [
      { symbol: 'D', description: 'Annual demand', value: annualDemand },
      { symbol: 'S', description: 'Ordering cost per order', value: orderingCost },
      { symbol: 'H', description: 'Holding cost per unit per year', value: holdingCostPerUnit }
    ],
    explanation: 'This is the optimal order quantity that minimizes total inventory costs (ordering + holding).'
  };
}

/**
 * Calculate Economic Production Quantity (EPQ)
 * Optimal batch size for production runs
 */
export function calculateEPQ(params: {
  annualDemand: number;
  setupCost: number;
  holdingCostPerUnit: number;
  dailyDemandRate: number;
  dailyProductionRate: number;
}): FormulaResult {
  const { annualDemand, setupCost, holdingCostPerUnit, dailyDemandRate, dailyProductionRate } = params;

  const ratio = 1 - (dailyDemandRate / dailyProductionRate);
  const epq = Math.sqrt((2 * annualDemand * setupCost) / (holdingCostPerUnit * ratio));

  return {
    value: epq,
    variables: [
      { symbol: 'D', description: 'Annual demand', value: annualDemand },
      { symbol: 'S', description: 'Setup cost per batch', value: setupCost },
      { symbol: 'H', description: 'Holding cost per unit per year', value: holdingCostPerUnit },
      { symbol: 'd', description: 'Daily demand rate', value: dailyDemandRate },
      { symbol: 'p', description: 'Daily production rate', value: dailyProductionRate }
    ],
    explanation: 'This is the optimal production batch size that balances setup costs against holding costs.'
  };
}

/**
 * Calculate Reorder Point (ROP) with Safety Stock
 * When to place a new order to avoid stockouts
 */
export function calculateROP(params: {
  averageDailyDemand: number;
  leadTimeDays: number;
  demandStdDev: number;
  serviceLevel: number; // e.g., 0.95 for 95%
}): FormulaResult {
  const { averageDailyDemand, leadTimeDays, demandStdDev, serviceLevel } = params;

  // Z-score lookup (approximate)
  const zScores: { [key: number]: number } = {
    0.90: 1.28,
    0.95: 1.65,
    0.99: 2.33
  };
  const zScore = zScores[serviceLevel] || 1.65;

  const safetyStock = zScore * demandStdDev * Math.sqrt(leadTimeDays);
  const rop = (averageDailyDemand * leadTimeDays) + safetyStock;

  return {
    value: rop,
    variables: [
      { symbol: 'd', description: 'Average daily demand', value: averageDailyDemand },
      { symbol: 'L', description: 'Lead time (days)', value: leadTimeDays },
      { symbol: 'Z', description: `Z-score for ${serviceLevel * 100}% service level`, value: zScore },
      { symbol: 'σd', description: 'Demand std deviation', value: demandStdDev }
    ],
    explanation: `Order when inventory drops to this level to maintain ${serviceLevel * 100}% service level during the ${leadTimeDays}-day lead time.`
  };
}

/**
 * Calculate Optimal Price using Price Elasticity
 * Find profit-maximizing price point
 */
export function calculateOptimalPrice(params: {
  demandIntercept: number; // 'a' in Demand = a + b*Price
  priceSlope: number; // 'b' (negative value for downward sloping demand)
  unitCost: number;
}): FormulaResult {
  const { demandIntercept, priceSlope, unitCost } = params;

  // For linear demand curve Q = a + b×P (where b < 0):
  // Optimal Price for profit max = (b×c - a) / (2b)
  // which simplifies to (a - b×c) / (-2b)
  const optimalPrice = (priceSlope * unitCost - demandIntercept) / (2 * priceSlope);
  const optimalQuantity = demandIntercept + priceSlope * optimalPrice;
  const revenue = optimalPrice * optimalQuantity;
  const profit = revenue - (unitCost * optimalQuantity);

  return {
    value: optimalPrice,
    variables: [
      { symbol: 'a', description: 'Demand intercept', value: demandIntercept },
      { symbol: 'b', description: 'Price slope', value: priceSlope },
      { symbol: 'c', description: 'Unit cost', value: unitCost },
      { symbol: 'Q*', description: 'Optimal quantity', value: Math.round(optimalQuantity) },
      { symbol: 'R*', description: 'Revenue at P*', value: Math.round(revenue) },
      { symbol: 'π*', description: 'Maximum profit', value: Math.round(profit) }
    ],
    explanation: 'This price maximizes total profit given the linear demand curve: Q = a + b×P and unit cost c'
  };
}

/**
 * Calculate Queuing Theory Metrics (M/M/s model)
 * Optimal workforce sizing for ARCP station
 */
export function calculateQueueMetrics(params: {
  arrivalRate: number; // λ - units arriving per day
  serviceRate: number; // μ - units one worker processes per day
  numServers: number; // s - number of workers
}): FormulaResult {
  const { arrivalRate, serviceRate, numServers } = params;

  const utilization = arrivalRate / (numServers * serviceRate);

  // Simplified calculation (assumes utilization < 1)
  const avgWaitTime = utilization > 0.95
    ? 999 // Very high wait time when near capacity
    : (utilization / (numServers * serviceRate * (1 - utilization)));

  const avgQueueLength = arrivalRate * avgWaitTime;

  return {
    value: avgWaitTime,
    variables: [
      { symbol: 'λ', description: 'Arrival rate (units/day)', value: arrivalRate },
      { symbol: 'μ', description: 'Service rate per worker (units/day)', value: serviceRate },
      { symbol: 's', description: 'Number of workers', value: numServers },
      { symbol: 'ρ', description: 'System utilization', value: utilization },
      { symbol: 'Lq', description: 'Avg queue length (units)', value: avgQueueLength }
    ],
    explanation: `Average wait time in queue. Utilization: ${(utilization * 100).toFixed(1)}%. Consider hiring if wait time exceeds production targets.`
  };
}

/**
 * Calculate Net Present Value (NPV)
 * Evaluate capital investment decisions
 */
export function calculateNPV(params: {
  initialInvestment: number;
  dailyCashFlow: number;
  daysRemaining: number;
  dailyDiscountRate: number; // e.g., 0.001 for 0.1% daily
}): FormulaResult {
  const { initialInvestment, dailyCashFlow, daysRemaining, dailyDiscountRate } = params;

  let npv = -initialInvestment;
  for (let t = 1; t <= daysRemaining; t++) {
    npv += dailyCashFlow / Math.pow(1 + dailyDiscountRate, t);
  }

  const breakEvenDays = dailyCashFlow > 0
    ? Math.log(1 - (initialInvestment * dailyDiscountRate) / dailyCashFlow) / Math.log(1 + dailyDiscountRate) * -1
    : 999;

  return {
    value: npv,
    variables: [
      { symbol: 'C₀', description: 'Initial investment', value: initialInvestment },
      { symbol: 'CF', description: 'Daily cash flow increase', value: dailyCashFlow },
      { symbol: 'n', description: 'Days remaining', value: daysRemaining },
      { symbol: 'r', description: 'Daily discount rate', value: dailyDiscountRate },
      { symbol: 't*', description: 'Break-even days', value: Math.round(breakEvenDays) }
    ],
    explanation: npv > 0
      ? `Positive NPV: Investment will generate $${npv.toFixed(2)} in present value. Break-even in ~${Math.round(breakEvenDays)} days.`
      : `Negative NPV: Investment will lose $${Math.abs(npv).toFixed(2)} in present value. Not recommended.`
  };
}

/**
 * Calculate Price Elasticity of Demand
 * Measure demand sensitivity to price changes
 */
export function calculatePriceElasticity(params: {
  currentPrice: number;
  currentQuantity: number;
  priceSlope: number; // from linear demand curve
}): FormulaResult {
  const { currentPrice, currentQuantity, priceSlope } = params;

  // For linear demand: Elasticity = (dQ/dP) * (P/Q)
  const elasticity = priceSlope * (currentPrice / currentQuantity);

  const interpretation = Math.abs(elasticity) > 1
    ? 'Elastic: Demand is sensitive to price changes'
    : Math.abs(elasticity) < 1
    ? 'Inelastic: Demand is relatively insensitive to price'
    : 'Unit elastic: Proportional response';

  return {
    value: elasticity,
    variables: [
      { symbol: 'P', description: 'Current price', value: currentPrice },
      { symbol: 'Q', description: 'Current quantity', value: currentQuantity },
      { symbol: 'dQ/dP', description: 'Demand slope', value: priceSlope },
      { symbol: '|Ed|', description: 'Absolute elasticity', value: Math.abs(elasticity) }
    ],
    explanation: `${interpretation}. ${Math.abs(elasticity).toFixed(2)} unit decrease in quantity per 1% price increase.`
  };
}

/**
 * Get formula calculations based on strategy state at a specific day
 * Uses data-driven inputs from historical analysis (Days 0-49):
 * - Daily parts usage: 35.5 parts/day (23.5 for Standard × 2 parts, 12 for Custom × 1 part)
 * - Annual parts demand: 12,965 parts/year
 * - Parts demand std dev: 3.4 parts/day
 * - Historical order pattern: 200 parts every 5 days
 * - Lead time: 4 days
 * - Stockout rate: 26% in historical period (13/50 days)
 */
export function getFormulaForAction(
  actionType: string,
  strategy: Strategy,
  day: number
): { formula: string; result: FormulaResult | null; title: string } | null {

  // Constants from business case
  const MATERIAL_COST = 50;
  const ORDER_FEE = 1000;
  const LEAD_TIME = 4;
  const STANDARD_ORDER_FEE = 100;
  const ANNUAL_INTEREST = 0.365;
  const DAILY_INTEREST = ANNUAL_INTEREST / 365;

  // Data-driven estimates from historical analysis (Days 0-49)
  const HISTORICAL_DAILY_PARTS_USAGE = 35.5; // Actual observed usage
  const HISTORICAL_ANNUAL_PARTS_DEMAND = 12965; // 35.5 × 365
  const HISTORICAL_PARTS_STD_DEV = 3.4; // Low variability observed
  const DAYS_REMAINING = 500 - day;

  // Standard line production estimates
  const STANDARD_DAILY_ORDERS = 12; // units/day from historical data
  const STANDARD_ANNUAL_DEMAND = STANDARD_DAILY_ORDERS * 365; // 4,380 units/year

  // Current production capacity (depends on workers and bottlenecks)
  const CURRENT_STANDARD_DELIVERY_RATE = 3.12; // Historical avg from data (severe bottleneck!)
  const POTENTIAL_STANDARD_PRODUCTION = 12; // If bottlenecks resolved

  switch (actionType) {
    case 'SET_ORDER_QUANTITY':
      return {
        title: 'Economic Order Quantity (EOQ)',
        formula: 'Q* = √(2DS/H)',
        result: calculateEOQ({
          annualDemand: HISTORICAL_ANNUAL_PARTS_DEMAND, // Data-driven: 12,965 parts/year
          orderingCost: ORDER_FEE, // $1,000 per order
          holdingCostPerUnit: MATERIAL_COST * 0.2 // 20% holding cost = $10/part/year
        })
      };

    case 'SET_REORDER_POINT':
      return {
        title: 'Reorder Point with Safety Stock',
        formula: 'ROP = (d × L) + Z × σd × √L',
        result: calculateROP({
          averageDailyDemand: HISTORICAL_DAILY_PARTS_USAGE, // Data-driven: 35.5 parts/day
          leadTimeDays: LEAD_TIME, // 4 days from business case
          demandStdDev: HISTORICAL_PARTS_STD_DEV, // Data-driven: 3.4 parts/day
          serviceLevel: 0.95 // Target 95% service level (avoid 26% stockout rate)
        })
      };

    case 'ADJUST_BATCH_SIZE':
      // Calculate based on days remaining - optimize differently for short vs long horizon
      const dailyDemandRate = CURRENT_STANDARD_DELIVERY_RATE; // Current constrained rate
      const productionRate = POTENTIAL_STANDARD_PRODUCTION; // Potential if unconstrained

      return {
        title: 'Economic Production Quantity (EPQ)',
        formula: 'Qp* = √(2DS/H(1-d/p))',
        result: calculateEPQ({
          annualDemand: STANDARD_ANNUAL_DEMAND, // Data-driven: 4,380 units/year
          setupCost: STANDARD_ORDER_FEE, // $100 per batch setup
          holdingCostPerUnit: strategy.standardPrice * 0.2, // 20% of product value
          dailyDemandRate: dailyDemandRate, // Current delivery rate: 3.12 units/day
          dailyProductionRate: productionRate // Potential production: 12 units/day
        })
      };

    case 'ADJUST_PRICE':
      // Calculate true unit cost from business case
      const rawMaterialCost = 100; // 2 parts × $50/part
      const laborCost = 50; // Estimated from workforce costs
      const overheadCost = 50; // Machine time, batching, etc.
      const totalUnitCost = rawMaterialCost + laborCost + overheadCost;

      return {
        title: 'Optimal Price (Profit Maximization)',
        formula: 'P* = (bc - a) / (2b)',
        result: calculateOptimalPrice({
          demandIntercept: strategy.standardDemandIntercept, // From strategy
          priceSlope: strategy.standardDemandSlope, // From strategy (negative)
          unitCost: totalUnitCost // $200 total unit cost
        })
      };

    case 'HIRE_ROOKIE':
      // Calculate based on actual ARCP queue size from custom line
      // Historical data shows 12 custom units/day, each needs ARCP processing
      const customUnitsPerDay = 12; // From historical data
      const expertProductivity = 3; // units/day per expert
      const estimatedCurrentExperts = 2; // Starting workforce

      return {
        title: 'Queuing Theory (M/M/s) - Wait Time',
        formula: 'Wq = ρ / (sμ(1-ρ))',
        result: calculateQueueMetrics({
          arrivalRate: customUnitsPerDay, // 12 custom units/day need ARCP
          serviceRate: expertProductivity, // 3 units/day per expert
          numServers: estimatedCurrentExperts // Current expert count
        })
      };

    case 'BUY_MACHINE': {
      // Calculate NPV based on days remaining and realistic cash flow impact
      // Machine costs: MCE=$20k, WMA=$25k, PUC=$15k (all increase capacity by 12 units/day)

      // Estimate daily cash flow from increased capacity
      const unitMargin = strategy.standardPrice - 200; // Revenue - cost per unit
      const estimatedDailyCashFlow = unitMargin * 3; // Conservative: 3 extra units/day

      return {
        title: 'Net Present Value (NPV)',
        formula: 'NPV = Σ[CFt / (1+r)^t] - C₀',
        result: calculateNPV({
          initialInvestment: 20000, // MCE machine cost (default)
          dailyCashFlow: estimatedDailyCashFlow, // Based on unit margin
          daysRemaining: DAYS_REMAINING,
          dailyDiscountRate: DAILY_INTEREST // 0.1% daily (36.5% annual)
        })
      };
    }

    default:
      return null;
  }
}
