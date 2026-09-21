# Architecture & Design

## Overview

World Economy Simulator is built around a deterministic, discrete-step simulation engine paired with a reactive analytical interface. The architecture separates computation (pure TypeScript functions) from presentation (React components).

```
src/
├── simulation/
│   ├── types.ts       # Domain interfaces, country state, step records, config
│   ├── engine.ts      # Deterministic step simulation, trade routing, shock generation
│   ├── formulas.ts    # Mathematical formulas for GDP, debt, sufficiency, migration
│   └── presets.ts     # Default country profiles, scenario presets, data validation
├── components/
│   ├── WorldNetworkView.tsx  # SVG network view of economies and trade routes
│   ├── TimelineBar.tsx       # Playback controls and step scrubbing
│   ├── CountryPanel.tsx      # Selected country policy, labor, trade, and resource editors
│   ├── GlobalTelemetry.tsx   # Top ribbon showing global totals and health indicators
│   ├── TrendsView.tsx        # Multi-metric historical trend charts and event log
│   ├── CompareView.tsx       # Side-by-side Scenario A/B divergence analysis
│   ├── WorldTrendChart.tsx   # Reusable Chart.js line visualization
│   └── NumberControl.tsx     # Range/number input pairing with bounds clamping
├── App.tsx                   # Top-level scenario state, simulation runner, view router
└── styles.css                # Dark analytical styling
```

## Simulation Pipeline

Each execution of `simulateEconomy` takes a `SimulationConfig` and runs `N` sequential steps:

1. **State Initialization**: Clones country states, allocates initial inventories, and seeds the PRNG.
2. **Production & Labor**: Computes sector outputs (agriculture, industry, services) based on labor distribution, infrastructure, and capital investments.
3. **Consumption & Deficits**: Evaluates population consumption needs against domestic inventory stocks.
4. **Bilateral Trade Routing**:
   - Deficit economies query trading partners in priority order.
   - Surplus economies export available goods subject to tariffs, transport loss, and trade barriers.
   - Financial balances (wealth and debt) update based on settled transactions.
5. **Economic Shocks**: Seeded stochastic events evaluate per step (supply crunches, embargoes, natural events).
6. **Macro Adjustments**: Updates inflation rates, interest payments on debt, happiness levels, and net migration flows between countries.
7. **Policy Autopilot**: If enabled, countries dynamically adjust tax rates or spending to approach target debt and happiness ratios.
8. **Record Generation**: Emits a `WorldStepRecord` capturing metrics, trade routes, active events, and diagnostics for that step.

## Reproducibility & Determinism

The simulation engine uses an integer-seeded xorshift RNG. Running a scenario with identical configuration and seed is strictly deterministic. This allows:
- Reliable debugging of edge conditions.
- Precise A/B comparison between Scenario A and Scenario B, where a single policy lever can be isolated against identical baseline conditions.
