# Architecture Notes

## Core flow

1. `src/App.tsx` stores scenario configuration and selected UI state.
2. `simulateEconomy` in `src/simulation/engine.ts` runs deterministic steps from the active scenario config.
3. Each step emits `WorldStepRecord` data: country metrics, trade routes, events, and insights.
4. UI components render controls, tables, and Chart.js trend views from the simulation result.

## Data model

- `CountryState` is the editable country configuration.
- `CountryStepRecord` is the per-step output used by charts and tables.
- `SimulationConfig` owns global controls like step count, seed, trade friction, event chance, migration sensitivity, interest rate, and price flexibility.

## Why seeded randomness matters

The custom RNG makes events reproducible. A scenario with the same seed and config should produce the same event sequence, which makes debugging and A/B comparison easier.

## Recommended next refactor

`App.tsx` is currently doing a lot: scenario state, derived summaries, update handlers, and dashboard rendering. The next maintainability win would be splitting it into:

- `ScenarioToolbar`
- `WorldSummaryCards`
- `CountryList`
- `ScenarioComparisonTable`
- `EventsTable`
- `TradeRoutesTable`
