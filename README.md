# 🏭 Medica Scientifica Factory Optimizer

A sophisticated genetic algorithm-based optimizer for the Medica Scientifica factory business case. This application simulates a complex manufacturing environment and automatically discovers the optimal production strategy to maximize cash on hand.

## 🌟 Features

### Complete Transparency
- **ALL variables tracked day-by-day** - Financial, production, inventory, workforce, and machine metrics
- **Full forecast visualization** - See exactly how your factory evolves over time
- **Action timeline** - Clear prescriptive guidance on what to do and when
- **Maximum confidence** - No doubt about why the optimal strategy was chosen

### Sophisticated Simulation Engine
- Multi-stage production lines (Standard 3-station + Custom line)
- Workforce management (Rookies, training, promotions)
- Financial modeling (Loans, debt, interest, cash management)
- Inventory management with reorder points
- Dynamic pricing based on delivery performance
- Configurable demand modeling with phase-based distributions
- Resource allocation and bottleneck optimization

### Genetic Algorithm Optimizer
- Population-based evolution finds global optimum
- Configurable population size, generations, mutation rates
- Elitism preserves best solutions
- Crossover and mutation for exploration
- Convergence tracking

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run

```bash
npm run dev
```

Then open your browser to http://localhost:3000

## 📊 How It Works

### The Simulation Core

The simulation models a complete factory with:

1. **Station 1 (MCE)**: Shared bottleneck processing raw materials
2. **Station 2 (WMA)**: 4-day batching for standard line
3. **Station 3 (PUC)**: 1-day final batching for standard line
4. **Custom Line**: MCE → ARCP → Ship (continuous flow)
5. **Finance**: Cash, debt, interest, loans, revenue
6. **Workforce**: Hiring, training (15 days), salary management
7. **Inventory**: Raw materials with lead times and reorder points

### The Genetic Algorithm

The optimizer works by:

1. **Generating** an initial population of random strategies
2. **Evaluating** each strategy by running the full simulation
3. **Selecting** the top performers (elites)
4. **Breeding** new strategies through crossover
5. **Mutating** strategies to explore new possibilities
6. **Repeating** for many generations until convergence

### Strategy DNA

Each strategy contains:

**Static Genes (Policies)**:
- Raw material reorder point and quantity
- MCE allocation between product lines
- Batch sizes and pricing
- Delivery time targets

**Timed Genes (Actions)**:
- Specific actions on specific days
- Examples: Take loan on Day 51, Hire rookie on Day 110, Buy machine on Day 192

## 📈 Results

The optimizer provides:

### Optimal Strategy
- Final cash on hand (fitness score)
- Complete policy recommendations
- Day-by-day action timeline

### Complete Daily Forecast

All variables tracked throughout simulation:

**Financial**: Cash, debt, net worth, revenue, expenses, interest
**Production**: Standard/custom production, WIP at each station
**Inventory**: Raw materials, pending orders, costs
**Workforce**: Experts, rookies, training status, salaries
**Machines**: Count of each machine type (MCE, WMA, PUC)
**Pricing**: Standard/custom prices, delivery times

## 🏗️ Project Structure

```
src/
├── simulation/
│   ├── types.ts              # Complete TypeScript type definitions
│   ├── constants.ts           # Game constants and initial conditions
│   ├── state.ts               # State management
│   ├── financeModule.ts       # Financial operations
│   ├── hrModule.ts            # Workforce management
│   ├── inventoryModule.ts     # Raw material management
│   ├── productionModule.ts    # Production line simulation
│   ├── pricingModule.ts       # Pricing and sales
│   ├── demandModule.ts        # Market demand modeling
│   └── simulationEngine.ts    # Main simulation orchestrator
├── optimizer/
│   └── geneticAlgorithm.ts    # Genetic algorithm optimizer
└── server.ts                   # HTTP server

public/
└── index.html                  # Web UI with complete transparency
```

## ⚙️ Configuration

### Genetic Algorithm Parameters

- **Population Size**: Number of strategies per generation (default: 100)
- **Generations**: Number of evolution cycles (default: 200)
- **Mutation Rate**: Probability of random changes (default: 0.05)
- **Elite Count**: Top strategies preserved each generation (default: 20)
- **Crossover Rate**: Probability of breeding (default: 0.7)

### Simulation Parameters

Defined in `src/simulation/constants.ts`:
- Simulation duration (Day 51 to Day 500)
- Financial rates (interest, commissions)
- Production capacities and times
- Machine costs
- Workforce productivity

### Market Demand Parameters

Configurable via the web UI:
- **Phase 1 (Days 51-172)**: Mean demand and standard deviation (defaults: 25, 5)
- **Phase 2 (Days 173-400)**: Mean demand and standard deviation (defaults: 32.5, 6.5)
- Uses normal distribution (Box-Muller transform) for realistic demand variation
- Treated as fixed market conditions (not optimized by genetic algorithm)

## 🎯 Use Cases

- **Business Strategy**: Find optimal operational strategies
- **What-if Analysis**: Test different scenarios and policies
- **Resource Planning**: Optimal timing for investments and hiring
- **Financial Modeling**: Cash flow optimization
- **Education**: Understanding complex system dynamics

## 🔬 Technical Details

### Built With
- **TypeScript** - Type-safe implementation
- **Node.js** - Runtime environment
- **Genetic Algorithms** - Optimization technique
- **Pure JavaScript/HTML/CSS** - No framework dependencies

### Performance
- Typical optimization: 30-60 seconds for 200 generations
- Simulation speed: ~10,000 days/second
- Memory efficient: JSON-based state management

## 📝 License

MIT

## 👤 Author

Built for the Medica Scientifica business case optimization challenge.

---

**🎉 Maximum Transparency. Zero Doubt. Optimal Strategy.**
