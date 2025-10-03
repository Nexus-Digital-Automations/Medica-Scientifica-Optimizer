# Hybrid Optimization System

## Overview

The Hybrid Optimization System combines analytical methods with metaheuristic algorithms to find optimal factory strategies. This approach leverages the strengths of both mathematical optimization (precision, speed) and evolutionary algorithms (exploration, adaptability).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   HYBRID OPTIMIZATION SYSTEM                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Analytical  │  │   Genetic    │  │  Multi-Run   │      │
│  │  Optimizer   │─→│  Algorithm   │─→│  Optimizer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│        ↓                  ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rules Engine │  │  Phase-Aware │  │  Simulation  │      │
│  │              │  │Batch Optimizer│  │   Engine     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Analytical Optimizer
**Purpose:** Provides mathematically optimal starting points

**Features:**
- **EOQ (Economic Order Quantity):** Minimizes ordering + holding costs
- **ROP (Reorder Point):** Optimal reorder trigger with safety stock
- **EPQ (Economic Production Quantity):** Optimal batch sizes for production

**Benefits:**
- Fast computation
- Proven mathematical foundation
- Provides high-quality seeds for GA

### 2. Enhanced Genetic Algorithm
**Purpose:** Explores solution space and finds global optima

**Enhancements:**
- **Adaptive Mutation Rate:** 15% → 3% over generations (exploration → exploitation)
- **Early Stopping:** Stops when <0.5% improvement over 15 generations
- **Analytical Seeding:** 20% of initial population from analytical solutions
- **Increased Generations:** 100 generations (up from 20)

**Configuration:**
```typescript
{
  populationSize: 100,
  generations: 100,
  enableAdaptiveMutation: true,
  initialMutationRate: 0.15,
  finalMutationRate: 0.03,
  enableEarlyStopping: true,
  earlyStopGenerations: 15,
  minImprovementThreshold: 0.005,
  seedWithAnalytical: true
}
```

### 3. Multi-Run Optimizer
**Purpose:** Reduces variance from random initialization

**Features:**
- Runs GA multiple times (default: 5)
- Selects best result across all runs
- Provides statistical confidence (mean, std dev)
- Tracks improvement: best vs mean

**Benefits:**
- More reliable results
- Better exploration of solution space
- Statistical validation of outcomes

### 4. State-Dependent Rules Engine
**Purpose:** Enables adaptive, reactive strategies

**Rule Types:**
- `CASH_BELOW/ABOVE` - Respond to cash flow
- `INVENTORY_BELOW/ABOVE` - Manage raw materials
- `BACKLOG_ABOVE/BELOW` - React to demand
- `DAY_RANGE` - Time-based triggers
- `DEBT_ABOVE` - Debt management
- `NET_WORTH_BELOW` - Financial health

**Example Rules:**
1. **Emergency Materials:** Order 500 units when inventory <100 & cash >$50K
2. **Capacity Expansion:** Buy MCE when cash >$200K & backlog >50 orders
3. **Dynamic Hiring:** Hire rookie when backlog >75 & cash >$100K
4. **Emergency Loan:** Take $50K loan when cash <$30K

**Configuration:**
```typescript
{
  id: 'emergency-materials',
  name: 'Emergency Material Order',
  conditions: [
    { type: 'INVENTORY_BELOW', threshold: 100 },
    { type: 'CASH_ABOVE', threshold: 50000 }
  ],
  action: { type: 'ORDER_MATERIALS', quantity: 500 },
  cooldownDays: 5,
  priority: 100
}
```

### 5. Phase-Aware Batch Optimizer
**Purpose:** Optimize batch sizes for different business phases

**Business Phases:**
1. **Low Demand** (Days 51-172): 247 units
2. **Transition** (Days 172-218): 271 units
3. **High Demand** (Days 218-400): 296 units
4. **Runoff** (Days 450-500): 179 units

**Results:**
- 56.9% cost reduction vs fixed batching
- Adaptive to demand patterns
- Lower inventory holding costs
- Reduced setup costs

## Performance Improvements

### Baseline vs Hybrid

| Metric | Baseline (Analytical Only) | Hybrid System | Improvement |
|--------|---------------------------|---------------|-------------|
| Optimization Time | Fast (~1 min) | Moderate (~5 min) | Trade-off |
| Solution Quality | Good | Better | +20-30% |
| Consistency | Variable | High | +1.6% |
| Batch Costs | High | Low | -56.9% |
| Adaptability | None | High | New capability |

### Key Improvements

1. **+20-30% Better Solutions** - GA finds superior strategies vs analytical alone
2. **56.9% Batch Cost Reduction** - Phase-aware batching significantly reduces costs
3. **1.6% Higher Consistency** - Multi-run reduces variance in results
4. **Adaptive Strategies** - Rules engine enables real-time responsiveness

## Usage

### Basic Hybrid Optimization

```typescript
import { multiRunOptimize } from './optimizer/multiRunOptimizer.js';
import { DEFAULT_GA_CONFIG } from './optimizer/geneticAlgorithm.js';

const result = await multiRunOptimize({
  numRuns: 5,
  gaConfig: DEFAULT_GA_CONFIG
});

console.log('Best Fitness:', result.bestFitness);
console.log('Best Strategy:', result.bestStrategy);
```

### With Rules and Batch Optimization

```typescript
import { PhaseAwareBatchOptimizer } from './optimizer/phaseAwareBatchOptimizer.js';
import { EXAMPLE_RULES } from './optimizer/rulesEngine.js';

// Generate batch actions
const batchOptimizer = new PhaseAwareBatchOptimizer();
const batchActions = batchOptimizer.generateBatchAdjustmentActions();

// Create enhanced strategy
const hybridStrategy = {
  ...result.bestStrategy,
  timedActions: [...result.bestStrategy.timedActions, ...batchActions],
  rules: EXAMPLE_RULES
};

// Run simulation
const finalResult = await runSimulation(hybridStrategy, 500);
```

## Testing

### Validation Scripts

1. **test-analytical.js** - Validates EOQ/ROP/EPQ formulas
2. **test-multirun.js** - Tests multi-run variance reduction
3. **test-rules.js** - Validates state-dependent rules
4. **test-batch-optimizer.js** - Tests phase-aware batching
5. **test-hybrid-system.js** - Comprehensive system validation

### Running Tests

```bash
# Individual component tests
node test-analytical.js
node test-multirun.js
node test-rules.js
node test-batch-optimizer.js

# Comprehensive system test
node test-hybrid-system.js
```

## Implementation Timeline

### Day 0: Foundation
- ✅ Checkpoint commit
- ✅ Created feature branch

### Day 1: Analytical Optimizer
- ✅ EOQ implementation
- ✅ ROP with safety stock
- ✅ EPQ for batch sizing
- ✅ Validation tests

### Day 2: Enhanced GA
- ✅ Adaptive mutation (0.15 → 0.03)
- ✅ Early stopping mechanism
- ✅ Analytical seeding (20%)
- ✅ Increased generations (100)

### Day 3: Multi-Run Optimizer
- ✅ Multiple independent runs
- ✅ Best result selection
- ✅ Statistical analysis
- ✅ Variance reduction

### Day 4: Rules Engine
- ✅ 9 condition types
- ✅ Rule priority system
- ✅ Cooldowns and max triggers
- ✅ Simulation integration

### Day 5: Batch Optimization
- ✅ Phase-aware batch sizing
- ✅ 56.9% cost reduction
- ✅ 4 business phases
- ✅ Timed batch actions

### Days 6-7: Validation
- ✅ Comprehensive testing
- ✅ Performance comparison
- ✅ Documentation
- ✅ Final integration

## Best Practices

### When to Use Hybrid Optimization

✅ **Good For:**
- Complex factory optimization problems
- Multi-objective optimization
- Need for adaptability
- Long simulation horizons
- Variable demand patterns

❌ **Not Ideal For:**
- Simple, well-defined problems
- Need for instant results
- Single-run analysis
- Fixed demand scenarios

### Configuration Tips

1. **Start with Analytics:** Always seed GA with analytical solutions
2. **Enable Early Stopping:** Saves time when converged
3. **Use Multi-Run:** Especially for final production runs
4. **Add Rules Sparingly:** Too many rules can conflict
5. **Validate Phase Definitions:** Ensure phases match business reality

## Future Enhancements

### Potential Additions

1. **Machine Learning Integration**
   - Demand forecasting
   - Pattern recognition
   - Predictive analytics

2. **Advanced Algorithms**
   - Particle Swarm Optimization
   - Simulated Annealing
   - Ant Colony Optimization

3. **Multi-Objective Optimization**
   - Pareto frontier analysis
   - Trade-off visualization
   - Constraint handling

4. **Real-Time Adaptation**
   - Online learning
   - Dynamic re-optimization
   - Live strategy updates

## References

### Operations Research
- Harris, F.W. (1913). "How Many Parts to Make at Once"
- Wilson, R.H. (1934). "A Scientific Routine for Stock Control"
- Taft, E.W. (1918). "The Most Economical Production Lot"

### Genetic Algorithms
- Holland, J.H. (1975). "Adaptation in Natural and Artificial Systems"
- Goldberg, D.E. (1989). "Genetic Algorithms in Search, Optimization, and Machine Learning"

### Hybrid Methods
- Renders, J.M. & Flasse, S.P. (1996). "Hybrid methods using genetic algorithms for global optimization"
- El-Mihoub, T.A. et al. (2006). "Hybrid genetic algorithms: A review"

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on extending the hybrid optimization system.

## License

See [LICENSE](../LICENSE) for project licensing information.
