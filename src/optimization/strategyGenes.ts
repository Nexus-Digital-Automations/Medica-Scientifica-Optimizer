/**
 * Strategy Genes: High-level parameters for Hybrid GA optimization
 *
 * These 8 parameters tune the analytical models (EOQ, Newsvendor, DP, Pricing)
 * to find optimal balance between inventory, capacity, workforce, and pricing.
 *
 * GA optimizes these genes → Analytical models expand to full strategy
 */

export interface StrategyGenes {
  // 1. INVENTORY POLICY TUNING
  safetyStockMultiplier: number;      // 0.8-1.5
  // How conservative with safety stock?
  // 0.8 = aggressive (less inventory, more risk)
  // 1.5 = conservative (more inventory, less risk)

  // 2. CAPACITY PLANNING TUNING
  targetCapacityMultiplier: number;   // 1.0-1.5
  // How much buffer capacity beyond expected demand?
  // 1.0 = just enough capacity for expected demand
  // 1.5 = 50% buffer for demand spikes

  // 3. WORKFORCE PLANNING TUNING
  workforceAggressiveness: number;    // 0.8-1.2
  // How aggressively to hire ahead of demand?
  // 0.8 = conservative hiring (risk of understaffing)
  // 1.2 = aggressive hiring (risk of overstaffing)

  // 4. PRICING STRATEGY TUNING
  priceAggressiveness: number;        // 0.9-1.1
  // Multiplier on analytically-optimal price
  // 0.9 = 10% below optimal (capture market share)
  // 1.1 = 10% above optimal (maximize margin)

  customPriceMultiplier: number;      // 0.95-1.05
  // Adjustment for custom product pricing

  // 5. PRODUCTION MIX TUNING
  mceAllocationCustom: number;        // 0.3-0.7
  // What % of MCE capacity to allocate to custom orders?
  // 0.3 = focus on standard (70% standard, 30% custom)
  // 0.7 = focus on custom (30% standard, 70% custom)

  // 6. DEBT MANAGEMENT TUNING
  debtPaydownAggressiveness: number;  // 0.5-1.0
  // What % of excess cash to use for debt paydown?
  // 0.5 = keep more cash (safety)
  // 1.0 = pay down debt aggressively (save interest)

  minCashReserveDays: number;         // 5-15 days
  // How many days of operating expenses to keep as cash reserve?
  // 5 = lean cash management
  // 15 = conservative cash management
}

/**
 * Default genes (middle of range)
 */
export const DEFAULT_GENES: StrategyGenes = {
  safetyStockMultiplier: 1.2,
  targetCapacityMultiplier: 1.2,
  workforceAggressiveness: 1.0,
  priceAggressiveness: 1.0,
  customPriceMultiplier: 1.0,
  mceAllocationCustom: 0.5,
  debtPaydownAggressiveness: 0.8,
  minCashReserveDays: 7
};

/**
 * Gene ranges for validation
 */
export const GENE_RANGES: Record<keyof StrategyGenes, [number, number]> = {
  safetyStockMultiplier: [0.8, 1.5],
  targetCapacityMultiplier: [1.0, 1.5],
  workforceAggressiveness: [0.8, 1.2],
  priceAggressiveness: [0.9, 1.1],
  customPriceMultiplier: [0.95, 1.05],
  mceAllocationCustom: [0.3, 0.7],
  debtPaydownAggressiveness: [0.5, 1.0],
  minCashReserveDays: [5, 15]
};

/**
 * Generate random genes within valid ranges
 */
export function randomizeGenes(): StrategyGenes {
  const genes = {} as Record<string, number>;

  for (const [key, [min, max]] of Object.entries(GENE_RANGES)) {
    if (key === 'minCashReserveDays') {
      // Integer parameter
      genes[key] = Math.floor(min + Math.random() * (max - min + 1));
    } else {
      // Float parameter
      genes[key] = min + Math.random() * (max - min);
    }
  }

  return genes as unknown as StrategyGenes;
}

/**
 * Mutate genes with given mutation rate
 */
export function mutateGenes(genes: StrategyGenes, rate: number): StrategyGenes {
  const mutated = { ...genes } as Record<string, number>;

  for (const [key, [min, max]] of Object.entries(GENE_RANGES)) {
    if (Math.random() < rate) {
      const value = mutated[key];

      if (key === 'minCashReserveDays') {
        // Integer mutation: ±1-3 days
        const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
        mutated[key] = Math.max(min, Math.min(max, value + change));
      } else {
        // Float mutation: ±10% of current value
        const change = value * 0.1 * (Math.random() * 2 - 1);
        mutated[key] = Math.max(min, Math.min(max, value + change));
      }
    }
  }

  return mutated as unknown as StrategyGenes;
}

/**
 * Crossover: Combine two parent genes
 */
export function crossoverGenes(parent1: StrategyGenes, parent2: StrategyGenes): StrategyGenes {
  const child = {} as Record<string, number>;

  for (const key of Object.keys(parent1)) {
    // Uniform crossover: 50% chance from each parent
    const p1 = parent1 as unknown as Record<string, number>;
    const p2 = parent2 as unknown as Record<string, number>;
    child[key] = Math.random() < 0.5 ? p1[key] : p2[key];
  }

  return child as unknown as StrategyGenes;
}

/**
 * Validate genes are within valid ranges
 */
export function validateGenes(genes: StrategyGenes): boolean {
  for (const [key, [min, max]] of Object.entries(GENE_RANGES)) {
    const k = key as keyof StrategyGenes;
    const value = genes[k];

    if (value < min || value > max) {
      return false;
    }
  }

  return true;
}

/**
 * Clamp genes to valid ranges
 */
export function clampGenes(genes: StrategyGenes): StrategyGenes {
  const clamped = {} as Record<string, number>;
  const genesRecord = genes as unknown as Record<string, number>;

  for (const [key, [min, max]] of Object.entries(GENE_RANGES)) {
    clamped[key] = Math.max(min, Math.min(max, genesRecord[key]));
  }

  return clamped as unknown as StrategyGenes;
}

/**
 * Calculate diversity score for population
 * Higher = more diverse (good for exploration)
 */
export function calculateDiversity(population: StrategyGenes[]): number {
  if (population.length < 2) return 0;

  let totalDistance = 0;
  let comparisons = 0;

  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      totalDistance += euclideanDistance(population[i], population[j]);
      comparisons++;
    }
  }

  return totalDistance / comparisons;
}

/**
 * Calculate Euclidean distance between two gene sets
 */
function euclideanDistance(genes1: StrategyGenes, genes2: StrategyGenes): number {
  let sumSquares = 0;

  for (const key of Object.keys(genes1) as Array<keyof StrategyGenes>) {
    // Normalize to [0,1] range
    const [min, max] = GENE_RANGES[key];
    const norm1 = (genes1[key] - min) / (max - min);
    const norm2 = (genes2[key] - min) / (max - min);

    sumSquares += Math.pow(norm1 - norm2, 2);
  }

  return Math.sqrt(sumSquares);
}
