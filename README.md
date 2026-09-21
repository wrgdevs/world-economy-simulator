# World Economy Simulator

Deterministic multi-country economic simulation with bilateral trade routing, policy adjustments, supply shocks, and comparative scenario analysis.

## Features

- **Macroeconomic State**: Simulates national output (GDP), treasury reserves, debt, inflation, population migration, and satisfaction for each country across discrete time steps.
- **Bilateral Trade Network**: Models multi-commodity flows (food, energy, materials) with tariffs, transport losses, and bilateral partner prioritization.
- **Policy Controls**: Configurable fiscal policy (income taxes, public spending, production subsidies), trade tariffs, and sector labor distribution (agriculture, industry, services).
- **Automated Policy Tuning**: Optional policy autopilot rules that adjust tax and spending levers via proportional feedback to approach target debt ratios and satisfaction levels.
- **Seeded Events**: Deterministic pseudo-random economic shocks (crop failures, supply crunches, trade embargoes, commodity booms).
- **Scenario Comparison**: Side-by-side A/B simulation comparison to evaluate diverging policy regimes against identical seeds.
- **Persistence & Export**: Browser local storage persistence, JSON scenario import/export, and CSV export for external analysis.

## Model Overview

The simulation models an interconnected world economy over discrete time steps:

1. **Production & Labor**: Each economy allocates its labor force across three sectors: Agriculture (produces food), Industry (produces materials), and Services (produces energy/general output). Output scales with labor share, infrastructure investment, and capital stock.
2. **Consumption & Domestic Sufficiency**: Population consumes commodities based on subsistence requirements. Shortfalls reduce satisfaction and strain reserves.
3. **Bilateral Trade Network**: Economies with commodity deficits query partner nations in priority order. Trade volume is governed by exporter capacity, trade barriers, transport losses, and tariffs. Payments settle between national treasuries.
4. **Macro Adjustments**: Unmet needs, excess debt, and rapid monetary expansion induce inflation. Population migrates toward countries with higher satisfaction and lower tax burdens.
5. **Policy Autopilot**: An optional proportional error feedback controller can be enabled per country to adjust fiscal levers automatically when debt or satisfaction deviates from target thresholds.
6. **Deterministic Events**: An integer-seeded 32-bit xorshift PRNG generates stochastic shocks (such as trade embargoes or infrastructure disruptions) with repeatable outcomes for testing.

## Screenshots

### Trade Network & Sector Controls
![Trade Network](docs/eco2.png)

### Economic Trends & Policy Insights
![Economic Trends](docs/eco3.png)

### Scenario Comparison (A/B Evaluation)
![Scenario Comparison](docs/eco4.png)

### Global Overview
![Global Overview](docs/eco1.png)

## Tech Stack

- **TypeScript** - Core simulation engine and data types
- **React 19** - Reactive analytical dashboard and scenario state management
- **Vite** - Bundler and development server
- **Chart.js** / **react-chartjs-2** - Time series and comparative data visualizations

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

### Production Build

Type-check and build the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Limitations

- **Discrete-Step Toy Model**: The economic engine is designed for pedagogical demonstration, scenario exploration, and comparative analysis. It is not an empirical econometric or DSGE (Dynamic Stochastic General Equilibrium) model.
- **Client-Side Execution**: All computation runs synchronously in the browser. Large scenario step counts (>200 steps) or high country counts may impact UI responsiveness.
- **3-Commodity Barter Settlement**: The trade engine models three physical commodities (Food, Energy, Materials) settled against national treasuries. It does not model floating foreign exchange currency markets, central bank reserve currencies, or international bond markets.
- **Heuristic Feedback Autopilot**: The policy autopilot uses simple proportional error feedback rules to adjust tax and spending levers. It does not use reinforcement learning or machine learning optimization.

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full pipeline flow, mathematical formulation references, and architectural components.
